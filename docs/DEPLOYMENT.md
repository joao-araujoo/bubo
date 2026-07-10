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
             ↓
          MongoDB
```

O `docker-compose.yml` é adequado para desenvolvimento, homologação e uma instalação simples em um único servidor. Em produção com maior escala, use banco gerenciado, armazenamento de logs e um orquestrador apropriado.

## Requisitos

- Linux atualizado;
- Docker Engine e Compose;
- domínio com HTTPS;
- backup persistente do MongoDB;
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
AI_PROVIDER=local
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

Nunca inclua `.env`, dumps do MongoDB ou chaves em commits, imagens públicas ou logs.

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
```

A resposta saudável contém:

```json
{
  "status": "ok",
  "database": "connected"
}
```

## Seed

O seed é destinado a desenvolvimento e homologação. Evite executá-lo em produção real.

```bash
docker compose --profile demo run --rm seed
```

Ele é idempotente, mas cria credenciais conhecidas quando os valores padrão são utilizados.

## Logs

Backend:

```bash
docker compose logs -f backend
```

Frontend:

```bash
docker compose logs -f frontend
```

MongoDB:

```bash
docker compose logs -f mongo
```

Os logs da API são JSON e incluem request ID, método, rota sem query string, status e duração. O texto das Deep Reviews e credenciais não são registrados pelo logger HTTP.

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

## Atualização

```bash
git pull
docker compose build --pull
docker compose up -d
docker compose ps
curl -fsS http://localhost:8080/api/health
```

Não remova volumes durante uma atualização comum.

## Rollback

1. identifique o commit estável anterior;
2. faça checkout desse commit;
3. reconstrua frontend e backend;
4. inicie os serviços novamente;
5. valide health check e login.

```bash
git checkout <commit-estavel>
docker compose build backend frontend
docker compose up -d backend frontend
```

Mudanças futuras de schema que exigirem migração devem incluir estratégia explícita de rollback antes do deploy.

## Monitoramento mínimo

Monitore:

- disponibilidade de `/api/health`;
- reinícios dos containers;
- uso de CPU, memória e disco;
- crescimento do volume MongoDB;
- taxas de erro HTTP 5xx;
- latência da API;
- falhas e tempo de resposta do provedor de IA;
- validade do certificado HTTPS.

## Limites e escalabilidade

O Compose atual executa uma instância da API. Antes de múltiplas réplicas:

- use MongoDB gerenciado ou replica set;
- mova rate limiting para um armazenamento compartilhado;
- centralize logs;
- mantenha todas as instâncias com o mesmo JWT secret;
- implemente migrações versionadas;
- avalie filas para tarefas de IA demoradas.

## Checklist pós-deploy

- health check responde `ok`;
- cadastro e login funcionam;
- busca de livros responde;
- Deep Review funciona no modo configurado;
- fallback local aparece quando esperado;
- feed persiste curtida e comentário;
- clube pode ser criado e acessado;
- PWA possui manifest e service worker;
- logs não contêm segredos;
- backup foi executado;
- alertas básicos estão ativos.
