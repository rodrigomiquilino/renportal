-- RenPortal · jogos
-- Catálogo público. Escrita só para admin (role no perfil).
-- Builds de desktop ficam no bucket game-builds; o cliente não escreve no Storage.

create table public.games (
  id uuid primary key default gen_random_uuid(),
  slug text not null,
  title text not null,
  description text,
  cover_url text,
  web_path text not null,
  windows_url text,
  mac_url text,
  linux_url text,
  file_size_mb numeric(10, 1),
  published boolean not null default true,
  created_at timestamptz not null default now(),
  constraint games_slug_unique unique (slug),
  constraint games_slug_format check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint games_title_len check (char_length(title) between 1 and 120),
  constraint games_description_len check (description is null or char_length(description) <= 4000),
  constraint games_web_path_len check (char_length(web_path) between 1 and 500)
);

comment on table public.games is 'Catálogo. web_path aponta para o build web (public/games/<slug>/play/). URLs de desktop são arquivos no Storage.';

create index games_published_created_idx on public.games (published, created_at desc);

alter table public.games enable row level security;

create policy games_select_published
  on public.games
  for select
  to anon, authenticated
  using (published = true or public.is_admin());

create policy games_insert_admin
  on public.games
  for insert
  to authenticated
  with check (public.is_admin());

create policy games_update_admin
  on public.games
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy games_delete_admin
  on public.games
  for delete
  to authenticated
  using (public.is_admin());

insert into storage.buckets (id, name, public, file_size_limit)
values ('game-builds', 'game-builds', true, 524288000)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit;

-- Leitura pública dos instaladores. Upload só com URL assinada da service role.
create policy game_builds_public_read
  on storage.objects
  for select
  to anon, authenticated
  using (bucket_id = 'game-builds');
