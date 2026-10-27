-- RenPortal · apoios em dinheiro (LivePix).
-- Idempotente. O crédito só entra por credit_support_payment (security definer / service role).
-- A meta do mês é a soma dos pagamentos com paid_at no mês de America/Sao_Paulo. Sem cron.

alter table public.profiles add column if not exists supporter_until timestamptz;
alter table public.profiles add column if not exists show_support boolean not null default true;

alter table public.shop_items add column if not exists supporter_only boolean not null default false;

grant update (show_support) on table public.profiles to authenticated;

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
  new.supporter_until := old.supporter_until;

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

-- Compra com XP não alcança o item de quem apoia.
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

  if v_item.supporter_only then
    return jsonb_build_object('ok', false, 'error', 'Este item vem com o plano Apoiador');
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

insert into public.shop_items (type, name, description, cost_xp, asset_key, active, supporter_only)
values
  (
    'border',
    'Moldura Apoiador',
    'Borda dourada de quem apoia o portal. Não sai do XP.',
    1,
    'border-apoiador',
    true,
    true
  ),
  (
    'title',
    'Apoiador',
    'Título de quem ajuda a manter o portal no ar.',
    1,
    'Apoiador',
    true,
    true
  )
on conflict (type, asset_key) do update
set supporter_only = true,
    active = true,
    name = excluded.name,
    description = excluded.description;

create table if not exists public.support_goal (
  id boolean primary key default true,
  target_cents integer not null,
  label text not null,
  constraint support_goal_singleton check (id),
  constraint support_goal_target check (target_cents between 100 and 100000000),
  constraint support_goal_label check (char_length(label) between 1 and 120)
);

insert into public.support_goal (id, target_cents, label)
values (true, 5000, 'Custo do servidor')
on conflict (id) do nothing;

create table if not exists public.support_checkouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null,
  amount_cents integer not null,
  livepix_reference text,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  constraint support_checkouts_kind check (kind in ('one_time', 'subscription')),
  constraint support_checkouts_status check (status in ('pending', 'paid')),
  constraint support_checkouts_amount check (amount_cents > 0)
);

create unique index if not exists support_checkouts_reference_uidx
  on public.support_checkouts (livepix_reference)
  where livepix_reference is not null;

create table if not exists public.support_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  livepix_id text not null,
  livepix_reference text,
  kind text not null,
  amount_cents integer not null,
  currency text not null default 'BRL',
  proof text,
  paid_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint support_payments_id_unique unique (livepix_id),
  constraint support_payments_kind check (kind in ('one_time', 'subscription')),
  constraint support_payments_amount check (amount_cents > 0),
  constraint support_payments_currency check (currency = 'BRL')
);

create index if not exists support_payments_paid_idx on public.support_payments (paid_at desc);

create table if not exists public.support_subscriptions (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  livepix_subscription_id text,
  livepix_reference text,
  status text not null default 'pending',
  renew_at timestamptz,
  amount_cents integer,
  updated_at timestamptz not null default now(),
  constraint support_subscriptions_status check (status in ('active', 'pending', 'cancelled'))
);

create unique index if not exists support_subscriptions_livepix_uidx
  on public.support_subscriptions (livepix_subscription_id)
  where livepix_subscription_id is not null;

alter table public.support_goal enable row level security;
alter table public.support_checkouts enable row level security;
alter table public.support_payments enable row level security;
alter table public.support_subscriptions enable row level security;

revoke all on table public.support_goal from anon, authenticated;
revoke all on table public.support_checkouts from anon, authenticated;
revoke all on table public.support_payments from anon, authenticated;
revoke all on table public.support_subscriptions from anon, authenticated;

grant select on table public.support_goal to anon, authenticated;
grant update (target_cents, label) on table public.support_goal to authenticated;
grant select on table public.support_checkouts to authenticated;
grant select on table public.support_payments to authenticated;
grant select on table public.support_subscriptions to authenticated;

drop policy if exists support_goal_select on public.support_goal;
create policy support_goal_select
  on public.support_goal
  for select
  to anon, authenticated
  using (true);

drop policy if exists support_goal_update_admin on public.support_goal;
create policy support_goal_update_admin
  on public.support_goal
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists support_checkouts_select on public.support_checkouts;
create policy support_checkouts_select
  on public.support_checkouts
  for select
  to authenticated
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists support_payments_select on public.support_payments;
create policy support_payments_select
  on public.support_payments
  for select
  to authenticated
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists support_subscriptions_select on public.support_subscriptions;
create policy support_subscriptions_select
  on public.support_subscriptions
  for select
  to authenticated
  using (user_id = auth.uid() or public.is_admin());

-- Mês civil de São Paulo. date_trunc no relógio local, de volta para timestamptz.
create or replace function public.support_month_bounds(p_at timestamptz default now())
returns table (start_at timestamptz, end_at timestamptz)
language sql
stable
as $$
  select
    (date_trunc('month', timezone('America/Sao_Paulo', p_at)) at time zone 'America/Sao_Paulo'),
    ((date_trunc('month', timezone('America/Sao_Paulo', p_at)) + interval '1 month') at time zone 'America/Sao_Paulo');
