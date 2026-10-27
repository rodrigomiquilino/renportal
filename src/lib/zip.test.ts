import { describe, expect, it } from 'vitest';
import { findOptionsEntry, listZipEntries, unzipEntry } from './zip';
import { parseRenpyConfig } from './renpy';

function u16(value: number): number[] {
  return [value & 255, (value >> 8) & 255];
}

function u32(value: number): number[] {
  return [value & 255, (value >> 8) & 255, (value >> 16) & 255, (value >> 24) & 255];
}

function storedZip(name: string, text: string): Blob {
  const fileName = Array.from(new TextEncoder().encode(name));
  const data = Array.from(new TextEncoder().encode(text));
  const local = [
    ...u32(0x04034b50),
    ...u16(20),
    ...u16(0),
    ...u16(0),
    ...u16(0),
    ...u16(0),
    ...u32(0),
    ...u32(data.length),
    ...u32(data.length),
    ...u16(fileName.length),
    ...u16(0),
    ...fileName,
    ...data,
  ];
  const central = [
    ...u32(0x02014b50),
    ...u16(20),
    ...u16(20),
    ...u16(0),
    ...u16(0),
    ...u16(0),
    ...u16(0),
    ...u32(0),
    ...u32(data.length),
    ...u32(data.length),
    ...u16(fileName.length),
    ...u16(0),
    ...u16(0),
    ...u16(0),
    ...u16(0),
    ...u32(0),
    ...u32(0),
    ...fileName,
  ];
  const eocd = [
    ...u32(0x06054b50),
    ...u16(0),
    ...u16(0),
    ...u16(1),
    ...u16(1),
    ...u32(central.length),
    ...u32(local.length),
    ...u16(0),
  ];
  return new Blob([new Uint8Array([...local, ...central, ...eocd])]);
}

describe('zip', () => {
  it('encontra o options.rpy sem descompactar o resto', async () => {
    const source = 'define config.name = _("Estação Aurora")\ndefine config.version = "1.4"\n';
    const file = storedZip('game/options.rpy', source);
    const entries = await listZipEntries(file);
    const options = findOptionsEntry(entries);
    expect(options?.name).toBe('game/options.rpy');
    if (!options) throw new Error('entrada ausente');
    const text = new TextDecoder().decode(await unzipEntry(file, options));
    expect(parseRenpyConfig(text)).toEqual({ name: 'Estação Aurora', version: '1.4' });
  });
});
