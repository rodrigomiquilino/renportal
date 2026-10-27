import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.118.0'
import { json, corsHeaders } from '../_shared/http.ts'
import {
  PLAN_CENTS,
  LivepixError,
  getPayment,
  getSubscription,
  listSubscriptionTransactions,
  livepixToken,
} from '../_shared/livepix.ts'

const OBJECT_ID = /^[a-f0-9]{24}$/i

type Notice = {
  event: 'new' | 'cancelled'
  type: 'payment' | 'subscription' | 'message'
  id: string
  reference: string
}

/** Igual a parseLivepixNotice em src/lib/support.ts. O corpo não traz valor confiável. */
function parseNotice(body: unknown): Notice | null {
  if (!body || typeof body !== 'object') return null
  const record = body as Record<string, unknown>
  const resource = record.resource
  if (!resource || typeof resource !== 'object') return null
  const item = resource as Record<string, unknown>
  const event = record.event
  const type = item.type
  const id = item.id
  const reference = item.reference
  if (event !== 'new' && event !== 'cancelled') return null
  if (type !== 'payment' && type !== 'subscription' && type !== 'message') return null
  if (typeof id !== 'string' || !OBJECT_ID.test(id)) return null
  if (typeof reference !== 'string' || !OBJECT_ID.test(reference)) return null
  return { event, type, id, reference }
}

type Checkout = { user_id: string; kind: string; amount_cents: number; livepix_reference: string }

async function findCheckout(admin: SupabaseClient, reference: string): Promise<Checkout | null> {
  const { data, error } = await admin
    .from('support_checkouts')
    .select('user_id, kind, amount_cents, livepix_reference')
    .eq('livepix_reference', reference)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Método não permitido' }, 405)

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return json({ error: 'JSON inválido' }, 400)
  }

  const notice = parseNotice(body)
  if (!notice || notice.type === 'message') return json({ ok: true, ignored: true })

  const url = Deno.env.get('SUPABASE_URL') ?? ''
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  if (!url || !service) return json({ error: 'Função sem as variáveis do Supabase' }, 500)

  const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } })

  try {
    const token = await livepixToken()
    if (notice.type === 'payment') {
      if (notice.event !== 'new') return json({ ok: true, ignored: true })
      const payment = await getPayment(token, notice.id)
      if (!payment?.proof || payment.currency !== 'BRL') return json({ error: 'Pagamento ainda não confirmado' }, 503)
      const checkout = await findCheckout(admin, payment.reference)
      if (!checkout || checkout.kind !== 'one_time' || checkout.amount_cents !== payment.amount) {
        return json({ ok: true, ignored: true })
      }
      const { error } = await admin.rpc('credit_support_payment', {
        p_user_id: checkout.user_id,
        p_livepix_id: payment.id,
        p_reference: payment.reference,
        p_kind: 'one_time',
        p_amount_cents: payment.amount,
        p_proof: payment.proof,
        p_paid_at: payment.createdAt,
        p_supporter_until: null,
      })
      if (error) return json({ error: 'Não consegui registrar o pagamento' }, 500)
      return json({ ok: true })
    }

    const remote = await getSubscription(token, notice.id)
    if (!remote || remote.currency !== 'BRL' || remote.recurrence !== 'monthly') {
      return json({ error: 'Assinatura ainda não confirmada' }, 503)
    }

    const { data: known, error: knownError } = await admin
      .from('support_subscriptions')
      .select('user_id, livepix_reference')
      .eq('livepix_subscription_id', remote.id)
      .maybeSingle()
    if (knownError) return json({ error: 'Não consegui ler a assinatura' }, 500)

    const checkout = known ? null : await findCheckout(admin, notice.reference)
    const userId = known?.user_id ?? checkout?.user_id
    if (!userId || (checkout && checkout.kind !== 'subscription')) return json({ ok: true, ignored: true })

    if (!known) {
      const { data: profile } = await admin.from('profiles').select('username').eq('id', userId).maybeSingle()
      const samePerson = profile?.username?.toLowerCase() === remote.subscriber.toLowerCase()
      if (!samePerson || checkout?.amount_cents !== PLAN_CENTS) {
        return json({ ok: true, ignored: true })
      }
    }

    const { error: recordError } = await admin.rpc('record_support_subscription', {
      p_user_id: userId,
      p_subscription_id: remote.id,
      p_reference: known?.livepix_reference ?? notice.reference,
      p_status: remote.status,
      p_renew_at: remote.renewAt,
      p_amount_cents: remote.amount,
    })
    if (recordError) return json({ error: 'Não consegui registrar a assinatura' }, 500)

    if (notice.event === 'cancelled' || remote.status === 'cancelled') return json({ ok: true })
    // Pendente ainda não tem Pix. 503 faz o LivePix repetir até a assinatura ficar ativa.
    if (remote.status !== 'active') return json({ error: 'Assinatura ainda não está ativa' }, 503)

    const transactions = await listSubscriptionTransactions(token, remote.id)
    for (const transaction of transactions) {
      if (!transaction.proof || transaction.amount < 1) continue
      const { error } = await admin.rpc('credit_support_payment', {
        p_user_id: userId,
        p_livepix_id: transaction.id,
        p_reference: known?.livepix_reference ?? notice.reference,
        p_kind: 'subscription',
        p_amount_cents: transaction.amount,
        p_proof: transaction.proof,
        p_paid_at: transaction.createdAt,
        p_supporter_until: remote.renewAt,
      })
      if (error) return json({ error: 'Não consegui registrar a assinatura' }, 500)
    }
    return json({ ok: true })
  } catch (caught) {
    if (caught instanceof LivepixError && caught.status === 404) return json({ error: 'Ainda não achei no LivePix' }, 503)
    const message = caught instanceof LivepixError ? caught.message : 'LivePix não respondeu'
    return json({ error: message }, 503)
  }
})
