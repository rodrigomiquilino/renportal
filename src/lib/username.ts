import { USERNAME_PATTERN, normalizeUsername } from '@/lib/format';
import { supabase } from '@/lib/supabase';

export type UsernameState = 'idle' | 'invalid' | 'checking' | 'available' | 'taken' | 'error';

export async function lookupUsername(value: string, exceptId?: string): Promise<UsernameState> {
  const username = normalizeUsername(value);
  if (!USERNAME_PATTERN.test(username)) return 'invalid';
  const { data, error } = await supabase.rpc('username_taken', {
    p_username: username,
    p_except: exceptId ?? null,
  });
  if (!error && typeof data === 'boolean') return data ? 'taken' : 'available';
  const missing =
    error &&
    /username_taken|schema cache|could not find the function|pgrst202/i.test(`${error.message} ${error.code ?? ''}`);
  if (error && !missing) return 'error';

  const fallback = await supabase.from('profiles').select('id').eq('username', username).maybeSingle();
  if (fallback.error) return 'error';
  if (!fallback.data || fallback.data.id === exceptId) return 'available';
  return 'taken';
}
