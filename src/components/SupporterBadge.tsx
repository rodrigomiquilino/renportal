import { isSupporter } from '@/lib/support';

/** Selo automático enquanto o plano está valendo. Não é item de loja. */
export function SupporterBadge({ until }: { until: string | null | undefined }) {
  if (!isSupporter(until)) return null;
  return (
    <span className="inline-flex shrink-0 rounded-full border border-[#e8c872]/40 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-[#e8c872] uppercase">
      Apoiador
    </span>
  );
}
