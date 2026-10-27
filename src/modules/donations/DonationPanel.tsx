import { useEffect, useState, type SubmitEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { FormError } from '@/components/FormError'
import { refreshProfile, useAuth } from '@/lib/auth'
import { formatDateTime, formatXp } from '@/lib/format'
import { href } from '@/lib/paths'
import { supabase } from '@/lib/supabase'
import { toast } from '@/lib/toast'
import { donateXp } from '@/modules/donations/api'
import { DONATION_DAILY_CAP, DONATION_MAX, DONATION_MIN } from '@/modules/donations/limits'

type Gift = { id: string; amount_xp: number; message: string | null; created_at: string; from_name: string }

/** Presente de XP no perfil. No próprio perfil, a lista do que chegou. */
export function DonationPanel({ profileId, displayName }: { profileId: string; displayName: string }) {
  const { session, profile } = useAuth()
  const mine = profile?.id === profileId
  const [amount, setAmount] = useState(String(DONATION_MIN))
  const [message, setMessage] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [gifts, setGifts] = useState<Gift[]>([])

  useEffect(() => {
    if (!session) return
    let cancelled = false
    supabase
      .from('donations')
      .select('id, amount_xp, message, created_at, from_user')
      .eq('to_user', profileId)
      .order('created_at', { ascending: false })
      .limit(8)
      .then(async ({ data }) => {
        if (cancelled || !data) return
        const ids = [...new Set(data.map((row) => row.from_user))]
        const names = new Map<string, string>()
        if (ids.length > 0) {
          const people = await supabase.from('profiles').select('id, display_name').in('id', ids)
          for (const person of people.data ?? []) names.set(person.id, person.display_name)
        }
        if (cancelled) return
        setGifts(
          data.map((row) => ({
            id: row.id,
            amount_xp: row.amount_xp,
            message: row.message,
            created_at: row.created_at,
            from_name: names.get(row.from_user) ?? 'Jogador',
          })),
        )
      })
    return () => {
      cancelled = true
    }
  }, [profileId, session, pending])

  async function onSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    const value = Number(amount)
    if (!Number.isInteger(value) || value < DONATION_MIN || value > DONATION_MAX) {
      setError(`O presente fica entre ${DONATION_MIN} e ${DONATION_MAX} XP.`)
      return
    }
    setPending(true)
    setError(null)
    const result = await donateXp(profileId, value, message.trim())
    setPending(false)
    if (!result.ok) {
      setError(result.error ?? 'Não foi possível enviar.')
      return
    }
    setMessage('')
    await refreshProfile()
    toast(`Você enviou ${formatXp(value)} XP para ${displayName}.`)
  }

  return (
    <section className="rounded-2xl border border-white/5 bg-card p-5">
      <h2 className="font-semibold">{mine ? 'Presentes recebidos' : `Presentear ${displayName}`}</h2>
      <p className="mt-1 text-sm text-zinc-400">
        Entre {DONATION_MIN} e {DONATION_MAX} XP por presente, até {formatXp(DONATION_DAILY_CAP)} por dia (horário de São Paulo).
      </p>

      {!session ? (
        <p className="mt-3 text-sm">
          <a className="font-medium text-accent" href={href('/login')}>
            Entre
          </a>{' '}
          para enviar XP.
        </p>
      ) : null}

      {!mine && session ? (
        <form className="mt-4 space-y-3" onSubmit={onSubmit}>
          <Input
            type="number"
            min={DONATION_MIN}
            max={DONATION_MAX}
            step={1}
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            aria-label="Quantidade de XP"
            required
          />
          <Textarea value={message} maxLength={280} placeholder="Um recado, se quiser" onChange={(event) => setMessage(event.target.value)} />
          <FormError message={error} />
          <Button type="submit" disabled={pending}>
            {pending ? 'Enviando…' : 'Enviar XP'}
          </Button>
        </form>
      ) : null}

      {session && gifts.length > 0 ? (
        <ul className="mt-4 space-y-2">
          {gifts.map((gift) => (
            <li key={gift.id} className="rounded-xl bg-white/5 px-3 py-2 text-sm">
              <p>
                <span className="font-medium">{gift.from_name}</span> enviou {formatXp(gift.amount_xp)} XP
              </p>
              {gift.message ? <p className="text-zinc-300">{gift.message}</p> : null}
              <p className="text-xs text-zinc-500">{formatDateTime(gift.created_at)}</p>
            </li>
          ))}
        </ul>
      ) : null}
      {mine && session && gifts.length === 0 ? <p className="mt-3 text-sm text-zinc-500">Nenhum presente ainda.</p> : null}
    </section>
  )
}
