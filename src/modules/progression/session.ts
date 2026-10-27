import { FunctionsHttpError } from '@supabase/supabase-js'
import { supabase, supabaseAnonKey, supabaseUrl } from '@/lib/supabase'

export type TickResult = {
  ok: boolean
  error?: string
  flagged?: boolean
  skipped?: boolean
  session_id?: string
  awarded_seconds?: number
  xp_gain?: number
  elapsed?: number
  total_awarded?: number
  status?: string
  xp?: number
  level?: number
}

function friendly(message: string): string {
  const lower = message.toLowerCase()
  if (lower.includes('failed to send') || lower.includes('relay') || lower.includes('404')) {
    return 'A Edge Function não está publicada. Veja a seção Progressão no README.'
  }
  return message
}

async function invoke(name: string, body: Record<string, unknown>): Promise<TickResult> {
  const { data, error } = await supabase.functions.invoke(name, { body })
  if (error) {
    let message = 'Não foi possível falar com o servidor de sessão.'
    if (error instanceof FunctionsHttpError) {
      try {
        const response = error.context as Response | undefined
        if (response && typeof response.json === 'function') {
          const payload = (await response.json()) as { error?: string }
          if (payload?.error) message = payload.error
        }
      } catch {
        message = error.message
      }
    } else if (error.message) {
      message = error.message
    }
    return { ok: false, error: friendly(message) }
  }
  return (data ?? { ok: false, error: 'Resposta vazia' }) as TickResult
}

export function startSession(gameId: string) {
  return invoke('start-session', { game_id: gameId })
}

export function heartbeat(sessionId: string) {
  return invoke('heartbeat', { session_id: sessionId })
}

export function endSession(sessionId: string) {
  return invoke('end-session', { session_id: sessionId })
}

/** pagehide não espera a promise do supabase-js. keepalive mantém o POST ao sair. */
export function endSessionKeepalive(sessionId: string, accessToken: string) {
  void fetch(`${supabaseUrl}/functions/v1/end-session`, {
    method: 'POST',
    keepalive: true,
    headers: {
      'Content-Type': 'application/json',
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ session_id: sessionId }),
  })
}
