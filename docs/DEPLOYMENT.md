# Deploy e operação do Bubo

Este documento descreve os requisitos mínimos para publicar o Bubo fora do ambiente local.

## Arquitetura recomendada

```text
Internet
  ↓ HTTPS
Reverse proxy / load balancer
  ↓
Frontend Nginx (porta 80 interna)
  ├── arquivos React/PWA
  └── /api → backend:3001
                 ├── MongoDB: dados persistentes do produto
                 └── Redis: rate limit e cache compartilhado
```

O `docker-compose.yml` é adequado para desenvolvimento, homologação e uma instalação simples em um único servidor. Em produção com maior escala, use MongoDB e Redis gerenciados, armazenamento centralizado de logs e um orquestrador apropriado.

## Requisitos

- Linux atualizado;
- Docker Engine e Compose;
- domínio com HTTPS;
- backup persistente do MongoDB;
- Redis privado ou gerenciado;
- segredo JWT aleatório;
- chave de IA opcional.

## Segredos

Gere um JWT forte:

```bash
openssl rand -base64 48
```

Defina no `.env`:

```env
JWT_SECRET=valor_gerado
AI_PROVIDER=auto
```

Para IA conectada, adicione somente uma chave no servidor:

```env
AI_PROVIDER=openai
OPENAI_API_KEY=...
```

ou:

```env
AI_PROVIDER=gemini
GEMINI_API_KEY=...
```

Nunca inclua `.env`, dumps do MongoDB, URLs Redis com credenciais ou chaves em commits, imagens públicas ou logs.

## Redis

O Compose fornece Redis na rede interna e não publica a porta `6379` no host:

```env
REDIS_URL=redis://redis:6379/0
REDIS_REQUIRED=true
REDIS_KEY_PREFIX=bubo:production
```

Em um serviço gerenciado, prefira TLS:

```env
REDIS_URL=rediss://usuario:senha@cache.example:6380/0
```

Declare a quantidade esperada de réplicas:

```env
INSTANCE_COUNT=1
```

Quando `INSTANCE_COUNT` é maior que um, Redis se torna obrigatório automaticamente. Não desative essa proteção em uma implantação com múltiplas instâncias.

Consulte `docs/REDIS.md` para namespaces, política de falha, métricas e recuperação.

## CORS e URL pública

No Compose local, `CLIENT_URL` é montada automaticamente. Em outro ambiente, configure a origem exata do navegador. Múltiplas origens podem ser separadas por vírgula:

```env
CLIENT_URL=https://bubo.example,https://admin.bubo.example
```

Não use `*` com credenciais.

## HTTPS

O Nginx incluído serve a aplicação dentro da rede Docker. Termine HTTPS em um proxy externo como Caddy, Traefik, Nginx Proxy Manager, balanceador cloud ou ingress controller.

O proxy deve encaminhar para a porta pública definida em `BUBO_PORT`. Preserve:

- `Host`;
- `X-Forwarded-For`;
- `X-Forwarded-Proto`;
- `X-Request-ID`, quando disponível.

Com proxy reverso, mantenha:

```env
TRUST_PROXY=true
```

## Inicialização

Sem dados demonstrativos:

```bash
docker compose up --build -d
```

Verifique:

```bash
docker compose ps
curl -fsS http://localhost:8080/api/health
curl -fsS http://localhost:8080/api/health/ready
```

A resposta saudável contém:

```json
{
  "status": "ok",
  "ready": true,
  "database": "connected",
  "redis": "connected"
}
```

O endpoint de liveness não depende das bases:

```bash
curl -fsS http://localhost:8080/api/health/live
```

## Seed

O seed é destinado a desenvolvimento e homologação. Evite executá-lo em produção real.

```bash
docker compose --profile demo run --rm seed
```

Ele é idempotente, mas cria credenciais conhecidas quando os valores padrão são utilizados.

## Logs

