import { useEffect, useSyncExternalStore } from 'react';
import type { Session } from '@supabase/supabase-js';
import { isGuardedPath, pathWithinSite } from '@/lib/access';
import { translateAuthError } from '@/lib/auth-errors';
import { consumeNext } from '@/lib/auth-storage';
import { href } from '@/lib/paths';
import { supabase } from '@/lib/supabase';
import type { Profile } from '@/lib/database.types';

export type AuthSnapshot = {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  error: string | null;
};

const serverSnapshot: AuthSnapshot = {
  session: null,
  profile: null,
  loading: true,
  error: null,
};

let snapshot: AuthSnapshot = serverSnapshot;
const listeners = new Set<() => void>();

function emit(next: AuthSnapshot) {
  snapshot = next;
  listeners.forEach((listener) => listener());
}

async function loadProfile(userId: string) {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
  if (error) {
    emit({
      ...snapshot,
      profile: null,
      loading: false,
      error: 'Não foi possível carregar o perfil. Sem conexão ou o servidor não respondeu.',
    });
    return;
  }
  emit({ ...snapshot, profile: data, loading: false, error: null });
}

function sendToLogin() {
  if (typeof window === 'undefined') return;
  const next = pathWithinSite(window.location.pathname, window.location.search, import.meta.env.BASE_URL || '/');
  if (!isGuardedPath(next)) return;
  const target = `${href('/login/')}?next=${encodeURIComponent(next)}`;
  if (window.location.pathname.replace(/\/+$/, '').endsWith('/login')) return;
  window.location.replace(target);
}

let started = false;

/**
 * Uma inscrição só, compartilhada por todas as islands.
 * O setTimeout evita o deadlock do auth lock do supabase-js
 * quando outra chamada parte de dentro do onAuthStateChange.
 */
export function ensureAuth() {
  if (started || typeof window === 'undefined') return;
  started = true;

  supabase.auth.getSession().then(({ data }) => {
    const session = data.session;
    if (!session?.user) {
      emit({ ...snapshot, session: null, profile: null, loading: false, error: null });
      sendToLogin();
      return;
    }
    emit({ ...snapshot, session, loading: true, error: null });
    void loadProfile(session.user.id);
  });

  supabase.auth.onAuthStateChange((event, session) => {
    setTimeout(() => {
      if (!session?.user) {
        emit({ ...snapshot, session: null, profile: null, loading: false, error: null });
        if (event === 'SIGNED_OUT') sendToLogin();
        return;
      }
      emit({ ...snapshot, session, loading: true, error: null });
      void loadProfile(session.user.id);
    }, 0);
  });
}

export async function refreshProfile() {
  const userId = snapshot.session?.user.id;
  if (!userId) return;
  await loadProfile(userId);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useAuth(): AuthSnapshot {
  const state = useSyncExternalStore(
    subscribe,
    () => snapshot,
    () => serverSnapshot,
  );
  useEffect(() => {
    ensureAuth();
  }, []);
  return state;
}

/** Em conta, admin, onboarding e chat, sessão ausente volta para o login. */
export function useRequireSession(): AuthSnapshot {
  const state = useAuth();
  useEffect(() => {
    if (state.loading || state.session) return;
    sendToLogin();
  }, [state.loading, state.session]);
  return state;
}

export function authErrorMessage(raw: string): string {
  return translateAuthError(raw);
}

export type SessionContinue = 'redirect' | 'network';

/**
 * Erro de rede não conta como onboarding feito.
 * Quem já concluiu volta para `?next=` ou para o início.
 */
export async function continueAfterSession(): Promise<SessionContinue> {
  const { data, error } = await supabase.auth.getUser();
  if (error) {
    const message = error.message.toLowerCase();
    if (message.includes('network') || message.includes('fetch') || message.includes('failed')) return 'network';
  }
  const userId = data.user?.id;
  if (!userId) {
    window.location.href = href('/');
    return 'redirect';
  }
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('onboarded_at')
    .eq('id', userId)
    .maybeSingle();
  if (profileError) return 'network';
  if (!profile?.onboarded_at) {
    window.location.href = href('/onboarding/');
    return 'redirect';
  }
  const next = consumeNext();
  window.location.href = next ? href(next) : href('/');
  return 'redirect';
}
