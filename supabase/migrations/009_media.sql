-- RenPortal · mídia do perfil, capa, loja e colunas do catálogo.
-- Idempotente. O cliente não cola URL: o trigger só aceita preset ou o próprio arquivo.

alter table public.profiles add column if not exists banner_url text;
alter table public.profiles add column if not exists onboarded_at timestamptz;

alter table public.profiles drop constraint if exists profiles_avatar_len;
alter table public.profiles add constraint profiles_avatar_len
  check (avatar_url is null or char_length(avatar_url) <= 1000);

alter table public.profiles drop constraint if exists profiles_banner_len;
alter table public.profiles add constraint profiles_banner_len
  check (banner_url is null or char_length(banner_url) <= 1000);

grant update (banner_url, onboarded_at) on table public.profiles to authenticated;

alter table public.games add column if not exists version text;
alter table public.games add column if not exists web_url text;

alter table public.games drop constraint if exists games_web_path_len;
alter table public.games alter column web_path drop not null;
alter table public.games add constraint games_web_path_len
  check (web_path is null or char_length(web_path) between 1 and 500);

alter table public.games drop constraint if exists games_version_len;
alter table public.games add constraint games_version_len
  check (version is null or char_length(version) <= 40);

alter table public.games drop constraint if exists games_web_url_len;
alter table public.games add constraint games_web_url_len
  check (web_url is null or char_length(web_url) <= 1000);

alter table public.shop_items add column if not exists image_url text;
alter table public.shop_items drop constraint if exists shop_items_image_len;
alter table public.shop_items add constraint shop_items_image_len
  check (image_url is null or char_length(image_url) <= 1000);

-- ---------------------------------------------------------------------------
-- Avatar: preset:nome ou URL pública do próprio arquivo em avatars/<uid>/...
-- Banner: só o arquivo da própria conta.
-- ---------------------------------------------------------------------------
create or replace function public.profile_media_ok(p_url text, p_kind text)
returns boolean
language plpgsql
stable
as $$
declare
  v_uid text;
begin
  if p_url is null or btrim(p_url) = '' then
    return true;
  end if;

  if p_kind = 'avatar' and p_url ~ '^preset:[a-z0-9-]{1,32}$' then
    return true;
  end if;

  v_uid := auth.uid()::text;
  if v_uid is null then
    return false;
  end if;

  return p_url ~ (
    '^https://[A-Za-z0-9.-]+/storage/v1/object/public/avatars/' || v_uid || '/[A-Za-z0-9._-]+$'
  );
end;
$$;

revoke all on function public.profile_media_ok(text, text) from public, anon, authenticated;
grant execute on function public.profile_media_ok(text, text) to authenticated, service_role;

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

  new.avatar_url := nullif(btrim(new.avatar_url), '');
  new.banner_url := nullif(btrim(new.banner_url), '');

  if not public.profile_media_ok(new.avatar_url, 'avatar') then
    raise exception 'Avatar precisa ser um dos prontos ou um arquivo da sua conta';
  end if;

  if not public.profile_media_ok(new.banner_url, 'banner') then
    raise exception 'O banner precisa ser um arquivo da sua conta';
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Buckets. Leitura pública. Escrita do avatar só na pasta do usuário.
-- Capa e imagem da loja só admin.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('avatars', 'avatars', true, 2097152, array['image/jpeg', 'image/png', 'image/webp', 'image/gif']),
  ('covers', 'covers', true, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/gif']),
  ('shop-assets', 'shop-assets', true, 2097152, array['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists avatars_public_read on storage.objects;
create policy avatars_public_read
  on storage.objects
  for select
  to anon, authenticated
  using (bucket_id = 'avatars');

drop policy if exists avatars_insert_own on storage.objects;
create policy avatars_insert_own
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists avatars_update_own on storage.objects;
create policy avatars_update_own
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists avatars_delete_own on storage.objects;
create policy avatars_delete_own
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists covers_public_read on storage.objects;
create policy covers_public_read
  on storage.objects
  for select
  to anon, authenticated
  using (bucket_id = 'covers');

drop policy if exists covers_admin_insert on storage.objects;
create policy covers_admin_insert
  on storage.objects
  for insert
  to authenticated
  with check (bucket_id = 'covers' and public.is_admin());

drop policy if exists covers_admin_update on storage.objects;
create policy covers_admin_update
  on storage.objects
  for update
  to authenticated
  using (bucket_id = 'covers' and public.is_admin())
  with check (bucket_id = 'covers' and public.is_admin());

drop policy if exists covers_admin_delete on storage.objects;
create policy covers_admin_delete
  on storage.objects
  for delete
  to authenticated
  using (bucket_id = 'covers' and public.is_admin());

drop policy if exists shop_assets_public_read on storage.objects;
create policy shop_assets_public_read
  on storage.objects
  for select
  to anon, authenticated
  using (bucket_id = 'shop-assets');

drop policy if exists shop_assets_admin_insert on storage.objects;
create policy shop_assets_admin_insert
  on storage.objects
  for insert
  to authenticated
  with check (bucket_id = 'shop-assets' and public.is_admin());

drop policy if exists shop_assets_admin_update on storage.objects;
create policy shop_assets_admin_update
  on storage.objects
  for update
  to authenticated
  using (bucket_id = 'shop-assets' and public.is_admin())
  with check (bucket_id = 'shop-assets' and public.is_admin());

drop policy if exists shop_assets_admin_delete on storage.objects;
create policy shop_assets_admin_delete
  on storage.objects
  for delete
  to authenticated
  using (bucket_id = 'shop-assets' and public.is_admin());
