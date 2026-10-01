# Configurar o Bubo — tudo o que depende de você

Este guia lista **cada conta, chave e decisão** que só o dono do projeto pode fazer. O código não
depende de mais nada: o que está aqui é o que falta para o Bubo funcionar "perfeitamente" em
produção e nas lojas. Estado técnico detalhado: [docs/release.md](docs/release.md) → "Current
remote state". Como testar cada tela: [docs/TESTAR-TELAS.md](docs/TESTAR-TELAS.md).

Última atualização: 2026-09-30 (Task 08 concluída — resenhas, amigos, ciclos e moderação geral).

---

## 1. O que já está no ar (feito por mim, sem precisar de você)

| Item                           | Estado                                                                                                                                                                                                                                                                            |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| API de produção                | `https://bubo-api.bubo-api.workers.dev` (Worker `bubo-api`). `/v1/health` e `/v1/ready` respondem 200.                                                                                                                                                                            |
| Banco Neon                     | Migrations `0001` a `0012` aplicadas, nenhuma pendente.                                                                                                                                                                                                                           |
| Segredos no Cloudflare         | `DATABASE_URL`, `BETTER_AUTH_SECRET` (gerado aleatoriamente), `BETTER_AUTH_URL`.                                                                                                                                                                                                  |
| Armazenamento R2               | Bucket `bubo` existe e está ligado ao Worker como `MEDIA` (sem acesso público ainda).                                                                                                                                                                                             |
| Testes automáticos em produção | Cadastro, catálogo, ISBN, sessões, cards, conquistas, clubes, debates anti-spoiler, clube privado com convite, enquetes, argumentos, reações, membros, feed, resenhas, amigos, ciclos, denúncia, bloqueio e exclusão de conta: todos passaram. As contas de teste foram apagadas. |

---

## 2. Resumo do que falta (por prioridade)

| #   | O que configurar                                  | Sem isso, o que acontece                                                                 | Prioridade              |
| --- | ------------------------------------------------- | ---------------------------------------------------------------------------------------- | ----------------------- |
| 1   | Plano **Workers Paid** (Cloudflare)               | Com mais usuários, cadastro/login podem falhar (limite de 10 ms de CPU do plano grátis). | Antes de usuários reais |
| 2   | **Banco de produção separado** (branch no Neon)   | Seu ambiente local e a produção escrevem no mesmo banco.                                 | Antes de usuários reais |
| 3   | **Build do app com EAS** (conta Expo)             | Não dá para testar o app contra a produção (o Expo Go só funciona com a API local).      | Para testar em produção |
| 4   | **E-mail (Resend)**                               | "Esqueci minha senha" responde "serviço indisponível".                                   | Alta                    |
| 5   | **Canal de suporte e moderação** (e-mail público) | As lojas recusam apps com comunidade sem contato para denúncias.                         | Antes das lojas         |
| 6   | **Política de Privacidade e Termos de Uso**       | As lojas recusam o app; o cadastro não pede consentimento.                               | Antes das lojas         |
| 7   | **Contas nas lojas** (Apple e Google)             | Não dá para publicar.                                                                    | Antes das lojas         |
| 8   | **Chave do Google Books**                         | A busca usa só Open Library e BrasilAPI (o Google recusa por cota sem chave).            | Média                   |
| 9   | **Capas no R2** (`MEDIA_PUBLIC_URL`)              | As capas vêm direto dos sites de origem, com a capa tipográfica como reserva.            | Média                   |
| 10  | **Domínio próprio** (opcional)                    | A API fica em `*.workers.dev`.                                                           | Baixa                   |
| 11  | **Rotacionar credenciais antigas**                | Senhas/chaves que já apareceram em arquivos ou conversas continuam válidas.              | Alta                    |
| 12  | **Tabelas antigas no Neon** (decisão)             | Nada quebra; o banco só fica com ~40 tabelas vazias que o Bubo não usa.                  | Baixa                   |

Não precisa configurar agora: `GEMINI_API_KEY` (nenhuma tela usa IA ainda) e
`CATALOG_CONTACT_EMAIL` (opcional, só identifica o Bubo para a Open Library).

---

## 3. Passo a passo

Todos os comandos rodam no PowerShell, na pasta do projeto. Os comandos `wrangler secret put`
**pedem o valor na tela**: ele não fica no histórico nem no repositório. Depois de mudar qualquer
segredo, rode a checagem da seção 4.

### 3.1 Plano Workers Paid (Cloudflare)

