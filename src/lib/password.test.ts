import { describe, expect, it } from 'vitest';
import { passwordAcceptable, passwordStrength } from './password';

describe('passwordStrength', () => {
  it('pede caracteres quando a senha é curta', () => {
    expect(passwordStrength('abc').label).toMatch(/8/);
    expect(passwordAcceptable('abc')).toBe(false);
  });

  it('aceita uma senha de 8 caracteres com número', () => {
    expect(passwordStrength('leitora1').score).toBeGreaterThanOrEqual(2);
    expect(passwordAcceptable('leitora1')).toBe(true);
  });

  it('trata senha vazia como ainda não digitada', () => {
    expect(passwordStrength('').score).toBe(0);
  });
});
