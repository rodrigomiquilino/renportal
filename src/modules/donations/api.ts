import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

export type DonationResult = { ok: boolean; error?: string; from_xp?: number; to_xp?: number };

export async function donateXp(toUser: string, amount: number, message: string): Promise<DonationResult> {
  const { data, error } = await supabase.functions.invoke('donate-xp', {
    body: { to_user: toUser, amount_xp: amount, message },
  });
  if (error) {
    let text = 'Não foi possível enviar o presente.';
    if (error instanceof FunctionsHttpError) {
      try {
        const response = error.context as Response | undefined;
        if (response && typeof response.json === 'function') {
          const payload = (await response.json()) as { error?: string };
          if (payload?.error) text = payload.error;
        }
      } catch {
        text = error.message;
      }
    } else if (error.message) {
      text = error.message;
    }
    if (text.toLowerCase().includes('failed to send') || text.includes('404')) {
      text = 'A function donate-xp não está publicada.';
    }
    return { ok: false, error: text };
  }
  return (data ?? { ok: false, error: 'Resposta vazia' }) as DonationResult;
}
