import { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { href } from '@/lib/paths';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { GamesAdmin } from '@/modules/admin/GamesAdmin';
import { FeedbackAdmin } from '@/modules/admin/FeedbackAdmin';
import { UsersAdmin } from '@/modules/admin/UsersAdmin';
import { ShopAdmin } from '@/modules/admin/ShopAdmin';
import { StatsAdmin } from '@/modules/admin/StatsAdmin';

const tabs = [
  ['games', 'Jogos'],
  ['feedback', 'Feedback'],
  ['users', 'Usuários'],
  ['shop', 'Loja'],
  ['stats', 'Números'],
] as const;

type Tab = (typeof tabs)[number][0];

export function AdminApp() {
  const { profile, loading } = useAuth();
  const [tab, setTab] = useState<Tab>('games');

  if (loading) return <div className="h-64 animate-pulse rounded-2xl border border-white/5 bg-card" />;

  if (!profile) {
    return (
      <section className="rounded-2xl border border-white/5 bg-card p-8">
        <h1 className="text-2xl font-semibold">Admin</h1>
        <p className="mt-2 text-sm text-zinc-400">Entre com uma conta de administrador.</p>
        <Button asChild className="mt-4">
          <a href={href('/login')}>Entrar</a>
        </Button>
      </section>
    );
  }

  if (profile.role !== 'admin') {
    return (
      <section className="rounded-2xl border border-white/5 bg-card p-8">
        <h1 className="text-2xl font-semibold">Área restrita</h1>
        <p className="mt-2 text-sm text-zinc-400">
          Sua conta é de jogador. Um admin promove pelo SQL Editor:{' '}
          <code>update profiles set role = 'admin' where username = '{profile.username}'</code>.
        </p>
      </section>
    );
  }

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">Admin</h1>
        <p className="mt-1 text-sm text-zinc-400">Jogos, moderação, papéis e a loja.</p>
      </header>
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Seções do admin">
        {tabs.map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={cn(
              'rounded-xl px-3 py-2 text-sm font-medium',
              tab === id ? 'bg-accent text-white' : 'bg-white/5 text-zinc-300',
            )}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === 'games' ? <GamesAdmin /> : null}
      {tab === 'feedback' ? <FeedbackAdmin /> : null}
      {tab === 'users' ? <UsersAdmin /> : null}
      {tab === 'shop' ? <ShopAdmin /> : null}
      {tab === 'stats' ? <StatsAdmin /> : null}
    </div>
  );
}
