import { useEffect, useState, type SubmitEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PasswordField } from '@/components/PasswordField';
import { FormError } from '@/components/FormError';
import { authErrorMessage, continueAfterSession } from '@/lib/auth';
import { rememberPreference, setRememberPreference, storeNext } from '@/lib/auth-storage';
import { href } from '@/lib/paths';
import { absoluteHref } from '@/lib/site';
import { supabase } from '@/lib/supabase';

export function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [magic, setMagic] = useState(false);
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const emailError = email.length > 0 && !email.includes('@') ? 'Informe um e-mail válido.' : null;

  useEffect(() => {
    setRemember(rememberPreference());
    const next = new URLSearchParams(window.location.search).get('next');
    if (next) storeNext(next);
    let cancelled = false;
    void supabase.auth.getSession().then(async ({ data }) => {
      if (cancelled || !data.session) return;
      const result = await continueAfterSession();
      if (!cancelled && result === 'network') {
        setError('Sem conexão com o servidor. Tente de novo.');
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function onSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setInfo(null);
    setRememberPreference(remember);
    if (magic) {
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: { emailRedirectTo: absoluteHref('/onboarding/') },
      });
      setPending(false);
      if (otpError) {
        setError(authErrorMessage(otpError.message));
        return;
      }
      setInfo('Enviei um link para o seu e-mail. Ele abre direto na sua conta.');
      return;
    }
    const { error: signError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (signError) {
      setPending(false);
      const message = authErrorMessage(signError.message);
      setError(message);
      if (signError.message.toLowerCase().includes('not confirmed')) {
        window.location.href = `${href('/confirm/')}?email=${encodeURIComponent(email.trim())}`;
      }
      return;
    }
    const result = await continueAfterSession();
    if (result === 'network') {
      setPending(false);
      setError('Sem conexão com o servidor. Tente de novo.');
    }
  }

  return (
    <form className="space-y-4" onSubmit={onSubmit}>
      <div className="space-y-2">
        <Label htmlFor="email">E-mail</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          value={email}
          aria-invalid={Boolean(emailError)}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
        {emailError ? <p className="text-xs text-red-200">{emailError}</p> : null}
      </div>
      {magic ? null : <PasswordField value={password} onChange={setPassword} autoComplete="current-password" />}
      <label className="flex items-start gap-2 text-sm text-zinc-300">
        <input
          type="checkbox"
          className="mt-1"
          checked={remember}
          onChange={(event) => setRemember(event.target.checked)}
        />
        <span>
          Lembrar neste aparelho
          {remember ? null : (
            <span className="mt-0.5 block text-xs text-zinc-500">A sessão acaba quando você fechar o navegador.</span>
          )}
        </span>
      </label>
      <FormError message={error} />
      {info ? (
        <p className="rounded-xl border border-accent/30 bg-accent/10 px-3 py-2 text-sm" role="status">
          {info}
        </p>
      ) : null}
      <Button type="submit" className="w-full" disabled={pending || Boolean(emailError)}>
        {pending ? 'Aguarde…' : magic ? 'Enviar link' : 'Entrar'}
      </Button>
      <div className="flex flex-col gap-2 text-center text-sm text-zinc-400">
        <button
          type="button"
          className="font-medium text-accent hover:underline"
          onClick={() => setMagic((value) => !value)}
        >
          {magic ? 'Entrar com senha' : 'Entrar com link no e-mail'}
        </button>
        <a className="font-medium text-accent hover:underline" href={href('/forgot/')}>
          Esqueci a senha
        </a>
        <p>
          Novo por aqui?{' '}
          <a className="font-medium text-accent hover:underline" href={href('/register/')}>
            Criar conta
          </a>
        </p>
      </div>
    </form>
  );
}
