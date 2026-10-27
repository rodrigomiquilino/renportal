import { describe, expect, it } from 'vitest';
import {
  PLAN_CENTS,
  formatBrl,
  isSupporter,
  oneTimeCents,
  parseLivepixNotice,
  reaisToCents,
  saoPauloMonthStart,
  supporterEndingSoon,
} from './support';

describe('reaisToCents', () => {
  it('lê real com vírgula e milhar', () => {
    expect(reaisToCents('10,50')).toBe(1050);
    expect(reaisToCents('1.000,50')).toBe(100050);
    expect(reaisToCents('0,99')).toBe(99);
  });

  it('recusa texto e fração demais', () => {
    expect(reaisToCents('dez')).toBeNull();
    expect(reaisToCents('10,505')).toBeNull();
  });
});

describe('oneTimeCents', () => {
  it('respeita o mínimo de R$ 1 da API e um teto contra digitação', () => {
    expect(oneTimeCents('0,99')).toBeNull();
    expect(oneTimeCents('1')).toBe(100);
    expect(oneTimeCents('5000')).toBe(500_000);
    expect(oneTimeCents('5000,01')).toBeNull();
  });
});

describe('apoio mensal', () => {
  it('o plano cabe em 99 centavos', () => {
    expect(PLAN_CENTS).toBe(99);
  });

  it('o selo vale enquanto a data não passou', () => {
    const now = Date.parse('2026-10-27T12:00:00Z');
    expect(isSupporter('2026-11-01T00:00:00Z', now)).toBe(true);
    expect(isSupporter('2026-10-01T00:00:00Z', now)).toBe(false);
    expect(isSupporter(null, now)).toBe(false);
  });

  it('avisa perto do fim só sem renovação', () => {
    const now = Date.parse('2026-10-27T12:00:00Z');
    const soon = '2026-10-30T12:00:00Z';
    expect(supporterEndingSoon(soon, false, now)).toBe(true);
    expect(supporterEndingSoon(soon, true, now)).toBe(false);
    expect(supporterEndingSoon('2026-12-01T00:00:00Z', false, now)).toBe(false);
  });
});

describe('saoPauloMonthStart', () => {
  it('ainda é outubro às 23h30 em São Paulo', () => {
    const start = saoPauloMonthStart(new Date('2026-11-01T02:30:00Z'));
    expect(start.toISOString()).toBe('2026-10-01T03:00:00.000Z');
  });

  it('vira novembro na meia-noite de São Paulo', () => {
    const start = saoPauloMonthStart(new Date('2026-11-01T03:00:00Z'));
    expect(start.toISOString()).toBe('2026-11-01T03:00:00.000Z');
  });
});

describe('parseLivepixNotice', () => {
  it('ignora valor que venha no corpo', () => {
    const notice = parseLivepixNotice({
      event: 'new',
      amount: 1,
      resource: {
        id: '61021c7bdabe5e001225b65d',
        reference: '61021c7bdabe5e001225b65e',
        type: 'payment',
      },
    });
    expect(notice).toEqual({
      event: 'new',
      type: 'payment',
      id: '61021c7bdabe5e001225b65d',
      reference: '61021c7bdabe5e001225b65e',
    });
    expect(notice && 'amount' in notice).toBe(false);
  });

  it('recusa id solto', () => {
    expect(parseLivepixNotice({ event: 'new', resource: { id: 'abc', reference: 'abc', type: 'payment' } })).toBeNull();
  });
});

describe('formatBrl', () => {
  it('mostra 99 centavos', () => {
    expect(formatBrl(99)).toBe('R$\u00a00,99');
  });
});
