/**
 * Monta um href respeitando o `base` do Astro (GitHub Pages).
 * O site usa `trailingSlash: 'always'`, então rotas internas terminam com /.
 */
export function href(path: string): string {
  const base = import.meta.env.BASE_URL || '/'
  const queryAt = path.indexOf('?')
  const hashAt = path.indexOf('#')
  let splitAt = path.length
  if (queryAt >= 0) splitAt = Math.min(splitAt, queryAt)
  if (hashAt >= 0) splitAt = Math.min(splitAt, hashAt)

  const pathname = path.slice(0, splitAt)
  const suffix = path.slice(splitAt)

  if (pathname === '' || pathname === '/') return `${base}${suffix}`

  const clean = pathname.replace(/^\/+/, '').replace(/\/+$/, '')
  return `${base}${clean}/${suffix}`
}

/** Arquivo em `public/`, com o base path na frente. URLs absolutas passam direto. */
export function assetUrl(path: string): string {
  if (!path) return path
  if (/^https?:\/\//i.test(path)) return path
  const base = import.meta.env.BASE_URL || '/'
  return `${base}${path.replace(/^\/+/, '')}`
}

/** Pathname atual sem o base e sem barra final (exceto a raiz). */
export function currentPath(): string {
  if (typeof window === 'undefined') return '/'
  const base = (import.meta.env.BASE_URL || '/').replace(/\/$/, '')
  let path = window.location.pathname
  if (base && path.startsWith(base)) path = path.slice(base.length) || '/'
  if (path.length > 1 && path.endsWith('/')) path = path.slice(0, -1)
  return path || '/'
}
