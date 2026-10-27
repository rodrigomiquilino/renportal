import { isUuid, json, readUser, corsHeaders } from '../_shared/http.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Método não permitido' }, 405)

  const auth = await readUser(req)
  if (!auth.ok) return auth.response

  let body: { to_user?: unknown; amount_xp?: unknown; message?: unknown }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'JSON inválido' }, 400)
  }

  if (!isUuid(body.to_user)) return json({ error: 'Destinatário inválido' }, 400)
  if (typeof body.amount_xp !== 'number' || !Number.isInteger(body.amount_xp)) {
    return json({ error: 'Informe um valor inteiro de XP' }, 400)
  }
  if (body.message != null && typeof body.message !== 'string') {
    return json({ error: 'Mensagem inválida' }, 400)
  }
  if (typeof body.message === 'string' && body.message.length > 280) {
    return json({ error: 'A mensagem passa de 280 caracteres' }, 400)
  }

  const { data, error } = await auth.ctx.admin.rpc('donate_xp', {
    p_from: auth.ctx.userId,
    p_to: body.to_user,
    p_amount: body.amount_xp,
    p_message: body.message ?? null,
  })

  if (error) return json({ error: 'Não foi possível enviar o presente' }, 500)
  const result = (data ?? {}) as { ok?: boolean; error?: string }
  if (!result.ok) return json(result, 400)
  return json(result)
})
