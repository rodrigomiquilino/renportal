import { useEffect, useState } from 'react';
import { href } from '@/lib/paths';
import { supabase } from '@/lib/supabase';
import { formatBrl, saoPauloMonthLabel } from '@/lib/support';

type Summary = { target_cents: number; label: string; raised_cents: number };

export function SupportMeter({ compact = false }: { compact?: boolean }) {
  const [summary, setSummary] = useState<Summary | null>(null);

  useEffect(() => {
    let cancelled = false;
    void supabase.rpc('support_month_summary').then(({ data, error }) => {
      if (cancelled || error || !data || typeof data !== 'object' || Array.isArray(data)) return;
      const row = data as Summary;
      if (typeof row.target_cents !== 'number') return;
      setSummary({
        target_cents: row.target_cents,
        label: row.label || 'Meta do mês',
        raised_cents: Number(row.raised_cents) || 0,
      });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!summary || summary.target_cents < 1) return null;
  const ratio = Math.max(0, Math.min(1, summary.raised_cents / summary.target_cents));

  return (
    <section className="rounded-2xl border border-white/5 bg-card p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold tracking-[0.16em] text-accent uppercase">{saoPauloMonthLabel()}</p>
          <h2 className="mt-1 text-lg font-semibold tracking-tight">{summary.label}</h2>
        </div>
        <p className="text-sm text-zinc-300">
          {formatBrl(summary.raised_cents)} de {formatBrl(summary.target_cents)}
        </p>
      </div>
      <div
        className="mt-4 h-2 overflow-hidden rounded-full bg-white/5"
        role="meter"
        aria-valuemin={0}
        aria-valuemax={summary.target_cents}
        aria-valuenow={Math.min(summary.raised_cents, summary.target_cents)}
        aria-label={summary.label}
      >
        <div className="h-full rounded-full bg-accent" style={{ width: `${ratio * 100}%` }} />
      </div>
      {compact ? null : (
        <a className="mt-4 inline-block text-sm font-medium text-accent hover:underline" href={href('/apoiar/')}>
          Apoiar o portal
        </a>
      )}
    </section>
  );
}