1. Painel Cloudflare → **Workers & Pages** → **Plans** → assinar **Workers Paid** (US$ 5/mês).
2. Nada muda no código. Me avise e eu atualizo o `docs/release.md`.

### 3.2 Banco de produção separado (Neon)

Hoje o `apps/api/.dev.vars` (usado pelo `npm run dev:api` no seu computador) aponta para o mesmo
banco da produção. Contas criadas nos seus testes locais vão para a produção.

1. Painel Neon → seu projeto → **Branches** → **Create branch** chamada `production` (a partir da
   atual) ou crie um banco novo e vazio.
2. Copie a connection string **pooled** dessa branch.
3. Aplique as migrations nela:
   ```powershell
   $env:DATABASE_URL="postgres://…(branch production)…"; npm run db:migrate --workspace @bubo/database -- --check
   $env:DATABASE_URL="postgres://…(branch production)…"; npm run db:migrate --workspace @bubo/database
   ```
4. Troque o segredo do Worker:
   ```powershell
   cd apps/api
   npx wrangler secret put DATABASE_URL --env production
   ```
5. Opcional: deixe o `.dev.vars` apontando para uma branch `dev`, ou apague a linha `DATABASE_URL`
   para desenvolver 100% local (PGlite, sem nuvem).

### 3.3 Build do app com EAS (para testar contra a produção)

O servidor de produção só aceita o app com o esquema oficial `bubo://`. O **Expo Go** usa `exp://`
e só funciona com a API local. Para testar contra a produção, gere um build:

