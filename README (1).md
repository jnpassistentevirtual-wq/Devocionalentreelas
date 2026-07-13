# Estudo Bíblico para Mulheres — Site

Este é o site completo, fora do Claude, hospedável no GitHub Pages, com banco
de dados próprio no Supabase.

## Arquivos

- `index.html` — página principal
- `styles.css` — visual (azul/branco/bege, mesma identidade de antes)
- `content.js` — todo o conteúdo dos 6 meses (Provérbios, Mulheres de
  Coragem, Mulheres do NT, Mães e Avós, Maria e Isabel), mural, orações por
  área e playlist
- `config.js` — sua foto, testemunho, link do WhatsApp e as chaves de
  conexão com o Supabase
- `app.js` — toda a lógica do site (login, diário, mural)

## Passo 1 — Rodar o SQL no Supabase (OBRIGATÓRIO, fazer antes de tudo)

1. No painel do seu novo projeto Supabase, vá em **SQL Editor** → **New query**
2. Abra o arquivo `sql/setup.sql` (que já te enviei antes), copie tudo e cole lá
3. Clique em **Run**
4. Deve aparecer "Success. No rows returned" — isso cria todas as tabelas

## Passo 2 — Desativar confirmação de e-mail (OBRIGATÓRIO)

Como o login é só "nome + senha" (sem e-mail de verdade por trás), você
precisa desligar a exigência de confirmação por e-mail:

1. No painel do Supabase, vá em **Authentication** → **Sign In / Providers**
   (ou **Providers** → **Email**, dependendo da versão)
2. Desative a opção **"Confirm email"**
3. Salve

Sem esse passo, ninguém consegue criar conta (o Supabase vai esperar por um
e-mail de confirmação que nunca chega, já que os e-mails são fictícios).

## Passo 3 — Publicar no GitHub Pages

1. Crie um repositório novo no GitHub (ex: `estudo-biblico-mulheres`)
2. Suba os 5 arquivos desta pasta (`index.html`, `styles.css`, `content.js`,
   `config.js`, `app.js`) para a raiz do repositório
3. Vá em **Settings** → **Pages**
4. Em "Source", selecione a branch (geralmente `main`) e pasta `/ (root)`
5. Salve — o GitHub vai te dar um link tipo
   `https://seu-usuario.github.io/estudo-biblico-mulheres/`
6. Esse é o link que você compartilha com o grupo

## Como funciona o login

Cada mulher cria a própria conta com **nome + senha** (sem precisar de
e-mail). As respostas do diário ficam privadas para cada uma. O mural
(recados, comentários, orações, testemunhos, louvores) é compartilhado —
todo mundo vê o que todo mundo escreve lá.

## Se precisar mexer no conteúdo depois

- Textos dos 6 meses → `content.js`
- Sua foto, testemunho, link do grupo → `config.js`
- Visual (cores, fontes) → `styles.css`

Qualquer ajuste, é só me chamar de novo na conversa.
