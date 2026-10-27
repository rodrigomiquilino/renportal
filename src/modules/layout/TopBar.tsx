import { LogOut, Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Avatar } from '@/components/Avatar';
import { useAuth } from '@/lib/auth';
import { features } from '@/lib/features';
import { href } from '@/lib/paths';
import { supabase } from '@/lib/supabase';
import { ProfileCard } from '@/modules/layout/ProfileCard';
import { Sidebar } from '@/modules/layout/Sidebar';
import { useState } from 'react';

export function TopBar() {
  const { session, profile } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  async function logout() {
    await supabase.auth.signOut({ scope: 'local' });
    window.location.href = href('/');
  }

  return (
    <header className="sticky top-0 z-30 flex min-h-16 flex-wrap items-center justify-between gap-3 border-b border-white/5 bg-background/80 px-4 py-2 backdrop-blur-md sm:px-6">
      <div className="flex items-center gap-2 lg:hidden">
        <Dialog open={menuOpen} onOpenChange={setMenuOpen}>
          <DialogTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Abrir menu">
              <Menu className="h-5 w-5" />
            </Button>
          </DialogTrigger>
          <DialogContent className="top-0 left-0 h-full max-w-xs translate-x-0 translate-y-0 rounded-none p-0">
            <DialogHeader className="sr-only">
              <DialogTitle>Menu</DialogTitle>
            </DialogHeader>
            <Sidebar onNavigate={() => setMenuOpen(false)} />
          </DialogContent>
        </Dialog>
        <span className="font-semibold tracking-tight lg:hidden">RenPortal</span>
      </div>

      {features.games ? (
        <form
          action={href('/games/')}
          className="order-last w-full min-w-0 md:order-none md:mx-auto md:w-auto md:flex-1"
        >
          <label htmlFor="game-search" className="sr-only">
            Buscar jogos
          </label>
          <input
            id="game-search"
            name="q"
            placeholder="Buscar jogos"
            className="h-10 w-full max-w-md rounded-xl border border-white/10 bg-white/5 px-3 text-sm outline-none placeholder:text-zinc-500 focus:border-accent/70"
          />
        </form>
      ) : (
        <p className="hidden text-sm text-zinc-400 lg:block">Portal de jogos Ren&apos;Py</p>
      )}

      <div className="ml-auto flex items-center gap-2">
        {session && profile ? (
          <>
            <Dialog open={profileOpen} onOpenChange={setProfileOpen}>
              <DialogTrigger asChild>
                <button
                  type="button"
                  className="flex items-center gap-2 rounded-full border border-white/5 bg-card py-1 pr-3 pl-1 xl:hidden"
                  aria-label={`Abrir progresso, nível ${profile.level}`}
                >
                  <Avatar
                    name={profile.display_name}
                    url={profile.avatar_url}
                    border={profile.active_border}
                    effect={profile.active_effect}
                    size="sm"
                  />
                  <span className="hidden text-sm font-medium sm:inline">Nível {profile.level}</span>
                </button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Seu progresso</DialogTitle>
                </DialogHeader>
                <ProfileCard />
              </DialogContent>
            </Dialog>
            <Button variant="ghost" size="sm" onClick={logout} aria-label="Sair neste aparelho">
              <LogOut className="h-4 w-4" aria-hidden />
              <span className="hidden sm:inline">Sair</span>
            </Button>
          </>
        ) : (
          <Button asChild size="sm">
            <a href={href('/login')}>Entrar</a>
          </Button>
        )}
      </div>
    </header>
  );
}
