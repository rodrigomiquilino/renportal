import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/auth'
import { formatPlayTime, formatRelative } from '@/lib/format'
import { assetUrl, href } from '@/lib/paths'
import { supabase } from '@/lib/supabase'
import type { PlaySession } from '@/lib/database.types'
import { features } from '@/lib/features'

type Card = PlaySession & { title: string; slug: string; cover_url: string | null }

const statusLabel = {
  active: 'Em andamento',
  ended: 'Encerrada',
  flagged: 'Em revisão',
} as const

/** "Continue de onde parou": últimas sessões do jogador, com o jogo ao lado. */
export function ContinuePlaying() {
  const { session, loading } = useAuth()
  const [cards, setCards] = useState<Card[]>([])
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')

  useEffect(() => {
    if (!features.progression) return
    if (loading) return
    if (!session) {
      setStatus('ready')
      setCards([])
      return
    }

    let cancelled = false
    supabase
      .from('play_sessions')
      .select('*')
      .eq('user_id', session.user.id)
      .order('last_heartbeat_at', { ascending: false })
      .limit(6)
      .then(async ({ data, error }) => {
        if (cancelled) return
        if (error) {
          setStatus('error')
          return
        }
        const sessions = data ?? []
        const ids = [...new Set(sessions.map((row) => row.game_id))]
        const titles = new Map<string, { title: string; slug: string; cover_url: string | null }>()
        if (ids.length > 0) {
          const games = await supabase.from('games').select('id, title, slug, cover_url').in('id', ids)
          for (const game of games.data ?? []) {
            titles.set(game.id, { title: game.title, slug: game.slug, cover_url: game.cover_url })
          }
        }
        setCards(
          sessions.flatMap((row) => {
            const game = titles.get(row.game_id)
            if (!game) return []
            return [{ ...row, ...game }]
          }),
        )
        setStatus('ready')
      })

    return () => {
      cancelled = true
    }
  }, [loading, session])

  if (!features.progression) return null

  return (
    <section>
      <h2 className="text-2xl font-semibold tracking-tight">Continue de onde parou</h2>
      {status === 'loading' || loading ? (
        <div className="mt-4 h-24 animate-pulse rounded-2xl border border-white/5 bg-card" />
      ) : status === 'error' ? (
        <p className="mt-4 rounded-2xl border border-red-400/20 bg-card px-5 py-6 text-sm text-zinc-400">
          Não foi possível ler suas sessões. Confira a migration de progressão.
        </p>
      ) : !session ? (
        <p className="mt-4 rounded-2xl border border-white/5 bg-card px-5 py-6 text-sm text-zinc-400">
          Entre para retomar os jogos que você já abriu.{' '}
          <a className="font-medium text-accent" href={href('/login')}>
            Entrar
          </a>
        </p>
      ) : cards.length === 0 ? (
        <p className="mt-4 rounded-2xl border border-white/5 bg-card px-5 py-6 text-sm text-zinc-400">
          Você ainda não começou nenhum jogo. A biblioteca está logo abaixo.
        </p>
      ) : (
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {cards.map((card) => (
            <li key={card.id}>
              <a href={href(`/games/${card.slug}/`)} className="flex gap-3 rounded-2xl border border-white/5 bg-card p-3 hover:border-accent/40">
                {card.cover_url ? (
                  <img src={assetUrl(card.cover_url)} alt="" className="h-16 w-24 rounded-lg object-cover" />
                ) : (
                  <div className="h-16 w-24 rounded-lg bg-white/5" />
                )}
                <div className="min-w-0">
                  <p className="truncate font-medium">{card.title}</p>
                  <p className="mt-1 text-xs text-zinc-400">
                    {statusLabel[card.status]} · {formatPlayTime(card.awarded_seconds)} · {formatRelative(card.last_heartbeat_at)}
                  </p>
                </div>
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
