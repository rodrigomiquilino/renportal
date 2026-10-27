-- RenPortal · feedback
-- Nota pública por jogo. hidden esconde da lista; o autor ainda vê a própria linha.

create table public.game_feedback (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  rating integer not null,
  rating_story integer,
  rating_gameplay integer,
  rating_art integer,
  rating_audio integer,
  rating_writing integer,
  comment text,
  hidden boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint game_feedback_unique unique (game_id, user_id),
  constraint game_feedback_rating_check check (rating between 1 and 5),
  constraint game_feedback_story_check check (rating_story is null or rating_story between 1 and 5),
  constraint game_feedback_gameplay_check check (rating_gameplay is null or rating_gameplay between 1 and 5),
  constraint game_feedback_art_check check (rating_art is null or rating_art between 1 and 5),
  constraint game_feedback_audio_check check (rating_audio is null or rating_audio between 1 and 5),
  constraint game_feedback_writing_check check (rating_writing is null or rating_writing between 1 and 5),
  constraint game_feedback_comment_len check (comment is null or char_length(comment) <= 2000)
);

create index game_feedback_game_idx on public.game_feedback (game_id, created_at desc);

alter table public.game_feedback enable row level security;

create or replace function public.protect_feedback_row()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' then
    if not public.is_admin() then
      new.hidden := old.hidden;
      new.user_id := old.user_id;
      new.game_id := old.game_id;
      new.created_at := old.created_at;
      new.id := old.id;
    end if;
    new.updated_at := now();
  end if;
  return new;
end;
$$;

create trigger game_feedback_protect
  before update on public.game_feedback
  for each row
  execute function public.protect_feedback_row();

create policy game_feedback_select
  on public.game_feedback
  for select
  to anon, authenticated
  using (hidden = false or user_id = auth.uid() or public.is_admin());

create policy game_feedback_insert_own
  on public.game_feedback
  for insert
  to authenticated
  with check (user_id = auth.uid() and hidden = false);

create policy game_feedback_update_own
  on public.game_feedback
  for update
  to authenticated
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

create policy game_feedback_delete_admin
  on public.game_feedback
  for delete
  to authenticated
  using (public.is_admin());

-- Médias só do que está visível. A view roda como dono e filtra hidden.
create view public.game_feedback_stats as
select
  game_id,
  count(*)::int as reviews,
  round(avg(rating)::numeric, 2) as rating_avg,
  round(avg(rating_story)::numeric, 2) as story_avg,
  round(avg(rating_gameplay)::numeric, 2) as gameplay_avg,
  round(avg(rating_art)::numeric, 2) as art_avg,
  round(avg(rating_audio)::numeric, 2) as audio_avg,
  round(avg(rating_writing)::numeric, 2) as writing_avg
from public.game_feedback
where hidden = false
group by game_id;

grant select on public.game_feedback_stats to anon, authenticated;
