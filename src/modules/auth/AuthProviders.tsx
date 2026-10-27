import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { FormError } from '@/components/FormError';
import { authErrorMessage } from '@/lib/auth';
import { consumeNext, setRememberPreference } from '@/lib/auth-storage';
import { authProviders } from '@/lib/features';
import { href } from '@/lib/paths';
import { absoluteHref } from '@/lib/site';
import { supabase } from '@/lib/supabase';

export function AuthProviders({ remember = true }: { remember?: boolean }) {
  const [pending, setPending] = useState<'github' | 'google' | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (!authProviders.github && !authProviders.google) return null;

  async function start(provider: 'github' | 'google') {
    setPending(provider);
    setError(null);
    setRememberPreference(remember);
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

export type SessionContinue = 'redirect' | 'network';

/**
 * Erro de rede não conta como onboarding feito.
 * Quem já concluiu volta para `?next=` ou para o início.
 */
export async function continueAfterSession(): Promise<SessionContinue> {
  const { data, error } = await supabase.auth.getUser();
  if (error) {
    const message = error.message.toLowerCase();
    if (message.includes('network') || message.includes('fetch') || message.includes('failed')) return 'network';
  }
  const userId = data.user?.id;
  if (!userId) {
    window.location.href = href('/');
    return 'redirect';
  }
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('onboarded_at')
    .eq('id', userId)
    .maybeSingle();
  if (profileError) return 'network';
  if (!profile?.onboarded_at) {
    window.location.href = href('/onboarding/');
    return 'redirect';
  }
  const next = consumeNext();
  window.location.href = next ? href(next) : href('/');
  return 'redirect';
}
