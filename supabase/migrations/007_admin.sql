-- RenPortal · admin
-- Promoção de papel e números do painel. Os dois conferem is_admin() por dentro.
-- CRUD de jogos, feedback e loja continua nas policies dos módulos anteriores.

create or replace function public.set_user_role(p_user_id uuid, p_role text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Apenas administradores';
  end if;

  if p_role not in ('user', 'admin') then
    raise exception 'Papel inválido';
  end if;

  if p_user_id = auth.uid() and p_role <> 'admin' then
    raise exception 'Você não pode remover o próprio acesso de admin';
  end if;

  perform set_config('renportal.trusted_write', 'on', true);

  update public.profiles
    set role = p_role
    where id = p_user_id;

  if not found then
    raise exception 'Perfil não encontrado';
  end if;
end;
$$;

revoke all on function public.set_user_role(uuid, text) from public, anon;
grant execute on function public.set_user_role(uuid, text) to authenticated;

create or replace function public.admin_stats()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Apenas administradores';
  end if;

  return jsonb_build_object(
    'users', (select count(*) from public.profiles),
    'games', (select count(*) from public.games),
    'published_games', (select count(*) from public.games where published),
    'sessions', (select count(*) from public.play_sessions),
    'flagged_sessions', (select count(*) from public.play_sessions where status = 'flagged'),
    'feedback', (select count(*) from public.game_feedback),
    'hidden_feedback', (select count(*) from public.game_feedback where hidden),
    'shop_items', (select count(*) from public.shop_items)
  );
end;
$$;

revoke all on function public.admin_stats() from public, anon;
grant execute on function public.admin_stats() to authenticated;
