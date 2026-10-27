import { useEffect, useRef, useState, type SubmitEvent } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Avatar } from '@/components/Avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/lib/auth';
import { href } from '@/lib/paths';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { sanitizeChat } from '@/lib/chat-text';
import { useOnlineIds } from '@/modules/chat/presence';
import type { Friendship, Message } from '@/lib/database.types';

type Person = {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  active_title: string | null;
  active_border: string | null;
  active_effect: string | null;
};

type FriendRow = {
  id: string;
  status: Friendship['status'];
  incoming: boolean;
  person: Person;
};

type Thread = { id: string; person: Person };

const personColumns = 'id, username, display_name, avatar_url, active_title, active_border, active_effect';

export function ChatApp() {
  const { session, profile, loading } = useAuth();
  const userId = session?.user.id ?? null;
  const online = useOnlineIds();
  const [friends, setFriends] = useState<FriendRow[]>([]);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [reply, setReply] = useState<Message | null>(null);
  const [editing, setEditing] = useState<Message | null>(null);
  const [typing, setTyping] = useState<string[]>([]);
  const [query, setQuery] = useState('');
  const [found, setFound] = useState<Person[]>([]);
  const [banner, setBanner] = useState<string | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const endRef = useRef<HTMLDivElement>(null);
  const typingTimer = useRef(0);

  const active = threads.find((thread) => thread.id === activeId) ?? null;

  function upsertMessage(message: Message) {
    setMessages((current) => {
      const index = current.findIndex((item) => item.id === message.id);
      if (index === -1) return [...current, message].sort((a, b) => a.created_at.localeCompare(b.created_at));
      const next = current.slice();
      next[index] = message;
      return next;
    });
  }

  async function loadSocial(currentUser: string) {
    const { data: links, error: friendError } = await supabase
      .from('friendships')
      .select('*')
      .or(`requester_id.eq.${currentUser},addressee_id.eq.${currentUser}`);
    if (friendError) {
      setStatus('error');
      setBanner('Não foi possível carregar amizades. Rode a migration 006_chat.sql.');
      return;
    }

    const { data: memberships } = await supabase
      .from('conversation_participants')
      .select('conversation_id')
      .eq('user_id', currentUser);
    const conversationIds = (memberships ?? []).map((row) => row.conversation_id);
    const { data: participants } = conversationIds.length
      ? await supabase
          .from('conversation_participants')
          .select('conversation_id, user_id')
          .in('conversation_id', conversationIds)
      : { data: [] as { conversation_id: string; user_id: string }[] };

    const friendIds = (links ?? []).map((link) =>
      link.requester_id === currentUser ? link.addressee_id : link.requester_id,
    );
    const profileIds = [...new Set([...friendIds, ...(participants ?? []).map((row) => row.user_id)])];
    const { data: people } = profileIds.length
      ? await supabase.from('profiles').select(personColumns).in('id', profileIds)
      : { data: [] as Person[] };
    const byId = new Map((people ?? []).map((person) => [person.id, person]));

    setFriends(
      (links ?? []).flatMap((link) => {
        const otherId = link.requester_id === currentUser ? link.addressee_id : link.requester_id;
        const person = byId.get(otherId);
        if (!person) return [];
        return [{ id: link.id, status: link.status, incoming: link.addressee_id === currentUser, person }];
      }),
    );
    setThreads(
      conversationIds.flatMap((id) => {
        const other = (participants ?? []).find((row) => row.conversation_id === id && row.user_id !== currentUser);
        const person = other ? byId.get(other.user_id) : undefined;
        if (!person) return [];
        return [{ id, person }];
      }),
    );
    setStatus('ready');
    setBanner(null);
  }

  useEffect(() => {
    if (loading) return;
    if (!userId) {
      setStatus('ready');
      return;
    }
    void loadSocial(userId);
    const channel = supabase
      .channel(`friendships:${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'friendships' }, () => {
        void loadSocial(userId);
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [loading, userId]);

  useEffect(() => {
    if (!userId || !activeId) {
      setMessages([]);
      return;
    }

    let cancelled = false;
    supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', activeId)
      .order('created_at', { ascending: true })
      .limit(200)
      .then(({ data, error }) => {
        if (cancelled || error) return;
        setMessages(data ?? []);
      });

    const channel = supabase.channel(`chat:${activeId}`, {
      config: { presence: { key: userId } },
    });
    channel
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'messages', filter: `conversation_id=eq.${activeId}` },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            const oldId = (payload.old as { id?: string }).id;
            if (oldId) setMessages((current) => current.filter((item) => item.id !== oldId));
            return;
          }
          upsertMessage(payload.new as Message);
        },
      )
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState() as Record<string, Array<{ user_id?: string; typing?: boolean }>>;
        const names: string[] = [];
        for (const entries of Object.values(state)) {
          for (const entry of entries) {
            if (entry.typing && entry.user_id && entry.user_id !== userId) names.push(entry.user_id);
          }
        }
        setTyping(names);
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') void channel.track({ user_id: userId, typing: false });
      });

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [activeId, userId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length]);

  async function searchPeople(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const needle = query.trim();
    if (needle.length < 2) return;
    const { data } = await supabase.from('profiles').select(personColumns).ilike('username', `%${needle}%`).limit(6);
    setFound((data ?? []).filter((person) => person.id !== userId));
  }

  async function requestFriend(person: Person) {
    if (!userId) return;
    const { error } = await supabase.from('friendships').insert({ requester_id: userId, addressee_id: person.id });
    if (error) {
      setBanner('Não foi possível enviar o pedido. Talvez ele já exista.');
      return;
    }
    setFound([]);
    setQuery('');
    await loadSocial(userId);
  }

  async function accept(id: string) {
    if (!userId) return;
    await supabase.from('friendships').update({ status: 'accepted' }).eq('id', id);
    await loadSocial(userId);
  }

  async function removeFriend(id: string) {
    if (!userId) return;
    await supabase.from('friendships').delete().eq('id', id);
    await loadSocial(userId);
  }

  async function block(id: string) {
    if (!userId) return;
    await supabase.from('friendships').update({ status: 'blocked' }).eq('id', id);
    await loadSocial(userId);
  }

  async function openChat(person: Person) {
    const { data, error } = await supabase.rpc('create_direct_conversation', { p_other: person.id });
    if (error || !data) {
      setBanner('A conversa só abre entre amigos aceitos.');
      return;
    }
    setThreads((current) =>
      current.some((thread) => thread.id === data) ? current : [...current, { id: data, person }],
    );
    setActiveId(data);
    setReply(null);
    setEditing(null);
  }

  function onDraft(value: string) {
    setDraft(value);
    if (!activeId || !userId) return;
    const channel = supabase.channel(`chat:${activeId}`);
    void channel.track({ user_id: userId, typing: true });
    window.clearTimeout(typingTimer.current);
    typingTimer.current = window.setTimeout(() => {
      void channel.track({ user_id: userId, typing: false });
    }, 1400);
  }

  async function onSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!userId || !activeId) return;
    const content = sanitizeChat(draft);
    if (!content) return;
    setDraft('');
    if (editing) {
      const { data, error } = await supabase
        .from('messages')
        .update({ content })
        .eq('id', editing.id)
        .select('*')
        .single();
      setEditing(null);
      if (!error && data) upsertMessage(data);
      return;
    }
    const { data, error } = await supabase
      .from('messages')
      .insert({ conversation_id: activeId, sender_id: userId, content, reply_to: reply?.id ?? null })
      .select('*')
      .single();
    setReply(null);
    if (error) {
      setBanner(
        error.message.toLowerCase().includes('muitas')
          ? 'Muitas mensagens em pouco tempo. Espere um instante.'
          : 'Não foi possível enviar.',
      );
      setDraft(content);
      return;
    }
    if (data) upsertMessage(data);
  }

  async function softDelete(message: Message) {
    const { data } = await supabase
      .from('messages')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', message.id)
      .select('*')
      .single();
    if (data) upsertMessage(data);
  }

  if (loading || status === 'loading') {
    return <div className="h-80 animate-pulse rounded-2xl border border-white/5 bg-card" />;
  }

  if (!session || !profile) {
    return (
      <section className="rounded-2xl border border-white/5 bg-card p-8">
        <h1 className="text-2xl font-semibold tracking-tight">Chat</h1>
        <p className="mt-2 text-sm text-zinc-400">Entre para pedir amizade e conversar.</p>
        <Button asChild className="mt-4">
          <a href={href('/login')}>Entrar</a>
        </Button>
      </section>
    );
  }

  return (
    <div className="space-y-3">
      <h1 className="text-3xl font-semibold tracking-tight">Chat</h1>
      {banner ? (
        <p className="rounded-xl border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-sm text-amber-100">
          {banner}
        </p>
      ) : null}
      {status === 'error' ? null : (
        <div className="grid overflow-hidden rounded-2xl border border-white/5 bg-card lg:h-[640px] lg:grid-cols-[300px_1fr]">
          <aside className={cn('border-white/5 lg:border-r', active && 'hidden lg:block')}>
            <div className="space-y-4 overflow-y-auto p-4 lg:h-[640px]">
              <form onSubmit={searchPeople} className="flex gap-2">
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Buscar usuário"
                  aria-label="Buscar usuário"
                />
                <Button type="submit" size="sm" variant="secondary">
                  Buscar
                </Button>
              </form>
              {found.length > 0 ? (
                <ul className="space-y-2">
                  {found.map((person) => (
                    <li key={person.id} className="flex items-center justify-between gap-2 text-sm">
                      <span>@{person.username}</span>
                      <Button type="button" size="sm" onClick={() => requestFriend(person)}>
                        Pedir
                      </Button>
                    </li>
                  ))}
                </ul>
              ) : null}
              <div>
                <h2 className="text-xs font-semibold tracking-[0.14em] text-zinc-500 uppercase">Amigos</h2>
                {friends.length === 0 ? <p className="mt-2 text-sm text-zinc-500">Nenhum pedido ainda.</p> : null}
                <ul className="mt-2 space-y-2">
                  {friends.map((friend) => (
                    <li key={friend.id} className="rounded-xl bg-white/5 p-2">
                      <div className="flex items-center gap-2">
                        <span className="relative">
                          <Avatar
                            name={friend.person.display_name}
                            url={friend.person.avatar_url}
                            border={friend.person.active_border}
                            effect={friend.person.active_effect}
                            size="sm"
                          />
                          {online.has(friend.person.id) ? (
                            <span className="absolute right-0 bottom-0 h-2.5 w-2.5 rounded-full bg-emerald-400" />
                          ) : null}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{friend.person.display_name}</p>
                          <p className="truncate text-xs text-zinc-500">
                            {friend.person.active_title ? `${friend.person.active_title} · ` : ''}@
                            {friend.person.username}
                          </p>
                        </div>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {friend.status === 'pending' && friend.incoming ? (
                          <Button type="button" size="sm" onClick={() => accept(friend.id)}>
                            Aceitar
                          </Button>
                        ) : null}
                        {friend.status === 'pending' && !friend.incoming ? (
                          <span className="text-xs text-zinc-500">Aguardando</span>
                        ) : null}
                        {friend.status === 'accepted' ? (
                          <Button type="button" size="sm" onClick={() => openChat(friend.person)}>
                            Conversar
                          </Button>
                        ) : null}
                        {friend.status === 'blocked' ? <span className="text-xs text-zinc-500">Bloqueado</span> : null}
                        {friend.status !== 'blocked' ? (
                          <Button type="button" size="sm" variant="ghost" onClick={() => block(friend.id)}>
                            Bloquear
                          </Button>
                        ) : null}
                        <Button type="button" size="sm" variant="ghost" onClick={() => removeFriend(friend.id)}>
                          Remover
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h2 className="text-xs font-semibold tracking-[0.14em] text-zinc-500 uppercase">Conversas</h2>
                <ul className="mt-2 space-y-1">
                  {threads.map((thread) => (
                    <li key={thread.id}>
                      <button
                        type="button"
                        onClick={() => setActiveId(thread.id)}
                        className={cn(
                          'w-full rounded-xl px-2 py-2 text-left text-sm hover:bg-white/5',
                          activeId === thread.id && 'bg-white/5',
                        )}
                      >
                        {thread.person.display_name}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </aside>

          <section className={cn('flex min-h-[420px] flex-col', !active && 'hidden lg:flex')}>
            {active ? (
              <>
                <header className="flex items-center gap-3 border-b border-white/5 px-4 py-3">
                  <button type="button" className="text-sm text-zinc-400 lg:hidden" onClick={() => setActiveId(null)}>
                    Voltar
                  </button>
                  <Avatar
                    name={active.person.display_name}
                    url={active.person.avatar_url}
                    border={active.person.active_border}
                    effect={active.person.active_effect}
                    size="sm"
                  />
                  <div>
                    <p className="font-medium">{active.person.display_name}</p>
                    <p className="text-xs text-zinc-500">
                      {active.person.active_title ? `${active.person.active_title} · ` : ''}
                      {online.has(active.person.id) ? 'online' : `@${active.person.username}`}
                    </p>
                  </div>
                </header>
                <ul className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
                  <AnimatePresence initial={false}>
                    {messages.map((message) => {
                      const mine = message.sender_id === userId;
                      const quoted = messages.find((item) => item.id === message.reply_to);
                      return (
                        <motion.li
                          key={message.id}
                          layout
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.2 }}
                          className={cn(
                            'flex max-w-[85%] flex-col gap-1',
                            mine ? 'ml-auto items-end' : 'mr-auto items-start',
                          )}
                        >
                          <div
                            className={cn(
                              'rounded-2xl px-3 py-2 text-sm',
                              mine ? 'bg-accent text-white' : 'bg-white/5',
                            )}
                          >
                            {quoted ? (
                              <p
                                className={cn(
                                  'mb-1 border-l-2 pl-2 text-xs',
                                  mine ? 'border-white/40 text-white/80' : 'border-accent text-zinc-400',
                                )}
                              >
                                {quoted.deleted_at ? 'Mensagem apagada' : quoted.content}
                              </p>
                            ) : null}
                            <p className={message.deleted_at ? 'italic opacity-70' : ''}>
                              {message.deleted_at ? 'Mensagem apagada' : message.content}
                            </p>
                            {message.edited_at && !message.deleted_at ? (
                              <p className="mt-1 text-[10px] opacity-70">editada</p>
                            ) : null}
                          </div>
                          {mine && !message.deleted_at ? (
                            <div className="flex gap-2 text-[11px] text-zinc-500">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditing(message);
                                  setDraft(message.content);
                                  setReply(null);
                                }}
                              >
                                Editar
                              </button>
                              <button type="button" onClick={() => softDelete(message)}>
                                Apagar
                              </button>
                            </div>
                          ) : null}
                          {!message.deleted_at ? (
                            <button
                              type="button"
                              className="text-[11px] text-zinc-500"
                              onClick={() => {
                                setReply(message);
                                setEditing(null);
                              }}
                            >
                              Responder
                            </button>
                          ) : null}
                        </motion.li>
                      );
                    })}
                  </AnimatePresence>
                  <div ref={endRef} />
                </ul>
                {typing.length > 0 ? <p className="px-4 text-xs text-zinc-500">Digitando…</p> : null}
                <form onSubmit={onSubmit} className="border-t border-white/5 p-3">
                  {reply ? (
                    <p className="mb-2 text-xs text-zinc-400">
                      Respondendo: {reply.deleted_at ? 'mensagem apagada' : reply.content}
                      <button type="button" className="ml-2 text-accent" onClick={() => setReply(null)}>
                        cancelar
                      </button>
                    </p>
                  ) : null}
                  {editing ? (
                    <p className="mb-2 text-xs text-zinc-400">
                      Editando
                      <button
                        type="button"
                        className="ml-2 text-accent"
                        onClick={() => {
                          setEditing(null);
                          setDraft('');
                        }}
                      >
                        cancelar
                      </button>
                    </p>
                  ) : null}
                  <div className="flex gap-2">
                    <Input
                      value={draft}
                      maxLength={2000}
                      onChange={(event) => onDraft(event.target.value)}
                      placeholder="Escreva uma mensagem"
                      aria-label="Mensagem"
                    />
                    <Button type="submit">Enviar</Button>
                  </div>
                </form>
              </>
            ) : (
              <div className="grid flex-1 place-items-center p-8 text-sm text-zinc-500">
                Escolha um amigo para conversar.
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
