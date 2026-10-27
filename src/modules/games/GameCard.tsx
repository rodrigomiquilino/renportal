import { assetUrl, href } from '@/lib/paths'
import type { Game } from '@/lib/database.types'

export function GameCard({ game }: { game: Game }) {
  const cover = game.cover_url ? assetUrl(game.cover_url) : null

  return (
    <a
      href={href(`/games/${game.slug}/`)}
      className="group flex flex-col overflow-hidden rounded-2xl border border-white/5 bg-card transition hover:border-accent/40"
    >
      <div className="relative aspect-[16/10] bg-[#101018]">
        {cover ? (
          <img src={cover} alt="" className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]" />
        ) : (
          <div className="grid h-full place-items-center text-3xl font-semibold text-accent">{game.title.slice(0, 1)}</div>
        )}
      </div>
      <div className="flex flex-1 flex-col p-4">
        <h3 className="font-semibold tracking-tight">{game.title}</h3>
        <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-zinc-400">
          {game.description || 'Sem sinopse ainda.'}
        </p>
      </div>
    </a>
  )
}
