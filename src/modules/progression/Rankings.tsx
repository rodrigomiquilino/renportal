import { useEffect, useState } from 'react';
import { Avatar } from '@/components/Avatar';
import { useAuth } from '@/lib/auth';
import { formatXp } from '@/lib/format';
import { href } from '@/lib/paths';
import { supabase } from '@/lib/supabase';
import type { Profile } from '@/lib/database.types';
import { cn } from '@/lib/utils';

export function Rankings() {
  const { profile: me } = useAuth();
  const [rows, setRows] = useState<Profile[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    let cancelled = false;
    supabase
      .from('profiles')
      .select('*')
      .order('xp', { ascending: false })
      .limit(50)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          setStatus('error');
          return;
        }
        setRows(data ?? []);
        setStatus('ready');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (status === 'loading') {
    return <div className="h-64 animate-pulse rounded-2xl border border-white/5 bg-card" />;
  }

  if (status === 'error') {
    return (
      <section className="rounded-2xl border border-red-400/20 bg-card p-8">
        <h1 className="text-2xl font-semibold">Ranking indisponível</h1>
        <p className="mt-2 text-sm text-zinc-400">Não foi possível ler os perfis. Confira a migration base.</p>
      </section>
    );
  }

  return (
    <section>
      <h1 className="text-3xl font-semibold tracking-tight">Rankings</h1>
      <p className="mt-2 max-w-2xl text-sm text-zinc-400">
        Os 50 jogadores com mais XP. O nível segue a raiz do XP: 40 pontos separam o nível 1 do 2.
      </p>
      {rows.length === 0 ? (
        <p className="mt-6 rounded-2xl border border-white/5 bg-card px-5 py-8 text-sm text-zinc-400">
          Ainda não há jogadores.
        </p>
      ) : (
        <ol className="mt-6 space-y-2">
          {rows.map((row, index) => {
            const mine = row.id === me?.id;
            return (
              <li key={row.id}>
                <a
                  href={href(`/profile/?username=${encodeURIComponent(row.username)}`)}
                  className={cn(
                    'flex items-center gap-3 rounded-2xl border border-white/5 bg-card px-3 py-3 hover:border-accent/40 sm:px-4',
                    mine && 'border-accent/40',
                  )}
                >
                  <span
                    className={cn('w-8 text-center text-sm font-semibold', index < 3 ? 'text-accent' : 'text-zinc-500')}
                  >
                    {index + 1}
                  </span>
                  <Avatar
                    name={row.display_name}
                    url={row.avatar_url}
                    border={row.active_border}
                    effect={row.active_effect}
                    size="sm"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">
                      {row.display_name}
                      {row.active_title ? (
                        <span className="ml-2 text-xs font-medium text-accent">{row.active_title}</span>
                      ) : null}
                    </p>
                    <p className="truncate text-xs text-zinc-500">@{row.username}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold">Nível {row.level}</p>
                    <p className="text-xs text-zinc-400">{formatXp(Number(row.xp))} XP</p>
                  </div>
                </a>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
