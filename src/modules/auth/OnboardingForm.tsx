import { useEffect, useState, type SubmitEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar } from '@/components/Avatar';
import { FormError } from '@/components/FormError';
import { authErrorMessage, refreshProfile, useRequireSession } from '@/lib/auth';
import { consumeNext } from '@/lib/auth-storage';
import { fitImage } from '@/lib/image';
import { href } from '@/lib/paths';
import { avatarPresets, presetValue } from '@/lib/presets';
import { supabase } from '@/lib/supabase';
import { explainUploadError, uploadToBucket } from '@/lib/upload';

export function OnboardingForm() {
  const { session, profile, loading, error: profileError } = useRequireSession();
  const [name, setName] = useState('');
  const [preset, setPreset] = useState<string>(presetValue('fox'));
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  useEffect(() => {
    if (profile) setName((current) => current || profile.display_name);
  }, [profile]);

  useEffect(() => {
    if (loading || !profile?.onboarded_at) return;
    const next = consumeNext();
    window.location.replace(next ? href(next) : href('/'));
  }, [loading, profile?.onboarded_at]);

  if (loading) return <p className="text-sm text-zinc-400">Carregando sua conta…</p>;
  if (!session) {
    return (
      <p className="text-sm">
        <a className="font-medium text-accent hover:underline" href={href('/login/')}>
          Entre
        </a>{' '}
        para terminar o perfil.
      </p>
    );
  }

  if (profileError || !profile) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-zinc-300">{profileError ?? 'Não achei seu perfil. Recarregue a página.'}</p>
        <Button type="button" variant="secondary" onClick={() => void refreshProfile()}>
          Tentar de novo
        </Button>
      </div>
    );
  }

  if (profile.onboarded_at) {
    return <p className="text-sm text-zinc-400">Seu perfil já está pronto. Indo para o portal…</p>;
  }

  async function pick(next: File) {
    try {
      const blob = await fitImage(next, 512, 8 * 1024 * 1024);
      setFile(new File([blob], 'avatar.webp', { type: blob.type }));
      setPreview(URL.createObjectURL(blob));
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Não foi possível ler a imagem.');
    }
  }

  async function onSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session) return;
    const displayName = name.trim();
    if (displayName.length < 1 || displayName.length > 40) {
      setError('O nome precisa ter entre 1 e 40 caracteres.');
      return;
    }
    setPending(true);
    setError(null);
    try {
      let avatarUrl: string | null = preset;
      if (file) avatarUrl = await uploadToBucket('avatars', `${session.user.id}/avatar.webp`, file);
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ display_name: displayName, avatar_url: avatarUrl, onboarded_at: new Date().toISOString() })
        .eq('id', session.user.id);
      if (updateError) {
        setError(authErrorMessage(updateError.message));
        return;
      }
      await refreshProfile();
      const next = consumeNext();
      window.location.href = next ? href(next) : href('/');
    } catch (caught) {
      setError(explainUploadError(caught));
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="space-y-4" onSubmit={onSubmit}>
      <div className="flex justify-center">
        <Avatar name={name || 'R'} url={preview || preset} size="lg" />
      </div>
      <div className="grid grid-cols-6 gap-2">
        {avatarPresets.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-label={item.label}
            aria-pressed={!file && preset === presetValue(item.id)}
            className={!file && preset === presetValue(item.id) ? 'rounded-full ring-2 ring-accent' : 'rounded-full'}
            onClick={() => {
              setFile(null);
              setPreview(null);
              setPreset(presetValue(item.id));
            }}
          >
            <Avatar name={item.label} url={presetValue(item.id)} size="sm" />
          </button>
        ))}
      </div>
      <div className="space-y-2">
        <Label htmlFor="onboard-photo">Ou envie uma foto</Label>
        <Input
          id="onboard-photo"
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          onChange={(event) => {
            const next = event.target.files?.[0];
            if (next) void pick(next);
          }}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="onboard-name">Nome de exibição</Label>
        <Input
          id="onboard-name"
          value={name}
          maxLength={40}
          onChange={(event) => setName(event.target.value)}
          required
        />
      </div>
      <FormError message={error} />
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? 'Salvando…' : 'Entrar no portal'}
      </Button>
    </form>
  );
}
