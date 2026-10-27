/** Regras do apoio. O crédito em si mora no banco; aqui só o que a interface e os testes compartilham. */

export const PLAN_CENTS = 99;
export const ONE_TIME_MIN_CENTS = 100;
export const ONE_TIME_MAX_CENTS = 500_000;
export const SUPPORT_SOON_MS = 5 * 24 * 60 * 60 * 1000;

const OBJECT_ID = /^[a-f0-9]{24}$/i;

export type LivepixNotice = {
  event: 'new' | 'cancelled';
  type: 'payment' | 'subscription' | 'message';
  id: string;
  reference: string;
};

export function formatBrl(cents: number): string {
  const value = Number.isFinite(cents) ? cents / 100 : 0;
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

/** Aceita 10, 10,50 e 1.000,50. Devolve centavos ou null. */
export function reaisToCents(raw: string): number | null {
  const text = raw.trim().replace(/\s/g, '');
  if (!text) return null;
  const normalized = text.includes(',') ? text.replace(/\./g, '').replace(',', '.') : text;
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  const cents = Math.round(Number(normalized) * 100);
  if (!Number.isSafeInteger(cents)) return null;
  return cents;
}

export function oneTimeCents(raw: string): number | null {
  const cents = reaisToCents(raw);
  if (cents == null || cents < ONE_TIME_MIN_CENTS || cents > ONE_TIME_MAX_CENTS) return null;
  return cents;
}

export function isSupporter(until: string | null | undefined, now = Date.now()): boolean {
  if (!until) return false;
  const time = new Date(until).getTime();
  return Number.isFinite(time) && time > now;
}

/** Aviso só quando o período acaba e não há renovação ativa. */
export function supporterEndingSoon(until: string | null | undefined, renewing: boolean, now = Date.now()): boolean {
  if (renewing || !isSupporter(until, now)) return false;
  const time = new Date(until as string).getTime();
  return time - now <= SUPPORT_SOON_MS;
}

/** Início do mês civil em America/Sao_Paulo, que não tem horário de verão desde 2019. */
export function saoPauloMonthStart(date: Date): Date {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(date);
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  return new Date(`${year}-${month}-01T00:00:00-03:00`);
}

export function saoPauloMonthLabel(date = new Date()): string {
  return new Intl.DateTimeFormat('pt-BR', {
    month: 'long',
    year: 'numeric',
    timeZone: 'America/Sao_Paulo',
  }).format(date);
}

/**
 * O webhook do LivePix não traz valor nem assinatura.
 * Só identificamos o recurso; o valor vem da consulta autenticada.
 */
export function parseLivepixNotice(body: unknown): LivepixNotice | null {
  if (!body || typeof body !== 'object') return null;
  const record = body as Record<string, unknown>;
  const resource = record.resource;
  if (!resource || typeof resource !== 'object') return null;
  const item = resource as Record<string, unknown>;
  const event = record.event;
  const type = item.type;
  const id = item.id;
  const reference = item.reference;
  if (event !== 'new' && event !== 'cancelled') return null;
  if (type !== 'payment' && type !== 'subscription' && type !== 'message') return null;
  if (typeof id !== 'string' || !OBJECT_ID.test(id)) return null;
  if (typeof reference !== 'string' || !OBJECT_ID.test(reference)) return null;
  return { event, type, id, reference };
}
