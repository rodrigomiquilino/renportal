-- RenPortal · progressão
-- Sessões e extrato de XP. O cliente só lê as próprias linhas.
-- Tempo, XP e nível mudam em apply_play_tick (security definer), chamada pela service role.

create table public.play_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  game_id uuid not null references public.games (id) on delete cascade,
  started_at timestamptz not null default now(),
  last_heartbeat_at timestamptz not null default now(),
  ended_at timestamptz,
  awarded_seconds integer not null default 0,
  status text not null default 'active',
  constraint play_sessions_status_check check (status in ('active', 'ended', 'flagged')),
  constraint play_sessions_awarded_nonnegative check (awarded_seconds >= 0)
);

comment on table public.play_sessions is 'Uma partida no navegador. awarded_seconds só cresce por apply_play_tick.';

create index play_sessions_user_recent_idx
  on public.play_sessions (user_id, last_heartbeat_at desc);

create index play_sessions_active_idx
  on public.play_sessions (user_id)
  where status = 'active';

create table public.xp_log (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  amount integer not null,
  source text not null,
  reference_id text,
  created_at timestamptz not null default now()
);

comment on table public.xp_log is 'Extrato. source=play_time para minutos jogados. amount pode ser negativo (compra, doação).';

create index xp_log_user_created_idx on public.xp_log (user_id, created_at desc);

alter table public.play_sessions enable row level security;
alter table public.xp_log enable row level security;

create policy play_sessions_select_own
  on public.play_sessions
  for select
  to authenticated
  using (user_id = auth.uid() or public.is_admin());

create policy xp_log_select_own
  on public.xp_log
  for select
  to authenticated
  using (user_id = auth.uid() or public.is_admin());

revoke all on table public.play_sessions from anon, authenticated;
grant select on table public.play_sessions to authenticated;

revoke all on table public.xp_log from anon, authenticated;
grant select on table public.xp_log to authenticated;

grant usage, select on sequence public.xp_log_id_seq to service_role;

