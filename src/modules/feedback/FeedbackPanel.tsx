import { useEffect, useMemo, useState, type SubmitEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { FormError } from '@/components/FormError';
import { Stars } from '@/modules/feedback/Stars';
import { useAuth } from '@/lib/auth';
import { formatDateTime } from '@/lib/format';
import { href } from '@/lib/paths';
import { supabase } from '@/lib/supabase';
import { toast } from '@/lib/toast';
import type { GameFeedback } from '@/lib/database.types';

type Row = GameFeedback & { username: string; display_name: string };

const categories = [
  ['rating_story', 'História'],
  ['rating_gameplay', 'Jogabilidade'],
  ['rating_art', 'Arte'],
  ['rating_audio', 'Áudio'],
  ['rating_writing', 'Roteiro'],
] as const;

function average(rows: GameFeedback[], key: keyof GameFeedback): number | null {
  const values = rows.map((row) => row[key]).filter((value): value is number => typeof value === 'number');
  if (values.length === 0) return null;
  return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10;
}

/** Médias, formulário do jogador logado e a lista de comentários visíveis. */
export function FeedbackPanel({ gameId }: { gameId: string }) {
  const { session, profile } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error' | 'local'>('loading');
  const [rating, setRating] = useState<number | null>(null);
  const [story, setStory] = useState<number | null>(null);
  const [gameplay, setGameplay] = useState<number | null>(null);
  const [art, setArt] = useState<number | null>(null);
  const [audio, setAudio] = useState<number | null>(null);
  const [writing, setWriting] = useState<number | null>(null);
  const [comment, setComment] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const setters = {
    rating_story: setStory,
    rating_gameplay: setGameplay,
    rating_art: setArt,
    rating_audio: setAudio,
    rating_writing: setWriting,
  };
  const values = {
    rating_story: story,
    rating_gameplay: gameplay,
    rating_art: art,
    rating_audio: audio,
    rating_writing: writing,
  };

  async function load() {
    if (gameId === 'local-demo') {
      setStatus('local');
      return;
    }
    const { data, error: loadError } = await supabase
      .from('game_feedback')
      .select('*')
      .eq('game_id', gameId)
      .order('created_at', { ascending: false });
    if (loadError) {
      setStatus('error');
      return;
    }
    const feedback = data ?? [];
    const ids = [...new Set(feedback.map((row) => row.user_id))];
    const names = new Map<string, { username: string; display_name: string }>();
    if (ids.length > 0) {
      const profiles = await supabase.from('profiles').select('id, username, display_name').in('id', ids);
      for (const person of profiles.data ?? []) names.set(person.id, person);
    }
    const merged = feedback.map((row) => ({
      ...row,
      username: names.get(row.user_id)?.username ?? 'jogador',
      display_name: names.get(row.user_id)?.display_name ?? 'Jogador',
    }));
    setRows(merged);
    const mine = merged.find((row) => row.user_id === session?.user.id);
    if (mine) {
      setRating(mine.rating);
      setStory(mine.rating_story);
      setGameplay(mine.rating_gameplay);
      setArt(mine.rating_art);
      setAudio(mine.rating_audio);
      setWriting(mine.rating_writing);
      setComment(mine.comment ?? '');
    }
    setStatus('ready');
  }

  useEffect(() => {
    void load();
  }, [gameId, session?.user.id]);

  const visible = rows.filter((row) => !row.hidden);
  const mine = rows.find((row) => row.user_id === session?.user.id);
  const summary = useMemo(
    () => ({
      rating: average(visible, 'rating'),
      story: average(visible, 'rating_story'),
      gameplay: average(visible, 'rating_gameplay'),
      art: average(visible, 'rating_art'),
      audio: average(visible, 'rating_audio'),
      writing: average(visible, 'rating_writing'),
    }),
    [rows],
  );

  async function onSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session || !profile) return;
    if (!rating) {
      setError('Dê uma nota geral de 1 a 5.');
      return;
    }
    setPending(true);
    setError(null);
    const fields = {
      rating,
      rating_story: story,
      rating_gameplay: gameplay,
      rating_art: art,
      rating_audio: audio,
      rating_writing: writing,
      comment: comment.trim() || null,
    };
    const query = mine
      ? supabase.from('game_feedback').update(fields).eq('id', mine.id)
      : supabase.from('game_feedback').insert({ ...fields, game_id: gameId, user_id: session.user.id });
    const { error: saveError } = await query;
    setPending(false);
    if (saveError) {
      setError('Não foi possível salvar. Confira se você já avaliou este jogo.');
      return;
    }
    toast(mine ? 'Avaliação atualizada.' : 'Avaliação publicada.');
    await load();
  }

  if (status === 'local') {
    return (
      <section className="rounded-2xl border border-white/5 bg-card p-5 text-sm text-zinc-400">
        A avaliação abre quando a demo está cadastrada na tabela games.
      </section>
    );
  }

  if (status === 'loading') return <div className="h-40 animate-pulse rounded-2xl border border-white/5 bg-card" />;
  if (status === 'error') {
    return (
      <section className="rounded-2xl border border-red-400/20 bg-card p-5 text-sm text-zinc-400">
        Não foi possível carregar as avaliações. Rode a migration 005_feedback.sql.
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <div className="rounded-2xl border border-white/5 bg-card p-5">
        <h2 className="font-semibold">Avaliações</h2>
        {visible.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-400">Ninguém avaliou ainda.</p>
        ) : (
          <div className="mt-3 flex flex-wrap gap-4">
            <Stars
              value={Math.round(summary.rating ?? 0)}
              label={`Geral ${summary.rating?.toFixed(1) ?? ''} · ${visible.length}`}
            />
            <Stars value={summary.story ? Math.round(summary.story) : null} label="História" />
            <Stars value={summary.gameplay ? Math.round(summary.gameplay) : null} label="Jogabilidade" />
            <Stars value={summary.art ? Math.round(summary.art) : null} label="Arte" />
            <Stars value={summary.audio ? Math.round(summary.audio) : null} label="Áudio" />
            <Stars value={summary.writing ? Math.round(summary.writing) : null} label="Roteiro" />
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-white/5 bg-card p-5">
        <h2 className="font-semibold">{mine ? 'Sua avaliação' : 'Avaliar este jogo'}</h2>
        {!session ? (
          <p className="mt-2 text-sm text-zinc-400">
            <a className="font-medium text-accent" href={href('/login')}>
              Entre
            </a>{' '}
            para deixar nota e comentário.
          </p>
        ) : (
          <form className="mt-4 space-y-4" onSubmit={onSubmit}>
            <Stars value={rating} onChange={setRating} label="Nota geral" />
            <div className="grid gap-3 sm:grid-cols-2">
              {categories.map(([key, label]) => (
                <Stars key={key} value={values[key]} onChange={setters[key]} label={label} />
              ))}
            </div>
            <Textarea
              value={comment}
              maxLength={2000}
              placeholder="O que ficou com você?"
              onChange={(event) => setComment(event.target.value)}
            />
            <FormError message={error} />
            <Button type="submit" disabled={pending}>
              {pending ? 'Salvando…' : mine ? 'Atualizar avaliação' : 'Publicar avaliação'}
            </Button>
          </form>
        )}
      </div>

      <ul className="space-y-3">
        {visible.map((row) => (
          <li key={row.id} className="rounded-2xl border border-white/5 bg-card p-4">
            <div className="flex items-baseline justify-between gap-3">
              <a
                className="font-medium hover:text-accent"
                href={href(`/profile/?username=${encodeURIComponent(row.username)}`)}
              >
                {row.display_name}
              </a>
              <span className="text-xs text-zinc-500">{formatDateTime(row.updated_at)}</span>
            </div>
            <div className="mt-2">
              <Stars value={row.rating} label={`${row.rating} de 5`} />
            </div>
            {row.comment ? <p className="mt-2 text-sm leading-relaxed text-zinc-300">{row.comment}</p> : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
