import { useState, type SubmitEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FormError } from '@/components/FormError';
import { authErrorMessage } from '@/lib/auth';
import { href } from '@/lib/paths';
import { absoluteHref } from '@/lib/site';
import { supabase } from '@/lib/supabase';

export function ForgotForm() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: absoluteHref('/reset/'),
    });
    setPending(false);
    if (resetError) {
      setError(authErrorMessage(resetError.message));
      return;
    }
    setInfo('Se esse e-mail tiver conta, o link de nova senha chega em alguns minutos.');
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
          onChange={(event) => setEmail(event.target.value)}
          required
        />
      </div>
      <FormError message={error} />
      {info ? (
        <p className="rounded-xl border border-accent/30 bg-accent/10 px-3 py-2 text-sm" role="status">
          {info}
        </p>
      ) : null}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? 'Enviando…' : 'Enviar link'}
      </Button>
      <p className="text-center text-sm">
        <a className="font-medium text-accent hover:underline" href={href('/login/')}>
          Voltar ao login
        </a>
      </p>
    </form>
  );
}
