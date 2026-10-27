import { isUuid, json, readUser, corsHeaders } from '../_shared/http.ts'

type GameInput = {
  id?: string
  slug?: string
  title?: string
  description?: string | null
  cover_url?: string | null
  web_path?: string
  windows_url?: string | null
  mac_url?: string | null
  linux_url?: string | null
  file_size_mb?: number | null
  published?: boolean
}

const platforms = new Set(['windows', 'mac', 'linux'])

function safeName(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Método não permitido' }, 405)

  const auth = await readUser(req)
  if (!auth.ok) return auth.response

  const { data: profile, error: profileError } = await auth.ctx.admin
    .from('profiles')
    .select('role')
    .eq('id', auth.ctx.userId)
    .maybeSingle()

  if (profileError || profile?.role !== 'admin') {
    return json({ error: 'Apenas administradores' }, 403)
  }

  let body: { game?: GameInput; platform?: string; filename?: string; slug?: string }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'JSON inválido' }, 400)
  }

  let saved: GameInput | null = null
  if (body.game) {
    const game = body.game
    if (!game.slug || !game.title || !game.web_path) {
      return json({ error: 'slug, title e web_path são obrigatórios' }, 400)
    }
    const row = {
      slug: game.slug,
      title: game.title,
      description: game.description ?? null,
      cover_url: game.cover_url ?? null,
      web_path: game.web_path,
      windows_url: game.windows_url ?? null,
      mac_url: game.mac_url ?? null,
      linux_url: game.linux_url ?? null,
      file_size_mb: game.file_size_mb ?? null,
      published: game.published ?? true,
    }
    const query = game.id && isUuid(game.id)
      ? auth.ctx.admin.from('games').update(row).eq('id', game.id).select('*').single()
      : auth.ctx.admin.from('games').insert(row).select('*').single()
    const { data, error } = await query
    if (error) return json({ error: 'Não foi possível salvar o jogo' }, 400)
    saved = data
  }

  let upload: { path: string; token: string; signedUrl: string; publicUrl: string } | null = null
  if (body.platform || body.filename) {
    if (!platforms.has(body.platform ?? '') || !body.filename || !body.slug) {
      return json({ error: 'Informe slug, platform e filename' }, 400)
    }
    const path = `${body.slug}/${body.platform}/${safeName(body.filename)}`
    const { data, error } = await auth.ctx.admin.storage.from('game-builds').createSignedUploadUrl(path)
    if (error || !data) return json({ error: 'Não foi possível assinar o upload' }, 500)
    const publicUrl = auth.ctx.admin.storage.from('game-builds').getPublicUrl(path).data.publicUrl
    upload = { path, token: data.token, signedUrl: data.signedUrl, publicUrl }
  }

  if (!saved && !upload) return json({ error: 'Nada para fazer' }, 400)
  return json({ ok: true, game: saved, upload })
})