1. Crie uma conta em [expo.dev](https://expo.dev) e rode:
   ```powershell
   npm i -g eas-cli
   eas login
   cd apps/mobile
   eas init
   eas env:create --environment preview --name EXPO_PUBLIC_API_URL --value https://bubo-api.bubo-api.workers.dev --visibility plaintext
   eas env:create --environment production --name EXPO_PUBLIC_API_URL --value https://bubo-api.bubo-api.workers.dev --visibility plaintext
   eas build --profile preview --platform android
   ```
2. Instale o APK gerado no celular Android. Para iPhone é preciso conta Apple Developer (3.7).

### 3.4 E-mail para "Esqueci minha senha" (Resend)

1. Crie conta em [resend.com](https://resend.com) → **Domains** → adicione seu domínio e crie os
   registros DNS (SPF/DKIM) que ele mostrar. Espere ficar "Verified".
2. **API Keys** → crie uma chave com permissão **Sending access** apenas.
3. Configure os dois juntos (só um deles é recusado pela validação):
   ```powershell
   cd apps/api
   npx wrangler secret put RESEND_API_KEY --env production
   npx wrangler secret put EMAIL_FROM --env production    # ex.: Bubo <nao-responda@seu-dominio.com>
   ```
4. Teste: no app, "Esqueci minha senha" → o e-mail deve chegar e o link deve abrir o app.

### 3.5 Canal de suporte e moderação (obrigatório para comunidade nas lojas)

A Comunidade já tem denunciar, bloquear, apagar o próprio conteúdo e moderação pelo criador do
clube (3 denúncias ocultam o conteúdo). As lojas também exigem que **você** possa agir sobre abusos
e que exista um contato público. Falta:

1. Um e-mail de suporte (ex.: `suporte@seu-dominio.com`) para colocar nas lojas e na Política de
   Privacidade.
2. Liberar o **painel de moderação geral** (Você → Moderação geral) para a sua conta:
   1. Descubra o id da sua conta no Neon (SQL Editor, somente leitura):
      `select id, email from users where email = 'seu-email@exemplo.com';`
   2. Grave o id (ou vários, separados por vírgula) no Worker:
      ```powershell
      cd apps/api
      npx wrangler secret put MODERATOR_USER_IDS --env production
      ```
   3. Saia e entre de novo no app: a entrada "Moderação geral" aparece em Você. Lá você vê as
      denúncias abertas de todos os clubes e decide "Remover" ou "Manter".
3. Se preferir consultar direto no banco, as denúncias abertas estão em (SQL Editor, **somente
   leitura**):
   ```sql
   select r.created_at, r.reason, r.target_type, r.target_id, c.name as clube
   from reading_club_reports r join reading_clubs c on c.id = r.club_id
   where r.status = 'open' order by r.created_at desc;
   ```
   Remova sempre pelo painel (ou pela API), nunca editando o banco: assim as denúncias são
   resolvidas e a decisão fica registrada.

### 3.6 Política de Privacidade e Termos de Uso

1. Escreva (ou contrate) os dois textos. Eles precisam citar: dados guardados (conta, estante,
   sessões, reflexões, cards, clubes e debates), exclusão de conta no app, contato de suporte e
   LGPD.
2. Publique em URLs públicas (ex.: `https://seu-dominio.com/privacidade` e `/termos`).
3. Me passe as URLs: eu coloco a caixa de consentimento no cadastro (hoje ela foi omitida de
   propósito) e os links no app.

### 3.7 Contas nas lojas

- **Apple Developer Program** (US$ 99/ano) — necessário para iPhone, inclusive para testes via
  TestFlight.
- **Google Play Console** (US$ 25, uma vez).
- Depois: `eas build --profile production --platform all` e `eas submit --profile production`
  (detalhes em [docs/release.md](docs/release.md) §4).

### 3.8 Chave do Google Books

1. [Google Cloud Console](https://console.cloud.google.com) → crie um projeto → **APIs & Services**
   → ative **Books API** → **Credentials** → **Create API key** → restrinja a chave à Books API.
2. Configure:
   ```powershell
   cd apps/api
   npx wrangler secret put GOOGLE_BOOKS_API_KEY --env production
   ```

### 3.9 Capas no R2

1. Painel Cloudflare → **R2** → bucket `bubo` → **Settings** → **Public access**: ative o domínio
   `r2.dev` ou conecte um domínio seu (recomendado para produção).
2. Configure a URL pública base (com `https://`, sem barra no final):
   ```powershell
   cd apps/api
   npx wrangler secret put MEDIA_PUBLIC_URL --env production
   ```
3. Ao abrir ou adicionar um livro, a capa passa a ser copiada para o R2 (limitada e validada).

### 3.10 Domínio próprio (opcional)

1. Painel Cloudflare → Worker `bubo-api` → **Settings** → **Domains & Routes** → adicione
   `api.seu-dominio.com`.
2. Atualize o segredo e os builds do app:
   ```powershell
   cd apps/api
   npx wrangler secret put BETTER_AUTH_URL --env production    # https://api.seu-dominio.com
   ```
   e o `EXPO_PUBLIC_API_URL` do EAS (3.3). Faça um novo build do app.
3. Observação: o subdomínio `bubo-api.workers.dev` da sua conta foi registrado automaticamente no
   primeiro deploy. Trocar o nome dele muda a URL de todos os Workers da conta.
4. **Links de convite em `https://`:** hoje o convite de clube é `bubo://convite/CODIGO` (abre o
   app se ele estiver instalado) mais o código digitável. Um link `https://seu-dominio.com/convite/…`
   que abre o app ou a loja precisa de um domínio com os arquivos de associação (Android App Links
   e iOS Universal Links). Quando tiver o domínio, me avise.

### 3.11 Rotacionar credenciais antigas

Se alguma senha do Neon ou chave do Gemini já foi colada em arquivo, conversa ou print, gere uma
nova no painel do serviço e atualize onde ela é usada (`apps/api/.dev.vars` local e o segredo do
Worker com `wrangler secret put`).

### 3.12 Tabelas antigas no banco Neon (decisão sua)

O banco atual tem cerca de 40 tabelas **vazias** que não foram criadas pelas migrations do Bubo
(por exemplo `clubs`, `club_members`, `club_polls`, `posts`, `blocks`, `works`, `editions`). O Bubo
não as usa: por isso as tabelas novas da Comunidade se chamam `reading_club_*`. Nada foi apagado.
Opções:

- **Recomendado:** criar a branch de produção limpa (3.2) a partir de um banco vazio.
- Ou me pedir para gerar um script de limpeza, que você revisa e roda.

---

## 4. Como conferir se está tudo certo

```powershell
curl https://bubo-api.bubo-api.workers.dev/v1/health    # status "ok", environment "production"
curl https://bubo-api.bubo-api.workers.dev/v1/ready     # status "ready"; se 503, lista o que falta
npm run db:migrate --workspace @bubo/database -- --check   # "pending": []
```

Depois, siga o roteiro de telas em [docs/TESTAR-TELAS.md](docs/TESTAR-TELAS.md).

## 5. Ainda não existe no app (não é configuração, é desenvolvimento)

Para você não procurar o que ainda não foi feito:

- Comunidade: notificações dos clubes e caixa de convites (vão junto com as notificações push da
  Task 09). Rascunho de resenha e feed público de resenhas (decisão de produto).
- Curva de retenção e Bubo Score (precisam de um modelo de memória documentado).
- Login com Google/Apple, verificação de e-mail, exportação de dados (LGPD).
- Configurações e notificações push (Task 09). Recursos de IA (Gemini) dentro dos fluxos.
