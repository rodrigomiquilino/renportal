import { useEffect, useState, type SubmitEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PasswordField } from '@/components/PasswordField';
import { FormError } from '@/components/FormError';
import { authErrorMessage, continueAfterSession } from '@/lib/auth';
import { USERNAME_PATTERN, normalizeUsername } from '@/lib/format';
import { passwordAcceptable } from '@/lib/password';
import { href } from '@/lib/paths';
import { absoluteHref } from '@/lib/site';
import { supabase } from '@/lib/supabase';
import { lookupUsername, type UsernameState } from '@/lib/username';

export function RegisterForm() {
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [usernameState, setUsernameState] = useState<UsernameState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void supabase.auth.getSession().then(async ({ data }) => {
      if (cancelled || !data.session) return;
      await continueAfterSession();
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const next = normalizeUsername(username);
    if (!next) {
      setUsernameState('idle');
      return;
    }
    if (!USERNAME_PATTERN.test(next)) {
      setUsernameState('invalid');
      return;
    }
    setUsernameState('checking');
    const timer = window.setTimeout(() => {
      void lookupUsername(next).then(setUsernameState);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [username]);

  const usernameHint =
    usernameState === 'checking'
      ? 'Conferindo se está livre…'
      : usernameState === 'available'
        ? 'Este usuário está livre.'
        : usernameState === 'taken'
          ? 'Alguém já usa esse nome.'
          : usernameState === 'invalid'
            ? '3 a 24 caracteres: letras minúsculas, números e _.'
            : usernameState === 'error'
              ? 'Não consegui conferir agora. Você ainda pode tentar criar a conta.'
              : 'Esse nome aparece no endereço do perfil.';

  async function onSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextUsername = normalizeUsername(username);
    if (!USERNAME_PATTERN.test(nextUsername) || usernameState === 'taken') {
      setError('Escolha um usuário disponível.');
      return;
    }
    if (!passwordAcceptable(password)) {
      setError('A senha precisa ter 8 caracteres ou mais e um pouco mais de variedade.');
      return;
    }
    setPending(true);
    setError(null);
    const { data, error: signError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo: absoluteHref('/confirm/'),
        data: {
          username: nextUsername,
          display_name: displayName.trim() || nextUsername,
        },
      },
    });
    setPending(false);
    if (signError) {
      setError(authErrorMessage(signError.message));
      return;
    }
    if (data.session) {
      window.location.href = href('/onboarding/');
      return;
    }
    window.location.href = `${href('/confirm/')}?email=${encodeURIComponent(email.trim())}`;
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
          value={username}
          aria-invalid={usernameState === 'taken' || usernameState === 'invalid'}
          aria-describedby="register-username-hint"
          onChange={(event) => setUsername(event.target.value)}
          required
        />
        <p id="register-username-hint" className="text-xs text-zinc-400" role="status">
          {usernameHint}
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="display-name">Como quer ser chamado</Label>
        <Input
          id="display-name"
          autoComplete="nickname"
          value={displayName}
          maxLength={40}
          onChange={(event) => setDisplayName(event.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="email">E-mail</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
      </div>
      <PasswordField value={password} onChange={setPassword} autoComplete="new-password" showMeter />
      <FormError message={error} />
      <Button
        type="submit"
        className="w-full"
        disabled={pending || usernameState === 'taken' || usernameState === 'checking'}
      >
        {pending ? 'Criando conta…' : 'Criar conta'}
      </Button>
      <p className="text-center text-sm text-zinc-400">
        Já tem conta?{' '}
        <a className="font-medium text-accent hover:underline" href={href('/login/')}>
          Entrar
        </a>
      </p>
    </form>
  );
}
