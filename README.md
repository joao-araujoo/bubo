# Bubo — Read Deeply

Bubo é uma plataforma de leitura profunda que combina biblioteca, progresso, Deep Reviews avaliadas por IA, memória cognitiva, rede social, recomendações por grafo e clubes de leitura.

A IA atua como tutora socrática: avalia compreensão, especificidade, conexões e reflexão sem substituir o pensamento do leitor.

## Estado atual

O Bubo 3.0 inclui:

- autenticação, perfil e onboarding personalizado;
- tema claro como padrão e opção de tema escuro;
- biblioteca com status, edição e progresso por páginas;
- pesquisa enriquecida usando Google Books e Open Library;
- capas, ISBN, autor, editora, categorias e páginas com origem e confiança;
- entrada manual de páginas quando nenhuma fonte consegue confirmá-las;
- Deep Review em etapas, com editor amplo e resultado separado;
- integração real com OpenAI ou Gemini, sem avaliação local simulada;
- mapa cognitivo por dimensão e histórico por livro;
- feed com posts, curtidas, comentários, salvos, seguidores e notificações;
- recomendações de leitores por Dijkstra e sinais de afinidade;
- clubes públicos e privados, membros, progresso e discussões por páginas;
- conquistas, metas e XP;
- componentes mobile-first, Select personalizado e PWA;
- Lucide React como biblioteca única de ícones funcionais;
- política automática que bloqueia emojis e SVGs manuais na interface;
- testes, lint, build, Docker Compose e smoke test clone-ready.

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

Abra `.env` e substitua obrigatoriamente:

```env
JWT_SECRET=uma-chave-longa-e-aleatoria-com-pelo-menos-24-caracteres
SEED_DEMO_PASSWORD=uma-senha-local-escolhida-por-voce
```

Para gerar um segredo no PowerShell:

```powershell
[Convert]::ToHexString([Security.Cryptography.RandomNumberGenerator]::GetBytes(32)).ToLower()
```

### 3. Configure a IA real

A Deep Review exige OpenAI ou Gemini. O restante do aplicativo funciona sem chave, mas a validação por IA ficará explicitamente indisponível.

OpenAI:

```env
AI_PROVIDER=openai
OPENAI_API_KEY=sua_chave
OPENAI_MODEL=gpt-4o-mini
```

Gemini:

```env
AI_PROVIDER=gemini
GEMINI_API_KEY=sua_chave
GEMINI_MODEL=gemini-2.0-flash
```

Seleção automática da primeira chave disponível:

```env
AI_PROVIDER=auto
```

As chaves permanecem somente no backend.

### 4. Inicie com dados demonstrativos

```bash
docker compose --profile demo up --build
```

Acesse:

- aplicação: `http://localhost:8080`;
- API: `http://localhost:3001`;
- health check: `http://localhost:3001/api/health`.

Conta demonstrativa:

```text
E-mail: o valor de SEED_DEMO_EMAIL no seu .env
Senha: o valor de SEED_DEMO_PASSWORD no seu .env
```

O seed é idempotente e inclui:

- quatro livros com capas reais;
- progresso e Deep Reviews demonstrativas;
- cinco leitores com avatares fotográficos;
- publicações e interações sociais;
- uma rede de segundo e terceiro grau;
- recomendações por grafo;
- clube de leitura com membros e discussão.

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

Para apagar o banco e recriar toda a demonstração:

```bash
docker compose down --volumes --remove-orphans
docker compose --profile demo up --build
```

## Atualizando uma instalação existente

```bash
git pull origin main
docker compose down --volumes --remove-orphans
docker compose --profile demo up --build
```

O reset de volumes é recomendado nesta atualização porque os modelos de livros, IA e dados demonstrativos foram ampliados.

O tema claro é o padrão para novas preferências. Se o navegador já guardou o tema escuro, altere pelo botão de tema ou remova a chave `bubo-theme` do armazenamento local.

## Marca oficial

O código não desenha corujas nem tenta recriar a marca com SVG manual. Os ativos oficiais devem ser colocados em:

```text
frontend/public/brand/bubo-logo.png
frontend/public/brand/bubo-wordmark.png
frontend/public/brand/bubo-mascot.png
```

Recomendações:

- PNG ou WebP com fundo transparente;
- resolução mínima de 512 × 512 para símbolo e mascote;
- wordmark horizontal com boa legibilidade em fundo claro;
- sem margens transparentes excessivas.

Enquanto os arquivos não existirem, o app mostra um fallback tipográfico neutro. Consulte `frontend/public/brand/README.md`.

## Catálogo de livros

A busca consulta Google Books e Open Library de forma independente. Os resultados são combinados por ISBN ou por título e autor.

O Bubo prioriza:

1. número de páginas confirmado;
2. capa de maior resolução;
3. ISBN;
4. autor e editora;
5. categorias e data de publicação.

