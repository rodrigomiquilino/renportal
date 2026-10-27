import { useEffect, useState } from 'react';
import { Avatar } from '@/components/Avatar';
import { Button } from '@/components/ui/button';
import { FormError } from '@/components/FormError';
import { refreshProfile, useAuth } from '@/lib/auth';
import { formatXp } from '@/lib/format';
import { href } from '@/lib/paths';
import { supabase } from '@/lib/supabase';
import { toast } from '@/lib/toast';
import type { ShopItem, ShopItemType } from '@/lib/database.types';
import { purchaseItem } from '@/modules/shop/api';

const labels: Record<ShopItemType, string> = {
  border: 'Bordas',
  effect: 'Efeitos',
  title: 'Títulos',
};

const order: ShopItemType[] = ['border', 'effect', 'title'];

export function ShopGrid() {
  const { session, profile, loading } = useAuth();
  const [items, setItems] = useState<ShopItem[]>([]);
  const [owned, setOwned] = useState<Set<string>>(new Set());
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load(userId?: string) {
    const itemsQuery = supabase.from('shop_items').select('*').eq('active', true).order('cost_xp');
    const ownedQuery = userId
      ? supabase.from('user_items').select('item_id').eq('user_id', userId)
      : Promise.resolve({ data: [], error: null });
    const [itemsResult, ownedResult] = await Promise.all([itemsQuery, ownedQuery]);
    if (itemsResult.error || ownedResult.error) {
      setStatus('error');
      return;
    }
    setItems(itemsResult.data ?? []);
    setOwned(new Set((ownedResult.data ?? []).map((row) => row.item_id)));
    setStatus('ready');
  }

  useEffect(() => {
    if (loading) return;
    void load(session?.user.id);
  }, [loading, session?.user.id]);

  async function buy(item: ShopItem) {
    setPending(item.id);
    setError(null);
    const result = await purchaseItem(item.id);
    setPending(null);
    if (!result.ok) {
      setError(result.error ?? 'Não foi possível comprar.');
      return;
    }
    setOwned((current) => new Set(current).add(item.id));
    await refreshProfile();
    toast(`${item.name} entrou no inventário.`);
  }

  async function equip(item: ShopItem) {
    if (!profile) return;
    const next =
      (item.type === 'border'
        ? profile.active_border
        : item.type === 'effect'
          ? profile.active_effect
          : profile.active_title) === item.asset_key
        ? null
        : item.asset_key;
    const patch =
      item.type === 'border'
        ? { active_border: next }
        : item.type === 'effect'
          ? { active_effect: next }
          : { active_title: next };
    setPending(item.id);
    const { error: updateError } = await supabase.from('profiles').update(patch).eq('id', profile.id);
    setPending(null);
    if (updateError) {
      setError('Não foi possível equipar. Confira se o item é seu.');
      return;
    }
    await refreshProfile();
    toast(next ? `${item.name} equipado.` : `${item.name} removido.`);
  }

  if (status === 'loading' || loading) {
    return <div className="h-64 animate-pulse rounded-2xl border border-white/5 bg-card" />;
  }

  if (status === 'error') {
    return (
      <section className="rounded-2xl border border-red-400/20 bg-card p-8">
        <h1 className="text-2xl font-semibold">Loja indisponível</h1>
        <p className="mt-2 text-sm text-zinc-400">Rode a migration 004_shop.sql e o seed dos itens.</p>
      </section>
    );
  }

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">Loja</h1>
        <p className="mt-2 max-w-2xl text-sm text-zinc-400">
          Bordas, efeitos e títulos saem do seu XP. O débito acontece no servidor.
          {profile ? ` Você tem ${formatXp(Number(profile.xp))} XP.` : ''}
        </p>
      </header>
      <FormError message={error} />
      {items.length === 0 ? (
        <p className="rounded-2xl border border-white/5 bg-card px-5 py-8 text-sm text-zinc-400">
          Nenhum item ativo. Rode o seed.
        </p>
      ) : (
        order.map((type) => {
          const group = items.filter((item) => item.type === type);
          if (group.length === 0) return null;
          return (
            <section key={type}>
              <h2 className="text-lg font-semibold">{labels[type]}</h2>
              <ul className="mt-3 grid gap-3 sm:grid-cols-2">
                {group.map((item) => {
                  const mine = owned.has(item.id);
                  const equipped =
                    (item.type === 'border' && profile?.active_border === item.asset_key) ||
                    (item.type === 'effect' && profile?.active_effect === item.asset_key) ||
                    (item.type === 'title' && profile?.active_title === item.asset_key);
                  return (
                    <li key={item.id} className="rounded-2xl border border-white/5 bg-card p-4">
                      {item.image_url ? (
                        <img src={item.image_url} alt="" className="mb-3 h-28 w-full rounded-xl object-cover" />
                      ) : null}
                      <div className="flex items-center gap-3">
                        <Avatar
                          name={profile?.display_name || 'R'}
                          url={profile?.avatar_url}
                          border={item.type === 'border' ? item.asset_key : profile?.active_border}
                          effect={item.type === 'effect' ? item.asset_key : null}
                          size="sm"
                        />
                        <div>
                          <p className="font-medium">{item.type === 'title' ? item.asset_key : item.name}</p>
                          <p className="text-xs text-zinc-500">{item.name}</p>
                        </div>
                      </div>
                      <p className="mt-3 text-sm text-zinc-400">{item.description}</p>
                      <div className="mt-4 flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold text-accent">{formatXp(item.cost_xp)} XP</span>
                        {!session ? (
                          <Button asChild size="sm" variant="secondary">
                            <a href={href('/login')}>Entrar para comprar</a>
                          </Button>
                        ) : mine ? (
                          <Button
                            size="sm"
                            variant={equipped ? 'secondary' : 'default'}
                            disabled={pending === item.id}
                            onClick={() => equip(item)}
                          >
                            {equipped ? 'Remover' : 'Usar'}
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            disabled={pending === item.id || Number(profile?.xp ?? 0) < item.cost_xp}
                            onClick={() => buy(item)}
                          >
                            {pending === item.id ? 'Comprando…' : 'Comprar'}
                          </Button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })
      )}
    </div>
  );
}
