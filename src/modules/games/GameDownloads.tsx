import { Download } from 'lucide-react'
import { formatSize } from '@/lib/format'
import type { Game } from '@/lib/database.types'

const platforms = [
  { key: 'windows_url', label: 'Windows' },
  { key: 'mac_url', label: 'macOS' },
  { key: 'linux_url', label: 'Linux' },
] as const

export function GameDownloads({ game }: { game: Game }) {
  const links = platforms.flatMap((platform) => {
    const url = game[platform.key]
    return url ? [{ ...platform, url }] : []
  })
  const size = formatSize(game.file_size_mb)

  return (
    <section className="rounded-2xl border border-white/5 bg-card p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-semibold">Baixar para PC</h2>
        {size ? <span className="text-xs text-zinc-500">{size}</span> : null}
      </div>
      {links.length === 0 ? (
        <p className="mt-2 text-sm text-zinc-400">Este jogo ainda não tem build de desktop.</p>
      ) : (
        <ul className="mt-4 flex flex-wrap gap-2">
          {links.map((link) => (
            <li key={link.key}>
              <a
                href={link.url}
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/10 px-4 text-sm font-semibold hover:bg-white/5"
              >
                <Download className="h-4 w-4" aria-hidden />
                {link.label}
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