-- ---------------------------------------------------------------------------
-- Um tick de sessão.
-- p_close = false: heartbeat. Só premia se o intervalo está entre 15 e 90s.
-- p_close = true: encerra e consolida o intervalo válido que ainda restava.
-- Menos de 15s no heartbeat, sessão concorrente ou buraco > 10 min: flagged.
-- ---------------------------------------------------------------------------
create or replace function public.apply_play_tick(
  p_session_id uuid,
  p_user_id uuid,
  p_close boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.play_sessions%rowtype;
  v_now timestamptz := now();
  v_elapsed integer;
  v_award integer := 0;
  v_xp_gain integer := 0;
  v_concurrent integer;
  v_total integer;
  v_xp bigint;
  v_level integer;
  v_status text;
begin
  perform set_config('renportal.trusted_write', 'on', true);

  -- Sempre trava o perfil antes da sessão, na mesma ordem de start_play_session.
  perform 1
  from public.profiles
  where id = p_user_id
  for update;

  select *
  into v_session
  from public.play_sessions
  where id = p_session_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'Sessão não encontrada');
  end if;

  if v_session.user_id <> p_user_id then
    return jsonb_build_object('ok', false, 'error', 'Sessão não pertence a você');
  end if;

  if v_session.status <> 'active' then
    return jsonb_build_object('ok', false, 'error', 'Sessão não está ativa', 'status', v_session.status);
  end if;

  select count(*)::int
  into v_concurrent
  from public.play_sessions
  where user_id = p_user_id
    and status = 'active'
    and id <> p_session_id;

  if not p_close and v_concurrent > 0 then
    update public.play_sessions
      set status = 'flagged',
          last_heartbeat_at = v_now
      where id = p_session_id;

    return jsonb_build_object('ok', false, 'flagged', true, 'error', 'Há outra sessão ativa ao mesmo tempo');
  end if;

  v_elapsed := greatest(0, floor(extract(epoch from (v_now - v_session.last_heartbeat_at)))::int);

  if not p_close and v_elapsed < 15 then
    update public.play_sessions
      set status = 'flagged',
          last_heartbeat_at = v_now
      where id = p_session_id;

    return jsonb_build_object('ok', false, 'flagged', true, 'error', 'Heartbeat rápido demais', 'elapsed', v_elapsed);
  end if;

  if not p_close and v_elapsed > 90 then
    if v_elapsed > 600 then
      update public.play_sessions
        set status = 'flagged',
            last_heartbeat_at = v_now
        where id = p_session_id;

      return jsonb_build_object('ok', false, 'flagged', true, 'error', 'Intervalo longo demais', 'elapsed', v_elapsed);
    end if;

    update public.play_sessions
      set last_heartbeat_at = v_now
      where id = p_session_id;

    return jsonb_build_object(
      'ok', true,
      'awarded_seconds', 0,
      'xp_gain', 0,
      'elapsed', v_elapsed,
      'skipped', true,
      'status', 'active',
      'total_awarded', v_session.awarded_seconds
    );
  end if;

  if v_elapsed between 15 and 90 then
    v_award := least(v_elapsed, 90);
  end if;

  if v_award > 0
     and (v_session.awarded_seconds + v_award)
         > (floor(extract(epoch from (v_now - v_session.started_at)))::int + 5) then
    update public.play_sessions
      set status = 'flagged',
          last_heartbeat_at = v_now
      where id = p_session_id;

    return jsonb_build_object('ok', false, 'flagged', true, 'error', 'Tempo acumulado passou do relógio');
  end if;

  v_total := v_session.awarded_seconds + v_award;
  v_xp_gain := floor(v_total / 60.0)::int - floor(v_session.awarded_seconds / 60.0)::int;
  v_status := case when p_close then 'ended' else 'active' end;

  update public.play_sessions
    set awarded_seconds = v_total,
        last_heartbeat_at = v_now,
        ended_at = case when p_close then v_now else ended_at end,
        status = v_status
    where id = p_session_id;

  if v_award > 0 then
    update public.profiles
      set total_play_time_seconds = total_play_time_seconds + v_award
      where id = p_user_id;
  end if;

  if v_xp_gain > 0 then
    update public.profiles
      set xp = xp + v_xp_gain
      where id = p_user_id;

    insert into public.xp_log (user_id, amount, source, reference_id)
    values (p_user_id, v_xp_gain, 'play_time', p_session_id::text);

    v_level := public.recalculate_level(p_user_id);
  else
    select level into v_level from public.profiles where id = p_user_id;
  end if;

  select xp into v_xp from public.profiles where id = p_user_id;

  return jsonb_build_object(
    'ok', true,
    'awarded_seconds', v_award,
    'xp_gain', v_xp_gain,
    'elapsed', v_elapsed,
    'total_awarded', v_total,
    'status', v_status,
    'xp', v_xp,
    'level', v_level
  );
end;
$$;

revoke all on function public.apply_play_tick(uuid, uuid, boolean) from public, anon, authenticated;
grant execute on function public.apply_play_tick(uuid, uuid, boolean) to service_role;

-- Encerra sessões ativas anteriores (consolidando o tempo válido) e abre outra.
create or replace function public.start_play_session(p_user_id uuid, p_game_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_other uuid;
  v_id uuid;
begin
  if not exists (select 1 from public.profiles where id = p_user_id) then
    return jsonb_build_object('ok', false, 'error', 'Perfil não encontrado');
  end if;

  if not exists (select 1 from public.games where id = p_game_id and published = true) then
    return jsonb_build_object('ok', false, 'error', 'Jogo não encontrado');
  end if;

  perform 1
  from public.profiles
  where id = p_user_id
  for update;

  for v_other in
    select id
    from public.play_sessions
    where user_id = p_user_id
      and status = 'active'
  loop
    perform public.apply_play_tick(v_other, p_user_id, true);
  end loop;

  insert into public.play_sessions (user_id, game_id)
  values (p_user_id, p_game_id)
  returning id into v_id;

  return jsonb_build_object('ok', true, 'session_id', v_id);
end;
$$;

revoke all on function public.start_play_session(uuid, uuid) from public, anon, authenticated;
grant execute on function public.start_play_session(uuid, uuid) to service_role;
