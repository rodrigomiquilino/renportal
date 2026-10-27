import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/database.types';

/**
 * Cliente do browser. A chave publishable é pública por desenho;
 * a service role fica só nas Edge Functions, injetada pelo Supabase.
 */
const url = import.meta.env.PUBLIC_SUPABASE_URL || 'https://wlacdgwbwsykvpobkbib.supabase.co';
const anonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_NkEk7Pn-moYRffrMVcpWNg_J_AMvcB9';

export const supabaseUrl = url;
export const supabaseAnonKey = anonKey;

export const supabase = createClient<Database>(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
