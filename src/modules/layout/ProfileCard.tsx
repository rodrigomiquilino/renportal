import { href } from '@/lib/paths';
import { useAuth } from '@/lib/auth';
import { formatPlayTime, formatXp } from '@/lib/format';
import { levelProgress } from '@/lib/level';
import { Avatar } from '@/components/Avatar';
import { Button } from '@/components/ui/button';
import { EditProfileDialog } from '@/modules/auth/EditProfileDialog';

/** Cartão de nível, barra de XP e cosméticos ativos. */
export function ProfileCard() {
  const { session, profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="animate-pulse space-y-3 rounded-2xl border border-white/5 bg-card p-4">
        <div className="h-14 rounded-xl bg-white/5" />
        <div className="h-2 rounded-full bg-white/5" />
      </div>
    );
  }

  if (!session || !profile) {
    return (
      <div className="rounded-2xl border border-white/5 bg-card p-4">
        <p className="text-sm font-medium">Entre para guardar seu progresso</p>
        <p className="mt-1 text-sm text-zinc-400">XP, tempo de jogo e cosméticos ficam na sua conta.</p>
        <div className="mt-4 flex gap-2">
          <Button asChild size="sm">
            <a href={href('/login')}>Entrar</a>
          </Button>
          <Button asChild size="sm" variant="secondary">
            <a href={href('/register')}>Criar conta</a>
          </Button>
        </div>
      </div>
    );
  }

  const progress = levelProgress(Number(profile.xp));

  return (
    <div className="rounded-2xl border border-white/5 bg-card p-4">
      <div className="flex items-center gap-3">
        <Avatar
          name={profile.display_name}
          url={profile.avatar_url}
          border={profile.active_border}
          effect={profile.active_effect}
        />
        <div className="min-w-0">
          <p className="truncate font-semibold">{profile.display_name}</p>
          <p className="truncate text-sm text-zinc-400">@{profile.username}</p>
          {profile.active_title ? (
            <p className="mt-0.5 truncate text-xs font-medium text-accent">{profile.active_title}</p>
          ) : null}
        </div>
      </div>

      <div className="mt-4">
        <div className="flex items-baseline justify-between text-sm">
          <span className="font-medium">Nível {profile.level}</span>
          <span className="text-zinc-400">{formatXp(Number(profile.xp))} XP</span>
        </div>
        <div
          className="mt-2 h-2 overflow-hidden rounded-full bg-white/5"
          role="meter"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress.ratio * 100)}
          aria-label="Progresso de XP"
        >
          <div className="h-full rounded-full bg-accent" style={{ width: `${progress.ratio * 100}%` }} />
        </div>
        <p className="mt-2 text-xs text-zinc-500">
          {formatXp(progress.into)} / {formatXp(progress.span)} XP até o nível {profile.level + 1}
        </p>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-2 text-sm">
        <div className="rounded-xl bg-white/5 px-3 py-2">
          <dt className="text-xs text-zinc-500">Tempo jogado</dt>
          <dd className="font-medium">{formatPlayTime(Number(profile.total_play_time_seconds))}</dd>
        </div>
        <div className="rounded-xl bg-white/5 px-3 py-2">
          <dt className="text-xs text-zinc-500">Papel</dt>
          <dd className="font-medium">{profile.role === 'admin' ? 'Admin' : 'Jogador'}</dd>
        </div>
      </dl>

      <div className="mt-4 space-y-2">
        <Button asChild variant="outline" size="sm" className="w-full">
          <a href={href(`/profile/?username=${encodeURIComponent(profile.username)}`)}>Ver perfil público</a>
        </Button>
        <EditProfileDialog />
        <Button asChild variant="ghost" size="sm" className="w-full">
          <a href={href('/conta/')}>Conta e privacidade</a>
        </Button>
      </div>
    </div>
  );
}
