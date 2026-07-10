# Bubo — Read Deeply

Bubo é uma plataforma de leitura profunda que combina acervo, progresso, Deep Reviews avaliadas por IA, memória cognitiva, rede social e clubes de leitura.

A aplicação foi desenhada para não substituir o pensamento do leitor. A IA atua como tutora socrática: avalia evidências e conexões, explica critérios e sugere perguntas para aprofundar a reflexão.

## Estado atual

O produto inclui:

- autenticação, perfil e onboarding personalizado;
- biblioteca com status e progresso por livro;
- pesquisa no Google Books e adição ao acervo;
- Deep Review com OpenAI, Gemini ou avaliador local;
- mapa cognitivo com compreensão, especificidade, conexões e reflexão;
- prompts de retenção por livro;
- feed persistente com posts, curtidas, comentários, salvos e seguidores;
- notificações sociais;
- clubes públicos e privados, membros, progresso e discussões por páginas;
- conquistas, metas e XP;
- temas claro e escuro;
- interface responsiva, acessível e instalável como PWA;
- testes automatizados e Quality Gates de frontend e backend;
- Docker Compose, health checks e seed demonstrativo.

## Início rápido com Docker

### Requisitos

- Git;
- Docker Desktop 4.30 ou superior, com Docker Compose.

### 1. Clone o repositório

```bash
git clone https://github.com/joao-araujoo/bubo.git
cd bubo
```

### 2. Crie o arquivo de ambiente

Linux, macOS ou Git Bash:

```bash
cp .env.example .env
```

PowerShell:

```powershell
Copy-Item .env.example .env
```

Para uso local, os valores padrão já funcionam. Antes de publicar a aplicação, substitua obrigatoriamente `JWT_SECRET`.

### 3. Inicie a aplicação com dados de demonstração

```bash
docker compose --profile demo up --build
```

Na primeira execução, o Docker baixa as imagens, compila frontend e backend, inicia o MongoDB e executa o seed idempotente.

Acesse:

- aplicação: `http://localhost:8080`;
- API: `http://localhost:3001`;
- health check: `http://localhost:3001/api/health`.

Conta demonstrativa:

```text
E-mail: demo@bubo.local
Senha: BuboDemo123!
```

O seed contém livros, progresso, Deep Reviews, mapa cognitivo, publicação social e clube de leitura. Ele pode ser executado novamente sem duplicar os registros principais.

Para iniciar sem dados demonstrativos:

```bash
docker compose up --build
```

Para executar em segundo plano:

```bash
docker compose --profile demo up --build -d
```

Para encerrar:

```bash
docker compose down
```

Para apagar também o banco local e recomeçar do zero:

```bash
docker compose down --volumes --remove-orphans
```

## Configuração da IA

O modo padrão do Docker é `local`: nenhuma síntese é enviada a serviços externos.

### OpenAI

No arquivo `.env`:

```env
AI_PROVIDER=openai
OPENAI_API_KEY=sua_chave
OPENAI_MODEL=gpt-4o-mini
```

### Google Gemini

```env
AI_PROVIDER=gemini
GEMINI_API_KEY=sua_chave
GEMINI_MODEL=gemini-2.0-flash
```

### Seleção automática

```env
AI_PROVIDER=auto
```

A ordem é OpenAI, Gemini e avaliador local. Com `AI_ALLOW_LOCAL_FALLBACK=true`, uma indisponibilidade externa usa o avaliador local e informa isso na interface. Nenhuma chave é enviada ao navegador.

Mais detalhes: [`docs/AI_READING_COACH.md`](docs/AI_READING_COACH.md).

## Desenvolvimento sem Docker

### Requisitos

- Node.js 24 ou superior;
- npm 10 ou superior;
- MongoDB 7 disponível localmente.

Instale as dependências:

```bash
npm run setup
```

Copie e configure o ambiente do backend:

```bash
cp backend/.env.example backend/.env
```

No PowerShell:

```powershell
Copy-Item backend/.env.example backend/.env
```

Use um segredo JWT com pelo menos 24 caracteres. Depois, em terminais separados:

```bash
npm run dev --prefix backend
```

```bash
npm run dev --prefix frontend
```

O frontend abre em `http://localhost:5173` e encaminha `/api` para `http://localhost:3001`.

Seed opcional:

```bash
npm run seed --prefix backend
```

## Validação local

Execute a suíte completa:

```bash
npm run check
```

Ela executa:

1. testes do backend;
2. ESLint do frontend;
3. testes do frontend;
4. build de produção.

O GitHub Actions executa os mesmos gates em cada pull request. A etapa clone-ready também compila as imagens Docker, inicia a stack, executa o seed e verifica os health checks.

