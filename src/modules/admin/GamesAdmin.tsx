import { useEffect, useState, type SubmitEvent } from 'react';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { FormError } from '@/components/FormError';
import { DropZone } from '@/components/DropZone';
import { ConfirmButton } from '@/components/ConfirmButton';
import { fitImage } from '@/lib/image';
import { parseRenpyConfig } from '@/lib/renpy';
import { slugify } from '@/lib/slug';
import { supabase } from '@/lib/supabase';
import { toast } from '@/lib/toast';
import { explainUploadError, uploadSigned, uploadToBucket } from '@/lib/upload';
import { findOptionsEntry, listZipEntries, looksLikeWebBuild, unzipEntry } from '@/lib/zip';
import type { Game } from '@/lib/database.types';

type Platform = 'windows' | 'mac' | 'linux' | 'web';

type Draft = {
  id: string;
  slug: string;
  title: string;
  description: string;
  version: string;
  contentRating: 'everyone' | 'mature';
  published: boolean;
  coverPreview: string | null;
  coverFile: File | null;
  coverUrl: string | null;
  zipName: string;
  zipFile: File | null;
  platform: Platform;
  sizeMb: string;
  webPath: string | null;
  webUrl: string | null;
  windowsUrl: string | null;
  macUrl: string | null;
  linuxUrl: string | null;
  note: string;
};

const empty: Draft = {
  id: '',
  slug: '',
  title: '',
  description: '',
  version: '',
  contentRating: 'everyone',
  published: false,
  coverPreview: null,
  coverFile: null,
  coverUrl: null,
  zipName: '',
  zipFile: null,
  platform: 'windows',
  sizeMb: '',
  webPath: null,
  webUrl: null,
  windowsUrl: null,
  macUrl: null,
  linuxUrl: null,
  note: '',
};

const selectClass = 'h-10 w-full rounded-xl border border-white/10 bg-[#16161e] px-3 text-sm';

function bytesToMb(bytes: number): string {
  return (bytes / (1024 * 1024)).toFixed(1);
}

