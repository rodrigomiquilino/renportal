/**
 * Cliente da API LivePix 2.0.
 * OpenAPI: https://api.livepix.gg/open-api.json
 * Token: POST https://oauth.livepix.gg/oauth2/token (client_credentials).
 * Não há assinatura de webhook na especificação; o valor confirmado sai destes GETs.
 */

const API = 'https://api.livepix.gg'
const TOKEN_URL = 'https://oauth.livepix.gg/oauth2/token'

export const LIVEPIX_SCOPES = [
  'payments:read',
  'payments:write',
  'subscriptions:read',
  'subscriptions:write',
  'subscription-plans:read',
  'subscription-plans:write',
].join(' ')

export const PLAN_SLUG = 'apoiador'
export const PLAN_REAIS = 0.99
export const PLAN_CENTS = 99

export class LivepixError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

type Envelope<T> = { data?: T; message?: string }

async function readBody(response: Response): Promise<Envelope<unknown>> {
  try {
    return (await response.json()) as Envelope<unknown>
  } catch {
    return {}
  }
}

export async function livepixToken(): Promise<string> {
  const clientId = Deno.env.get('LIVEPIX_CLIENT_ID') ?? ''
  const clientSecret = Deno.env.get('LIVEPIX_CLIENT_SECRET') ?? ''
  if (!clientId || !clientSecret) {
    throw new LivepixError(500, 'LIVEPIX_CLIENT_ID e LIVEPIX_CLIENT_SECRET não estão no ambiente da função')
  }

  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
      scope: LIVEPIX_SCOPES,
    }),
  })
  const body = (await readBody(response)) as { access_token?: string; message?: string }
  if (!response.ok || !body.access_token) {
    throw new LivepixError(response.status || 502, body.message || 'LivePix não emitiu o token')
  }
  return body.access_token
}

async function livepix<T>(token: string, path: string, init?: RequestInit): Promise<{ status: number; data: T | null; message: string }> {
  const response = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers,
    },
  })
  const body = await readBody(response)
  return {
    status: response.status,
    data: (body.data as T | undefined) ?? null,
    message: body.message ?? '',
  }
}

export type CreatedCheckout = { reference: string; redirectUrl: string }

export async function createPayment(token: string, amountCents: number, redirectUrl: string): Promise<CreatedCheckout> {
  const result = await livepix<CreatedCheckout>(token, '/v2/payments', {
    method: 'POST',
    body: JSON.stringify({ amount: amountCents, currency: 'BRL', redirectUrl }),
  })
  if (result.status !== 201 || !result.data?.reference || !result.data.redirectUrl) {
    throw new LivepixError(result.status || 502, result.message || 'LivePix não abriu o pagamento')
  }
  return result.data
}

export type ReceivedPayment = {
  id: string
  proof: string
  reference: string
  amount: number
  currency: string
  createdAt: string
}

export async function getPayment(token: string, paymentId: string): Promise<ReceivedPayment | null> {
  const result = await livepix<ReceivedPayment>(token, `/v2/payments/${paymentId}`)
  if (result.status === 404) return null
  if (result.status !== 200 || !result.data?.id) {
    throw new LivepixError(result.status || 502, result.message || 'LivePix não devolveu o pagamento')
  }
  return result.data
}

export type SubscriptionPlan = {
  id: string
  slug: string
  amount: number
  currency: string
}

export async function ensureSupporterPlan(token: string): Promise<string> {
  const listed = await livepix<SubscriptionPlan[]>(token, '/v2/subscriptions/plans?limit=100')
  if (listed.status !== 200 || !listed.data) {
    throw new LivepixError(listed.status || 502, listed.message || 'LivePix não listou os planos')
  }
  const existing = listed.data.find((plan) => plan.slug === PLAN_SLUG)
  if (existing) return existing.id

  const created = await livepix<{ id: string }>(token, '/v2/subscriptions/plans', {
    method: 'POST',
    body: JSON.stringify({
      slug: PLAN_SLUG,
      name: 'Apoiador',
      description: 'Apoio mensal ao RenPortal.',
      amount: PLAN_REAIS,
      currency: 'BRL',
    }),
  })
  if (created.status !== 201 || !created.data?.id) {
    throw new LivepixError(created.status || 502, created.message || 'LivePix não criou o plano Apoiador')
  }
  return created.data.id
}

export async function createSubscription(
  token: string,
  planId: string,
  username: string,
  email: string,
  redirectUrl: string,
): Promise<CreatedCheckout> {
  const result = await livepix<CreatedCheckout>(token, '/v2/subscriptions', {
    method: 'POST',
    body: JSON.stringify({
      planId,
      recurrence: 'monthly',
      subscriber: { username, email },
      redirectUrl,
    }),
  })
  if (result.status !== 201 || !result.data?.reference || !result.data.redirectUrl) {
    throw new LivepixError(result.status || 502, result.message || 'LivePix não abriu a assinatura')
  }
  return result.data
}

export type RemoteSubscription = {
  id: string
  subscriber: string
  amount: number
  currency: string
  recurrence: string
  status: 'active' | 'pending' | 'cancelled'
  renewAt: string
}

export async function getSubscription(token: string, subscriptionId: string): Promise<RemoteSubscription | null> {
  const result = await livepix<RemoteSubscription>(token, `/v2/subscriptions/${subscriptionId}`)
  if (result.status === 404) return null
  if (result.status !== 200 || !result.data?.id) {
    throw new LivepixError(result.status || 502, result.message || 'LivePix não devolveu a assinatura')
  }
  return result.data
}

export type SubscriptionTransaction = {
  id: string
  proof: string
  amount: number
  createdAt: string
}

export async function listSubscriptionTransactions(
  token: string,
  subscriptionId: string,
): Promise<SubscriptionTransaction[]> {
  const result = await livepix<SubscriptionTransaction[]>(
    token,
    `/v2/subscriptions/${subscriptionId}/transactions?limit=100`,
  )
  if (result.status !== 200 || !result.data) {
    throw new LivepixError(result.status || 502, result.message || 'LivePix não devolveu os pagamentos da assinatura')
  }
  return result.data
}

export function portalReturnUrl(): string {
  const origin = (Deno.env.get('PUBLIC_SITE_URL') || 'https://rodrigomiquilino.github.io').replace(/\/$/, '')
  const base = Deno.env.get('PUBLIC_BASE_PATH') || '/renportal'
  const prefix = base.endsWith('/') ? base : `${base}/`
  return `${origin}${prefix}apoiar/?retorno=1`
}
