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

/** Conteúdo adulto é opt-in. Admin vê a ficha mesmo com a opção desligada. */
export function canSeeMature(showAdult: boolean | null | undefined, isAdmin = false): boolean {
  return Boolean(showAdult) || isAdmin;
}
