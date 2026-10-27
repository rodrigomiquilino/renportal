import { FunctionsHttpError } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

export type PurchaseResult = { ok: boolean; error?: string; xp?: number; level?: number; item_id?: string }

/** Compra atômica. O cliente não debita XP. */
export async function purchaseItem(itemId: string): Promise<PurchaseResult> {
  const { data, error } = await supabase.functions.invoke('purchase-item', { body: { item_id: itemId } })
  if (error) {
    let message = 'Não foi possível comprar agora.'
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
    if (message.toLowerCase().includes('failed to send') || message.includes('404')) {
      message = 'A function purchase-item não está publicada.'
    }
    return { ok: false, error: message }
  }
  return (data ?? { ok: false, error: 'Resposta vazia' }) as PurchaseResult
}
