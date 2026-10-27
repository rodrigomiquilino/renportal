import { useState, type SubmitEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { FormError } from '@/components/FormError'
import { authErrorMessage } from '@/lib/auth'
import { USERNAME_PATTERN, normalizeUsername } from '@/lib/format'
import { href } from '@/lib/paths'
import { supabase } from '@/lib/supabase'

export function RegisterForm() {
  const [username, setUsername] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function onSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    const nextUsername = normalizeUsername(username)
    if (!USERNAME_PATTERN.test(nextUsername)) {
      setError('Usuário: 3 a 24 caracteres, só letras minúsculas, números e _.')
      return
    }
    if (password.length < 6) {
      setError('A senha precisa ter pelo menos 6 caracteres.')
      return
    }

    setPending(true)
    setError(null)
    const { data, error: signError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: {
          username: nextUsername,
          display_name: displayName.trim() || nextUsername,
        },
      },
    })
    setPending(false)

    if (signError) {
      setError(authErrorMessage(signError.message))
      return
    }

    if (data.session) {
      window.location.href = href('/')
      return
    }

    setInfo('Conta criada. Se a confirmação de e-mail estiver ligada no Supabase, abra o link que enviamos antes de entrar.')
  }

  return (
    <form className="space-y-4" onSubmit={onSubmit}>
      <div className="space-y-2">
        <Label htmlFor="username">Usuário</Label>
        <Input
          id="username"
          autoCapitalize="none"
          autoComplete="username"
          spellCheck={false}
          placeholder="aurora_leitora"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="display-name">Nome de exibição</Label>
        <Input id="display-name" autoComplete="nickname" value={displayName} onChange={(event) => setDisplayName(event.target.value)} maxLength={40} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="email">E-mail</Label>
        <Input id="email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Senha</Label>
        <Input id="password" type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={6} />
      </div>
      <FormError message={error} />
      {info ? <p className="rounded-xl border border-accent/30 bg-accent/10 px-3 py-2 text-sm text-zinc-100">{info}</p> : null}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? 'Criando conta…' : 'Criar conta'}
      </Button>
      <p className="text-center text-sm text-zinc-400">
        Já tem conta?{' '}
        <a className="font-medium text-accent hover:underline" href={href('/login')}>
          Entrar
        </a>
      </p>
    </form>
  )
}
