import { useEffect, useState } from 'react';
import { Brand } from '@/modules/layout/Brand';
import { navItems } from '@/modules/layout/nav';
import { features } from '@/lib/features';
import { useAuth } from '@/lib/auth';
import { currentPath, href } from '@/lib/paths';
import { cn } from '@/lib/utils';

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { profile } = useAuth();
  const [path, setPath] = useState('/');

  useEffect(() => {
    setPath(currentPath());
  }, []);

  const items = navItems.filter((item) => {
    if (item.feature && !features[item.feature]) return false;
    if (item.adminOnly && profile?.role !== 'admin') return false;
    return true;
  });

  return (
    <div className="flex h-full flex-col px-4 py-5">
      <Brand />
      <nav className="mt-8 flex flex-1 flex-col gap-1" aria-label="Principal">
        {items.map((item) => {
          const Icon = item.icon;
          const target = item.href === '/' ? '/' : item.href.replace(/\/$/, '');
          const active = path === target;
          return (
            <a
              key={item.href}
              href={href(item.href)}
              aria-current={active ? 'page' : undefined}
              onClick={onNavigate}
              className={cn(
                'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
                active ? 'bg-white/5 text-white' : 'text-zinc-400 hover:bg-white/5 hover:text-white',
              )}
            >
              <Icon className="h-4 w-4" aria-hidden />
              {item.label}
            </a>
          );
        })}
      </nav>
      <p className="px-3 text-xs leading-relaxed text-zinc-400">Visual novels, XP e uma mesa só.</p>
    </div>
  );
}
