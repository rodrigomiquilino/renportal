import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { FormError } from '@/components/FormError';
import { authErrorMessage } from '@/lib/auth';
import { href } from '@/lib/paths';
import { absoluteHref } from '@/lib/site';
import { supabase } from '@/lib/supabase';

export function ConfirmEmail() {
  const email = typeof window === 'undefined' ? '' : (new URLSearchParams(window.location.search).get('email') ?? '');
  const [info, setInfo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function resend() {
    if (!email) {
      setError('Não sei para qual e-mail reenviar. Volte ao cadastro.');
      return;
    }
    setPending(true);
    setError(null);
    const { error: resendError } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: { emailRedirectTo: absoluteHref('/confirm/') },
    });
    setPending(false);
    if (resendError) {
      setError(authErrorMessage(resendError.message));
      return;
    }
    setInfo('Enviei outro e-mail. Olhe também o spam.');
  }

  return (
    <div className="space-y-4 text-sm">
      <p className="text-zinc-300">
        {email ? (
          <>
            Mandei um link para <strong className="text-zinc-100">{email}</strong>.
          </>
        ) : (
          'Abra o link que chegou no seu e-mail.'
        )}{' '}
        Depois disso a conta entra no RenPortal.
      </p>
      <FormError message={error} />
      {info ? (
        <p className="rounded-xl border border-accent/30 bg-accent/10 px-3 py-2" role="status">
          {info}
        </p>
      ) : null}
      <Button type="button" className="w-full" onClick={() => void resend()} disabled={pending}>
        {pending ? 'Enviando…' : 'Reenviar e-mail'}
      </Button>
      <p className="text-center">
        <a className="font-medium text-accent hover:underline" href={href('/login/')}>
          Já confirmei, entrar
        </a>
      </p>
    </div>
  );
}
