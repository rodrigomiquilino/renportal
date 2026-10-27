import { isUuid, json, readUser, corsHeaders } from '../_shared/http.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Método não permitido' }, 405)

  const auth = await readUser(req)
  if (!auth.ok) return auth.response

  let body: { game_id?: unknown }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'JSON inválido' }, 400)
  }

  if (!isUuid(body.game_id)) return json({ error: 'game_id inválido' }, 400)

  const { data, error } = await auth.ctx.admin.rpc('start_play_session', {
    p_user_id: auth.ctx.userId,
    p_game_id: body.game_id,
  })

  if (error) return json({ error: 'Não foi possível abrir a sessão' }, 500)
  const result = data as { ok?: boolean; error?: string; session_id?: string }
  if (!result?.ok) return json({ error: result?.error ?? 'Não foi possível abrir a sessão' }, 400)
  return json({ ok: true, session_id: result.session_id })
})
