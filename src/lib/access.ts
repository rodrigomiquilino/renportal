/** Destino interno depois do login. Recusa URL absoluta e protocol-relative. */
export function safeNextPath(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null;
  const path = value.trim();
  if (path.length < 1 || path.length > 300) return null;
  if (!path.startsWith('/') || path.startsWith('//')) return null;
  if (path.includes('\\') || path.includes('://')) return null;
  if (/\s/.test(path)) return null;
  for (let index = 0; index < path.length; index += 1) {
    if (path.charCodeAt(index) < 32) return null;
  }
  return path;
}

/** Tira o base do Pages e devolve um caminho que `href` entende. */
export function pathWithinSite(pathname: string, search = '', base = '/'): string {
  const normalizedBase = base.endsWith('/') ? base.slice(0, -1) : base;
  let path = pathname || '/';
  if (normalizedBase && path.startsWith(normalizedBase)) {
    path = path.slice(normalizedBase.length) || '/';
  }
  if (!path.startsWith('/')) path = `/${path}`;
  const query = search ? (search.startsWith('?') ? search : `?${search}`) : '';
  return safeNextPath(`${path}${query}`) ?? '/';
}

const GUARDED = new Set(['/conta', '/admin', '/onboarding', '/chat']);

export function isGuardedPath(path: string): boolean {
  const clean = path.split('?')[0].split('#')[0].replace(/\/+$/, '') || '/';
  return GUARDED.has(clean);
}

/** Conta com identidade de e-mail (senha ou link). OAuth puro não tem. */
export function hasEmailIdentity(
  user: {
    identities?: Array<{ provider?: string }> | null;
    app_metadata?: { provider?: string; providers?: string[] } | null;
  } | null,
): boolean {
  if (!user) return false;
  const providers = user.app_metadata?.providers;
  if (Array.isArray(providers)) return providers.includes('email');
  if (user.app_metadata?.provider === 'email') return true;
  return (user.identities ?? []).some((item) => item.provider === 'email');
}

/** Conteúdo adulto é opt-in. Admin vê a ficha mesmo com a opção desligada. */
export function canSeeMature(showAdult: boolean | null | undefined, isAdmin = false): boolean {
  return Boolean(showAdult) || isAdmin;
}
