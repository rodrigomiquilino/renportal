import { isUuid, json, readUser, corsHeaders } from '../_shared/http.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Método não permitido' }, 405)

  const auth = await readUser(req)
  if (!auth.ok) return auth.response

  let body: { session_id?: unknown }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'JSON inválido' }, 400)
  }

  if (!isUuid(body.session_id)) return json({ error: 'session_id inválido' }, 400)

  const { data, error } = await auth.ctx.admin.rpc('apply_play_tick', {
    p_session_id: body.session_id,
    p_user_id: auth.ctx.userId,
    p_close: true,
  })

  if (error) return json({ error: 'Não foi possível encerrar a sessão' }, 500)
  const result = (data ?? {}) as { ok?: boolean; error?: string }
  if (!result.ok) return json(result, 400)
  return json(result)
})
