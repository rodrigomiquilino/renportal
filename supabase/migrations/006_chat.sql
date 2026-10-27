-- RenPortal · amigos e chat
-- Leitura e escrita só entre participantes. Helpers security definer
-- evitam recursão de RLS entre messages e conversation_participants.

create table public.friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles (id) on delete cascade,
  addressee_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  constraint friendships_status_check check (status in ('pending', 'accepted', 'blocked')),
  constraint friendships_not_self check (requester_id <> addressee_id),
  constraint friendships_pair_directed unique (requester_id, addressee_id)
);

create unique index friendships_undirected_pair
  on public.friendships (least(requester_id, addressee_id), greatest(requester_id, addressee_id));

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now()
);

create table public.conversation_participants (
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  primary key (conversation_id, user_id)
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  content text not null,
  reply_to uuid references public.messages (id) on delete set null,
  edited_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  constraint messages_content_len check (char_length(content) between 1 and 2000)
);

create index messages_conversation_created_idx
  on public.messages (conversation_id, created_at desc);

alter table public.friendships enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_participants enable row level security;
alter table public.messages enable row level security;

create or replace function public.is_conversation_participant(p_conversation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.conversation_participants
    where conversation_id = p_conversation_id
      and user_id = auth.uid()
  );
$$;

revoke all on function public.is_conversation_participant(uuid) from public, anon;
grant execute on function public.is_conversation_participant(uuid) to authenticated, service_role;

create or replace function public.enforce_friendship_update()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.requester_id <> old.requester_id or new.addressee_id <> old.addressee_id then
    raise exception 'Par imutável';
  end if;

  if auth.uid() is null then
    return new;
  end if;

  if auth.uid() <> old.requester_id
     and auth.uid() <> old.addressee_id
     and not public.is_admin() then
    raise exception 'Sem permissão';
  end if;

  if new.status = 'accepted'
     and old.status = 'pending'
     and auth.uid() <> old.addressee_id
     and not public.is_admin() then
    raise exception 'Apenas o destinatário pode aceitar';
  end if;

  if new.status = 'pending' and old.status <> 'pending' then
    raise exception 'Não dá para reabrir este pedido';
  end if;

  return new;
end;
$$;

create trigger friendships_enforce_update
  before update on public.friendships
  for each row
  execute function public.enforce_friendship_update();

create policy friendships_select
  on public.friendships
  for select
  to authenticated
  using (requester_id = auth.uid() or addressee_id = auth.uid() or public.is_admin());

create policy friendships_insert
  on public.friendships
  for insert
  to authenticated
  with check (requester_id = auth.uid() and status = 'pending');

create policy friendships_update
  on public.friendships
  for update
  to authenticated
  using (requester_id = auth.uid() or addressee_id = auth.uid() or public.is_admin())
  with check (requester_id = auth.uid() or addressee_id = auth.uid() or public.is_admin());

create policy friendships_delete
  on public.friendships
  for delete
  to authenticated
  using (
    public.is_admin()
    or requester_id = auth.uid()
    or addressee_id = auth.uid()
  );

create policy conversations_select
  on public.conversations
  for select
  to authenticated
  using (public.is_conversation_participant(id) or public.is_admin());

create policy participants_select
  on public.conversation_participants
  for select
  to authenticated
  using (public.is_conversation_participant(conversation_id) or public.is_admin());

create or replace function public.protect_message_row()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.reply_to is not null then
    if not exists (
      select 1 from public.messages
      where id = new.reply_to
        and conversation_id = new.conversation_id
    ) then
      raise exception 'A resposta precisa ser da mesma conversa';
    end if;
  end if;

  if tg_op = 'UPDATE' then
    new.id := old.id;
    new.conversation_id := old.conversation_id;
    new.sender_id := old.sender_id;
    new.created_at := old.created_at;
    new.reply_to := old.reply_to;

    if old.deleted_at is not null then
      return old;
    end if;

    if new.deleted_at is not null then
      new.deleted_at := now();
      return new;
    end if;

    if new.content is distinct from old.content then
      new.edited_at := now();
    end if;
  end if;

  return new;
end;
$$;

create trigger messages_protect
  before insert or update on public.messages
  for each row
  execute function public.protect_message_row();

create policy messages_select
  on public.messages
  for select
  to authenticated
  using (public.is_conversation_participant(conversation_id) or public.is_admin());

create policy messages_insert
  on public.messages
  for insert
  to authenticated
  with check (
    sender_id = auth.uid()
    and public.is_conversation_participant(conversation_id)
  );

create policy messages_update_own
  on public.messages
  for update
  to authenticated
  using (sender_id = auth.uid() or public.is_admin())
  with check (sender_id = auth.uid() or public.is_admin());

-- Abre (ou reaproveita) uma conversa 1:1 entre amigos aceitos.
create or replace function public.create_direct_conversation(p_other uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_id uuid;
begin
  if v_me is null then
    raise exception 'Não autenticado';
  end if;

  if p_other = v_me then
    raise exception 'Conversa inválida';
  end if;

  if not exists (
    select 1
    from public.friendships
    where status = 'accepted'
      and (
        (requester_id = v_me and addressee_id = p_other)
        or (requester_id = p_other and addressee_id = v_me)
      )
  ) then
    raise exception 'Vocês ainda não são amigos';
  end if;

  select cp1.conversation_id
  into v_id
  from public.conversation_participants cp1
  join public.conversation_participants cp2
    on cp1.conversation_id = cp2.conversation_id
  where cp1.user_id = v_me
    and cp2.user_id = p_other
    and (
      select count(*)
      from public.conversation_participants cp
      where cp.conversation_id = cp1.conversation_id
    ) = 2
  limit 1;

  if v_id is not null then
    return v_id;
  end if;

  insert into public.conversations default values
  returning id into v_id;

  insert into public.conversation_participants (conversation_id, user_id)
  values (v_id, v_me), (v_id, p_other);

  return v_id;
end;
$$;

revoke all on function public.create_direct_conversation(uuid) from public, anon;
grant execute on function public.create_direct_conversation(uuid) to authenticated, service_role;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'friendships'
  ) then
    alter publication supabase_realtime add table public.friendships;
  end if;
end $$;
