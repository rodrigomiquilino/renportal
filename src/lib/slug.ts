/** Slug estável para jogo e cosmético. Acentos saem, o resto vira hífen. */
export function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

export function cosmeticKey(type: 'border' | 'effect' | 'title', name: string): string {
  if (type === 'title') return name.trim().slice(0, 40);
  const body = slugify(name).replace(/^(border|effect)-/, '');
  const prefix = type === 'border' ? 'border-' : 'effect-';
  return `${prefix}${body || 'item'}`.slice(0, 40);
}
