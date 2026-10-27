import { useEffect, useState, type SubmitEvent } from 'react';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PasswordField } from '@/components/PasswordField';
import { FormError } from '@/components/FormError';
import { authErrorMessage, refreshProfile, useRequireSession } from '@/lib/auth';
import { href } from '@/lib/paths';
import { passwordAcceptable } from '@/lib/password';
import { absoluteHref } from '@/lib/site';
import { supabase } from '@/lib/supabase';
import { toast } from '@/lib/toast';
import type { ProfileVisibility } from '@/lib/database.types';

const selectClass = 'h-10 w-full rounded-xl border border-white/10 bg-[#16161e] px-3 text-sm';

async function functionMessage(error: unknown): Promise<string> {
  if (error instanceof FunctionsHttpError) {
    try {
      const payload = (await (error.context as Response).json()) as { error?: string };
      if (payload.error) return payload.error;
    } catch {
      return 'Não foi possível apagar a conta.';
    }
  }
  return 'Não foi possível apagar a conta. Publique a function delete-account.';
}

export function AccountForm() {
  const { session, profile, loading, error: loadError } = useRequireSession();
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [emailPending, setEmailPending] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [nextPassword, setNextPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordPending, setPasswordPending] = useState(false);
  const [visibility, setVisibility] = useState<ProfileVisibility>('public');
  const [showAdult, setShowAdult] = useState(false);
  const [showActivity, setShowActivity] = useState(true);
  const [allowFriends, setAllowFriends] = useState(true);
  const [privacyError, setPrivacyError] = useState<string | null>(null);
  const [privacyPending, setPrivacyPending] = useState(false);
  const [confirmName, setConfirmName] = useState('');
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deletePending, setDeletePending] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setVisibility(profile.profile_visibility ?? 'public');
    setShowAdult(Boolean(profile.show_adult));
    setShowActivity(profile.show_activity !== false);
    setAllowFriends(profile.allow_friend_requests !== false);
  }, [profile]);

  if (loading) return <div className="h-64 animate-pulse rounded-2xl border border-white/5 bg-card" />;
  if (!session) return <p className="text-sm text-zinc-400">Indo para o login…</p>;
  if (loadError || !profile) {
    return (
      <section className="rounded-2xl border border-white/5 bg-card p-6">
        <p className="text-sm text-zinc-300">{loadError ?? 'Não achei seu perfil.'}</p>
        <Button type="button" className="mt-4" variant="secondary" onClick={() => void refreshProfile()}>
          Tentar de novo
        </Button>
      </section>
    );
  }

  const account = profile;
  const currentEmail = session.user.email ?? '';

  async function onEmail(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const next = email.trim();
    if (!next.includes('@')) {
      setEmailError('Informe um e-mail válido.');
      return;
    }
    if (next.toLowerCase() === currentEmail.toLowerCase()) {
      setEmailError('Esse já é o e-mail da conta.');
      return;
    }
    setEmailPending(true);
    setEmailError(null);
    const { error } = await supabase.auth.updateUser({ email: next }, { emailRedirectTo: absoluteHref('/conta/') });
    setEmailPending(false);
    if (error) {
      setEmailError(authErrorMessage(error.message));
      return;
    }
    setEmail('');
    toast('Enviamos a confirmação. Abra o link no e-mail novo e, se chegar, no antigo também.');
  }

  async function onPassword(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!passwordAcceptable(nextPassword)) {
      setPasswordError('A senha precisa ter 8 caracteres ou mais e um pouco mais de variedade.');
      return;
    }
    if (!currentEmail) {
      setPasswordError('Não achei o e-mail desta conta.');
      return;
    }
    setPasswordPending(true);
    setPasswordError(null);
    const { error: reauthError } = await supabase.auth.signInWithPassword({
      email: currentEmail,
      password: currentPassword,
    });
    if (reauthError) {
      setPasswordPending(false);
      setPasswordError(authErrorMessage(reauthError.message));
      return;
    }
    const { error } = await supabase.auth.updateUser({ password: nextPassword });
    setPasswordPending(false);
    if (error) {
      setPasswordError(authErrorMessage(error.message));
      return;
    }
    setCurrentPassword('');
    setNextPassword('');
    toast('Senha atualizada neste aparelho.');
  }

  async function onPrivacy(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setPrivacyPending(true);
    setPrivacyError(null);
    const { error } = await supabase
      .from('profiles')
      .update({
        profile_visibility: visibility,
        show_adult: showAdult,
        show_activity: showActivity,
        allow_friend_requests: allowFriends,
      })
      .eq('id', account.id);
    setPrivacyPending(false);
    if (error) {
      setPrivacyError(authErrorMessage(error.message));
      return;
    }
    await refreshProfile();
    toast('Preferências salvas.');
  }

  async function signOutOthers() {
    const { error } = await supabase.auth.signOut({ scope: 'others' });
    if (error) {
      toast(authErrorMessage(error.message));
      return;
    }
    toast('Os outros aparelhos saíram. Este continua conectado.');
  }

  async function onDelete(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (confirmName.trim().toLowerCase() !== account.username) {
      setDeleteError('Digite seu usuário exatamente como está no perfil.');
      return;
    }
    if (!currentEmail) {
      setDeleteError('Não achei o e-mail desta conta.');
      return;
    }
    setDeletePending(true);
    setDeleteError(null);
    const { error: reauthError } = await supabase.auth.signInWithPassword({
      email: currentEmail,
      password: deletePassword,
    });
    if (reauthError) {
      setDeletePending(false);
      setDeleteError(authErrorMessage(reauthError.message));
      return;
    }
    const { error } = await supabase.functions.invoke('delete-account', {
      body: { username: account.username },
    });
    if (error) {
      setDeletePending(false);
      setDeleteError(await functionMessage(error));
      return;
    }
    await supabase.auth.signOut({ scope: 'local' });
    window.location.href = href('/');
  }

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">Conta</h1>
        <p className="mt-1 text-sm text-zinc-400">
          E-mail, senha, quem vê você e este aparelho. O perfil em si continua em Editar perfil.
        </p>
      </header>

      <form className="space-y-3 rounded-2xl border border-white/5 bg-card p-5" onSubmit={onEmail}>
        <h2 className="font-semibold">E-mail</h2>
        <p className="text-sm text-zinc-400">Atual: {currentEmail || 'não informado'}</p>
        <div className="space-y-1">
          <Label htmlFor="account-email">Novo e-mail</Label>
          <Input
            id="account-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </div>
        <FormError message={emailError} />
        <Button type="submit" disabled={emailPending}>
          {emailPending ? 'Enviando…' : 'Trocar e-mail'}
        </Button>
      </form>

      <form className="space-y-3 rounded-2xl border border-white/5 bg-card p-5" onSubmit={onPassword}>
        <h2 className="font-semibold">Senha</h2>
        <p className="text-sm text-zinc-400">
          Se você entra só com o link do e-mail e ainda não tem senha, saia e use Esqueci a senha.
        </p>
        <PasswordField
          label="Senha atual"
          value={currentPassword}
          onChange={setCurrentPassword}
          autoComplete="current-password"
        />
        <PasswordField
          label="Nova senha"
          value={nextPassword}
          onChange={setNextPassword}
          autoComplete="new-password"
          showMeter
        />
        <FormError message={passwordError} />
        <Button type="submit" disabled={passwordPending}>
          {passwordPending ? 'Salvando…' : 'Atualizar senha'}
        </Button>
      </form>

      <form className="space-y-3 rounded-2xl border border-white/5 bg-card p-5" onSubmit={onPrivacy}>
        <h2 className="font-semibold">Privacidade</h2>
        <div className="space-y-1">
          <Label htmlFor="profile-visibility">Quem vê o perfil</Label>
          <select
            id="profile-visibility"
            className={selectClass}
            value={visibility}
            onChange={(event) => setVisibility(event.target.value as ProfileVisibility)}
          >
            <option value="public">Público, inclusive quem não entrou</option>
            <option value="members">Só quem tem conta</option>
            <option value="private">Só eu</option>
          </select>
          <p className="text-xs text-zinc-500">
            Perfil privado sai do ranking e do chat dos outros. XP continua no servidor; o ranking só esconde quem
            pediu.
          </p>
        </div>
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            className="mt-1"
            checked={showActivity}
            onChange={(event) => setShowActivity(event.target.checked)}
          />
          <span>Mostrar nível, XP e tempo jogado no perfil e no ranking</span>
        </label>
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            className="mt-1"
            checked={allowFriends}
            onChange={(event) => setAllowFriends(event.target.checked)}
          />
          <span>Aceitar pedidos de amizade</span>
        </label>
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            className="mt-1"
            checked={showAdult}
            onChange={(event) => setShowAdult(event.target.checked)}
          />
          <span>Tenho 18 anos ou mais e quero ver jogos marcados como adultos</span>
        </label>
        <p className="text-xs text-zinc-500">Isso é uma declaração sua. Não pedimos documento.</p>
        <FormError message={privacyError} />
        <Button type="submit" disabled={privacyPending}>
          {privacyPending ? 'Salvando…' : 'Salvar privacidade'}
        </Button>
      </form>

      <section className="space-y-3 rounded-2xl border border-white/5 bg-card p-5">
        <h2 className="font-semibold">Outros aparelhos</h2>
        <p className="text-sm text-zinc-400">O botão Sair do topo encerra só este navegador.</p>
        <Button type="button" variant="secondary" onClick={() => void signOutOthers()}>
          Sair dos outros aparelhos
        </Button>
      </section>

      <form className="space-y-3 rounded-2xl border border-red-400/20 bg-card p-5" onSubmit={onDelete}>
        <h2 className="font-semibold text-red-100">Apagar conta</h2>
        <p className="text-sm text-zinc-400">
          Apaga o perfil, o progresso e as conversas. Não tem volta. Digite <strong>{account.username}</strong> para
          confirmar.
        </p>
        <div className="space-y-1">
          <Label htmlFor="delete-username">Usuário</Label>
          <Input
            id="delete-username"
            autoComplete="off"
            value={confirmName}
            onChange={(event) => setConfirmName(event.target.value)}
            required
          />
        </div>
        <p className="text-sm text-zinc-400">
          Se você nunca criou uma senha, saia e use Esqueci a senha. Depois volte aqui.
        </p>
        <PasswordField
          label="Senha atual"
          value={deletePassword}
          onChange={setDeletePassword}
          autoComplete="current-password"
        />
        <FormError message={deleteError} />
        <Button type="submit" variant="outline" className="text-red-200" disabled={deletePending}>
          {deletePending ? 'Apagando…' : 'Apagar minha conta'}
        </Button>
      </form>
    </div>
  );
}
