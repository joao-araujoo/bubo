# Redis no Bubo

Redis é a camada compartilhada de baixa latência do Bubo. Ele não substitui o MongoDB como fonte persistente dos dados de produto.

## Responsabilidades

Redis é usado para:

- contadores distribuídos de rate limit;
- cache compartilhado de busca de livros;
- coordenação futura de filas e jobs;
- métricas de disponibilidade e latência da infraestrutura compartilhada.

MongoDB continua responsável por usuários, acervo, sessões, clubes, discussões e pelo fallback persistente do cache de catálogo.

## Modos de execução

### Processo local único

Redis é opcional:

```env
INSTANCE_COUNT=1
REDIS_URL=
REDIS_REQUIRED=false
```

Neste modo:

- rate limits usam memória do processo;
- busca usa memória local e MongoDB;
- readiness não depende de Redis.

### Docker Compose

O Compose inicia Redis na rede interna:

```env
REDIS_URL=redis://redis:6379/0
REDIS_REQUIRED=true
```

A porta Redis não é publicada no host. O backend só começa a aceitar tráfego depois que MongoDB e Redis estão saudáveis.

### Múltiplas réplicas

Declare a quantidade esperada de processos:

```env
INSTANCE_COUNT=3
REDIS_URL=rediss://usuario:senha@cache.example:6380/0
REDIS_REQUIRED=true
```

Quando `INSTANCE_COUNT` é maior que um, Redis se torna obrigatório automaticamente. O servidor rejeita a inicialização quando a URL não existe ou a conexão não pode ser estabelecida.

Isso impede uma configuração aparentemente escalada, mas com:

- limites independentes por réplica;
- cache duplicado;
- comportamento diferente conforme o balanceador escolhe a instância.

## Variáveis

```env
INSTANCE_COUNT=1
REDIS_URL=
REDIS_REQUIRED=false
REDIS_KEY_PREFIX=bubo:development
REDIS_CONNECT_TIMEOUT_MS=5000
REDIS_COMMAND_TIMEOUT_MS=1500
REDIS_RECONNECT_DELAY_MS=30000
REDIS_CACHE_TTL_MS=3600000
```

### `REDIS_KEY_PREFIX`

Use um prefixo diferente por aplicação e ambiente:

```text
bubo:development
bubo:staging
bubo:production
```

São aceitos somente letras, números, dois-pontos, underscore e hífen. Isso evita colisões quando o mesmo cluster atende ambientes diferentes.

### `REDIS_URL`

Protocolos aceitos:

- `redis://` para rede privada sem TLS;
- `rediss://` para conexão TLS.

Credenciais podem existir na URL, mas nunca aparecem em logs, health checks ou métricas. O estado público contém apenas protocolo, host, porta e database.

Quando Redis é opcional e não está disponível no startup, o backend inicia degradado e agenda novas tentativas usando `REDIS_RECONNECT_DELAY_MS`. O timer não mantém o processo aberto durante shutdown e é cancelado assim que a conexão volta ou o encerramento começa.

## Rate limiting

Cada política usa um namespace separado:

```text
< prefixo >:rate-limit:api:
< prefixo >:rate-limit:auth:
< prefixo >:rate-limit:book-search:
```

O store é lazy: scripts Lua só são carregados na primeira requisição, depois que Redis está pronto.

### Política de falha

**Uma instância e Redis opcional:** fail-open.

Se Redis cair, o middleware permite a requisição e registra a falha. A aplicação permanece disponível porque ainda existe proteção local e o risco de inconsistência entre réplicas não existe.

**Múltiplas instâncias ou Redis obrigatório:** fail-closed.

O backend não inicia sem Redis. Se a dependência falhar durante a execução, a readiness fica indisponível e erros do store não são silenciosamente ignorados.

## Cache de busca

A ordem de leitura é:

```text
memória da instância → Redis → MongoDB → provedores externos
```

A ordem de escrita é:

```text
memória + Redis + MongoDB
```

Características:

- memória reduz latência dentro da mesma instância;
- Redis compartilha resultados entre réplicas;
- MongoDB preserva o fallback compartilhado mesmo sem Redis;
- falha de Redis não impede uma busca;
- IDs das chaves são hashes SHA-256 da consulta normalizada;
- payloads inválidos são descartados;
- TTL Redis é menor que o TTL persistente por padrão.

## Health e métricas

`GET /api/health/ready` informa:

```json
{
  "ready": true,
  "redis": "connected",
  "dependencies": {
    "redis": {
      "enabled": true,
      "required": true,
      "ready": true,
      "status": "ready"
    }
  }
}
```

Estados possíveis:

- `disabled`: Redis não foi configurado;
- `connected`: cliente pronto;
- `degraded`: configurado, porém indisponível.

Redis opcional e degradado mantém HTTP 200 na readiness, mas o campo geral `status` fica `degraded`. Redis obrigatório e indisponível retorna HTTP 503.

`GET /api/metrics` inclui:

- comandos executados;
- falhas;
- reconexões;
- latência média e máxima;
- último erro, último ready e último ping;
- próxima tentativa agendada, quando aplicável;
- destino sanitizado.

## Persistência e política de memória

O Compose usa AOF com `appendfsync everysec`. Isso não transforma Redis em banco principal; serve para reduzir perda de contadores e cache durante reinícios comuns.

A política `noeviction` evita expulsar silenciosamente contadores de proteção. Em produção gerenciada:

- configure limite de memória e alertas;
- monitore `used_memory`, rejeições de escrita e latência;
- dimensione o serviço antes de atingir o limite;
- não compartilhe o mesmo database com cargas desconhecidas.

## Verificação manual

Com Redis disponível:

```bash
cd backend
REDIS_URL=redis://localhost:6379/0 \
REDIS_KEY_PREFIX=bubo:verification \
npm run verify:redis
```

O comando valida:

- conexão e ping;
- JSON compartilhado;
- dois stores incrementando o mesmo contador;
- reset compartilhado;
- expiração TTL;
- ausência de credenciais no estado publicado;
- limpeza das chaves criadas.

## Incidente

1. consulte readiness e métricas;
2. verifique se Redis é obrigatório;
3. filtre logs por `redis_operation_failed`, `redis_reconnecting` e `redis_reconnect_scheduled`;
4. confira DNS, TLS, credenciais, limites de conexão e memória;
5. não altere para `REDIS_REQUIRED=false` em ambiente com múltiplas réplicas;
6. reduza réplicas para uma somente como mitigação consciente e temporária;
7. valide rate limit e cache após a recuperação.
