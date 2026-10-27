import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase'
import { toast } from '@/lib/toast'
import type { GameFeedback } from '@/lib/database.types'

type Row = GameFeedback & { username: string; game: string }

export function FeedbackAdmin() {
  const [rows, setRows] = useState<Row[]>([])
  const [error, setError] = useState<string | null>(null)

  async function load() {
    const { data, error: loadError } = await supabase.from('game_feedback').select('*').order('created_at', { ascending: false }).limit(50)
    if (loadError) {
      setError('Não foi possível ler o feedback.')
      return
    }
    const feedback = data ?? []
    const userIds = [...new Set(feedback.map((row) => row.user_id))]
    const gameIds = [...new Set(feedback.map((row) => row.game_id))]
    const [people, games] = await Promise.all([
      userIds.length ? supabase.from('profiles').select('id, username').in('id', userIds) : Promise.resolve({ data: [] }),
      gameIds.length ? supabase.from('games').select('id, title').in('id', gameIds) : Promise.resolve({ data: [] }),
    ])
    const names = new Map((people.data ?? []).map((person) => [person.id, person.username]))
    const titles = new Map((games.data ?? []).map((game) => [game.id, game.title]))
    setRows(feedback.map((row) => ({ ...row, username: names.get(row.user_id) ?? 'jogador', game: titles.get(row.game_id) ?? 'jogo' })))
  }

  useEffect(() => {
    void load()
  }, [])

  async function toggle(row: Row) {
    const { error: updateError } = await supabase.from('game_feedback').update({ hidden: !row.hidden }).eq('id', row.id)
    if (updateError) {
      setError('Não foi possível moderar.')
      return
    }
    toast(row.hidden ? 'Comentário visível de novo.' : 'Comentário oculto.')
    await load()
  }

  async function remove(id: string) {
    const { error: deleteError } = await supabase.from('game_feedback').delete().eq('id', id)
    if (deleteError) {
      setError('Não foi possível apagar.')
      return
    }
    await load()
  }

  return (
    <div className="space-y-3">
      {error ? <p className="text-sm text-red-200">{error}</p> : null}
      {rows.length === 0 ? <p className="text-sm text-zinc-400">Nenhuma avaliação.</p> : null}
      <ul className="space-y-2">
        {rows.map((row) => (
          <li key={row.id} className="rounded-2xl border border-white/5 bg-card p-4 text-sm">
            <p className="font-medium">{row.game} · @{row.username} · {row.rating}/5 {row.hidden ? '· oculto' : ''}</p>
            {row.comment ? <p className="mt-1 text-zinc-300">{row.comment}</p> : null}
            <div className="mt-3 flex gap-2">
              <Button type="button" size="sm" variant="secondary" onClick={() => toggle(row)}>
                {row.hidden ? 'Mostrar' : 'Ocultar'}
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => remove(row.id)}>
                Apagar
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
