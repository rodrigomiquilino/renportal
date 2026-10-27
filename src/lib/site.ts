import { href } from '@/lib/paths';

/** URL absoluta com o base do Pages, para redirect do Auth. */
export function absoluteHref(path: string): string {
  const relative = href(path);
  if (typeof window === 'undefined') return relative;
  return new URL(relative, window.location.origin).toString();
}
