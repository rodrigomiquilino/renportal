# Segurança

O saldo, o papel e o tempo de jogo são dados que um usuário motivado tentaria gravar sozinho. O modelo assume isso.

## O que não vai para o repositório

Podem aparecer a URL pública do projeto e a chave publishable (`sb_publishable_…`, o papel da antiga anon key).

Não podem aparecer:

- senha do banco
- `SUPABASE_SERVICE_ROLE_KEY` ou qualquer JWT de service role
- access token de GitHub, Supabase ou da Management API

A service role vive como secret da Edge Function. O comando está no README. O cliente do browser em `src/lib/supabase.ts` só conhece a chave publishable.

## RLS

Toda tabela de `public` tem RLS ligado. As policies não fazem subquery em `profiles` para saber se alguém é admin: `is_admin()` é `security definer` e lê a linha uma vez. O chat usa `is_conversation_participant()` pelo mesmo motivo.

Leituras típicas:

- perfil: qualquer um autenticado lê perfis (o portal é social). O anon lê o necessário para a página pública quando a policy permite.
- jogos publicados e itens ativos: `anon` e `authenticated`.
- `xp_log`, `play_sessions`, `user_items`, `donations`: o dono, o outro lado quando faz sentido (doação), ou admin.
- mensagens: só participante da conversa, ou admin.

Escritas do cliente existem só onde o risco é baixo: nome, avatar, username, cosmético ativo, pedido de amizade, mensagem, avaliação do próprio jogo. XP, nível, papel, tempo total, compras e doações não têm policy de insert/update para `authenticated`.

## Travas de coluna

`protect_profile_columns` é `security invoker`. Dentro de uma função `security definer` o `current_user` seria sempre o dono da função, e a trava não veria o usuário. Como invoker, o trigger enxerga quem chamou.

Ele deixa passar `postgres`, `supabase_admin`, `service_role`, ou a GUC de transação `renportal.trusted_write = on`, que as funções de saldo ligam antes de mexer em `xp`. Qualquer outro update restaura `xp`, `level`, `role` e `total_play_time_seconds`.

O `GRANT` repete a regra: o usuário autenticado não recebe `UPDATE` nessas colunas. As duas camadas existem porque um grant largo no futuro não deveria abrir o saldo sozinho.

Cosmético equipado passa por `enforce_owned_cosmetics`. A chave em `active_border`, `active_effect` ou `active_title` precisa existir em `user_items` daquela pessoa.

## Funções que mexem em saldo

| Função | Quem executa | O que garante |
| --- | --- | --- |
| `start_play_session` / `apply_play_tick` | `service_role` | Janela 15–90s, uma sessão ativa, teto pelo relógio, XP a cada 60s. |
| `purchase_item` | `service_role` | Item ativo, ainda não possuído, saldo suficiente, um lançamento negativo. |
| `donate_xp` | `service_role` | Sem auto-presente, 10–500, teto diário em `America/Sao_Paulo`, duas linhas no extrato, nível dos dois. |
| `recalculate_level` | `service_role` | Só o servidor recalcula. |
| `set_user_role` | admin autenticado | Não deixa a pessoa se rebaixar sozinha. O primeiro admin nasce no SQL Editor. |

As Edge Functions conferem o JWT com `auth.getUser` (`readUser` em `supabase/functions/_shared/http.ts`) antes de chamar o SQL. O corpo não escolhe o usuário de origem: doação e compra usam o `sub` do token.

`verify_jwt = false` no `config.toml` vale para todas, inclusive `donate-xp`. O gateway da Supabase responde 401 no `OPTIONS` quando exige JWT, e o browser desiste do POST. A autenticação continua dentro da função. Um POST sem `Authorization` recebe 401 da própria função.

## Heartbeat

Ameaça: um loop no console mandando heartbeat a cada segundo, ou um relógio adulterado, ou duas abas somando o mesmo minuto duas vezes.

Resposta em `apply_play_tick`:

- intervalo fora de 15–90s no heartbeat não premia
- intervalo curto demais marca `flagged`
- intervalo acima de 10 minutos marca `flagged`
- segundos premiados não passam do tempo de parede desde `started_at`
- `start_play_session` fecha as outras sessões ativas daquela pessoa antes de abrir outra
- um heartbeat que ainda vê outra sessão ativa marca `flagged`

O marco `postMessage` do jogo é ignorado para saldo. É texto na tela.

## Chat e presença

Presença é efêmera e não concede XP. Mensagem tem tamanho limitado no banco, autor igual ao `auth.uid()`, e update só do próprio autor (texto, `edited_at`, `deleted_at`). O trigger `protect_message_row` impede trocar `conversation_id` ou `user_id` numa edição.

Amizade bloqueada não abre sala. `create_direct_conversation` olha o status `accepted`.

## Admin

O painel some para quem não tem `role = admin`. Isso é conveniência de UI. A autorização está nas policies e em `set_user_role` / `admin_stats` / `admin-upload-game`. O upload de build devolve uma URL assinada no bucket `game-builds`. A URL pública resultante é o que a página de download mostra. O bucket não aceita escrita de um usuário comum.

## O que este documento não cobre

Não há revisão formal de penetração. Não há WAF na frente do GitHub Pages. A chave publishable é pública de propósito: com ela dá para chamar a API como um visitante, e o RLS é o limite. Girar a service role no painel e atualizar o secret da função é o procedimento se ela vazar.

O GitHub Pages não deixa definir cabeçalho HTTP. O `BaseLayout` manda um Content-Security-Policy por meta tag: script e estilo do próprio site, conexão só com o Supabase do projeto, imagem em `data:` e `blob:` para a prévia local.

Avatar e banner só passam no trigger se forem um preset (`preset:fox`) ou a URL pública do arquivo em `avatars/<id do usuário>/`. Capa e imagem da loja só sobem com `is_admin()`. O chat tira tags no trigger e corta em 20 mensagens por minuto. Pedido de amizade tem teto de 15 por hora. XP, compra e doação seguem só nas funções `security definer`.
