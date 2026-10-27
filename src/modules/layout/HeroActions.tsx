import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth';
import { href } from '@/lib/paths';

/** Botões do hero. O título fica no HTML estático para o primeiro paint e para o SEO. */
export function HeroActions() {
  const { session, profile, loading } = useAuth();

  if (loading) {
    return <div className="h-12 w-56 animate-pulse rounded-xl bg-white/5" aria-hidden />;
  }

  if (session && profile) {
    return (
      <p className="text-sm text-zinc-300">
        Olá, <span className="font-semibold text-white">{profile.display_name}</span>. Nível {profile.level} na coluna
        de progresso.
      </p>
    );
  }

  return (
    <div className="flex flex-wrap gap-3">
      <Button asChild size="lg">
        <a href={href('/games/demo/')}>Jogar a demo</a>
      </Button>
      <Button asChild size="lg" variant="secondary">
        <a href={href('/register')}>Criar conta</a>
      </Button>
      <Button asChild size="lg" variant="outline">
        <a href="https://github.com/rodrigomiquilino/renportal">Ver o código</a>
      </Button>
    </div>
  );
}
