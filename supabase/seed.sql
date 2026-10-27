-- Dados de exemplo. Rode depois das migrations, no SQL Editor ou com `supabase db query`.
-- A demo web fica em public/games/demo/play/ para não ocupar a página /games/demo/.
-- O catálogo e as sessões de XP precisam desta linha.

insert into public.games (slug, title, description, cover_url, web_path, file_size_mb, published)
values (
  'demo',
  'Estação Aurora',
  'Noite fechada, plataforma vazia e uma aurora que não devia estar ali. Visual novel curtinha de demonstração: o arquivo em public/games/demo/play imita um build web do Ren''Py e avisa o portal quando você faz uma escolha.',
  '/games/demo/cover.svg',
  '/games/demo/play/index.html',
  0.2,
  true
)
on conflict (slug) do update
  set web_path = excluded.web_path
  where public.games.web_path = '/games/demo/index.html';

insert into public.shop_items (type, name, description, cost_xp, asset_key, active)
values
  ('border', 'Violeta', 'Um aro roxo em volta do avatar.', 30, 'border-violet', true),
  ('border', 'Aurora', 'Gradiente de violeta e ciano.', 80, 'border-aurora', true),
  ('effect', 'Brilho suave', 'Um pulso de luz atrás do avatar.', 50, 'effect-glow', true),
  ('effect', 'Véu estelar', 'Pontos de luz girando devagar.', 120, 'effect-stars', true),
  ('title', 'Leitor', 'Aparece junto do seu nome.', 40, 'Leitor', true),
  ('title', 'Viajante', 'Para quem atravessa várias histórias.', 90, 'Viajante', true)
on conflict (type, asset_key) do nothing;