```bash
docker compose logs -f backend
docker compose logs -f frontend
docker compose logs -f mongo
docker compose logs -f redis
```

Os logs da API são JSON e incluem request ID, usuário quando autenticado, método, rota sem query string, status e duração. Senhas, tokens, cookies, chaves e credenciais são removidos recursivamente.

Não registre textos integrais de Deep Review, corpos de requisição ou URLs Redis completas.

## Métricas

Em produção, o endpoint fica desabilitado por padrão. Para habilitar:

```env
METRICS_ENABLED=true
METRICS_TOKEN=<segredo-com-pelo-menos-24-caracteres>
```

Consulta:

```bash
curl -fsS \
  -H "Authorization: Bearer $METRICS_TOKEN" \
  https://bubo.example/api/metrics
```

As métricas incluem HTTP, memória, event loop, MongoDB e Redis. O token nunca deve ser enviado ao frontend.

## Backup do MongoDB

Exemplo de backup no servidor:

```bash
docker compose exec mongo mongodump --db bubo --archive=/tmp/bubo.archive --gzip
docker compose cp mongo:/tmp/bubo.archive ./backups/bubo-$(date +%F).archive
```

Exemplo de restauração:

```bash
docker compose cp ./backups/bubo.archive mongo:/tmp/bubo.archive
docker compose exec mongo mongorestore --archive=/tmp/bubo.archive --gzip --drop
```

Teste restaurações periodicamente. Um backup nunca testado não é uma estratégia de recuperação.

Redis não é a fonte principal dos dados do produto. O Compose mantém AOF para reduzir perda de cache e contadores em reinícios, mas a recuperação do sistema não deve depender de backup Redis.

## Atualização

```bash
git pull
docker compose build --pull
docker compose up -d
docker compose ps
curl -fsS http://localhost:8080/api/health/ready
```

Não remova volumes durante uma atualização comum.

## Rollback

1. identifique o commit estável anterior;
2. faça checkout desse commit;
3. reconstrua frontend e backend;
4. inicie os serviços novamente;
5. valide readiness, login e uma rota protegida.

```bash
git checkout <commit-estavel>
docker compose build backend frontend
docker compose up -d mongo redis backend frontend
```

Mudanças futuras de schema que exigirem migração devem incluir estratégia explícita de rollback antes do deploy.

## Monitoramento mínimo

Monitore:

- disponibilidade de `/api/health/live` e `/api/health/ready`;
- reinícios dos containers;
- uso de CPU, memória e disco;
- crescimento do volume MongoDB;
- memória, latência, reconexões e rejeições de escrita do Redis;
- taxas de erro HTTP 5xx e 429;
- p95 e p99 de latência da API;
- atraso do event loop;
- falhas e tempo de resposta do provedor de IA;
- validade do certificado HTTPS.

## Limites e escalabilidade

O Compose atual publica uma instância da API. Para múltiplas réplicas:

- use MongoDB gerenciado ou replica set;
- mantenha Redis obrigatório e compartilhado;
- defina `INSTANCE_COUNT` corretamente;
- use o mesmo `JWT_SECRET` em todas as instâncias;
- use o mesmo `REDIS_KEY_PREFIX` dentro do ambiente;
- centralize logs e métricas;
- implemente migrações versionadas;
- coloque tarefas demoradas de IA em filas antes de aumentar concorrência.

## Checklist pós-deploy

- liveness responde `ok`;
- readiness responde `ready: true`;
- MongoDB e Redis aparecem como `connected`;
- Redis não possui porta pública acidental;
- cadastro e login funcionam;
- rate limit retorna 429 quando esperado;
- busca de livros responde e reutiliza cache;
- Deep Review funciona no modo configurado;
- feed persiste curtida e comentário;
- clube pode ser criado e acessado;
- PWA possui manifest e service worker;
- logs não contêm segredos;
- backup MongoDB foi executado e restaurado em teste;
- alertas básicos estão ativos.
