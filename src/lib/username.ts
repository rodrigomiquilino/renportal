import { USERNAME_PATTERN, normalizeUsername } from '@/lib/format';
import { supabase } from '@/lib/supabase';

export type UsernameState = 'idle' | 'invalid' | 'checking' | 'available' | 'taken' | 'error';

export async function lookupUsername(value: string, exceptId?: string): Promise<UsernameState> {
  const username = normalizeUsername(value);
  if (!USERNAME_PATTERN.test(username)) return 'invalid';
  const { data, error } = await supabase.from('profiles').select('id').eq('username', username).maybeSingle();
  if (error) return 'error';
  if (!data || data.id === exceptId) return 'available';
  return 'taken';
}
