export type ZipEntry = {
  name: string;
  method: number;
  compressedSize: number;
  uncompressedSize: number;
  localHeaderOffset: number;
};

const EOCD = 0x06054b50;
const CENTRAL = 0x02014b50;

function readU16(bytes: Uint8Array, offset: number): number {
  return bytes[offset] | (bytes[offset + 1] << 8);
}

function readU32(bytes: Uint8Array, offset: number): number {
  return (bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24)) >>> 0;
}

async function readRange(file: Blob, start: number, end: number): Promise<Uint8Array> {
  const buffer = await file.slice(start, end).arrayBuffer();
  return new Uint8Array(buffer);
}

function findEocd(tail: Uint8Array): number {
  for (let index = tail.length - 22; index >= 0; index -= 1) {
    if (readU32(tail, index) === EOCD) return index;
  }
  return -1;
}

/** Lê o diretório central sem descompactar o arquivo inteiro. */
export async function listZipEntries(file: Blob): Promise<ZipEntry[]> {
  if (file.size < 22) return [];
  const tailSize = Math.min(file.size, 65557);
  const tail = await readRange(file, file.size - tailSize, file.size);
  const eocd = findEocd(tail);
  if (eocd < 0) throw new Error('Esse arquivo não parece um zip.');

  const count = readU16(tail, eocd + 10);
  const directorySize = readU32(tail, eocd + 12);
  const directoryOffset = readU32(tail, eocd + 16);
  const directory = await readRange(file, directoryOffset, directoryOffset + directorySize);
  const entries: ZipEntry[] = [];
  let cursor = 0;

  for (let index = 0; index < count && cursor + 46 <= directory.length; index += 1) {
    if (readU32(directory, cursor) !== CENTRAL) break;
    const method = readU16(directory, cursor + 10);
    const compressedSize = readU32(directory, cursor + 20);
    const uncompressedSize = readU32(directory, cursor + 24);
    const nameLength = readU16(directory, cursor + 28);
    const extraLength = readU16(directory, cursor + 30);
    const commentLength = readU16(directory, cursor + 32);
    const localHeaderOffset = readU32(directory, cursor + 42);
    const nameBytes = directory.slice(cursor + 46, cursor + 46 + nameLength);
    const name = new TextDecoder('utf-8', { fatal: false }).decode(nameBytes);
    entries.push({ name, method, compressedSize, uncompressedSize, localHeaderOffset });
    cursor += 46 + nameLength + extraLength + commentLength;
  }

  return entries;
}

export async function unzipEntry(file: Blob, entry: ZipEntry): Promise<Uint8Array> {
  const header = await readRange(file, entry.localHeaderOffset, entry.localHeaderOffset + 30);
  if (readU32(header, 0) !== 0x04034b50) throw new Error('Cabeçalho do zip inválido.');
  const nameLength = readU16(header, 26);
  const extraLength = readU16(header, 28);
  const dataStart = entry.localHeaderOffset + 30 + nameLength + extraLength;
  const compressed = await readRange(file, dataStart, dataStart + entry.compressedSize);

  if (entry.method === 0) return compressed;
  if (entry.method !== 8) throw new Error('Esse zip usa uma compressão que o navegador não lê.');
  if (typeof DecompressionStream === 'undefined') throw new Error('Este navegador não descompacta o zip.');

  const payload = compressed.buffer.slice(
    compressed.byteOffset,
    compressed.byteOffset + compressed.byteLength,
  ) as ArrayBuffer;
  const stream = new Blob([payload]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  const buffer = await new Response(stream).arrayBuffer();
  return new Uint8Array(buffer);
}

export function findOptionsEntry(entries: ZipEntry[]): ZipEntry | null {
  const matches = entries.filter((entry) => /(^|\/)options\.rpy$/i.test(entry.name) && !entry.name.endsWith('/'));
  if (matches.length === 0) return null;
  return matches.find((entry) => /game\/options\.rpy$/i.test(entry.name)) ?? matches[0];
}

export function looksLikeWebBuild(entries: ZipEntry[]): boolean {
  return entries.some((entry) => /(^|\/)index\.html$/i.test(entry.name));
}
