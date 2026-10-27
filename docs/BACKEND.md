# O que aplicar no Supabase

009, 010 e a function `admin-upload-game` já estão no projeto. O que falta desta rodada é a migration 011 e a function `delete-account`.

## 1. Migration

No SQL Editor, o conteúdo de `supabase/migrations/011_account_privacy.sql`.

Ela é idempotente. Cria:

- no perfil: `show_adult` (padrão desligado), `profile_visibility` (`public`, `members`, `private`), `show_activity`, `allow_friend_requests`
- em jogos: `content_rating` (`everyone` ou `mature`)
- `username_taken`, para o nome continuar único mesmo com perfil privado
- `user_blocks` e `is_blocked` (também considera amizade antiga com status `blocked`)
- trava de pedido de amizade, de conversa e de mensagem quando há bloqueio
- `user_reports`, no máximo 5 denúncias por dia

```bash
supabase link --project-ref wlacdgwbwsykvpobkbib
supabase db query --linked -f supabase/migrations/011_account_privacy.sql
```

Sem a 011, o site continua de pé. Privacidade, 18+, bloqueio e denúncia avisam que a migration falta. O ranking, se a coluna ainda não existir, volta para a lista antiga.

A classificação do jogo é gravada pelo admin no cliente, na policy de update que já existe. Não precisa republicar `admin-upload-game` por causa disso.

## 2. Edge Function

Publicar a exclusão de conta. Ela confere o JWT no código, compara o usuário digitado com o perfil e chama `auth.admin.deleteUser`. A service role continua só no ambiente da função.

```bash
supabase functions deploy delete-account --project-ref wlacdgwbwsykvpobkbib
```

`verify_jwt` fica `false` por causa do preflight, como as outras.

Apagar a conta pede o usuário e a senha atual. Quem entra só com o link do e-mail define a senha em Esqueci a senha antes.

## 3. Auth

Acrescentar em Authentication → URL configuration, além das que já estavam (`confirm`, `reset`, `onboarding`):

- `https://rodrigomiquilino.github.io/renportal/conta/`
- `http://127.0.0.1:4455/renportal/conta/` se for testar local

A troca de e-mail manda o link para essa página. Confirme o e-mail novo e, se o Supabase mandar, o antigo também.

A entrada é e-mail e senha, ou um link enviado ao e-mail. Não há login social. Senha mínima continua 8. Em Authentication → Providers, deixe e-mail ligado e desligue os outros.

## 4. O que não vai no Git

Senha do banco, service role e tokens continuam fora do repositório.

## 5. Apoios com LivePix

A 012 depende da 011 (`profile_visibility` no mural). Se a 011 ainda não rodou, aplique ela antes.

No SQL Editor, o conteúdo de `supabase/migrations/012_livepix.sql`. Ela é idempotente. Cria `supporter_until` e `show_support` no perfil, a meta mensal, os checkouts, os pagamentos, a assinatura, o crédito `credit_support_payment` (só `service_role`) e os itens de loja exclusivos do plano. O mês é calculado em `America/Sao_Paulo` na hora da leitura. Não há cron.

```bash
supabase db query --linked -f supabase/migrations/012_livepix.sql
supabase functions deploy livepix-checkout --project-ref wlacdgwbwsykvpobkbib
supabase functions deploy livepix-webhook --project-ref wlacdgwbwsykvpobkbib
```

`verify_jwt` fica `false` nas duas. O checkout confere o JWT no código. O webhook não tem JWT: o LivePix chama de fora.

Secrets da função, sem valor no repositório:

```bash
supabase secrets set LIVEPIX_CLIENT_ID=… LIVEPIX_CLIENT_SECRET=… --project-ref wlacdgwbwsykvpobkbib
```

Opcional, se o site não for o GitHub Pages: `PUBLIC_SITE_URL` e `PUBLIC_BASE_PATH`. O padrão do checkout é `https://rodrigomiquilino.github.io` e `/renportal`. A volta depois do Pix é `/renportal/apoiar/?retorno=1`.

No painel do LivePix, nas credenciais do aplicativo:

- escopos `payments:read`, `payments:write`, `subscriptions:read`, `subscriptions:write`, `subscription-plans:read`, `subscription-plans:write`
- webhook `https://wlacdgwbwsykvpobkbib.supabase.co/functions/v1/livepix-webhook`

A API não assina o webhook. A função reconsulta o pagamento ou a assinatura com o token e só então credita. O id do pagamento é a chave de idempotência. O plano `apoiador` de R$ 0,99/mês é criado na primeira assinatura, se ainda não existir. Não altere o valor de um plano que já tenha assinante.

Doação avulsa mínima é R$ 1,00 porque `POST /v2/payments` exige pelo menos 100 centavos. Ela entra na meta e no mural e não liga o selo.
