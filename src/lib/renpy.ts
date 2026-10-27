export type RenpyMeta = {
  name: string | null;
  version: string | null;
};

/** Lê `define config.name` e `define config.version` de um options.rpy. */
export function parseRenpyConfig(source: string): RenpyMeta {
  return {
    name: readConfig(source, 'name')?.slice(0, 120) ?? null,
    version: readConfig(source, 'version')?.slice(0, 40) ?? null,
  };
}

function readConfig(source: string, key: string): string | null {
  const pattern = new RegExp(
    String.raw`define\s+config\.${key}\s*=\s*(?:_\(\s*)?(?:"([^"\\]*(?:\\.[^"\\]*)*)"|'([^'\\]*(?:\\.[^'\\]*)*)')`,
    'm',
  );
  const match = source.match(pattern);
  const raw = match?.[1] ?? match?.[2];
  if (!raw) return null;
  const value = raw.replace(/\\"/g, '"').replace(/\\'/g, "'").trim();
  return value || null;
}
