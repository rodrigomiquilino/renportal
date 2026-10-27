import { useEffect, useState, type SubmitEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FormError } from '@/components/FormError';
import { formatDateTime } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import { formatBrl, reaisToCents } from '@/lib/support';
import { toast } from '@/lib/toast';

type PaymentRow = {
  id: string;
  user_id: string;
  kind: string;
  amount_cents: number;
  paid_at: string;
  username?: string;
};

export function SupportAdmin() {
  const [label, setLabel] = useState('Custo do servidor');
  const [target, setTarget] = useState('50,00');
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);
  const [pending, setPending] = useState(false);

  async function load() {
    const goal = await supabase.from('support_goal').select('label, target_cents').limit(1).maybeSingle();
    if (goal.error) {
      setMissing(true);
      return;
    }
    if (goal.data) {
      setLabel(goal.data.label);
      setTarget((goal.data.target_cents / 100).toFixed(2).replace('.', ','));
    }
    const history = await supabase
      .from('support_payments')
      .select('id, user_id, kind, amount_cents, paid_at')
      .order('paid_at', { ascending: false })
      .limit(40);
    if (history.error) {
      setMissing(true);
      return;
    }
    const ids = [...new Set((history.data ?? []).map((row) => row.user_id))];
    const people = ids.length
      ? await supabase.from('profiles').select('id, username').in('id', ids)
      : { data: [] as { id: string; username: string }[] };
    const names = new Map((people.data ?? []).map((person) => [person.id, person.username]));
    setPayments(
      (history.data ?? []).map((row) => ({
        ...row,
        username: names.get(row.user_id) ?? 'conta',
      })),
    );
  }

  useEffect(() => {
    void load();
  }, []);

  async function onGoal(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const cents = reaisToCents(target);
    const text = label.trim();
    if (cents == null || cents < 100 || text.length < 1 || text.length > 120) {
      setError('A meta precisa de um texto e um valor de pelo menos R$ 1,00.');
      return;
    }
    setPending(true);
    setError(null);
    const { error: updateError } = await supabase
      .from('support_goal')
      .update({ target_cents: cents, label: text })
      .eq('id', true);
    setPending(false);
    if (updateError) {
      setError('Não foi possível salvar a meta. Confira a migration 012_livepix.sql.');
      return;
    }
    toast('Meta atualizada.');
  }

  if (missing) {
    return <p className="text-sm text-zinc-400">O histórico de apoios aparece depois da migration 012_livepix.sql.</p>;
  }

  return (
    <div className="space-y-6">
      <form className="max-w-lg space-y-3 rounded-2xl border border-white/5 bg-card p-5" onSubmit={onGoal}>
        <h2 className="font-semibold">Meta do mês</h2>
        <p className="text-sm text-zinc-400">A barra zera sozinha no dia 1, no horário de São Paulo.</p>
        <div className="space-y-1">
          <Label htmlFor="goal-label">Texto</Label>
          <Input
            id="goal-label"
            value={label}
            maxLength={120}
            onChange={(event) => setLabel(event.target.value)}
            required
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="goal-target">Valor</Label>
          <Input
            id="goal-target"
            inputMode="decimal"
            value={target}
            onChange={(event) => setTarget(event.target.value)}
            required
          />
        </div>
        <FormError message={error} />
        <Button type="submit" disabled={pending}>
          {pending ? 'Salvando…' : 'Salvar meta'}
        </Button>
      </form>

      <section>
        <h2 className="font-semibold">Pagamentos</h2>
        {payments.length === 0 ? <p className="mt-2 text-sm text-zinc-500">Nenhum Pix confirmado ainda.</p> : null}
        <ul className="mt-2 space-y-2">
          {payments.map((row) => (
            <li key={row.id} className="rounded-2xl border border-white/5 bg-card px-4 py-3 text-sm">
              <p className="font-medium">
                @{row.username} · {formatBrl(row.amount_cents)}
              </p>
              <p className="text-xs text-zinc-500">
                {row.kind === 'subscription' ? 'Plano' : 'Avulso'} · {formatDateTime(row.paid_at)}
              </p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
