import { useEffect, useState, type SubmitEvent } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FormError } from '@/components/FormError';
import { Avatar } from '@/components/Avatar';
import { authErrorMessage, refreshProfile, useAuth } from '@/lib/auth';
import { USERNAME_PATTERN, normalizeUsername } from '@/lib/format';
import { fitImage } from '@/lib/image';
import { avatarPresets, presetValue, resolveMediaUrl } from '@/lib/presets';
import { supabase } from '@/lib/supabase';
import { toast } from '@/lib/toast';
import { explainUploadError, uploadToBucket } from '@/lib/upload';
import { lookupUsername, type UsernameState } from '@/lib/username';

export function EditProfileDialog() {
  const { profile } = useAuth();
  const [open, setOpen] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [avatarValue, setAvatarValue] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);
  const [usernameState, setUsernameState] = useState<UsernameState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!open) return;
    const next = normalizeUsername(username);
    if (!next || next === profile?.username) {
      setUsernameState(next && USERNAME_PATTERN.test(next) ? 'available' : 'idle');
      return;
    }
    setUsernameState('checking');
    const timer = window.setTimeout(() => {
      void lookupUsername(next, profile?.id).then(setUsernameState);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [username, open, profile?.id, profile?.username]);

  if (!profile) return null;
  const current = profile;

  function reset() {
    setDisplayName(current.display_name);
    setUsername(current.username);
    setAvatarValue(current.avatar_url);
    setAvatarFile(null);
    setAvatarPreview(null);
    setBannerFile(null);
    setBannerPreview(resolveMediaUrl(current.banner_url));
    setError(null);
    setUsernameState('available');
  }

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (next) reset();
  }

  async function pickAvatar(file: File) {
    try {
      const blob = await fitImage(file, 512, 8 * 1024 * 1024);
      setAvatarFile(new File([blob], 'avatar.webp', { type: blob.type }));
      setAvatarPreview(URL.createObjectURL(blob));
      setAvatarValue(null);
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Não foi possível ler a imagem.');
    }
  }

  async function pickBanner(file: File) {
    try {
      const blob = await fitImage(file, 1600, 8 * 1024 * 1024);
      setBannerFile(new File([blob], 'banner.webp', { type: blob.type }));
      setBannerPreview(URL.createObjectURL(blob));
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Não foi possível ler a imagem.');
    }
  }

  async function onSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextUsername = normalizeUsername(username);
    const nextName = displayName.trim();
    if (!USERNAME_PATTERN.test(nextUsername)) {
      setError('Usuário: 3 a 24 caracteres, só letras minúsculas, números e _.');
      return;
    }
    if (usernameState === 'taken') {
      setError('Este nome de usuário já está em uso.');
      return;
    }
    if (nextName.length < 1 || nextName.length > 40) {
      setError('O nome de exibição precisa ter entre 1 e 40 caracteres.');
      return;
    }

    setPending(true);
    setError(null);
    try {
      let nextAvatar = avatarValue;
      let nextBanner = current.banner_url;
      if (avatarFile) {
        nextAvatar = await uploadToBucket('avatars', `${current.id}/avatar.webp`, avatarFile);
      }
      if (bannerFile) {
        nextBanner = await uploadToBucket('avatars', `${current.id}/banner.webp`, bannerFile);
      }
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          username: nextUsername,
          display_name: nextName,
          avatar_url: nextAvatar,
          banner_url: nextBanner,
        })
        .eq('id', current.id);
      if (updateError) {
        setError(authErrorMessage(updateError.message));
        return;
      }
      await refreshProfile();
      toast('Perfil atualizado.');
      setOpen(false);
    } catch (caught) {
      setError(explainUploadError(caught));
    } finally {
      setPending(false);
    }
  }

  const previewUrl = avatarPreview || resolveMediaUrl(avatarValue);
  const usernameHint =
    usernameState === 'checking'
      ? 'Conferindo…'
      : usernameState === 'available'
        ? 'Disponível.'
        : usernameState === 'taken'
          ? 'Já existe uma conta com esse usuário.'
          : usernameState === 'invalid'
            ? 'Use 3 a 24 caracteres: letras minúsculas, números e _.'
            : usernameState === 'error'
              ? 'Não consegui conferir agora. Você ainda pode tentar salvar.'
              : '';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant="secondary" size="sm" className="w-full">
          Editar perfil
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar perfil</DialogTitle>
          <DialogDescription>Nome, usuário e imagens. XP e nível continuam com o servidor.</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={onSubmit}>
          {bannerPreview ? (
            <img src={bannerPreview} alt="" className="h-24 w-full rounded-xl object-cover" />
          ) : (
            <div className="h-24 rounded-xl bg-white/5" />
          )}
          <div className="flex items-center gap-3">
            <Avatar
              name={displayName || current.display_name}
              url={previewUrl}
              border={current.active_border}
              size="lg"
            />
            <div className="text-sm text-zinc-400">A foto é cortada e reduzida antes de subir.</div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="avatar-file">Enviar foto</Label>
            <Input
              id="avatar-file"
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void pickAvatar(file);
              }}
            />
          </div>
          <fieldset>
            <legend className="text-sm font-medium">Ou escolha um pronto</legend>
            <div className="mt-2 grid grid-cols-6 gap-2">
              {avatarPresets.map((preset) => {
                const selected = avatarValue === presetValue(preset.id) && !avatarFile;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    aria-label={preset.label}
                    aria-pressed={selected}
                    className={selected ? 'rounded-full ring-2 ring-accent' : 'rounded-full'}
                    onClick={() => {
                      setAvatarFile(null);
                      setAvatarPreview(null);
                      setAvatarValue(presetValue(preset.id));
                    }}
                  >
                    <Avatar name={preset.label} url={presetValue(preset.id)} size="sm" />
                  </button>
                );
              })}
            </div>
          </fieldset>
          <div className="space-y-2">
            <Label htmlFor="banner-file">Banner</Label>
            <Input
              id="banner-file"
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void pickBanner(file);
              }}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="display-name">Nome de exibição</Label>
            <Input
              id="display-name"
              value={displayName}
              maxLength={40}
              onChange={(event) => setDisplayName(event.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="username">Usuário</Label>
            <Input
              id="username"
              value={username}
              maxLength={24}
              autoCapitalize="none"
              spellCheck={false}
              aria-invalid={usernameState === 'taken' || usernameState === 'invalid'}
              aria-describedby="username-hint"
              onChange={(event) => setUsername(event.target.value)}
              required
            />
            <p id="username-hint" className="text-xs text-zinc-400" role="status">
              {usernameHint}
            </p>
          </div>
          <FormError message={error} />
          <Button
            type="submit"
            disabled={pending || usernameState === 'taken' || usernameState === 'checking'}
            className="w-full"
          >
            {pending ? 'Salvando…' : 'Salvar'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
