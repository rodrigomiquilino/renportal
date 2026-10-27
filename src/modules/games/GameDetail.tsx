import { useEffect, useState } from 'react';
import { FeedbackPanel } from '@/modules/feedback/FeedbackPanel';
import { GameDownloads } from '@/modules/games/GameDownloads';
import { GameEmbed } from '@/modules/games/GameEmbed';
import { GamePlayer } from '@/modules/games/GamePlayer';
import { features } from '@/lib/features';
import { demoGame } from '@/modules/games/demo';
import { assetUrl, href } from '@/lib/paths';
import { supabase } from '@/lib/supabase';
import type { Game } from '@/lib/database.types';

type Status = 'loading' | 'ready' | 'missing' | 'error';

/** Página do jogo. `slug` vem da rota estática; sem ele, lê `?slug=`. */
export function GameDetail({ slug }: { slug?: string }) {
  const [game, setGame] = useState<Game | null>(null);
  const [status, setStatus] = useState<Status>('loading');
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    const resolved = (slug || new URLSearchParams(window.location.search).get('slug') || '').trim().toLowerCase();
    if (!resolved) {
      setStatus('missing');
      return;
    }

    let cancelled = false;
    supabase
      .from('games')
      .select('*')
      .eq('slug', resolved)
      .eq('published', true)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          if (resolved === 'demo') {
            setGame(demoGame);
            setNote('O catálogo não respondeu. Abrindo a demo que mora neste site.');
            setStatus('ready');
            return;
          }
          setStatus('error');
          return;
        }
        if (!data) {
          if (resolved === 'demo') {
            setGame(demoGame);
            setNote('A demo ainda não está na tabela games. O arquivo local abre mesmo assim.');
            setStatus('ready');
            return;
          }
          setStatus('missing');
          return;
        }
        setGame(data);
        setStatus('ready');
      });

    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (status === 'loading') {
    return <div className="h-80 animate-pulse rounded-2xl border border-white/5 bg-card" />;
  }

  if (status === 'error') {
    return (
      <section className="rounded-2xl border border-red-400/20 bg-card p-8">
        <h1 className="text-2xl font-semibold">Não foi possível abrir o jogo</h1>
        <p className="mt-2 text-sm text-zinc-400">Confira a migration 002_games.sql e a conexão com o Supabase.</p>
      </section>
    );
  }

  if (status === 'missing' || !game) {
    return (
      <section className="rounded-2xl border border-white/5 bg-card p-8">
        <h1 className="text-2xl font-semibold tracking-tight">Jogo não encontrado</h1>
        <p className="mt-2 text-sm text-zinc-400">
          Esse endereço não está publicado para a sua conta. Jogos adultos só aparecem depois que você liga a opção em{' '}
          <a className="font-medium text-accent hover:underline" href={href('/conta/')}>
            Conta
          </a>
          .
        </p>
        <a className="mt-4 inline-block text-sm font-medium text-accent" href={href('/games/')}>
          Voltar para a biblioteca
        </a>
      </section>
    );
  }

  const cover = game.cover_url ? assetUrl(game.cover_url) : null;

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-5 sm:flex-row">
        {cover ? (
          <img src={cover} alt="" className="h-40 w-full rounded-2xl border border-white/5 object-cover sm:w-64" />
        ) : null}
        <div>
          <p className="text-xs font-semibold tracking-[0.16em] text-accent uppercase">
            {game.content_rating === 'mature' ? '18+' : 'Visual novel'}
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">{game.title}</h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-zinc-400">{game.description}</p>
        </div>
      </header>
      {note ? (
        <p className="rounded-xl border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-sm text-amber-100">{note}</p>
      ) : null}
      {features.progression ? <GameEmbed game={game} /> : <GamePlayer game={game} />}
      <GameDownloads game={game} />
      {features.feedback ? <FeedbackPanel gameId={game.id} /> : null}
    </div>
  );
}
