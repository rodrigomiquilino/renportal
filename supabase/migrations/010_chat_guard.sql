-- RenPortal · limpeza do chat e limite de ritmo.
-- A policy continua decidindo quem fala. Aqui a mensagem deixa de carregar HTML
-- e um usuário não enche a conversa nem a lista de pedidos.

create table if not exists public.rate_limits (
  user_id uuid not null references auth.users (id) on delete cascade,
  bucket text not null,
  window_start timestamptz not null default now(),
  hits integer not null default 0,
  primary key (user_id, bucket)
);

alter table public.rate_limits enable row level security;
revoke all on table public.rate_limits from anon, authenticated;

create or replace function public.consume_rate_limit(
  p_user uuid,
  p_bucket text,
  p_max integer,
  p_window_seconds integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hits integer;
begin
  if p_user is null then
    raise exception 'Não autorizado';
  end if;

  if auth.uid() is not null and p_user is distinct from auth.uid() then
    raise exception 'Não autorizado';
  end if;

  insert into public.rate_limits (user_id, bucket, window_start, hits)
  values (p_user, p_bucket, now(), 1)
  on conflict (user_id, bucket) do update
    set
      window_start = case
        when public.rate_limits.window_start < now() - make_interval(secs => p_window_seconds) then now()
        else public.rate_limits.window_start
      end,
      hits = case
        when public.rate_limits.window_start < now() - make_interval(secs => p_window_seconds) then 1
        else public.rate_limits.hits + 1
      end
  returning hits into v_hits;

  if v_hits > p_max then
    raise exception 'Muitas ações em pouco tempo. Espere um instante.';
  end if;
end;
$$;

revoke all on function public.consume_rate_limit(uuid, text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_rate_limit(uuid, text, integer, integer) to authenticated;

create or replace function public.protect_message_row()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.content := regexp_replace(coalesce(new.content, ''), '<[^>]*>', '', 'g');
  new.content := regexp_replace(new.content, '[[:cntrl:]]', '', 'g');
  new.content := btrim(new.content);
  new.content := left(new.content, 2000);

  if char_length(new.content) < 1 then
    raise exception 'Mensagem vazia';
  end if;

  if new.reply_to is not null then
    if not exists (
      select 1 from public.messages
      where id = new.reply_to
        and conversation_id = new.conversation_id
    ) then
      raise exception 'A resposta precisa ser da mesma conversa';
    end if;
  end if;

  if tg_op = 'INSERT' then
    perform public.consume_rate_limit(auth.uid(), 'chat', 20, 60);
    return new;
  end if;

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

  return new;
end;
$$;

create or replace function public.limit_friend_request()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' and new.requester_id = auth.uid() then
    perform public.consume_rate_limit(new.requester_id, 'friend', 15, 3600);
  end if;
  return new;
end;
$$;

drop trigger if exists friendships_rate_limit on public.friendships;
create trigger friendships_rate_limit
  before insert on public.friendships
  for each row
  execute function public.limit_friend_request();
