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

Quem tem identidade de e-mail redigita a senha antes. Conta só de GitHub ou Google confirma digitando o usuário. Isso evita clique errado. Uma sessão roubada que já consegue ler o usuário ainda consegue apagar conta OAuth; a senha cobre o caso do e-mail.

## 3. Auth

Acrescentar em Authentication → URL configuration, além das que já estavam (`confirm`, `reset`, `onboarding`):

- `https://rodrigomiquilino.github.io/renportal/conta/`
- `http://127.0.0.1:4455/renportal/conta/` se for testar local

A troca de e-mail manda o link para essa página. Confirme o e-mail novo e, se o Supabase mandar, o antigo também.

Senha mínima continua 8. GitHub e Google seguem como na rodada anterior: desligados no painel, o botão explica; `PUBLIC_AUTH_GITHUB=false` ou `PUBLIC_AUTH_GOOGLE=false` escondem o botão no build.

Redirect dos apps OAuth: `https://wlacdgwbwsykvpobkbib.supabase.co/auth/v1/callback`.

## 4. O que não vai no Git

Senha do banco, service role e tokens continuam fora do repositório.
