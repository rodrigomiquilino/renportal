-- RenPortal · loja
-- Itens cosméticos. A compra só acontece em purchase_item (security definer).

create table public.shop_items (
  id uuid primary key default gen_random_uuid(),
  type text not null,
  name text not null,
  description text,
  cost_xp integer not null,
  asset_key text not null,
  active boolean not null default true,
  constraint shop_items_type_check check (type in ('border', 'effect', 'title')),
  constraint shop_items_cost_positive check (cost_xp > 0),
  constraint shop_items_name_len check (char_length(name) between 1 and 60),
  constraint shop_items_asset_len check (char_length(asset_key) between 1 and 40),
  constraint shop_items_asset_unique unique (type, asset_key)
);

comment on table public.shop_items is 'Cosméticos. asset_key vira classe CSS (borda/efeito) ou o texto do título.';

create table public.user_items (
  user_id uuid not null references public.profiles (id) on delete cascade,
  item_id uuid not null references public.shop_items (id) on delete cascade,
  acquired_at timestamptz not null default now(),
  primary key (user_id, item_id)
);

comment on table public.user_items is 'Inventário. Insert só via purchase_item.';

alter table public.shop_items enable row level security;
alter table public.user_items enable row level security;

create policy shop_items_select
  on public.shop_items
  for select
  to anon, authenticated
  using (active = true or public.is_admin());

create policy shop_items_insert_admin
  on public.shop_items
  for insert
  to authenticated
  with check (public.is_admin());

create policy shop_items_update_admin
  on public.shop_items
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy shop_items_delete_admin
  on public.shop_items
  for delete
  to authenticated
  using (public.is_admin());

create policy user_items_select_own
  on public.user_items
  for select
  to authenticated
  using (user_id = auth.uid() or public.is_admin());

revoke all on table public.user_items from anon, authenticated;
grant select on table public.user_items to authenticated;

-- O dono só equipa o que comprou. Limpar (null) é sempre permitido.
create or replace function public.enforce_owned_cosmetics()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user in ('postgres', 'supabase_admin', 'service_role') then
    return new;
  end if;

  if new.active_border is not null and new.active_border is distinct from old.active_border then
    if not exists (
      select 1
      from public.user_items ui
      join public.shop_items si on si.id = ui.item_id
      where ui.user_id = new.id
        and si.type = 'border'
        and si.asset_key = new.active_border
    ) then
      raise exception 'Borda não adquirida';
    end if;
  end if;

  if new.active_effect is not null and new.active_effect is distinct from old.active_effect then
    if not exists (
      select 1
      from public.user_items ui
      join public.shop_items si on si.id = ui.item_id
      where ui.user_id = new.id
        and si.type = 'effect'
        and si.asset_key = new.active_effect
    ) then
      raise exception 'Efeito não adquirido';
    end if;
  end if;

  if new.active_title is not null and new.active_title is distinct from old.active_title then
    if not exists (
      select 1
      from public.user_items ui
      join public.shop_items si on si.id = ui.item_id
      where ui.user_id = new.id
        and si.type = 'title'
        and si.asset_key = new.active_title
    ) then
      raise exception 'Título não adquirido';
    end if;
  end if;

  return new;
end;
$$;

create trigger profiles_enforce_cosmetics
  before update on public.profiles
  for each row
  execute function public.enforce_owned_cosmetics();

create or replace function public.purchase_item(p_user_id uuid, p_item_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item public.shop_items%rowtype;
  v_updated integer;
  v_xp bigint;
  v_level integer;
begin
  perform set_config('renportal.trusted_write', 'on', true);

  perform 1 from public.profiles where id = p_user_id for update;

  select *
  into v_item
  from public.shop_items
  where id = p_item_id
    and active = true;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'Item indisponível');
  end if;

  if exists (
    select 1 from public.user_items
    where user_id = p_user_id and item_id = p_item_id
  ) then
    return jsonb_build_object('ok', false, 'error', 'Você já tem este item');
  end if;

  update public.profiles
    set xp = xp - v_item.cost_xp
    where id = p_user_id
      and xp >= v_item.cost_xp;

  get diagnostics v_updated = row_count;
  if v_updated = 0 then
    return jsonb_build_object('ok', false, 'error', 'XP insuficiente');
  end if;

  insert into public.user_items (user_id, item_id)
  values (p_user_id, p_item_id);

  insert into public.xp_log (user_id, amount, source, reference_id)
  values (p_user_id, -v_item.cost_xp, 'purchase', p_item_id::text);

  v_level := public.recalculate_level(p_user_id);
  select xp into v_xp from public.profiles where id = p_user_id;

  return jsonb_build_object('ok', true, 'xp', v_xp, 'level', v_level, 'item_id', p_item_id);
end;
$$;

revoke all on function public.purchase_item(uuid, uuid) from public, anon, authenticated;
grant execute on function public.purchase_item(uuid, uuid) to service_role;
