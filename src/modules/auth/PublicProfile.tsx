import { useEffect, useState } from 'react';
import { Avatar } from '@/components/Avatar';
import { formatDate, formatPlayTime, formatXp } from '@/lib/format';
import { levelProgress } from '@/lib/level';
import { href } from '@/lib/paths';
import { resolveMediaUrl } from '@/lib/presets';
import { supabase } from '@/lib/supabase';
import type { Profile } from '@/lib/database.types';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { features } from '@/lib/features';
import { DonationPanel } from '@/modules/donations/DonationPanel';
import { ReportUserDialog } from '@/modules/auth/ReportUserDialog';
import { authErrorMessage } from '@/lib/auth';
import { toast } from '@/lib/toast';

type Status = 'loading' | 'ready' | 'empty' | 'missing' | 'error';

/**
 * Perfil público. Recebe o username da rota estática ou lê `?username=`
 * quando o jogador não existia no build (GitHub Pages não tem SSR).
 */
export function PublicProfile({ username }: { username?: string }) {
  const { profile: me } = useAuth();
  const [name, setName] = useState(username ?? '');
  const [profile, setProfile] = useState<Profile | null>(null);
  const [status, setStatus] = useState<Status>(username ? 'loading' : 'loading');
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    const fromQuery = new URLSearchParams(window.location.search).get('username') ?? '';
    const resolved = (username || fromQuery).trim().toLowerCase();
    setName(resolved);
    if (!resolved) {
      setStatus('empty');
      setProfile(null);
      return;
    }

    let cancelled = false;
    setStatus('loading');
    supabase
      .from('profiles')
      .select('*')
      .eq('username', resolved)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          setStatus('error');
          return;
        }
        if (!data) {
          setStatus('missing');
          return;
        }
        setProfile(data);
        setStatus('ready');
      });

    return () => {
      cancelled = true;
    };
  }, [username]);

  useEffect(() => {
    if (!me || !profile || me.id === profile.id) {
      setBlocked(false);
      return;
    }
    let cancelled = false;
    void supabase
      .from('user_blocks')
      .select('blocked_id')
      .eq('blocker_id', me.id)
      .eq('blocked_id', profile.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled || error) return;
        setBlocked(Boolean(data));
      });
    return () => {
      cancelled = true;
    };
  }, [me, profile]);

  async function toggleBlock() {
    if (!me || !profile) return;
    if (blocked) {
      const { error } = await supabase
        .from('user_blocks')
        .delete()
        .eq('blocker_id', me.id)
        .eq('blocked_id', profile.id);
      if (error) {
        toast(authErrorMessage(error.message));
        return;
      }
      setBlocked(false);
      toast('Bloqueio removido.');
      return;
    }
    const { error } = await supabase.from('user_blocks').insert({ blocker_id: me.id, blocked_id: profile.id });
    if (error && error.code !== '23505') {
      toast(authErrorMessage(error.message));
      return;
    }
    setBlocked(true);
    toast('Pessoa bloqueada. Pedidos e conversas param dos dois lados.');
  }

  if (status === 'loading') {
    return <div className="h-48 animate-pulse rounded-2xl border border-white/5 bg-card" />;
  }

  if (status === 'empty') {
    return (
      <section className="rounded-2xl border border-white/5 bg-card p-8">
        <h1 className="text-2xl font-semibold tracking-tight">Perfil</h1>
        <p className="mt-2 text-sm text-zinc-400">Escolha um jogador pelo usuário, ou abra o seu.</p>
        {me ? (
          <Button asChild className="mt-4">
            <a href={href(`/profile/?username=${encodeURIComponent(me.username)}`)}>Meu perfil</a>
          </Button>
        ) : null}
      </section>
    );
  }

  if (status === 'error') {
    return (
      <section className="rounded-2xl border border-red-400/20 bg-card p-8">
        <h1 className="text-2xl font-semibold">Não foi possível carregar</h1>
        <p className="mt-2 text-sm text-zinc-400">
          Confira se a migration <code>001_base.sql</code> já rodou no projeto Supabase.
        </p>
      </section>
    );
  }

  if (status === 'missing' || !profile) {
    return (
      <section className="rounded-2xl border border-white/5 bg-card p-8">
        <h1 className="text-2xl font-semibold tracking-tight">Jogador não encontrado</h1>
        <p className="mt-2 text-sm text-zinc-400">Não há perfil com o usuário @{name}.</p>
      </section>
    );
  }

  const progress = levelProgress(Number(profile.xp));
  const mine = me?.id === profile.id;
  const showStats = mine || profile.show_activity !== false;

  return (
    <div className="space-y-4">
      <article className="overflow-hidden rounded-2xl border border-white/5 bg-card">
        {resolveMediaUrl(profile.banner_url) ? (
          <img src={resolveMediaUrl(profile.banner_url) ?? ''} alt="" className="h-36 w-full object-cover" />
        ) : null}
        <div className="p-6 sm:p-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
            <Avatar
              name={profile.display_name}
              url={profile.avatar_url}
              border={profile.active_border}
              effect={profile.active_effect}
              size="lg"
            />
            <div>
              <p className="text-xs font-semibold tracking-[0.16em] text-accent uppercase">
                {profile.active_title || 'Jogador'}
              </p>
              <h1 className="mt-1 text-3xl font-semibold tracking-tight">{profile.display_name}</h1>
              <p className="text-zinc-400">@{profile.username}</p>
            </div>
          </div>
          {mine ? null : me ? (
            <div className="mt-4 flex flex-wrap gap-2">
              <Button type="button" size="sm" variant="secondary" onClick={() => void toggleBlock()}>
                {blocked ? 'Desbloquear' : 'Bloquear'}
              </Button>
              <ReportUserDialog userId={profile.id} username={profile.username} />
            </div>
          ) : null}

          {showStats ? (
            <div className="mt-6">
              <div className="flex justify-between text-sm">
                <span>Nível {profile.level}</span>
                <span className="text-zinc-400">{formatXp(Number(profile.xp))} XP</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/5">
                <div className="h-full rounded-full bg-accent" style={{ width: `${progress.ratio * 100}%` }} />
              </div>
            </div>
          ) : (
            <p className="mt-6 text-sm text-zinc-400">Este jogador prefere não mostrar progresso.</p>
          )}

          <dl className="mt-6 grid gap-3 sm:grid-cols-3">
            {showStats ? (
              <div className="rounded-xl bg-white/5 px-4 py-3">
                <dt className="text-xs text-zinc-500">Tempo jogado</dt>
                <dd className="mt-1 font-medium">{formatPlayTime(Number(profile.total_play_time_seconds))}</dd>
              </div>
            ) : null}
            <div className="rounded-xl bg-white/5 px-4 py-3">
              <dt className="text-xs text-zinc-500">No portal desde</dt>
              <dd className="mt-1 font-medium">{formatDate(profile.created_at)}</dd>
            </div>
            <div className="rounded-xl bg-white/5 px-4 py-3">
              <dt className="text-xs text-zinc-500">Papel</dt>
              <dd className="mt-1 font-medium">{profile.role === 'admin' ? 'Admin' : 'Jogador'}</dd>
            </div>
          </dl>
        </div>
      </article>
      {features.donations ? <DonationPanel profileId={profile.id} displayName={profile.display_name} /> : null}
    </div>
  );
}
