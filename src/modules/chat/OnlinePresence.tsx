import { useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { setOnlineIds } from '@/modules/chat/presence';

/** Canal global de presença. Não desenha nada: só publica quem está online. */
export function OnlinePresence() {
  const { session, profile } = useAuth();
  const userId = session?.user.id;
  const username = profile?.username;

  useEffect(() => {
    if (!userId || !username) return;

    const channel = supabase.channel('renportal:online', {
      config: { presence: { key: userId } },
    });

    const sync = () => {
      const state = channel.presenceState() as Record<string, Array<{ user_id?: string }>>;
      const ids = new Set<string>();
      for (const [key, entries] of Object.entries(state)) {
        for (const entry of entries) ids.add(entry.user_id ?? key);
      }
      setOnlineIds(ids);
    };

    channel.on('presence', { event: 'sync' }, sync);
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') void channel.track({ user_id: userId, username });
    });

    return () => {
      void supabase.removeChannel(channel);
      setOnlineIds(new Set());
    };
  }, [userId, username]);

  return null;
}
