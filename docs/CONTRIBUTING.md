# Como contribuir

RenPortal é um projeto de portfólio. Issues e pull requests são bem-vindos quando deixam um módulo mais claro sem misturar saldo no cliente.

## Ambiente

Node >=22.23.4 (exigência do Astro 7). O deploy no GitHub Pages usa Node 24. `npm install`, depois `npm run dev -- --host 127.0.0.1 --port 4455`. O padrão abre em `/renportal/`.

`npm run typecheck` precisa passar. `npm run build` também, porque o alvo é site estático.

## O que não entra no commit

- `.env` com segredo
- senha do banco, service role, personal access token
- `node_modules/` e `dist/`

A URL do projeto e a chave publishable podem ficar em `.env.example`, no README e como fallback do cliente. São públicas.

## Um módulo novo

1. Pasta em `src/modules/<nome>` com a UI e, se precisar de escrita sensível, uma chamada de Edge Function. Nada de `update` direto em `xp`.
2. Flag em `src/lib/features.ts` e em `.env.example` (`PUBLIC_FEATURE_<NOME>`). Auth continua sem flag.
3. Item de menu em `src/modules/layout/nav.ts`, com `feature`.
4. Migration seguinte, `009_….sql`, com RLS desde o `create table`. Se a tabela guarda saldo ou moderação, o cliente não recebe `insert`/`update`.
5. Função SQL `security definer` com `search_path = public` e `grant execute` só para `service_role`, se a escrita for crítica.
6. Edge Function em `supabase/functions/<nome>` que chama `readUser` e, no `config.toml`, `verify_jwt = false` com um comentário dizendo que o JWT é conferido no código.
7. Linha na tabela de módulos do README, seção “Como ativar este módulo”.

## Commits

Mensagens curtas, em português, no estilo que o histórico já usa: `feat(shop): …`, `fix(games): …`, `docs: …`. Um assunto por commit.

## SQL

- Trave linhas numa ordem estável (perfil antes da sessão; dois perfis em ordem de UUID).
- Trigger que olha `current_user` fica `security invoker`. Função que ignora RLS fica `security definer` e não confia no corpo do POST para saber quem é o usuário.
- Comentário na tabela dizendo o que o cliente não pode escrever.

## Visual

Fundo `#0c0c12`, card `#16161e`, acento `#8b5cf6`, texto em português do Brasil. Botão, input e dialog vêm de `src/components/ui`. Estado vazio, carregando e erro ficam na própria tela, não num `alert`.

## Antes de abrir o PR

- [ ] `npm run typecheck`
- [ ] `npm run build`
- [ ] Nenhum segredo no diff (`git diff` e uma busca por `sb_secret`, `service_role` com valor, `postgres://`)
- [ ] README atualizado se a flag, a rota ou o passo de teste mudou
