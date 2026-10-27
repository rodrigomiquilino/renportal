import { useEffect, useState, type SubmitEvent } from 'react'
import { FunctionsHttpError } from '@supabase/supabase-js'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { FormError } from '@/components/FormError'
import { supabase } from '@/lib/supabase'
import { toast } from '@/lib/toast'
import type { Game } from '@/lib/database.types'

const empty = {
  id: '',
  slug: '',
  title: '',
  description: '',
  cover_url: '',
  web_path: '',
  file_size_mb: '',
  published: true,
}

export function GamesAdmin() {
  const [games, setGames] = useState<Game[]>([])
  const [form, setForm] = useState(empty)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function load() {
    const { data, error: loadError } = await supabase.from('games').select('*').order('created_at', { ascending: false })
    if (loadError) {
      setError('Não foi possível listar os jogos.')
      return
    }
    setGames(data ?? [])
  }

  useEffect(() => {
    void load()
  }, [])

  function edit(game: Game) {
    setForm({
      id: game.id,
      slug: game.slug,
      title: game.title,
      description: game.description ?? '',
      cover_url: game.cover_url ?? '',
      web_path: game.web_path,
      file_size_mb: game.file_size_mb == null ? '' : String(game.file_size_mb),
      published: game.published,
    })
  }

  async function onSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    setError(null)
    const row = {
      slug: form.slug.trim(),
      title: form.title.trim(),
      description: form.description.trim() || null,
      cover_url: form.cover_url.trim() || null,
      web_path: form.web_path.trim(),
      file_size_mb: form.file_size_mb ? Number(form.file_size_mb) : null,
      published: form.published,
    }
    const query = form.id
      ? supabase.from('games').update(row).eq('id', form.id)
      : supabase.from('games').insert(row)
    const { error: saveError } = await query
    setPending(false)
    if (saveError) {
      setError('Não foi possível salvar. O slug precisa ser único e em minúsculas.')
      return
    }
    toast('Jogo salvo.')
    setForm(empty)
    await load()
  }

  async function remove(id: string) {
    const { error: deleteError } = await supabase.from('games').delete().eq('id', id)
    if (deleteError) {
      setError('Não foi possível apagar.')
      return
    }
    await load()
  }

  async function upload(platform: 'windows' | 'mac' | 'linux', file: File | undefined) {
    if (!file || !form.slug || !form.id) {
      setError('Salve o jogo antes de enviar o build.')
      return
    }
    setPending(true)
    setError(null)
    const { data, error: signError } = await supabase.functions.invoke('admin-upload-game', {
      body: { slug: form.slug, platform, filename: file.name },
    })
    if (signError || !data?.upload) {
      let message = 'Não foi possível pedir a URL de upload. Publique a function admin-upload-game.'
      if (signError instanceof FunctionsHttpError) {
        try {
          const payload = (await (signError.context as Response).json()) as { error?: string }
          if (payload.error) message = payload.error
        } catch {
          message = signError.message
        }
      }
      setError(message)
      setPending(false)
      return
    }
    const upload = data.upload as { path: string; token: string; publicUrl: string }
    const sent = await supabase.storage.from('game-builds').uploadToSignedUrl(upload.path, upload.token, file)
    if (sent.error) {
      setError('O arquivo não subiu. Confira o bucket game-builds.')
      setPending(false)
      return
    }
    const patch =
      platform === 'windows'
        ? { windows_url: upload.publicUrl }
        : platform === 'mac'
          ? { mac_url: upload.publicUrl }
          : { linux_url: upload.publicUrl }
    await supabase.from('games').update(patch).eq('id', form.id)
    setPending(false)
    toast(`Build de ${platform} enviado.`)
    await load()
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <form onSubmit={onSubmit} className="space-y-3 rounded-2xl border border-white/5 bg-card p-4">
        <h2 className="font-semibold">{form.id ? 'Editar jogo' : 'Novo jogo'}</h2>
        <Input placeholder="slug" value={form.slug} onChange={(event) => setForm({ ...form, slug: event.target.value })} required />
        <Input placeholder="Título" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} required />
        <Input placeholder="web_path (/games/slug/play/index.html)" value={form.web_path} onChange={(event) => setForm({ ...form, web_path: event.target.value })} required />
        <Input placeholder="URL da capa" value={form.cover_url} onChange={(event) => setForm({ ...form, cover_url: event.target.value })} />
        <Input placeholder="Tamanho em MB" value={form.file_size_mb} onChange={(event) => setForm({ ...form, file_size_mb: event.target.value })} />
        <Textarea placeholder="Sinopse" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.published} onChange={(event) => setForm({ ...form, published: event.target.checked })} />
          Publicado
        </label>
        <FormError message={error} />
        <div className="flex gap-2">
          <Button type="submit" disabled={pending}>{pending ? 'Salvando…' : 'Salvar'}</Button>
          {form.id ? <Button type="button" variant="secondary" onClick={() => setForm(empty)}>Limpar</Button> : null}
        </div>
        {form.id ? (
          <div className="grid gap-2 border-t border-white/5 pt-3 text-sm">
            <p className="text-zinc-400">Builds de desktop. O arquivo vai para o Storage e a URL pública entra na ficha.</p>
            {(['windows', 'mac', 'linux'] as const).map((platform) => (
              <label key={platform} className="flex items-center justify-between gap-3">
                <span className="capitalize">{platform}</span>
                <input
                  type="file"
                  onChange={(event) => {
                    const file = event.target.files?.[0]
                    void upload(platform, file)
                    event.target.value = ''
                  }}
                />
              </label>
            ))}
          </div>
        ) : null}
      </form>
      <ul className="space-y-2">
        {games.map((game) => (
          <li key={game.id} className="rounded-xl border border-white/5 bg-card p-3 text-sm">
            <p className="font-medium">{game.title}</p>
            <p className="text-xs text-zinc-500">{game.slug} · {game.published ? 'publicado' : 'oculto'}</p>
            <div className="mt-2 flex gap-2">
              <Button type="button" size="sm" variant="secondary" onClick={() => edit(game)}>Editar</Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => remove(game.id)}>Apagar</Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