export function GamesAdmin() {
  const [games, setGames] = useState<Game[]>([]);
  const [draft, setDraft] = useState<Draft>(empty);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);

  async function load() {
    const { data, error: loadError } = await supabase
      .from('games')
      .select('*')
      .order('created_at', { ascending: false });
    if (loadError) {
      setError('Não foi possível listar os jogos.');
      return;
    }
    setGames(data ?? []);
  }

  useEffect(() => {
    void load();
  }, []);

  function edit(game: Game) {
    setDraft({
      ...empty,
      id: game.id,
      slug: game.slug,
      title: game.title,
      description: game.description ?? '',
      version: game.version ?? '',
      contentRating: game.content_rating === 'mature' ? 'mature' : 'everyone',
      published: game.published,
      coverPreview: game.cover_url,
      coverUrl: game.cover_url,
      sizeMb: game.file_size_mb == null ? '' : String(game.file_size_mb),
      webPath: game.web_path,
      webUrl: game.web_url,
      windowsUrl: game.windows_url,
      macUrl: game.mac_url,
      linuxUrl: game.linux_url,
    });
    setError(null);
    setProgress(null);
  }

  async function onZip(file: File) {
    setError(null);
    const next = { ...draft, zipFile: file, zipName: file.name, sizeMb: bytesToMb(file.size) };
    try {
      const entries = await listZipEntries(file);
      const options = findOptionsEntry(entries);
      if (options && options.uncompressedSize < 200_000) {
        const bytes = await unzipEntry(file, options);
        const meta = parseRenpyConfig(new TextDecoder().decode(bytes));
        if (meta.name && !draft.title) next.title = meta.name;
        if (meta.version) next.version = meta.version;
        next.note = meta.name ? `Li ${options.name}.` : 'Achei o options.rpy, mas sem nome.';
      } else {
        next.note = 'Não achei options.rpy. O nome fica o do arquivo.';
      }
      if (!next.title) next.title = file.name.replace(/\.zip$/i, '').replace(/[-_]+/g, ' ');
      if (!draft.id) next.slug = slugify(next.title);
      next.platform = looksLikeWebBuild(entries) ? 'web' : guessPlatform(file.name);
    } catch (caught) {
      next.note = caught instanceof Error ? caught.message : 'Não consegui ler o zip. Dá para publicar mesmo assim.';
      if (!next.title) next.title = file.name.replace(/\.zip$/i, '');
      if (!draft.id) next.slug = slugify(next.title);
    }
    setDraft(next);
  }

  async function onCover(file: File) {
    try {
      const blob = await fitImage(file, 1280, 8 * 1024 * 1024);
      setDraft((current) => ({
        ...current,
        coverFile: new File([blob], 'cover.webp', { type: blob.type }),
        coverPreview: URL.createObjectURL(blob),
      }));
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Não foi possível ler a capa.');
    }
  }

  async function onSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = draft.title.trim();
    const slug = slugify(draft.slug || title);
    if (!title || !slug) {
      setError('Preciso de um nome para gerar o endereço do jogo.');
      return;
    }
    setPending(true);
    setError(null);
    setProgress(0);
    try {
      const slugFree = await ensureSlug(slug, draft.id);
      let coverUrl = draft.coverUrl;
      if (draft.coverFile) {
        coverUrl = await uploadToBucket('covers', `${slugFree}/cover.webp`, draft.coverFile, (ratio) =>
          setProgress(ratio * 0.35),
        );
      }

      const platformUrl = (platform: Platform, url: string | null) => {
        if (draft.zipFile && draft.platform === platform) return null;
        return url;
      };
      const { data, error: signError } = await supabase.functions.invoke('admin-upload-game', {
        body: {
          slug: slugFree,
          game: {
            id: draft.id || undefined,
            slug: slugFree,
            title,
            description: draft.description.trim() || null,
            cover_url: coverUrl,
            web_path: draft.webPath,
            web_url: platformUrl('web', draft.webUrl),
            windows_url: platformUrl('windows', draft.windowsUrl),
            mac_url: platformUrl('mac', draft.macUrl),
            linux_url: platformUrl('linux', draft.linuxUrl),
            file_size_mb: draft.sizeMb ? Number(draft.sizeMb) : null,
            version: draft.version.trim() || null,
            published: draft.published,
          },
          ...(draft.zipFile ? { platform: draft.platform, filename: draft.zipFile.name } : {}),
        },
      });
      if (signError || !data?.game) {
        setError(await functionMessage(signError));
        return;
      }

      let publicUrl: string | null = null;
      if (draft.zipFile && data.upload) {
        const upload = data.upload as { path: string; token: string };
        await uploadSigned('game-builds', upload.path, upload.token, draft.zipFile, (ratio) =>
          setProgress(0.35 + ratio * 0.65),
        );
        publicUrl = supabase.storage.from('game-builds').getPublicUrl(upload.path).data.publicUrl;
        const patch =
          draft.platform === 'web'
            ? { web_url: publicUrl }
            : draft.platform === 'windows'
              ? { windows_url: publicUrl }
              : draft.platform === 'mac'
                ? { mac_url: publicUrl }
                : { linux_url: publicUrl };
        await supabase.from('games').update(patch).eq('id', data.game.id);
      }

      if (data.game?.id) {
        const { error: ratingError } = await supabase
          .from('games')
          .update({ content_rating: draft.contentRating })
          .eq('id', data.game.id);
        const ratingMissing = ratingError && /column|schema cache|content_rating/i.test(ratingError.message);
        if (ratingError && !(ratingMissing && draft.contentRating === 'everyone')) {
          setError('O jogo foi salvo, mas a classificação adulto precisa da migration 011_account_privacy.sql.');
          await load();
          return;
        }
      }

      toast(draft.published ? 'Jogo publicado.' : 'Jogo salvo como oculto.');
      setDraft(empty);
      setProgress(null);
      await load();
    } catch (caught) {
      setError(explainUploadError(caught));
    } finally {
      setPending(false);
    }
  }

  async function setPublished(game: Game, published: boolean) {
    const { error: updateError } = await supabase.from('games').update({ published }).eq('id', game.id);
    if (updateError) {
      setError('Não foi possível mudar a publicação.');
      return;
    }
    toast(published ? 'Jogo publicado.' : 'Jogo oculto.');
    await load();
  }

  async function remove(id: string) {
    const { error: deleteError } = await supabase.from('games').delete().eq('id', id);
    if (deleteError) {
      setError('Não foi possível apagar.');
      return;
    }
    if (draft.id === id) setDraft(empty);
    await load();
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
      <form onSubmit={onSubmit} className="space-y-4 rounded-2xl border border-white/5 bg-card p-4">
        <h2 className="font-semibold">{draft.id ? 'Editar jogo' : 'Novo jogo'}</h2>
        <DropZone
          accept=".zip,application/zip"
          label="Build em zip"
          hint="Arraste o zip do Ren'Py. Eu leio o nome e a versão se o options.rpy estiver lá."
          fileName={draft.zipName}
          disabled={pending}
          onFile={(file) => void onZip(file)}
        />
        <DropZone
          accept="image/png,image/jpeg,image/webp,image/gif"
          label="Capa"
          hint="PNG, JPG ou WebP. A imagem é reduzida antes do envio."
          fileName={draft.coverFile ? 'Capa pronta para enviar' : null}
          disabled={pending}
          onFile={(file) => void onCover(file)}
        />
        <article className="overflow-hidden rounded-2xl border border-white/10 bg-black/20">
          {draft.coverPreview ? (
            <img src={draft.coverPreview} alt="" className="h-40 w-full object-cover" />
          ) : (
            <div className="h-28 bg-white/5" />
          )}
          <div className="space-y-1 p-4 text-sm">
            <p className="text-xs text-zinc-500">Prévia</p>
            <p className="text-lg font-semibold">{draft.title || 'Sem nome ainda'}</p>
            <p className="text-zinc-400">
              /{draft.slug || 'slug'} {draft.version ? `· v${draft.version}` : ''}{' '}
              {draft.sizeMb ? `· ${draft.sizeMb} MB` : ''}
            </p>
            <p className="text-zinc-400">{draft.description || 'A sinopse aparece aqui.'}</p>
            {draft.note ? <p className="text-xs text-accent">{draft.note}</p> : null}
          </div>
        </article>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="game-title">Nome</Label>
            <Input
              id="game-title"
              value={draft.title}
              onChange={(event) => {
                const title = event.target.value;
                setDraft((current) => ({ ...current, title, slug: current.id ? current.slug : slugify(title) }));
              }}
              required
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="game-platform">Este arquivo é</Label>
            <select
              id="game-platform"
              className={selectClass}
              value={draft.platform}
              onChange={(event) => setDraft({ ...draft, platform: event.target.value as Platform })}
            >
              <option value="windows">Windows</option>
              <option value="mac">macOS</option>
              <option value="linux">Linux</option>
              <option value="web">Web (zip para download)</option>
            </select>
          </div>
        </div>
        <p className="text-xs text-zinc-500">Endereço gerado: /games/{draft.slug || '…'}/</p>
        <div className="space-y-1">
          <Label htmlFor="game-synopsis">Sinopse</Label>
          <Textarea
            id="game-synopsis"
            value={draft.description}
            onChange={(event) => setDraft({ ...draft, description: event.target.value })}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="game-rating">Classificação</Label>
          <select
            id="game-rating"
            className={selectClass}
            value={draft.contentRating}
            onChange={(event) =>
              setDraft({ ...draft, contentRating: event.target.value === 'mature' ? 'mature' : 'everyone' })
            }
          >
            <option value="everyone">Livre</option>
            <option value="mature">Adulto, 18+</option>
          </select>
          <p className="text-xs text-zinc-500">Adulto fica oculto até a pessoa declarar que tem 18 anos, em Conta.</p>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={draft.published}
            onChange={(event) => setDraft({ ...draft, published: event.target.checked })}
          />
          Publicar agora
        </label>
        {progress != null ? (
          <div className="space-y-1">
            <div
              className="h-2 overflow-hidden rounded-full bg-white/10"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(progress * 100)}
            >
              <div className="h-full bg-accent" style={{ width: `${Math.round(progress * 100)}%` }} />
            </div>
            <p className="text-xs text-zinc-400">{Math.round(progress * 100)}%</p>
          </div>
        ) : null}
        <FormError message={error} />
        <div className="flex gap-2">
          <Button type="submit" disabled={pending}>
            {pending ? 'Enviando…' : draft.published ? 'Publicar' : 'Salvar oculto'}
          </Button>
          {draft.id ? (
            <Button type="button" variant="secondary" onClick={() => setDraft(empty)}>
              Limpar
            </Button>
          ) : null}
        </div>
      </form>
      <ul className="space-y-2">
        {games.length === 0 ? (
          <li className="rounded-xl border border-white/5 px-3 py-4 text-sm text-zinc-400">Nenhum jogo cadastrado.</li>
        ) : null}
        {games.map((game) => (
          <li key={game.id} className="rounded-xl border border-white/5 bg-card p-3 text-sm">
            <p className="font-medium">{game.title}</p>
            <p className="text-xs text-zinc-500">
              {game.slug} · {game.published ? 'publicado' : 'oculto'}
              {game.version ? ` · v${game.version}` : ''}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button type="button" size="sm" variant="secondary" onClick={() => edit(game)}>
                Editar
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => void setPublished(game, !game.published)}>
                {game.published ? 'Ocultar' : 'Publicar'}
              </Button>
              <ConfirmButton
                label="Apagar"
                title={`Apagar ${game.title}?`}
                description="O jogo sai do catálogo. Os arquivos no Storage podem continuar lá."
                confirmLabel="Apagar"
                onConfirm={() => remove(game.id)}
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function guessPlatform(filename: string): Platform {
  const lower = filename.toLowerCase();
  if (lower.includes('mac') || lower.includes('dmg')) return 'mac';
  if (lower.includes('linux') || lower.includes('tar')) return 'linux';
  if (lower.includes('web')) return 'web';
  return 'windows';
}

async function ensureSlug(base: string, exceptId: string): Promise<string> {
  let slug = base;
  for (let attempt = 2; attempt < 40; attempt += 1) {
    const { data } = await supabase.from('games').select('id').eq('slug', slug).maybeSingle();
    if (!data || data.id === exceptId) return slug;
    slug = `${base}-${attempt}`.slice(0, 48);
  }
  return `${base}-${Date.now().toString(36)}`.slice(0, 48);
}

async function functionMessage(error: unknown): Promise<string> {
  if (error instanceof FunctionsHttpError) {
    try {
      const payload = (await (error.context as Response).json()) as { error?: string };
      if (payload.error) return payload.error;
    } catch {
      return error.message;
    }
  }
  return 'Não foi possível salvar. Publique a function admin-upload-game de novo.';
}
