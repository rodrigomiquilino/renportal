import { resolveMediaUrl } from '@/lib/presets';
import { cn } from '@/lib/utils';

const frames: Record<string, string> = {
  'border-violet': 'cosmetic-border-violet',
  'border-aurora': 'cosmetic-border-aurora',
};

const effects: Record<string, string> = {
  'effect-glow': 'cosmetic-effect-glow',
  'effect-stars': 'cosmetic-effect-stars',
};

type AvatarProps = {
  name: string;
  url?: string | null;
  border?: string | null;
  effect?: string | null;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
};

const sizes = {
  sm: 'h-9 w-9 text-xs',
  md: 'h-14 w-14 text-lg',
  lg: 'h-20 w-20 text-2xl',
};

/** Avatar com iniciais e os cosméticos ativos (borda e efeito). */
export function Avatar({ name, url, border, effect, size = 'md', className }: AvatarProps) {
  const initial = (name.trim()[0] || '?').toUpperCase();
  const frame = border ? (frames[border] ?? 'cosmetic-border-violet') : undefined;
  const aura = effect ? effects[effect] : undefined;
  const src = resolveMediaUrl(url);

  return (
    <span className={cn('relative inline-flex shrink-0 rounded-full', aura, className)}>
      {src ? (
        <img src={src} alt="" className={cn('rounded-full object-cover', sizes[size], frame)} />
      ) : (
        <span
          className={cn(
            'grid place-items-center rounded-full bg-accent/20 font-semibold text-accent',
            sizes[size],
            frame,
          )}
          aria-hidden
        >
          {initial}
        </span>
      )}
    </span>
  );
}