Quando uma fonte falha, a outra continua sendo usada. Quando nenhuma confirma as páginas, o usuário informa o total da própria edição antes de adicionar o livro.

`GOOGLE_BOOKS_API_KEY` é opcional, mas aumenta a cota da busca no Google Books.

## Deep Review 3.0

O fluxo possui quatro momentos:

1. seleção do trecho;
2. escrita em editor amplo;
3. revisão antes do envio;
4. resultado separado da escrita.

A avaliação considera:

- compreensão;
- especificidade;
- conexões;
- reflexão.

O texto permanece na interface quando há falha de conexão, provedor indisponível ou resposta incompleta. O backend nunca inventa uma nota local.

## Recomendações sociais

As sugestões de leitores usam um ranking híbrido:

- menor caminho na rede de seguidores calculado por Dijkstra;
- conexões em comum;
- clubes compartilhados;
- livros em comum;
- gêneros de interesse;
- atividade recente.

Cada recomendação apresenta motivos legíveis em vez de uma pontuação opaca.

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

PowerShell:

```powershell
Copy-Item backend/.env.example backend/.env
```

Depois, em terminais separados:

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

```bash
npm run check
```

O Quality Gate executa:

1. política visual sem emojis ou SVGs manuais;
2. ESLint;
3. testes do frontend;
4. build de produção;
5. testes do backend;
6. carregamento integral dos módulos.

No GitHub Actions, um smoke test adicional constrói as imagens, inicia MongoDB, API e frontend, executa o seed com credenciais efêmeras, autentica uma conta e valida uma rota protegida.

## Arquitetura

```text
bubo/
├── backend/
│   ├── scripts/                  # seed idempotente
│   ├── src/
│   │   ├── config/               # ambiente validado
│   │   ├── controllers/          # contratos HTTP
│   │   ├── middleware/           # autenticação e proteção
│   │   ├── models/               # schemas e índices MongoDB
│   │   ├── routes/               # rotas Express
│   │   └── services/
│   │       ├── ai/               # AI Reading Coach
│   │       ├── books/            # enriquecimento de metadados
│   │       └── social/           # recomendação por grafo
│   └── test/                     # Node Test Runner
├── frontend/
│   ├── public/brand/             # ativos oficiais do Bubo
│   └── src/
│       ├── components/           # design system e domínios
│       ├── pages/                # áreas do produto
│       ├── services/             # cliente HTTP
│       ├── stores/               # Zustand
│       └── theme/                # temas e tokens
├── docs/
├── docker-compose.yml
└── package.json
```

## Variáveis principais

| Variável | Finalidade |
|---|---|
| `BUBO_PORT` | Porta pública do frontend |
| `API_PORT` | Porta pública da API |
| `JWT_SECRET` | Assinatura dos tokens; obrigatória |
| `AI_PROVIDER` | `auto`, `openai` ou `gemini` |
| `OPENAI_API_KEY` | Credencial OpenAI |
| `GEMINI_API_KEY` | Credencial Gemini |
| `GOOGLE_BOOKS_API_KEY` | Cota opcional do Google Books |
| `SEED_DEMO_EMAIL` | E-mail da conta demonstrativa |
| `SEED_DEMO_PASSWORD` | Senha escolhida para o seed; obrigatória ao usar o perfil `demo` |

## Segurança

- segredos permanecem no backend;
- Compose não fornece senhas demonstrativas ou JWT padrão;
- o servidor rejeita `JWT_SECRET` inválido;
- o CI gera credenciais efêmeras em cada execução;
- CORS usa allowlist por ambiente;
- endpoints possuem rate limit;
- payloads têm limite configurável;
- entradas MongoDB são sanitizadas;
- erros de produção não expõem stack interna;
- respostas possuem request ID;
- containers possuem health checks;
- o backend executa sem privilégios;
- MongoDB não é exposto publicamente pelo Compose.

## Solução de problemas

### O Compose informa que uma variável é obrigatória

Confira se `.env` contém valores reais para:

```env
JWT_SECRET=...
SEED_DEMO_PASSWORD=...
```

### O backend está `unhealthy`

```bash
docker compose logs backend
```

```bash
curl http://localhost:3001/api/health
```

PowerShell:

```powershell
Invoke-RestMethod http://localhost:3001/api/health
```

### A IA não está disponível

Confirme que `AI_PROVIDER` corresponde a uma chave preenchida. Não existe modo local de avaliação.

### O navegador mostra uma versão anterior

```bash
docker compose build --no-cache frontend
docker compose up -d frontend
```

Depois, recarregue ignorando o cache ou remova os dados do site.

## Licença e uso

O repositório ainda não contém uma licença pública. Até que uma licença seja adicionada, considere o código como uso reservado ao autor do projeto.
