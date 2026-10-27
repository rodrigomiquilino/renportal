import { describe, expect, it } from 'vitest';
import { canSeeMature, hasEmailIdentity, isGuardedPath, pathWithinSite, safeNextPath } from './access';

describe('safeNextPath', () => {
  it('aceita caminho interno', () => {
    expect(safeNextPath('/conta/')).toBe('/conta/');
    expect(safeNextPath('/games/demo/?q=1')).toBe('/games/demo/?q=1');
  });

  it('recusa endereço externo', () => {
    expect(safeNextPath('https://evil.example')).toBeNull();
    expect(safeNextPath('//evil.example')).toBeNull();
    expect(safeNextPath('/\\evil')).toBeNull();
    expect(safeNextPath('conta')).toBeNull();
  });
});

describe('pathWithinSite', () => {
  it('remove o base do Pages', () => {
    expect(pathWithinSite('/renportal/conta/', '', '/renportal/')).toBe('/conta/');
    expect(pathWithinSite('/renportal/chat/', '?x=1', '/renportal/')).toBe('/chat/?x=1');
  });
});

describe('isGuardedPath', () => {
  it('protege conta, admin, onboarding e chat', () => {
    expect(isGuardedPath('/conta/')).toBe(true);
    expect(isGuardedPath('/admin')).toBe(true);
    expect(isGuardedPath('/games/')).toBe(false);
  });
});

describe('hasEmailIdentity', () => {
  it('distingue e-mail de OAuth puro', () => {
    expect(hasEmailIdentity({ app_metadata: { providers: ['email'] } })).toBe(true);
    expect(hasEmailIdentity({ app_metadata: { providers: ['github'] } })).toBe(false);
    expect(hasEmailIdentity({ identities: [{ provider: 'google' }] })).toBe(false);
    expect(hasEmailIdentity(null)).toBe(false);
  });
});

describe('canSeeMature', () => {
  it('fica desligado até a pessoa assumir', () => {
    expect(canSeeMature(false)).toBe(false);
    expect(canSeeMature(undefined)).toBe(false);
    expect(canSeeMature(true)).toBe(true);
    expect(canSeeMature(false, true)).toBe(true);
  });
});
