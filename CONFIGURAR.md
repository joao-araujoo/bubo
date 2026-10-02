# Configurar o Bubo — tudo o que depende de você

Este guia lista **cada conta, chave e decisão** que só o dono do projeto pode fazer. O código não
depende de mais nada: o que está aqui é o que falta para o Bubo funcionar "perfeitamente" em
produção e nas lojas. Estado técnico detalhado: [docs/release.md](docs/release.md) → "Current
remote state". Como testar cada tela: [docs/TESTAR-TELAS.md](docs/TESTAR-TELAS.md).

Última atualização: 2026-10-01 (Task 09 concluída — preferências, notificações e push).

---

## 1. O que já está no ar (feito por mim, sem precisar de você)

| Item                           | Estado                                                                                                                                                                                                                                                                            |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| API de produção                | `https://bubo-api.bubo-api.workers.dev` (Worker `bubo-api`). `/v1/health` e `/v1/ready` respondem 200.                                                                                                                                                                            |
| Banco Neon                     | Migrations `0001` a `0013` aplicadas, nenhuma pendente.                                                                                                                                                                                                                           |
| Segredos no Cloudflare         | `DATABASE_URL`, `BETTER_AUTH_SECRET` (gerado aleatoriamente), `BETTER_AUTH_URL`.                                                                                                                                                                                                  |
| Armazenamento R2               | Bucket `bubo` existe e está ligado ao Worker como `MEDIA` (sem acesso público ainda).                                                                                                                                                                                             |
| Testes automáticos em produção | Cadastro, catálogo, ISBN, sessões, cards, conquistas, clubes, debates anti-spoiler, clube privado com convite, enquetes, argumentos, reações, membros, feed, resenhas, amigos, ciclos, denúncia, bloqueio e exclusão de conta: todos passaram. As contas de teste foram apagadas. |

---

## 2. Resumo do que falta (por prioridade)

| #   | O que configurar                                  | Sem isso, o que acontece                                                                  | Prioridade              |
| --- | ------------------------------------------------- | ----------------------------------------------------------------------------------------- | ----------------------- |
| 1   | Plano **Workers Paid** (Cloudflare)               | Com mais usuários, cadastro/login podem falhar (limite de 10 ms de CPU do plano grátis).  | Antes de usuários reais |
| 2   | **Banco de produção separado** (branch no Neon)   | Seu ambiente local e a produção escrevem no mesmo banco.                                  | Antes de usuários reais |
| 3   | **Build nativa do app**                           | Use `npm run build:android` para um APK gratuito com widgets; Expo Go não inclui widgets. | Para testar no celular  |
| 4   | **E-mail (Resend)**                               | "Esqueci minha senha" responde "serviço indisponível".                                    | Alta                    |
| 5   | **Canal de suporte e moderação** (e-mail público) | As lojas recusam apps com comunidade sem contato para denúncias.                          | Antes das lojas         |
| 6   | **Política de Privacidade e Termos de Uso**       | As lojas recusam o app; o cadastro não pede consentimento.                                | Antes das lojas         |
| 7   | **Contas nas lojas** (Apple e Google)             | Não dá para publicar.                                                                     | Antes das lojas         |
| 8   | **Chave do Google Books**                         | A busca usa só Open Library e BrasilAPI (o Google recusa por cota sem chave).             | Média                   |
| 9   | **Capas no R2** (`MEDIA_PUBLIC_URL`)              | As capas vêm direto dos sites de origem, com a capa tipográfica como reserva.             | Média                   |
| 10  | **Domínio próprio** (opcional)                    | A API fica em `*.workers.dev`.                                                            | Baixa                   |
| 11  | **Rotacionar credenciais antigas**                | Senhas/chaves que já apareceram em arquivos ou conversas continuam válidas.               | Alta                    |
| 12  | **Tabelas antigas no Neon** (decisão)             | Nada quebra; o banco só fica com ~40 tabelas vazias que o Bubo não usa.                   | Baixa                   |
| 13  | **Notificações push** (EAS + Firebase)            | Os avisos ficam só dentro do app; o celular não recebe lembretes nem avisos.              | Antes das lojas         |

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

### 3.3 Build Android gratuito (com widgets)

O servidor de produção só aceita o app com o esquema oficial `bubo://`. O **Expo Go** usa `exp://`
e só funciona com a API local. Para testar contra a produção, gere um APK local:

1. Na raiz do projeto, rode:
   ```powershell
   npm run build:android
   ```
2. Copie `build/android/bubo-test.apk` para o Android e abra-o, ou conecte/autorize o USB e rode
   `npm run install:android`. O app funciona sem o computador e inclui os widgets.
3. Leia [docs/build-mobile.md](docs/build-mobile.md) para diagnóstico, configuração e limites.
   Não exige EAS, assinatura paga nem publicação. iPhone físico com estes widgets exige
   Mac/Xcode e App Groups disponíveis na equipe Apple Developer (3.7).

### 3.4 Emails de conta (Resend)

**2026-10-01:** teste real entregue pelo Resend e encontrado no Gmail do dono, com a arte oficial.
Boas-vindas/confirmação, recuperação de senha e aviso de senha alterada implementados (ADR-025).
O remetente de teste `onboarding@resend.dev` não serve para enviar aos usuários em geral.
`bubo.nyoneo.com.br` está preparado no Resend; o dono adiou os quatro registros de DNS e,
até verificar o subdomínio e configurar os secrets, o email da API continua indisponível.
Guia simples com valores exatos: [docs/emails-dns.md](docs/emails-dns.md).
Modelos, casos estudados e comandos de prévia/diagnóstico: [docs/emails.md](docs/emails.md).

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

