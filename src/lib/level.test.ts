import { describe, expect, it } from 'vitest';
import { levelProgress } from './level';

describe('levelProgress', () => {
  it('começa no nível 1 sem XP', () => {
    const progress = levelProgress(0);
    expect(progress.level).toBe(1);
    expect(progress.currentFloor).toBe(0);
    expect(progress.nextFloor).toBe(40);
    expect(progress.ratio).toBe(0);
  });

  it('sobe para o nível 2 com 40 XP', () => {
    const progress = levelProgress(40);
    expect(progress.level).toBe(2);
    expect(progress.into).toBe(0);
    expect(progress.ratio).toBe(0);
  });

  it('ignora XP negativo ou inválido', () => {
    expect(levelProgress(-10).level).toBe(1);
    expect(levelProgress(Number.NaN).level).toBe(1);
  });
});