$$;

create or replace function public.support_month_summary()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_start timestamptz;
  v_end timestamptz;
  v_target integer;
  v_label text;
  v_raised bigint;
begin
  select start_at, end_at into v_start, v_end from public.support_month_bounds();

  select target_cents, label into v_target, v_label
  from public.support_goal
  where id;

  select coalesce(sum(amount_cents), 0) into v_raised
  from public.support_payments
  where paid_at >= v_start and paid_at < v_end;

  return jsonb_build_object(
    'target_cents', coalesce(v_target, 0),
    'label', coalesce(v_label, ''),
    'raised_cents', coalesce(v_raised, 0)
  );
end;
$$;

revoke all on function public.support_month_summary() from public;
grant execute on function public.support_month_summary() to anon, authenticated, service_role;

create or replace function public.support_month_wall()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_start timestamptz;
  v_end timestamptz;
  v_rows jsonb;
begin
  select start_at, end_at into v_start, v_end from public.support_month_bounds();

  select coalesce(jsonb_agg(to_jsonb(w) order by w.amount_cents desc), '[]'::jsonb)
  into v_rows
  from (
    select
      p.username,
      p.display_name,
      p.avatar_url,
      sum(sp.amount_cents)::bigint as amount_cents
    from public.support_payments sp
    join public.profiles p on p.id = sp.user_id
    where sp.paid_at >= v_start
      and sp.paid_at < v_end
      and p.show_support
      and (
        p.profile_visibility = 'public'
        or (p.profile_visibility = 'members' and auth.uid() is not null)
        or p.id = auth.uid()
        or public.is_admin()
      )
    group by p.id, p.username, p.display_name, p.avatar_url
    order by sum(sp.amount_cents) desc
    limit 24
  ) w;

  return v_rows;
end;
$$;

revoke all on function public.support_month_wall() from public;
grant execute on function public.support_month_wall() to anon, authenticated, service_role;

-- Idempotente pelo id do pagamento no LivePix. Não mexe em XP.
create or replace function public.credit_support_payment(
  p_user_id uuid,
  p_livepix_id text,
  p_reference text,
  p_kind text,
  p_amount_cents integer,
  p_proof text,
  p_paid_at timestamptz,
  p_supporter_until timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new uuid;
begin
  perform set_config('renportal.trusted_write', 'on', true);

  if p_kind not in ('one_time', 'subscription') then
    return jsonb_build_object('ok', false, 'error', 'Tipo inválido');
  end if;

  if p_amount_cents is null or p_amount_cents < 1 then
    return jsonb_build_object('ok', false, 'error', 'Valor inválido');
  end if;

  insert into public.support_payments (
    user_id, livepix_id, livepix_reference, kind, amount_cents, proof, paid_at
  )
  values (
    p_user_id, p_livepix_id, p_reference, p_kind, p_amount_cents, p_proof, p_paid_at
  )
  on conflict (livepix_id) do nothing
  returning id into v_new;

  if v_new is null then
    return jsonb_build_object('ok', true, 'duplicate', true);
  end if;

  update public.support_checkouts
    set status = 'paid'
    where livepix_reference = p_reference
      and user_id = p_user_id;

  if p_kind = 'subscription' and p_supporter_until is not null then
    update public.profiles
      set supporter_until = greatest(coalesce(supporter_until, p_supporter_until), p_supporter_until)
      where id = p_user_id;

    insert into public.user_items (user_id, item_id)
    select p_user_id, si.id
    from public.shop_items si
    where si.supporter_only and si.active
    on conflict (user_id, item_id) do nothing;
  end if;

  return jsonb_build_object('ok', true, 'duplicate', false);
end;
$$;

revoke all on function public.credit_support_payment(uuid, text, text, text, integer, text, timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function public.credit_support_payment(uuid, text, text, text, integer, text, timestamptz, timestamptz) to service_role;

create or replace function public.record_support_subscription(
  p_user_id uuid,
  p_subscription_id text,
  p_reference text,
  p_status text,
  p_renew_at timestamptz,
  p_amount_cents integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.support_subscriptions (
    user_id, livepix_subscription_id, livepix_reference, status, renew_at, amount_cents, updated_at
  )
  values (p_user_id, p_subscription_id, p_reference, p_status, p_renew_at, p_amount_cents, now())
  on conflict (user_id) do update
  set livepix_subscription_id = excluded.livepix_subscription_id,
      livepix_reference = excluded.livepix_reference,
      status = excluded.status,
      renew_at = excluded.renew_at,
      amount_cents = excluded.amount_cents,
      updated_at = now();
end;
$$;

revoke all on function public.record_support_subscription(uuid, text, text, text, timestamptz, integer) from public, anon, authenticated;
grant execute on function public.record_support_subscription(uuid, text, text, text, timestamptz, integer) to service_role;
