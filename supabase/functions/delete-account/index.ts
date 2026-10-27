import { json, readUser, corsHeaders } from '../_shared/http.ts'

const USERNAME = /^[a-z0-9_]{3,24}$/

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Método não permitido' }, 405)

  const auth = await readUser(req)
  if (!auth.ok) return auth.response

  let body: { username?: string }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'JSON inválido' }, 400)
  }

  const username = (body.username ?? '').trim().toLowerCase()
  if (!USERNAME.test(username)) {
    return json({ error: 'Digite seu usuário para confirmar.' }, 400)
  }

  const { data: profile, error: profileError } = await auth.ctx.admin
    .from('profiles')
    .select('username')
    .eq('id', auth.ctx.userId)
    .maybeSingle()

  if (profileError || !profile) return json({ error: 'Não encontrei o perfil.' }, 400)
  if (profile.username !== username) {
    return json({ error: 'O usuário não confere com esta conta.' }, 400)
  }

  const { error } = await auth.ctx.admin.auth.admin.deleteUser(auth.ctx.userId)
  if (error) return json({ error: 'Não foi possível apagar a conta.' }, 500)

  return json({ ok: true })
})
