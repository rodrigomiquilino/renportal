import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import { toast } from '@/lib/toast';
import { formatDateTime, formatXp } from '@/lib/format';
import type { Profile, UserReport } from '@/lib/database.types';

const reasonLabel: Record<UserReport['reason'], string> = {
  spam: 'Spam',
  harassment: 'Assédio',
  adult: 'Conteúdo adulto',
  other: 'Outro',
};

export function UsersAdmin() {
  const [rows, setRows] = useState<Profile[]>([]);
  const [reports, setReports] = useState<UserReport[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const { data, error: loadError } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);
    if (loadError) {
      setError('Não foi possível listar usuários.');
      return;
    }
    setRows(data ?? []);
    const reportsResult = await supabase
      .from('user_reports')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(30);
    if (!reportsResult.error) setReports(reportsResult.data ?? []);
  }

  useEffect(() => {
    void load();
  }, []);

  async function setRole(userId: string, role: 'user' | 'admin') {
    const { error: rpcError } = await supabase.rpc('set_user_role', { p_user_id: userId, p_role: role });
    if (rpcError) {
      setError(
        rpcError.message.includes('próprio')
          ? 'Você não pode remover o próprio admin.'
          : 'Não foi possível mudar o papel.',
      );
      return;
    }
    toast(role === 'admin' ? 'Admin promovido.' : 'Voltou a ser jogador.');
    await load();
  }

  return (
    <div className="space-y-2">
      {error ? <p className="text-sm text-red-200">{error}</p> : null}
      <ul className="space-y-2">
        {rows.map((row) => (
          <li
            key={row.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/5 bg-card px-4 py-3 text-sm"
          >
            <div>
              <p className="font-medium">{row.display_name}</p>
              <p className="text-xs text-zinc-500">
                @{row.username} · nível {row.level} · {formatXp(Number(row.xp))} XP · {row.role}
              </p>
            </div>
            {row.role === 'admin' ? (
              <Button type="button" size="sm" variant="secondary" onClick={() => setRole(row.id, 'user')}>
                Remover admin
              </Button>
            ) : (
              <Button type="button" size="sm" onClick={() => setRole(row.id, 'admin')}>
                Promover
              </Button>
            )}
          </li>
        ))}
      </ul>
      <section className="pt-4">
        <h2 className="text-sm font-semibold">Denúncias</h2>
        {reports.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-500">Nenhuma denúncia, ou a migration 011 ainda não rodou.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {reports.map((report) => {
              const target = rows.find((row) => row.id === report.target_id);
              return (
                <li key={report.id} className="rounded-2xl border border-white/5 bg-card px-4 py-3 text-sm">
                  <p className="font-medium">
                    {reasonLabel[report.reason]} · @{target?.username ?? 'usuário'}
                  </p>
                  <p className="text-xs text-zinc-500">{formatDateTime(report.created_at)}</p>
                  {report.details ? <p className="mt-1 text-zinc-300">{report.details}</p> : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