## Arquitetura

```text
bubo/
├── backend/
│   ├── scripts/              # seed idempotente
│   ├── src/
│   │   ├── config/           # ambiente validado
│   │   ├── controllers/      # contratos HTTP
│   │   ├── middleware/       # autenticação
│   │   ├── models/           # schemas e índices MongoDB
│   │   ├── routes/           # rotas Express
│   │   ├── services/ai/      # AI Reading Coach
│   │   └── utils/            # logger estruturado
│   └── test/                 # testes com Node Test Runner
├── frontend/
│   ├── public/               # PWA e assets públicos
│   └── src/
│       ├── components/       # design system e componentes de domínio
│       ├── pages/            # áreas do produto
│       ├── services/         # cliente HTTP
│       ├── stores/           # estado Zustand
│       ├── theme/            # temas e tokens
│       └── test/             # configuração do Vitest
├── docs/
├── docker-compose.yml
└── package.json
```

### Stack

Frontend:

- React 18;
- Vite 5;
- Tailwind CSS;
- Zustand;
- React Query;
- Framer Motion;
- Lucide React;
- Vitest e Testing Library.

Backend:

- Node.js 24;
- Express;
- MongoDB e Mongoose;
- JWT e bcryptjs;
- OpenAI ou Gemini;
- Node Test Runner.

Infraestrutura local:

- Nginx;
- Docker Compose;
- MongoDB 7.

## Variáveis principais

| Variável | Finalidade | Padrão local |
|---|---|---|
| `BUBO_PORT` | Porta pública do frontend | `8080` |
| `API_PORT` | Porta pública da API | `3001` |
| `JWT_SECRET` | Assinatura dos tokens | deve ser substituída em produção |
| `AI_PROVIDER` | `auto`, `openai`, `gemini` ou `local` | `local` |
| `AI_ALLOW_LOCAL_FALLBACK` | Mantém o fluxo quando o provedor falha | `true` |
| `OPENAI_API_KEY` | Credencial OpenAI | vazia |
| `GEMINI_API_KEY` | Credencial Gemini | vazia |
| `GOOGLE_BOOKS_API_KEY` | Cota opcional do Google Books | vazia |
| `SEED_DEMO_EMAIL` | Login do seed | `demo@bubo.local` |
| `SEED_DEMO_PASSWORD` | Senha do seed | `BuboDemo123!` |

Veja todos os valores em [`.env.example`](.env.example) e [`backend/.env.example`](backend/.env.example).

## Segurança

- segredos permanecem no backend;
- o servidor não inicia com `JWT_SECRET` inválido ou MongoDB indisponível;
- CORS usa allowlist por ambiente;
- endpoints possuem rate limit;
- payloads têm limite configurável;
- entradas MongoDB são sanitizadas;
- erros de produção não retornam stack ou mensagem interna;
- respostas possuem request ID;
- containers possuem health checks;
- o backend executa com usuário sem privilégios;
- o MongoDB não é exposto publicamente pelo Compose.

O segredo padrão do Docker existe apenas para desenvolvimento local. Nunca o reutilize em produção.

## Solução de problemas

### A porta já está em uso

Altere no `.env`:

```env
BUBO_PORT=8081
API_PORT=3002
```

Depois reinicie o Compose.

### O backend está `unhealthy`

Veja os logs:

```bash
docker compose logs backend
```

Confira também:

```bash
curl http://localhost:3001/api/health
```

No PowerShell:

```powershell
Invoke-RestMethod http://localhost:3001/api/health
```

### O seed não apareceu

Execute manualmente:

```bash
docker compose --profile demo run --rm seed
```

Atualize a página depois que a execução terminar.

### A IA externa não responde

Confirme a chave e o nome do modelo no `.env`. Para continuar sem custo externo:

```env
AI_PROVIDER=local
```

### Alterei o frontend, mas o navegador mostra a versão anterior

O Bubo possui service worker. Em desenvolvimento normal ele não é registrado. Para uma imagem Docker antiga:

```bash
docker compose build --no-cache frontend
docker compose up -d frontend
```

Depois, recarregue a página ignorando o cache ou remova os dados do site no navegador.

### Quero zerar tudo

```bash
docker compose down --volumes --remove-orphans
docker compose --profile demo up --build
```

## Fluxo de contribuição

1. crie uma branch curta;
2. implemente uma entrega vertical;
3. execute `npm run check`;
4. abra um pull request;
5. aguarde os Quality Gates;
6. faça merge somente com frontend e backend verdes.

## Licença e uso

O repositório ainda não contém uma licença pública. Até que uma licença seja adicionada, considere o código como uso reservado ao autor do projeto.
