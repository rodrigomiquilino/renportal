# LinkedIn

Texto para eu publicar. O longo é o post. O curto cabe num dia corrido. A ficha de Projects fica no perfil.

## Post longo

Eu sempre gostei de visual novel. No Ren'Py eu vi que uma história com escolha, sprite e trilha vira um jogo que uma pessoa sozinha consegue terminar. Queria um lugar para jogar isso no navegador. Também queria um projeto em que o backend doesse de verdade, não um formulário de tutorial. As duas coisas viraram o RenPortal.

Para quem entra, a proposta é pequena. Jogar, ganhar XP pelo tempo que ficou na história, comprar uma borda para o perfil e conversar com quem está online. Por baixo, o navegador não manda no saldo.

O site é estático. O Astro gera o HTML e o GitHub Pages publica de graça.

https://rodrigomiquilino.github.io/renportal/

Não deixei um servidor meu ligado só para entregar página. Conta, banco, arquivos e o chat ficam no Supabase.

O XP foi o problema que eu não quis resolver pela metade. Se o ponto fica no JavaScript, qualquer pessoa abre o console e se promove. O cliente só avisa, de tempos em tempos, que a aba ainda está aberta. Isso é um heartbeat. Quem decide se aquele pedaço de tempo vale ponto é o servidor. A janela aceita entre 15 e 90 segundos. Mais rápido que isso parece um script. Um buraco grande, ou um total maior do que o relógio da partida, não rende nada. A cada minuto honesto entra 1 XP, com extrato e nível novo. Não dá para inventar tempo.

Compra na loja e doação de XP são uma operação só. Ou o banco tira de um, põe no outro, grava o extrato e recalcula os dois níveis, ou não grava nada. As duas contas são travadas sempre na mesma ordem, para doações cruzadas não ficarem esperando uma à outra. Não aceita presente para a própria conta, e tem teto por dia.

A trava mora no banco. Cada tabela tem RLS. Quem está logado nem recebe permissão de alterar XP, nível, cargo ou tempo de jogo. Se alguma rota mais aberta tentar, o banco devolve o valor que já estava lá.

O chat me segurou mais do que eu esperava. Mensagem nova chega na hora, só para quem está naquela conversa. O "está digitando" e o ponto verde de online não vão para uma tabela. Somem quando a pessoa fecha a aba. Apagar não some com a linha. A bolha vira "Mensagem apagada".

Separei o portal em módulos. Loja, chat, painel de admin e doação podem sair do menu com uma flag no build, sem eu arrancar a pasta. A demo, Estação Aurora, imita um jogo Ren'Py e mostra o marco da história. Ela não dá XP. XP é tempo, e tempo passa pelo servidor.

Levei daqui uma coisa simples. Saldo não se protege com um if no cliente. E página estática, de graça, aguenta o produto quando o que muda mora numa API.

Se quiser ver, cria uma conta e joga um pouco. O código é aberto, licença MIT. Se achar um furo, abre uma issue.

https://rodrigomiquilino.github.io/renportal/
https://github.com/rodrigomiquilino/renportal

#RenPy #VisualNovel #Astro #Supabase #TypeScript #PostgreSQL #GitHubPages

## Versão curta

Gosto de visual novel e queria um projeto em que o backend não fosse enfeite. Fiz o RenPortal para jogar Ren'Py no navegador, ganhar XP e conversar com quem está na história.

O site é estático, Astro no GitHub Pages, sem servidor pago. Conta, banco e chat ficam no Supabase. O XP só entra se o servidor aceitar o tempo de jogo: o navegador manda um heartbeat, e ponto inventado não passa. Compra e doação acontecem inteiras ou não acontecem. O banco impede a pessoa de alterar o próprio saldo. No chat dá para ver quem está digitando.

Entra e testa: https://rodrigomiquilino.github.io/renportal/
Código: https://github.com/rodrigomiquilino/renportal

#RenPy #Astro #Supabase #TypeScript #Portfolio

## Projects (ficha do perfil)

**RenPortal**
Portal de visual novels Ren'Py. Eu queria jogar essas histórias no navegador e, no mesmo projeto, fazer um backend que não confia no cliente.

Site estático em Astro, hospedado de graça no GitHub Pages. Auth, Postgres, chat em tempo real e arquivos no Supabase. O tempo de jogo passa por heartbeat no servidor, então ninguém finge XP. Compras e doações são atômicas. RLS no banco bloqueia alteração de saldo, nível e cargo. Chat com indicador de digitação. Módulos com feature flag.

Full-Stack Student Developer · Coyote Lab · Brasil
https://rodrigomiquilino.github.io/renportal/
https://github.com/rodrigomiquilino/renportal
