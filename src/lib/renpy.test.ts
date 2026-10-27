import { describe, expect, it } from 'vitest';
import { parseRenpyConfig } from './renpy';
import { slugify, cosmeticKey } from './slug';
import { sanitizeChat } from './chat-text';
import { translateAuthError } from './auth-errors';

describe('parseRenpyConfig', () => {
  it('lê nome e versão do options.rpy', () => {
    const source = `
define config.name = _("Estação Aurora")
define config.version = "1.2"
`;
    expect(parseRenpyConfig(source)).toEqual({ name: 'Estação Aurora', version: '1.2' });
  });

  it('aceita aspas simples sem a função de tradução', () => {
    const source = `define config.name = 'Noite'\ndefine config.version = '0.9'`;
    expect(parseRenpyConfig(source).name).toBe('Noite');
    expect(parseRenpyConfig(source).version).toBe('0.9');
  });
});

describe('slugify', () => {
  it('tira acento e espaço', () => {
    expect(slugify('Estação Aurora!')).toBe('estacao-aurora');
  });

  it('gera chave de cosmético sem campo livre', () => {
    expect(cosmeticKey('border', 'Véu Violeta')).toBe('border-veu-violeta');
    expect(cosmeticKey('title', 'Leitor')).toBe('Leitor');
  });
});

describe('sanitizeChat', () => {
  it('remove tags e controles', () => {
    expect(sanitizeChat('  oi <b>tudo</b>\u0000  ')).toBe('oi tudo');
  });
});

describe('translateAuthError', () => {
  it('traduz credencial e provider desligado', () => {
    expect(translateAuthError('Invalid login credentials')).toMatch(/incorretos/);
    expect(translateAuthError('Provider is not enabled')).toMatch(/não está ligado/);
  });
});
