import { href } from '@/lib/paths';

export function Brand() {
  return (
    <a href={href('/')} className="flex items-center gap-2.5 rounded-xl" aria-label="RenPortal, início">
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-accent text-sm font-bold text-white shadow-[0_0_24px_-6px_#8b5cf6]">
        R
      </span>
      <span className="text-lg font-semibold tracking-tight">RenPortal</span>
    </a>
  );
}
