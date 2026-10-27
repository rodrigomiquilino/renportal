-- RenPortal · conta, privacidade, conteúdo adulto, bloqueio e denúncia.
-- Idempotente. 009 e 010 já estão aplicadas; esta é a próxima.

alter table public.profiles add column if not exists show_adult boolean not null default false;
alter table public.profiles add column if not exists profile_visibility text not null default 'public';
alter table public.profiles add column if not exists show_activity boolean not null default true;
alter table public.profiles add column if not exists allow_friend_requests boolean not null default true;

alter table public.games add column if not exists content_rating text not null default 'everyone';

do $$
begin
  alter table public.profiles
    add constraint profiles_visibility_check
    check (profile_visibility in ('public', 'members', 'private'));
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter table public.games
    add constraint games_content_rating_check
    check (content_rating in ('everyone', 'mature'));
exception
  when duplicate_object then null;
end $$;

grant update (
  show_adult,
  profile_visibility,
  show_activity,
  allow_friend_requests
) on table public.profiles to authenticated;

-- Visitante vê só o público. Membro vê público e "membros". Privado é só o dono e o admin.
drop policy if exists profiles_select_public on public.profiles;
drop policy if exists profiles_select_visible on public.profiles;
create policy profiles_select_visible
  on public.profiles
  for select
  to anon, authenticated
  using (
    id = auth.uid()
    or public.is_admin()
    or profile_visibility = 'public'
    or (profile_visibility = 'members' and auth.uid() is not null)
  );

-- Jogo adulto some do catálogo e do endereço direto até a pessoa ligar a opção.
drop policy if exists games_select_published on public.games;
create policy games_select_published
  on public.games
  for select
  to anon, authenticated
  using (
    public.is_admin()
    or (
      published = true
      and (
        content_rating = 'everyone'
        or exists (
          select 1
          from public.profiles
          where id = auth.uid()
            and show_adult = true
        )
      )
    )
  );

-- A checagem de usuário único não pode depender da visibilidade do perfil.
create or replace function public.username_taken(p_username text, p_except uuid default null)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where username = lower(btrim(coalesce(p_username, '')))
      and (p_except is null or id <> p_except)
  );
$$;

revoke all on function public.username_taken(text, uuid) from public;
grant execute on function public.username_taken(text, uuid) to anon, authenticated, service_role;

create table if not exists public.user_blocks (
  blocker_id uuid not null references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  constraint user_blocks_not_self check (blocker_id <> blocked_id)
);

alter table public.user_blocks enable row level security;
revoke all on table public.user_blocks from anon, authenticated;
grant select, insert, delete on table public.user_blocks to authenticated;

drop policy if exists user_blocks_select_own on public.user_blocks;
create policy user_blocks_select_own
  on public.user_blocks
  for select
  to authenticated
  using (blocker_id = auth.uid() or public.is_admin());

drop policy if exists user_blocks_insert_own on public.user_blocks;
create policy user_blocks_insert_own
  on public.user_blocks
  for insert
  to authenticated
  with check (blocker_id = auth.uid());

drop policy if exists user_blocks_delete_own on public.user_blocks;
create policy user_blocks_delete_own
  on public.user_blocks
  for delete
  to authenticated
  using (blocker_id = auth.uid());

-- Vale nos dois sentidos. Também lê o status antigo "blocked" da amizade.
create or replace function public.is_blocked(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_blocks
    where (blocker_id = a and blocked_id = b)
       or (blocker_id = b and blocked_id = a)
  )
  or exists (
    select 1
    from public.friendships
    where status = 'blocked'
      and (
        (requester_id = a and addressee_id = b)
        or (requester_id = b and addressee_id = a)
      )
  );
$$;

revoke all on function public.is_blocked(uuid, uuid) from public, anon;
grant execute on function public.is_blocked(uuid, uuid) to authenticated, service_role;

create or replace function public.enforce_friendship_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_blocked(new.requester_id, new.addressee_id) then
    raise exception 'Não foi possível enviar o pedido';
  end if;

  if exists (
    select 1
    from public.profiles
    where id = new.addressee_id
      and allow_friend_requests = false
  ) then
    raise exception 'Esta pessoa não aceita pedidos de amizade';
  end if;

  return new;
end;
$$;

drop trigger if exists friendships_guard_insert on public.friendships;
create trigger friendships_guard_insert
  before insert on public.friendships
  for each row
  execute function public.enforce_friendship_insert();

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

  if public.is_blocked(v_me, p_other) then
    raise exception 'Não foi possível abrir a conversa';
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

create or replace function public.conversation_has_block(p_conversation uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.conversation_participants other_person
    where other_person.conversation_id = p_conversation
      and other_person.user_id is distinct from auth.uid()
      and public.is_blocked(auth.uid(), other_person.user_id)
  );
$$;

revoke all on function public.conversation_has_block(uuid) from public, anon;
grant execute on function public.conversation_has_block(uuid) to authenticated, service_role;

drop policy if exists messages_insert on public.messages;
create policy messages_insert
  on public.messages
  for insert
  to authenticated
  with check (
    sender_id = auth.uid()
    and public.is_conversation_participant(conversation_id)
    and not public.conversation_has_block(conversation_id)
  );

create table if not exists public.user_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  target_id uuid not null references public.profiles (id) on delete cascade,
  reason text not null,
  details text,
  created_at timestamptz not null default now(),
  constraint user_reports_reason_check check (reason in ('spam', 'harassment', 'adult', 'other')),
  constraint user_reports_details_len check (details is null or char_length(details) <= 500),
  constraint user_reports_not_self check (reporter_id <> target_id)
);

alter table public.user_reports enable row level security;
revoke all on table public.user_reports from anon, authenticated;
grant insert on table public.user_reports to authenticated;
grant select on table public.user_reports to authenticated;

drop policy if exists user_reports_insert_own on public.user_reports;
create policy user_reports_insert_own
  on public.user_reports
  for insert
  to authenticated
  with check (reporter_id = auth.uid());

drop policy if exists user_reports_select_admin on public.user_reports;
create policy user_reports_select_admin
  on public.user_reports
  for select
  to authenticated
  using (public.is_admin());

create or replace function public.protect_user_report()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.details := nullif(left(btrim(regexp_replace(coalesce(new.details, ''), '<[^>]*>', '', 'g')), 500), '');
  perform public.consume_rate_limit(auth.uid(), 'report', 5, 86400);
  return new;
end;
$$;

drop trigger if exists user_reports_protect on public.user_reports;
create trigger user_reports_protect
  before insert on public.user_reports
  for each row
  execute function public.protect_user_report();