Esta seção é para distribuição futura; não é requisito para gerar/instalar o APK Android gratuito.

- **Apple Developer Program** (US$ 99/ano) — para App Store e testes via TestFlight.
  Teste local no iPhone via Mac/Xcode depende do provisionamento da conta; veja [docs/build-mobile.md](docs/build-mobile.md).
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

### 3.13 Notificações push (lembretes e avisos da comunidade)

O servidor já envia os avisos e o app já sabe recebê-los. Falta ligar o push nas contas Expo e
Google. Sem isso, os avisos continuam aparecendo na tela **Notificações** do app.

1. **Projeto EAS** (uma vez): na pasta `apps/mobile`, rode `npx eas init`. Como a configuração
   do app é `app.config.ts`, ele mostra o `projectId` e pede para colocá-lo em
   `extra.eas.projectId`: me mande o id (não é segredo) que eu coloco.
2. **Android (Firebase / FCM)**:
   1. Em <https://console.firebase.google.com>, crie um projeto e adicione um app Android com o
      pacote `com.joaoaraujo.bubo`. Baixe o `google-services.json` (não vai para o Git).
   2. Envie o arquivo para o EAS como variável de arquivo:
      `npx eas env:create --name GOOGLE_SERVICES_JSON --type file --value ./google-services.json`
   3. No Firebase → Configurações do projeto → Contas de serviço, gere uma chave privada e envie
      para o EAS: `npx eas credentials` → Android → "Google Service Account Key for FCM V1".
3. **iOS**: na primeira build com `npx eas build -p ios`, aceite que o EAS crie a chave de push
   da Apple (precisa da conta Apple Developer, item 7).
4. Faça uma nova build (3.3). No app: Você → engrenagem → "Ativar notificações". No Android 13+
   o sistema pergunta se pode notificar.

Ícone da notificação no Android: enquanto não existir um ícone monocromático oficial do Bubo, o
Android desenha a silhueta do símbolo oficial. Se o designer tiver o arquivo "Ícone minimal" em
branco com fundo transparente, me envie que eu troco.
---

### 3.14 Widgets Android e iPhone (nova build nativa)

O código dos widgets está implementado. **Expo Go não instala widgets**, e uma atualização
só de JavaScript não inclui os arquivos nativos. Não precisam de Firebase nem push.

1. Gere e instale uma nova build com `npm run build:android` (3.3). Java/SDK são preparados
   automaticamente no Windows x64. iOS local requer
   macOS/Xcode: `npm run ios --workspace @bubo/mobile`.
2. **iOS/Apple Developer:** confirme o App Group `group.com.joaoaraujo.bubo.widgets` tanto no
   app `com.joaoaraujo.bubo` quanto na extensão `com.joaoaraujo.bubo.widgets`.
   O plugin gera os entitlements e o target `BuboWidgetsExtension`, inclusive metadados para
   o EAS preparar as credenciais. Não substitua os PNGs do mascote nem a paleta gerada.
3. No app: **Você → Bubo na sua tela**. Confira as prévias dos quatro widgets (Sequência,
   Sequência da semana, Calendário de leitura, Continuar leitura); escolha a meta semanal e a
   privacidade do título. No Android, “Adicionar à tela inicial” abre a confirmação do launcher
   quando suportado. Alternativa: tela inicial → Widgets → Bubo.
4. No iPhone, adicione Bubo pelo seletor da tela inicial; a Sequência também está em
   Personalizar tela bloqueada → Adicionar Widgets. O título vem oculto; capa nunca aparece ali.
5. Faça o roteiro da seção **6c** de TESTAR-TELAS: sessões/revisões, sair/trocar conta,
   redimensionar, dados vencidos, fontes grandes e acessibilidade.

Neste ambiente foram verificados o código, testes, geração dos projetos e bundle Android.
**APK Android compilado e assinatura/três receptores de widgets verificados em 2026-10-01.**
Swift/iOS ainda não foi compilado; instalação e aceite dos widgets em aparelhos continuam
pendentes. Guia gratuito e evidências: [docs/build-mobile.md](docs/build-mobile.md).
Não há widget Android específico de tela bloqueada nem Live Activity nesta entrega.
Detalhes: [docs/widgets.md](docs/widgets.md).

## 4. Como conferir se está tudo certo

```powershell
curl https://bubo-api.bubo-api.workers.dev/v1/health    # status "ok", environment "production"
curl https://bubo-api.bubo-api.workers.dev/v1/ready     # status "ready"; se 503, lista o que falta
npm run db:migrate --workspace @bubo/database -- --check   # "pending": []
```

Depois, siga o roteiro de telas em [docs/TESTAR-TELAS.md](docs/TESTAR-TELAS.md).

## 5. Ainda não existe no app (não é configuração, é desenvolvimento)

Para você não procurar o que ainda não foi feito:

- Comunidade: rascunho de resenha e feed público de resenhas (decisão de produto).
- Curva de retenção e Bubo Score (precisam de um modelo de memória documentado).
- Login com Google/Apple, exigir verificação de email antes das lojas, exportação de dados (LGPD).
- Alerta de "curva crítica", paisagem sonora, tema sépia e exportação (Anki/Notion).
- Recursos de IA (Gemini) dentro dos fluxos.
