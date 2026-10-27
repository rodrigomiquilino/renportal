# O que aplicar no Supabase

O site novo não liga sozinho. Estas mudanças ficam no repositório. Quem tem o painel do projeto `wlacdgwbwsykvpobkbib` precisa rodar isto antes do público usar avatar, loja com imagem e o limite do chat.

## 1. Migrations

No SQL Editor, nesta ordem, o conteúdo de:

1. `supabase/migrations/009_media.sql`
2. `supabase/migrations/010_chat_guard.sql`

As duas são idempotentes. A 009 cria as colunas `banner_url`, `onboarded_at`, `games.version`, `games.web_url`, `shop_items.image_url`, deixa `web_path` nulo e abre os buckets `avatars`, `covers` e `shop-assets` com RLS. A 010 limpa HTML das mensagens e limita ritmo (20 mensagens por minuto, 15 pedidos de amizade por hora).

Se o histórico do CLI não conhecer esses arquivos:

```bash
supabase link --project-ref wlacdgwbwsykvpobkbib
supabase db query --linked -f supabase/migrations/009_media.sql
supabase db query --linked -f supabase/migrations/010_chat_guard.sql
```

## 2. Edge Function

Republicar a função que assina o upload do zip:

```bash
supabase functions deploy admin-upload-game --project-ref wlacdgwbwsykvpobkbib
```

Ela continua conferindo o JWT no código. `verify_jwt` segue `false` por causa do preflight, como as outras.

XP, compra e doação não mudaram de função. Não é preciso redeploy de `heartbeat`, `purchase-item` ou `donate-xp` por causa desta rodada.

## 3. Auth

Em Authentication → URL configuration, acrescentar:

- `https://rodrigomiquilino.github.io/renportal/confirm/`
- `https://rodrigomiquilino.github.io/renportal/reset/`
- `https://rodrigomiquilino.github.io/renportal/onboarding/`
- o mesmo trio em `http://127.0.0.1:4455/renportal/` se for testar local

Site URL pode continuar `https://rodrigomiquilino.github.io/renportal/`.

Providers:

- Email: deixar confirmação como quiser. Ligada, a tela "Confirme seu e-mail" reenvia o link. Desligada, o cadastro cai direto no onboarding.
- GitHub e Google: criar o app em cada um e colar client id e secret no Supabase. Enquanto o provider estiver desligado, o botão aparece e a tela explica que ainda não está configurado. Para esconder o botão no build, defina a variável do repositório `PUBLIC_AUTH_GITHUB` ou `PUBLIC_AUTH_GOOGLE` como `false`.
- Tamanho mínimo de senha: 8, para bater com o medidor da interface.

Redirect do GitHub/Google no app deles precisa aceitar `https://wlacdgwbwsykvpobkbib.supabase.co/auth/v1/callback`.

## 4. O que não vai no Git

Senha do banco, service role e tokens continuam fora do repositório. A chave publishable que já estava no cliente é a mesma.
