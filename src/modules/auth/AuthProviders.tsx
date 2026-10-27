import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { FormError } from '@/components/FormError';
import { authErrorMessage } from '@/lib/auth';
import { authProviders } from '@/lib/features';
import { absoluteHref } from '@/lib/site';
import { supabase } from '@/lib/supabase';

export function AuthProviders() {
  const [pending, setPending] = useState<'github' | 'google' | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (!authProviders.github && !authProviders.google) return null;

  async function start(provider: 'github' | 'google') {
    setPending(provider);
    setError(null);
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: absoluteHref('/onboarding/') },
    });
    if (oauthError) {
      setError(authErrorMessage(oauthError.message));
      setPending(null);
    }
  }

  return (
    <div className="space-y-3">
      {authProviders.github ? (
        <Button
          type="button"
          variant="secondary"
          className="w-full"
          disabled={pending !== null}
          onClick={() => void start('github')}
        >
          {pending === 'github' ? 'Abrindo GitHub…' : 'Continuar com GitHub'}
        </Button>
      ) : null}
      {authProviders.google ? (
        <Button
          type="button"
          variant="secondary"
          className="w-full"
          disabled={pending !== null}
          onClick={() => void start('google')}
        >
          {pending === 'google' ? 'Abrindo Google…' : 'Continuar com Google'}
        </Button>
      ) : null}
      <FormError message={error} />
      <p className="text-center text-xs text-zinc-500">ou com e-mail</p>
    </div>
  );
}

export async function continueAfterSession() {
  const { data } = await supabase.auth.getUser();
  const userId = data.user?.id;
  if (!userId) {
    window.location.href = absoluteHref('/');
    return;
  }
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('onboarded_at')
    .eq('id', userId)
    .maybeSingle();
  if (error || profile?.onboarded_at) {
    window.location.href = absoluteHref('/');
    return;
  }
  window.location.href = absoluteHref('/onboarding/');
}
