import { useEffect, useRef, useState } from 'react'
import { assetUrl } from '@/lib/paths'
import { refreshProfile, useAuth } from '@/lib/auth'
import { formatPlayTime } from '@/lib/format'
import type { Game } from '@/lib/database.types'
import { endSession, endSessionKeepalive, heartbeat, startSession, type TickResult } from '@/modules/progression/session'

const HIDDEN_LIMIT_MS = 45_000
const MIN_GAP_MS = 15_000

type Phase = 'starting' | 'live' | 'ended' | 'flagged' | 'error' | 'guest'

/**
 * Player do build web.
 * A sessão nasce no mount, o heartbeat sai a cada 30s só com a aba visível,
 * e o encerramento acontece ao sair, no pagehide ou depois de um tempo escondido.
 */
export function GameEmbed({ game }: { game: Game }) {
  const { session } = useAuth()
  const userId = session?.user.id ?? null
  const tokenRef = useRef(session?.access_token ?? '')
  tokenRef.current = session?.access_token ?? ''
  const [phase, setPhase] = useState<Phase>(userId ? 'starting' : 'guest')
  const [detail, setDetail] = useState(userId ? 'Abrindo sessão…' : 'Entre para contabilizar XP. O jogo abre mesmo assim.')
  const [awarded, setAwarded] = useState(0)
  const [xpThisSession, setXpThisSession] = useState(0)
  const [milestone, setMilestone] = useState<string | null>(null)
  const src = assetUrl(game.web_path)

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      const data = event.data as { type?: string; label?: string } | null
      if (!data || data.type !== 'renportal:milestone' || typeof data.label !== 'string') return
      setMilestone(data.label)
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [])

  useEffect(() => {
    if (!userId) {
      setPhase('guest')
      setDetail('Entre para contabilizar XP. O jogo abre mesmo assim.')
      return
    }
    if (game.id === 'local-demo') {
      setPhase('error')
      setDetail('A demo ainda não está na tabela games, então esta partida não gera XP.')
      return
    }

    let cancelled = false
    let sessionId: string | null = null
    let lastSent = 0
    let hiddenTimer = 0

    function applyTick(result: TickResult) {
      if (typeof result.total_awarded === 'number') setAwarded(result.total_awarded)
      const gainedNow = result.xp_gain ?? 0
      if (gainedNow > 0) {
        setXpThisSession((current) => current + gainedNow)
        void refreshProfile()
      }
      if (result.flagged || result.status === 'flagged') {
        setPhase('flagged')
        setDetail(result.error ?? 'Sessão sinalizada para revisão.')
        return
      }
      if (result.status === 'ended') {
        setPhase('ended')
        setDetail('Sessão encerrada.')
        return
      }
      if (!result.ok) {
        setPhase('error')
        setDetail(result.error ?? 'Falha na sessão.')
        return
      }
      setPhase('live')
      if (result.skipped) {
        setDetail('Aba ficou tempo demais sem sinal. O intervalo longo não entrou na conta.')
        return
      }
      setDetail(gainedNow > 0 ? `+${gainedNow} XP neste heartbeat.` : 'Sessão ativa.')
    }

    async function open() {
      const result = await startSession(game.id)
      if (cancelled) {
        if (result.session_id) void endSession(result.session_id)
        return
      }
      if (!result.ok || !result.session_id) {
        setPhase('error')
        setDetail(result.error ?? 'Não foi possível abrir a sessão.')
        return
      }
      if (document.visibilityState !== 'visible') {
        void endSession(result.session_id)
        setPhase('ended')
        setDetail('A aba estava escondida. A sessão foi encerrada sem contabilizar tempo.')
        return
      }
      sessionId = result.session_id
      lastSent = Date.now()
      setPhase('live')
      setAwarded(0)
      setDetail('Sessão ativa. O próximo heartbeat sai em 30 segundos, se a aba estiver visível.')
    }

    async function close(reason: 'unmount' | 'hidden' | 'pagehide') {
      if (!sessionId) return
      const id = sessionId
      sessionId = null
      if (reason === 'pagehide') {
        endSessionKeepalive(id, tokenRef.current)
        return
      }
      const result = await endSession(id)
      if (!cancelled) applyTick(result)
    }

    async function beat() {
      if (!sessionId || document.visibilityState !== 'visible') return
      if (Date.now() - lastSent < MIN_GAP_MS) return
      lastSent = Date.now()
      const result = await heartbeat(sessionId)
      if (cancelled) return
      applyTick(result)
      if (!result.ok) sessionId = null
    }

    function onVisibility() {
      if (document.visibilityState === 'hidden') {
        hiddenTimer = window.setTimeout(() => {
          void close('hidden')
        }, HIDDEN_LIMIT_MS)
        return
      }
      window.clearTimeout(hiddenTimer)
      if (!sessionId) void open()
      else void beat()
    }

    function onPageHide() {
      void close('pagehide')
    }

    const interval = window.setInterval(() => {
      void beat()
    }, 30_000)

    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('pagehide', onPageHide)
    void open()

    return () => {
      cancelled = true
      window.clearInterval(interval)
      window.clearTimeout(hiddenTimer)
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('pagehide', onPageHide)
      void close('unmount')
    }
  }, [game.id, userId])

  const tone =
    phase === 'live' ? 'bg-emerald-400' : phase === 'flagged' ? 'bg-amber-400' : phase === 'error' ? 'bg-red-400' : 'bg-zinc-500'

  return (
    <section className="overflow-hidden rounded-2xl border border-white/5 bg-black">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/5 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${tone}`} aria-hidden />
          <h2 className="text-sm font-medium">No navegador</h2>
        </div>
        <p className="text-xs text-zinc-400" role="status">
          {detail}
          {awarded > 0 ? ` · ${formatPlayTime(awarded)} nesta sessão` : ''}
          {xpThisSession > 0 ? ` · +${xpThisSession} XP` : ''}
        </p>
      </div>
      <div className="relative aspect-video bg-[#0c0c12]">
        <iframe title={game.title} src={src} className="absolute inset-0 h-full w-full" allow="fullscreen; autoplay" />
      </div>
      {milestone ? (
        <p className="border-t border-white/5 px-4 py-2 text-xs text-zinc-300">Marco do jogo: {milestone}</p>
      ) : null}
    </section>
  )
}
