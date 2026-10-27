import { isUuid, json, readUser, corsHeaders } from '../_shared/http.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Método não permitido' }, 405)

  const auth = await readUser(req)
  if (!auth.ok) return auth.response

  let body: { item_id?: unknown }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'JSON inválido' }, 400)
  }

  if (!isUuid(body.item_id)) return json({ error: 'item_id inválido' }, 400)

  const { data, error } = await auth.ctx.admin.rpc('purchase_item', {
    p_user_id: auth.ctx.userId,
    p_item_id: body.item_id,
  })

  if (error) return json({ error: 'Não foi possível concluir a compra' }, 500)
  const result = (data ?? {}) as { ok?: boolean; error?: string }
  if (!result.ok) return json(result, 400)
  return json(result)
})
