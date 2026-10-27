import { useState } from 'react';
import { Play } from 'lucide-react';
import { assetUrl } from '@/lib/paths';
import type { Game } from '@/lib/database.types';

/** Iframe do build web. O heartbeat entra no módulo de progressão. */
export function GamePlayer({ game }: { game: Game }) {
  const [playing, setPlaying] = useState(false);
  if (!game.web_path) {
    return (
      <section className="rounded-2xl border border-white/5 bg-card p-5">
        <h2 className="font-semibold">No navegador</h2>
        <p className="mt-2 text-sm text-zinc-400">Este jogo não tem versão web. Use o download abaixo.</p>
      </section>
    );
  }
  const src = assetUrl(game.web_path);
  const cover = game.cover_url ? assetUrl(game.cover_url) : null;

  return (
    <section className="overflow-hidden rounded-2xl border border-white/5 bg-black">
      <div className="flex items-center justify-between gap-3 border-b border-white/5 px-4 py-3">
        <h2 className="text-sm font-medium">No navegador</h2>
        {playing ? (
          <a href={src} target="_blank" rel="noreferrer" className="text-xs text-zinc-400 hover:text-white">
            Abrir em outra aba
          </a>
        ) : null}
      </div>
      <div className="relative aspect-video bg-[#0c0c12]">
        {playing ? (
          <iframe
            title={game.title}
            src={src}
            className="absolute inset-0 h-full w-full"
            allow="fullscreen; autoplay"
          />
        ) : (
          <button
            type="button"
            onClick={() => setPlaying(true)}
            className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white"
          >
            {cover ? (
              <img src={cover} alt="" className="absolute inset-0 h-full w-full object-cover opacity-50" />
            ) : null}
            <span className="relative grid h-14 w-14 place-items-center rounded-full bg-accent shadow-[0_0_32px_-6px_#8b5cf6]">
              <Play className="h-6 w-6" aria-hidden />
            </span>
            <span className="relative text-sm font-semibold">Jogar no navegador</span>
          </button>
        )}
      </div>
    </section>
  );
}
