const controls = new RegExp(
  `[${String.fromCharCode(0)}-${String.fromCharCode(8)}${String.fromCharCode(11)}${String.fromCharCode(12)}${String.fromCharCode(14)}-${String.fromCharCode(31)}]`,
  'g',
);

/** Tira HTML e caracteres de controle. O banco repete essa limpeza. */
export function sanitizeChat(value: string): string {
  return value
    .replace(/<[^>]*>/g, '')
    .replace(controls, '')
    .trim()
    .slice(0, 2000);
}
