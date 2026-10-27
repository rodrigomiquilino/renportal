import { useState, type SubmitEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { FormError } from '@/components/FormError'
import { authErrorMessage, refreshProfile, useAuth } from '@/lib/auth'
import { USERNAME_PATTERN, normalizeUsername } from '@/lib/format'
import { supabase } from '@/lib/supabase'
import { toast } from '@/lib/toast'

/** O dono edita só campos não críticos. XP e papel ficam no banco. */
export function EditProfileDialog() {
  const { profile } = useAuth()
  const [open, setOpen] = useState(false)
  const [displayName, setDisplayName] = useState(profile?.display_name ?? '')
  const [username, setUsername] = useState(profile?.username ?? '')
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url ?? '')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  if (!profile) return null
  const current = profile

  function onOpenChange(next: boolean) {
    setOpen(next)
      if (next) {
      setDisplayName(current.display_name)
      setUsername(current.username)
      setAvatarUrl(current.avatar_url ?? '')
      setError(null)
    }
  }

  async function onSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    const nextUsername = normalizeUsername(username)
    const nextName = displayName.trim()
    if (!USERNAME_PATTERN.test(nextUsername)) {
      setError('Usuário: 3 a 24 caracteres, só letras minúsculas, números e _.')
      return
    }
    if (nextName.length < 1 || nextName.length > 40) {
      setError('O nome de exibição precisa ter entre 1 e 40 caracteres.')
      return
    }
    const nextAvatar = avatarUrl.trim()
    if (nextAvatar && !/^https?:\/\//i.test(nextAvatar)) {
      setError('A foto precisa ser um link http(s).')
      return
    }

    setPending(true)
    setError(null)
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        username: nextUsername,
        display_name: nextName,
        avatar_url: nextAvatar || null,
      })
      .eq('id', current.id)

    setPending(false)
    if (updateError) {
      setError(authErrorMessage(updateError.message))
      return
    }
    await refreshProfile()
    toast('Perfil atualizado.')
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant="secondary" size="sm" className="w-full">
          Editar perfil
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar perfil</DialogTitle>
          <DialogDescription>Nome, usuário e foto. XP, nível e tempo de jogo ficam com o servidor.</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={onSubmit}>
          <div className="space-y-2">
            <Label htmlFor="display-name">Nome de exibição</Label>
            <Input id="display-name" value={displayName} maxLength={40} onChange={(event) => setDisplayName(event.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="username">Usuário</Label>
            <Input
              id="username"
              value={username}
              maxLength={24}
              autoCapitalize="none"
              spellCheck={false}
              onChange={(event) => setUsername(event.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="avatar-url">URL da foto</Label>
            <Input
              id="avatar-url"
              type="url"
              placeholder="https://"
              value={avatarUrl}
              onChange={(event) => setAvatarUrl(event.target.value)}
            />
          </div>
          <FormError message={error} />
          <Button type="submit" disabled={pending} className="w-full">
            {pending ? 'Salvando…' : 'Salvar'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
