import { useEffect, useSyncExternalStore } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { Profile } from '@/lib/database.types'

export type AuthSnapshot = {
  session: Session | null
  profile: Profile | null
  loading: boolean
  error: string | null
}

const serverSnapshot: AuthSnapshot = {
  session: null,
  profile: null,
  loading: true,
  error: null,
}

let snapshot: AuthSnapshot = serverSnapshot
const listeners = new Set<() => void>()

function emit(next: AuthSnapshot) {
  snapshot = next
  listeners.forEach((listener) => listener())
}

async function loadProfile(userId: string) {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle()
  if (error) {
    emit({ ...snapshot, profile: null, error: 'Não foi possível carregar o perfil.' })
    return
  }
  emit({ ...snapshot, profile: data, error: null })
}

let started = false

/**
 * Uma inscrição só, compartilhada por todas as islands.
 * O setTimeout evita o deadlock do auth lock do supabase-js
 * quando outra chamada parte de dentro do onAuthStateChange.
 */
export function ensureAuth() {
  if (started || typeof window === 'undefined') return
  started = true

  supabase.auth.getSession().then(({ data }) => {
    const session = data.session
    emit({ ...snapshot, session, loading: false })
    if (session?.user) void loadProfile(session.user.id)
  })

  supabase.auth.onAuthStateChange((_event, session) => {
    setTimeout(() => {
      emit({ ...snapshot, session, loading: false, error: null })
      if (session?.user) void loadProfile(session.user.id)
      else emit({ ...snapshot, session: null, profile: null, loading: false })
    }, 0)
  })
}

export async function refreshProfile() {
  const userId = snapshot.session?.user.id
  if (!userId) return
  await loadProfile(userId)
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useAuth(): AuthSnapshot {
  const state = useSyncExternalStore(subscribe, () => snapshot, () => serverSnapshot)
  useEffect(() => {
    ensureAuth()
  }, [])
  return state
}

export function authErrorMessage(raw: string): string {
  const message = raw.toLowerCase()
  if (message.includes('invalid login') || message.includes('invalid credentials')) {
    return 'E-mail ou senha incorretos.'
  }
  if (message.includes('already registered') || message.includes('already been registered')) {
    return 'Este e-mail já está cadastrado.'
  }
  if (message.includes('password')) return 'A senha precisa ter pelo menos 6 caracteres.'
  if (message.includes('email')) return 'Informe um e-mail válido.'
  if (message.includes('rate limit') || message.includes('too many')) {
    return 'Muitas tentativas. Espere um pouco e tente de novo.'
  }
  if (message.includes('profiles_username') || message.includes('duplicate') || message.includes('23505')) {
    return 'Este nome de usuário já está em uso.'
  }
  return 'Não foi possível concluir. Tente novamente.'
}
