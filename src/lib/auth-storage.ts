import { safeNextPath } from '@/lib/access';

export const REMEMBER_KEY = 'renportal-remember';
const NEXT_KEY = 'renportal-next';

const memory = new Map<string, string>();
let consumedNext: string | null | undefined;

function browserStore(kind: 'local' | 'session'): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return kind === 'local' ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
}

/** Ligado por padrão. Só fica desligado quando o login gravou `0`. */
export function rememberPreference(): boolean {
  const store = browserStore('local');
  if (!store) return true;
  return store.getItem(REMEMBER_KEY) !== '0';
}

export function setRememberPreference(remember: boolean): void {
  browserStore('local')?.setItem(REMEMBER_KEY, remember ? '1' : '0');
}

/**
 * O cliente do Supabase é um singleton. O adapter lê a preferência
 * em cada acesso, então "lembrar" pode mudar antes do sign-in.
 */
export const supabaseAuthStorage = {
  getItem(key: string): string | null {
    const store = browserStore(rememberPreference() ? 'local' : 'session');
    if (!store) return memory.get(key) ?? null;
    return store.getItem(key);
  },
  setItem(key: string, value: string): void {
    const remember = rememberPreference();
    const primary = browserStore(remember ? 'local' : 'session');
    const other = browserStore(remember ? 'session' : 'local');
    other?.removeItem(key);
    if (!primary) {
      memory.set(key, value);
      return;
    }
    primary.setItem(key, value);
  },
  removeItem(key: string): void {
    memory.delete(key);
    browserStore('local')?.removeItem(key);
    browserStore('session')?.removeItem(key);
  },
};

export function storeNext(value: string | null | undefined): void {
  consumedNext = undefined;
  const store = browserStore('session');
  if (!store) return;
  const safe = safeNextPath(value ?? null);
  if (!safe) {
    store.removeItem(NEXT_KEY);
    return;
  }
  store.setItem(NEXT_KEY, safe);
}

/** Lê uma vez. A segunda chamada na mesma página devolve o mesmo destino. */
export function consumeNext(): string | null {
  if (consumedNext !== undefined) return consumedNext;
  const store = browserStore('session');
  const safe = safeNextPath(store?.getItem(NEXT_KEY) ?? null);
  store?.removeItem(NEXT_KEY);
  consumedNext = safe;
  return safe;
}
