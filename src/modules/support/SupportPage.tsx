import { useEffect, useState, type SubmitEvent } from 'react';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FormError } from '@/components/FormError';
import { Avatar } from '@/components/Avatar';
import { authErrorMessage, refreshProfile, useAuth } from '@/lib/auth';
import { href } from '@/lib/paths';
import { supabase } from '@/lib/supabase';
import { toast } from '@/lib/toast';
import {
  PLAN_CENTS,
  formatBrl,
  isSupporter,
  oneTimeCents,
  saoPauloMonthLabel,
  supporterEndingSoon,
} from '@/lib/support';
import { SupportMeter } from '@/modules/support/SupportMeter';

type WallRow = {
  username: string;
  display_name: string;
  avatar_url: string | null;
  amount_cents: number;
};

async function invokeMessage(error: unknown): Promise<string> {
  if (error instanceof FunctionsHttpError) {
    try {
      const payload = (await (error.context as Response).json()) as { error?: string };
      if (payload.error) return payload.error;
    } catch {
      return 'Não foi possível abrir o Pix.';
    }
  }
  return 'Não foi possível abrir o Pix. Publique a function livepix-checkout.';
}

export function SupportPage() {
  const { session, profile, loading } = useAuth();
  const [amount, setAmount] = useState('10,00');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<'subscription' | 'one_time' | null>(null);
  const [wall, setWall] = useState<WallRow[]>([]);
  const [wallState, setWallState] = useState<'loading' | 'ready' | 'missing'>('loading');
  const [returned, setReturned] = useState(false);
  const [renewing, setRenewing] = useState(false);

  useEffect(() => {
    setReturned(new URLSearchParams(window.location.search).get('retorno') === '1');
    let cancelled = false;
    void supabase.rpc('support_month_wall').then(({ data, error: wallError }) => {
      if (cancelled) return;
      if (wallError) {
        setWallState('missing');
        return;
      }
      setWall(Array.isArray(data) ? (data as WallRow[]) : []);
      setWallState('ready');
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    void supabase
      .from('support_subscriptions')
      .select('status')
      .eq('user_id', session.user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setRenewing(data?.status === 'active');
      });
    return () => {
      cancelled = true;
    };
  }, [session]);

  async function start(kind: 'subscription' | 'one_time') {
    if (!session) {
      const next = encodeURIComponent('/apoiar/');
      window.location.href = `${href('/login/')}?next=${next}`;
      return;
    }
    setError(null);
    const body: { kind: 'subscription' | 'one_time'; amount_cents?: number } = { kind };
    if (kind === 'one_time') {
      const cents = oneTimeCents(amount);
      if (cents == null) {
        setError('A doação avulsa fica entre R$ 1,00 e R$ 5.000,00.');
        return;
      }
      body.amount_cents = cents;
    }
    setPending(kind);
    const { data, error: invokeError } = await supabase.functions.invoke('livepix-checkout', { body });
    if (invokeError || !data?.redirectUrl) {
      setPending(null);
      setError(await invokeMessage(invokeError));
      return;
    }
    window.location.href = data.redirectUrl as string;
  }

  async function onOneTime(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    await start('one_time');
  }

  async function toggleWall(show: boolean) {
    if (!profile) return;
    const { error: updateError } = await supabase.from('profiles').update({ show_support: show }).eq('id', profile.id);
    if (updateError) {
      toast(authErrorMessage(updateError.message));
      return;
    }
    await refreshProfile();
  }

  const active = isSupporter(profile?.supporter_until);
  const ending = supporterEndingSoon(profile?.supporter_until, renewing);
  const loginHref = `${href('/login/')}?next=${encodeURIComponent('/apoiar/')}`;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">Apoiar</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-400">
          O Pix ajuda a manter o portal. O plano deixa um selo e uma moldura. Não mexe em XP nem em tempo de jogo.
        </p>
      </header>

      {returned ? (
        <p className="rounded-xl border border-accent/30 bg-accent/10 px-3 py-2 text-sm" role="status">
          Se o Pix foi concluído, o selo aparece assim que o LivePix confirmar. Pode levar um instante.
        </p>
      ) : null}

      <SupportMeter compact />

      {wallState === 'missing' ? (
        <p className="text-sm text-zinc-400">A meta e o mural entram depois da migration 012_livepix.sql.</p>
      ) : null}

      {loading ? null : active ? (
        <section className="rounded-2xl border border-[#e8c872]/30 bg-card p-5">
          <p className="text-sm font-medium text-[#e8c872]">Você é Apoiador</p>
          <p className="mt-1 text-sm text-zinc-400">
            O selo fica até {new Date(profile?.supporter_until ?? '').toLocaleDateString('pt-BR')}.
            {renewing ? ' O plano renova sozinho.' : ''}
          </p>
          {ending ? <p className="mt-2 text-sm text-zinc-300">Falta pouco para esse período acabar.</p> : null}
          <label className="mt-4 flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-1"
              checked={profile?.show_support !== false}
              onChange={(event) => void toggleWall(event.target.checked)}
            />
            <span>Aparecer no mural deste mês, com o usuário e o valor</span>
          </label>
        </section>
      ) : session && profile ? (
        <label className="flex items-start gap-2 text-sm text-zinc-300">
          <input
            type="checkbox"
            className="mt-1"
            checked={profile.show_support !== false}
            onChange={(event) => void toggleWall(event.target.checked)}
          />
          <span>Se eu apoiar, pode me mostrar no mural com o usuário e o valor</span>
        </label>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <section className="rounded-2xl border border-white/5 bg-card p-5">
          <h2 className="text-lg font-semibold">Apoiador</h2>
          <p className="mt-1 text-2xl font-semibold tracking-tight">
            {formatBrl(PLAN_CENTS)}
            <span className="text-base font-normal text-zinc-400">/mês</span>
          </p>
          <p className="mt-3 text-sm leading-relaxed text-zinc-400">
            Assinatura do LivePix. O selo, o nome dourado e a moldura da loja ficam enquanto o plano estiver valendo.
          </p>
          <Button className="mt-4" disabled={pending !== null} onClick={() => void start('subscription')}>
            {pending === 'subscription' ? 'Abrindo Pix…' : session ? 'Assinar' : 'Entrar para assinar'}
          </Button>
        </section>

        <form className="rounded-2xl border border-white/5 bg-card p-5" onSubmit={onOneTime}>
          <h2 className="text-lg font-semibold">Uma vez</h2>
          <p className="mt-1 text-sm text-zinc-400">Entra na meta e no mural deste mês. Não liga o selo.</p>
          <div className="mt-4 space-y-1">
            <Label htmlFor="support-amount">Valor</Label>
            <Input
              id="support-amount"
              inputMode="decimal"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              required
            />
          </div>
          <Button className="mt-4" type="submit" variant="secondary" disabled={pending !== null}>
            {pending === 'one_time' ? 'Abrindo Pix…' : session ? 'Doar' : 'Entrar para doar'}
          </Button>
        </form>
      </div>
      <FormError message={error} />
      {session ? null : (
        <p className="text-sm text-zinc-400">
          Só uma conta logada apoia.{' '}
          <a className="font-medium text-accent hover:underline" href={loginHref}>
            Entrar
          </a>
        </p>
      )}

      <section>
        <h2 className="text-lg font-semibold">Mural de {saoPauloMonthLabel()}</h2>
        <p className="mt-1 text-sm text-zinc-400">Quem pediu para ficar de fora não aparece. Não tem mensagem.</p>
        {wallState === 'loading' ? <div className="mt-3 h-24 animate-pulse rounded-2xl bg-card" /> : null}
        {wallState === 'ready' && wall.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-500">Ninguém no mural ainda neste mês.</p>
        ) : null}
        {wallState === 'ready' && wall.length > 0 ? (
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {wall.map((row) => (
              <li key={row.username}>
                <a
                  href={href(`/profile/?username=${encodeURIComponent(row.username)}`)}
                  className="flex items-center gap-3 rounded-2xl border border-white/5 bg-card px-3 py-3 hover:border-accent/40"
                >
                  <Avatar name={row.display_name} url={row.avatar_url} size="sm" />
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{row.display_name}</span>
                    <span className="block truncate text-xs text-zinc-500">@{row.username}</span>
                  </span>
                  <span className="ml-auto text-sm font-medium">{formatBrl(Number(row.amount_cents))}</span>
                </a>
              </li>
            ))}
          </ul>
        ) : null}
      </section>
    </div>
  );
}
