import { useEffect, useMemo, useState } from 'react';
import { GameCard } from '@/modules/games/GameCard';
import { withDemo } from '@/modules/games/demo';
import { supabase } from '@/lib/supabase';
import type { Game } from '@/lib/database.types';
import { Input } from '@/components/ui/input';

type Props = {
  heading?: string;
  headingLevel?: 'h1' | 'h2';
};

export function GameCatalog({ heading = 'Jogos', headingLevel = 'h1' }: Props) {
  const [games, setGames] = useState<Game[]>([]);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [message, setMessage] = useState<string | null>(null);
  const Title = headingLevel;

  useEffect(() => {
    const initial = new URLSearchParams(window.location.search).get('q') ?? '';
    setQuery(initial);

    let cancelled = false;
    supabase
      .from('games')
      .select('*')
      .eq('published', true)
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          setGames(withDemo([]));
          setStatus('error');
          setMessage('A biblioteca não respondeu. A demo local continua disponível.');
          return;
        }
        setGames(withDemo(data ?? []));
        setStatus('ready');
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return games;
    return games.filter((game) => `${game.title} ${game.description ?? ''}`.toLowerCase().includes(needle));
  }, [games, query]);

  return (
    <section>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Title className="text-2xl font-semibold tracking-tight">{heading}</Title>
          <p className="mt-1 text-sm text-zinc-400">Builds web no navegador e instaladores para o computador.</p>
        </div>
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Filtrar por nome"
          aria-label="Filtrar jogos"
          className="sm:max-w-xs"
        />
      </div>

      {message ? (
        <p
          className="mt-4 rounded-xl border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-sm text-amber-100"
          role="status"
        >
          {message}
        </p>
      ) : null}

      {status === 'loading' ? (
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="h-64 animate-pulse rounded-2xl border border-white/5 bg-card" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <p className="mt-6 rounded-2xl border border-white/5 bg-card px-5 py-8 text-sm text-zinc-400">
          Nenhum jogo com esse nome.
        </p>
      ) : (
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((game) => (
            <GameCard key={game.id} game={game} />
          ))}
        </div>
      )}
    </section>
  );
}
