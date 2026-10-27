-- RenPortal · doações de XP
-- O cliente não mexe no saldo. donate_xp debita, credita, grava o presente
-- e dois lançamentos no extrato, e recalcula o nível dos dois.

create table public.donations (
  id uuid primary key default gen_random_uuid(),
  from_user uuid not null references public.profiles (id) on delete cascade,
  to_user uuid not null references public.profiles (id) on delete cascade,
  amount_xp integer not null,
  message text,
  created_at timestamptz not null default now(),
  constraint donations_amount_positive check (amount_xp > 0),
  constraint donations_not_self check (from_user <> to_user),
  constraint donations_message_len check (message is null or char_length(message) <= 280)
);

comment on table public.donations is 'Presente de XP. Limites (10–500, teto diário 2000 no fuso de São Paulo) ficam em donate_xp.';

create index donations_from_idx on public.donations (from_user, created_at desc);
create index donations_to_idx on public.donations (to_user, created_at desc);

alter table public.donations enable row level security;

create policy donations_select_participants
  on public.donations
  for select
  to authenticated
  using (from_user = auth.uid() or to_user = auth.uid() or public.is_admin());

revoke all on table public.donations from anon, authenticated;
grant select on table public.donations to authenticated;

create or replace function public.donate_xp(
  p_from uuid,
  p_to uuid,
  p_amount integer,
  p_message text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_min constant integer := 10;
  v_max constant integer := 500;
  v_daily constant integer := 2000;
  v_start timestamptz;
  v_today integer;
  v_updated integer;
  v_from_xp bigint;
  v_to_xp bigint;
  v_from_level integer;
  v_to_level integer;
  v_id uuid;
  v_message text;
begin
  perform set_config('renportal.trusted_write', 'on', true);

  if p_from = p_to then
    return jsonb_build_object('ok', false, 'error', 'Você não pode presentear a si mesmo');
  end if;

  if p_amount is null or p_amount < v_min or p_amount > v_max then
    return jsonb_build_object('ok', false, 'error', 'O presente fica entre 10 e 500 XP');
  end if;

  if not exists (select 1 from public.profiles where id = p_from)
     or not exists (select 1 from public.profiles where id = p_to) then
    return jsonb_build_object('ok', false, 'error', 'Jogador não encontrado');
  end if;

  -- Trava os dois perfis sempre na mesma ordem para não cruzar com outra doação.
  if p_from < p_to then
    perform 1 from public.profiles where id = p_from for update;
    perform 1 from public.profiles where id = p_to for update;
  else
    perform 1 from public.profiles where id = p_to for update;
    perform 1 from public.profiles where id = p_from for update;
  end if;

  v_start := (date_trunc('day', now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo');

  select coalesce(sum(amount_xp), 0)::int
  into v_today
  from public.donations
  where from_user = p_from
    and created_at >= v_start;

  if v_today + p_amount > v_daily then
    return jsonb_build_object('ok', false, 'error', 'Limite diário de 2000 XP');
  end if;

  update public.profiles
    set xp = xp - p_amount
    where id = p_from
      and xp >= p_amount;

  get diagnostics v_updated = row_count;
  if v_updated = 0 then
    return jsonb_build_object('ok', false, 'error', 'XP insuficiente');
  end if;

  update public.profiles
    set xp = xp + p_amount
    where id = p_to;

  v_message := nullif(trim(coalesce(p_message, '')), '');

  insert into public.donations (from_user, to_user, amount_xp, message)
  values (p_from, p_to, p_amount, v_message)
  returning id into v_id;

  insert into public.xp_log (user_id, amount, source, reference_id)
  values
    (p_from, -p_amount, 'donation_sent', v_id::text),
    (p_to, p_amount, 'donation_received', v_id::text);

  v_from_level := public.recalculate_level(p_from);
  v_to_level := public.recalculate_level(p_to);
  select xp into v_from_xp from public.profiles where id = p_from;
  select xp into v_to_xp from public.profiles where id = p_to;

  return jsonb_build_object(
    'ok', true,
    'donation_id', v_id,
    'from_xp', v_from_xp,
    'to_xp', v_to_xp,
    'from_level', v_from_level,
    'to_level', v_to_level
  );
end;
$$;

revoke all on function public.donate_xp(uuid, uuid, integer, text) from public, anon, authenticated;
grant execute on function public.donate_xp(uuid, uuid, integer, text) to service_role;
