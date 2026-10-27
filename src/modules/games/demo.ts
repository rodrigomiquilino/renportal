import type { Game } from '@/lib/database.types';

/**
 * Cópia local da demo. Aparece mesmo se a migration ainda não rodou,
 * para o iframe em public/games/demo/play continuar abrindo.
 * Sessões de XP exigem a linha de verdade no banco (o id daqui não é um uuid).
 */
export const demoGame: Game = {
  id: 'local-demo',
  slug: 'demo',
  title: 'Estação Aurora',
  description:
    "Noite fechada, plataforma vazia e uma aurora que não devia estar ali. Página de demonstração no lugar de um build web do Ren'Py.",
  cover_url: '/games/demo/cover.svg',
  web_path: '/games/demo/play/index.html',
  web_url: null,
  windows_url: null,
  mac_url: null,
  linux_url: null,
  file_size_mb: 0.2,
  version: '1.0',
  published: true,
  created_at: '2026-01-01T00:00:00.000Z',
};

export function withDemo(games: Game[]): Game[] {
  if (games.some((game) => game.slug === 'demo')) return games;
  return [demoGame, ...games];
}
