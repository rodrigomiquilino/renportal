-- RenPortal · módulo base
-- Perfis, criação automática no cadastro, nível e RLS.
-- XP, nível, papel e tempo de jogo não são graváveis pelo cliente.

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null,
  display_name text not null,
  avatar_url text,
  xp bigint not null default 0,
  level integer not null default 1,
  total_play_time_seconds bigint not null default 0,
  active_title text,
  active_border text,
  active_effect text,
  role text not null default 'user',
  created_at timestamptz not null default now(),
  constraint profiles_username_unique unique (username),
  constraint profiles_username_format check (username ~ '^[a-z0-9_]{3,24}$'),
  constraint profiles_display_name_len check (char_length(display_name) between 1 and 40),
  constraint profiles_avatar_len check (avatar_url is null or char_length(avatar_url) <= 500),
  constraint profiles_xp_nonnegative check (xp >= 0),
  constraint profiles_level_positive check (level >= 1),
  constraint profiles_play_time_nonnegative check (total_play_time_seconds >= 0),
  constraint profiles_role_check check (role in ('user', 'admin'))
);

comment on table public.profiles is 'Perfil público do jogador. XP, nível, papel e tempo de jogo só mudam por função security definer ou service role.';

create index profiles_xp_idx on public.profiles (xp desc);

alter table public.profiles enable row level security;

-- Leitura pública: ranking, chat e páginas de perfil.
create policy profiles_select_public
  on public.profiles
  for select
  to anon, authenticated
  using (true);

-- O dono atualiza a própria linha. Colunas críticas são revertidas no trigger
-- e também ficam de fora do GRANT de UPDATE.
create policy profiles_update_own
  on public.profiles
  for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

revoke all on table public.profiles from anon, authenticated;
grant select on table public.profiles to anon, authenticated;
grant update (
  display_name,
  avatar_url,
  username,
  active_title,
  active_border,
  active_effect
) on table public.profiles to authenticated;

-- ---------------------------------------------------------------------------
-- Proteção de colunas críticas.
-- SECURITY INVOKER de propósito: dentro de um trigger SECURITY DEFINER,
-- current_user seria sempre o dono e a trava nunca pegaria o cliente.
-- postgres / supabase_admin (SQL Editor) e service_role (Edge Functions)
-- passam. Funções security definer também rodam como postgres.
-- ---------------------------------------------------------------------------
create or replace function public.protect_profile_columns()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user in ('postgres', 'supabase_admin', 'service_role') then
    return new;
  end if;

  if current_setting('renportal.trusted_write', true) = 'on' then
    return new;
  end if;

  new.id := old.id;
  new.xp := old.xp;
  new.level := old.level;
  new.role := old.role;
  new.total_play_time_seconds := old.total_play_time_seconds;
  new.created_at := old.created_at;

  new.username := lower(trim(new.username));
  if new.display_name is null or char_length(trim(new.display_name)) = 0 then
    new.display_name := old.display_name;
  else
    new.display_name := trim(new.display_name);
  end if;

  return new;
end;
$$;

create trigger profiles_protect_columns
  before update on public.profiles
  for each row
  execute function public.protect_profile_columns();

-- ---------------------------------------------------------------------------
-- true quando o JWT atual pertence a um admin.
-- SECURITY DEFINER para as policies não reentrarem na RLS de profiles.
-- ---------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
  );
$$;

revoke all on function public.is_admin() from public, anon, authenticated;
grant execute on function public.is_admin() to anon, authenticated, service_role;

comment on function public.is_admin() is 'Helper de RLS. Não consulta profiles pela policy do chamador.';

-- ---------------------------------------------------------------------------
-- level = greatest(1, floor(sqrt(xp / 40.0))::int + 1)
-- Só service_role (as Edge Functions) pode chamar.
-- ---------------------------------------------------------------------------
create or replace function public.recalculate_level(p_user_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_xp bigint;
  v_level integer;
begin
  perform set_config('renportal.trusted_write', 'on', true);

  select xp into v_xp
  from public.profiles
  where id = p_user_id;

  if not found then
    raise exception 'Perfil não encontrado';
  end if;

  v_level := greatest(1, floor(sqrt(v_xp / 40.0))::int + 1);

  update public.profiles
    set level = v_level
    where id = p_user_id;

  return v_level;
end;
$$;

revoke all on function public.recalculate_level(uuid) from public, anon, authenticated;
grant execute on function public.recalculate_level(uuid) to service_role;

comment on function public.recalculate_level(uuid) is 'Recalcula profiles.level a partir do XP. level = greatest(1, floor(sqrt(xp/40))+1).';

-- ---------------------------------------------------------------------------
-- Perfil nasce junto com o usuário do Auth.
-- username vem de raw_user_meta_data; senão, jogador_<8 chars do id>.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_raw text;
  v_username text;
  v_display text;
  v_n integer := 0;
begin
  v_raw := lower(coalesce(new.raw_user_meta_data ->> 'username', ''));
  v_raw := regexp_replace(v_raw, '[^a-z0-9_]', '', 'g');

  if char_length(v_raw) < 3 then
    v_raw := 'jogador_' || substr(replace(new.id::text, '-', ''), 1, 8);
  end if;

  v_raw := substr(v_raw, 1, 24);
  v_username := v_raw;

  while exists (select 1 from public.profiles where username = v_username) loop
    v_n := v_n + 1;
    v_username := substr(v_raw, 1, 18) || '_' || v_n::text;
  end loop;

  v_display := nullif(trim(coalesce(new.raw_user_meta_data ->> 'display_name', '')), '');
  if v_display is null then
    v_display := v_username;
  end if;
  v_display := substr(v_display, 1, 40);

  perform set_config('renportal.trusted_write', 'on', true);

  insert into public.profiles (id, username, display_name)
  values (new.id, v_username, v_display);

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();
