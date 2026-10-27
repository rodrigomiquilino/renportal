import { useEffect, useState, type SubmitEvent } from 'react';
import { Button } from '@/components/ui/button';
import { PasswordField } from '@/components/PasswordField';
import { FormError } from '@/components/FormError';
import { authErrorMessage, useAuth } from '@/lib/auth';
import { passwordAcceptable } from '@/lib/password';
import { href } from '@/lib/paths';
import { supabase } from '@/lib/supabase';

export function ResetForm() {
  const { session, loading } = useAuth();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!loading) setReady(true);
  }, [loading]);

  async function onSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!passwordAcceptable(password)) {
      setError('A senha precisa ter 8 caracteres ou mais e um pouco mais de variedade.');
      return;
    }
    setPending(true);
    setError(null);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setPending(false);
    if (updateError) {
      setError(authErrorMessage(updateError.message));
      return;
    }
    window.location.href = href('/');
  }

  if (!ready) return <p className="text-sm text-zinc-400">Abrindo o link…</p>;

  if (!session) {
    return (
      <div className="space-y-3 text-sm text-zinc-300">
        <p>Esse link não vale mais, ou você abriu a página direto.</p>
        <a className="font-medium text-accent hover:underline" href={href('/forgot/')}>
          Pedir outro link
        </a>
      </div>
    );
  }

  return (
    <form className="space-y-4" onSubmit={onSubmit}>
      <PasswordField label="Nova senha" value={password} onChange={setPassword} autoComplete="new-password" showMeter />
      <FormError message={error} />
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? 'Salvando…' : 'Salvar senha'}
      </Button>
    </form>
  );
}
