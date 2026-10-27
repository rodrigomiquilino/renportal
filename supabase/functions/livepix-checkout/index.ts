import { json, readUser, corsHeaders } from '../_shared/http.ts'
import {
  PLAN_CENTS,
  LivepixError,
  createPayment,
  createSubscription,
  ensureSupporterPlan,
  livepixToken,
  portalReturnUrl,
} from '../_shared/livepix.ts'

const ONE_TIME_MIN = 100
const ONE_TIME_MAX = 500_000

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Método não permitido' }, 405)

  const auth = await readUser(req)
  if (!auth.ok) return auth.response

  let body: { kind?: string; amount_cents?: number }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'JSON inválido' }, 400)
  }

  const kind = body.kind === 'subscription' ? 'subscription' : body.kind === 'one_time' ? 'one_time' : null
  if (!kind) return json({ error: 'Escolha o plano mensal ou um valor avulso.' }, 400)

  const amount = kind === 'subscription' ? PLAN_CENTS : body.amount_cents
  if (typeof amount !== 'number' || !Number.isInteger(amount)) {
    return json({ error: 'Informe um valor em centavos.' }, 400)
  }
  if (kind === 'one_time' && (amount < ONE_TIME_MIN || amount > ONE_TIME_MAX)) {
    return json({ error: 'A doação avulsa fica entre R$ 1,00 e R$ 5.000,00.' }, 400)
  }

  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  const { count, error: countError } = await auth.ctx.admin
    .from('support_checkouts')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', auth.ctx.userId)
    .gte('created_at', since)
  if (countError) return json({ error: 'Falta aplicar a migration 012_livepix.sql.' }, 500)
  if ((count ?? 0) >= 8) return json({ error: 'Muitas cobranças nesta hora. Espere um pouco.' }, 429)

  const { data: profile, error: profileError } = await auth.ctx.admin
    .from('profiles')
    .select('username')
    .eq('id', auth.ctx.userId)
    .maybeSingle()
  if (profileError || !profile?.username) return json({ error: 'Não achei seu usuário.' }, 400)

  let email = ''
  if (kind === 'subscription') {
    const { data: account, error: accountError } = await auth.ctx.admin.auth.admin.getUserById(auth.ctx.userId)
    email = account?.user?.email ?? ''
    if (accountError || !email) {
      return json({ error: 'O plano mensal precisa do e-mail da conta. O LivePix usa isso na renovação.' }, 400)
    }
  }

  const { data: checkout, error: insertError } = await auth.ctx.admin
    .from('support_checkouts')
    .insert({ user_id: auth.ctx.userId, kind, amount_cents: amount, status: 'pending' })
    .select('id')
    .single()
  if (insertError || !checkout) return json({ error: 'Não foi possível abrir a cobrança.' }, 500)

  try {
    const token = await livepixToken()
    const redirectUrl = portalReturnUrl()
    const created =
      kind === 'subscription'
        ? await createSubscription(token, await ensureSupporterPlan(token), profile.username, email, redirectUrl)
        : await createPayment(token, amount, redirectUrl)

    const { error: saveError } = await auth.ctx.admin
      .from('support_checkouts')
      .update({ livepix_reference: created.reference })
      .eq('id', checkout.id)
    if (saveError) return json({ error: 'A cobrança abriu, mas não consegui guardá-la.' }, 500)

    return json({ redirectUrl: created.redirectUrl })
  } catch (caught) {
    const message = caught instanceof LivepixError ? caught.message : 'LivePix não respondeu.'
    return json({ error: message }, 502)
  }
})
