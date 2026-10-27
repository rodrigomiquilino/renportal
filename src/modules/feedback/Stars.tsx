import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Stars({
  value,
  onChange,
  label,
}: {
  value: number | null;
  onChange?: (value: number) => void;
  label: string;
}) {
  return (
    <div>
      <p className="text-xs text-zinc-400">{label}</p>
      <div className="mt-1 flex gap-1" role={onChange ? 'radiogroup' : 'img'} aria-label={label}>
        {[1, 2, 3, 4, 5].map((score) => {
          const filled = score <= (value ?? 0);
          const className = cn('h-4 w-4', filled ? 'text-accent' : 'text-zinc-600');
          if (!onChange) {
            return <Star key={score} className={className} fill={filled ? 'currentColor' : 'none'} aria-hidden />;
          }
          return (
            <button
              key={score}
              type="button"
              role="radio"
              aria-checked={value === score}
              aria-label={`${score} de 5`}
              className="rounded p-0.5"
              onClick={() => onChange(score)}
            >
              <Star className={className} fill={filled ? 'currentColor' : 'none'} />
            </button>
          );
        })}
      </div>
    </div>
  );
}
