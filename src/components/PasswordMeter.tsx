import { passwordStrength } from '@/lib/password';

const bars = [1, 2, 3, 4] as const;

export function PasswordMeter({ password, id }: { password: string; id: string }) {
  const strength = passwordStrength(password);
  return (
    <div className="space-y-1" id={id}>
      <div className="flex gap-1" aria-hidden>
        {bars.map((step) => (
          <span
            key={step}
            className={
              step <= strength.score ? 'h-1 flex-1 rounded-full bg-accent' : 'h-1 flex-1 rounded-full bg-white/10'
            }
          />
        ))}
      </div>
      <p className="text-xs text-zinc-400">{strength.label}</p>
    </div>
  );
}
