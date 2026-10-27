import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

const labels: Record<string, string> = {
  users: 'Jogadores',
  games: 'Jogos',
  published_games: 'Publicados',
  sessions: 'Sessões',
  flagged_sessions: 'Sessões sinalizadas',
  feedback: 'Avaliações',
  hidden_feedback: 'Ocultas',
  shop_items: 'Itens da loja',
}

export function StatsAdmin() {
  const [stats, setStats] = useState<Record<string, number> | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    supabase.rpc('admin_stats').then(({ data, error: rpcError }) => {
      if (rpcError || !data || typeof data !== 'object') {
        setError('Não foi possível ler os números. Rode a migration 007_admin.sql.')
        return
      }
      setStats(data as Record<string, number>)
    })
  }, [])

  if (error) return <p className="text-sm text-red-200">{error}</p>
  if (!stats) return <div className="h-32 animate-pulse rounded-2xl border border-white/5 bg-card" />

  return (
    <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {Object.entries(stats).map(([key, value]) => (
        <div key={key} className="rounded-2xl border border-white/5 bg-card p-4">
          <dt className="text-xs text-zinc-500">{labels[key] ?? key}</dt>
          <dd className="mt-1 text-2xl font-semibold">{Number(value)}</dd>
        </div>
      ))}
    </dl>
  )
}
