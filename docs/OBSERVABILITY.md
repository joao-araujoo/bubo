# Observabilidade do Bubo

Esta documentação descreve como acompanhar a API, correlacionar falhas e configurar coleta externa sem expor dados sensíveis.

## Identidade da aplicação

Defina uma identidade estável por serviço e uma versão diferente em cada deploy:

```env
SERVICE_NAME=bubo-api
APP_RELEASE=<commit-ou-tag>
```

`APP_RELEASE` aparece nos logs, nas métricas e nos relatórios externos. Em CI/CD, prefira o SHA do commit implantado.

## Request ID

Toda resposta da API contém:

```http
x-request-id: <identificador>
```

O cliente pode enviar um identificador no mesmo header. O backend aceita apenas valores com 8 a 128 caracteres formados por letras, números, ponto, dois-pontos, hífen e underscore. Valores inválidos são substituídos por UUID.

O mesmo identificador aparece:

- na resposta de erro;
- nos logs HTTP;
- nos logs de domínio executados dentro da requisição;
- no relatório enviado ao coletor externo.

Ao investigar um incidente, comece buscando o `requestId` informado pelo usuário.

## Health checks

### Liveness

```text
GET /api/health/live
```

Responde `200` enquanto o processo Node está executando. Não depende do MongoDB. Use para detectar processo travado ou container morto.

### Readiness

```text
GET /api/health/ready
```

Responde `200` somente quando:

- o servidor terminou a inicialização;
- o processo ainda aceita tráfego;
- o MongoDB está conectado;
- o shutdown não começou.

Durante indisponibilidade ou desligamento, responde `503`. Balanceadores e orquestradores devem remover a instância do tráfego nesse estado.

### Compatibilidade

```text
GET /api/health
```

Mantém o contrato histórico e retorna o mesmo resultado da readiness.

## Métricas

O endpoint JSON é:

```text
GET /api/metrics
```

Ele inclui:

- requisições ativas e totais;
- respostas por classe HTTP;
- erros 5xx e conexões abortadas;
- latência média, máxima e buckets;
- métricas por método e rota normalizada;
- memória do processo;
- atraso médio, p95, p99 e máximo do event loop;
- estado do MongoDB e do ciclo de vida do processo;
- versão da aplicação.

IDs MongoDB, UUIDs e segmentos numéricos são convertidos para `:id`, evitando uma série diferente por recurso.

### Desenvolvimento

Fora de produção, métricas ficam habilitadas por padrão e podem ser consultadas sem token.

### Produção

Em produção, ficam desabilitadas por padrão:

```env
METRICS_ENABLED=false
```

Para habilitar:

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

Nunca exponha esse token no frontend. O endpoint deve ser consumido por um agente de monitoramento, rede privada ou proxy autenticado.

## Logs estruturados

O backend escreve uma linha JSON por evento. Campos comuns:

```json
{
  "timestamp": "2026-07-11T20:00:00.000Z",
  "level": "info",
  "message": "http_request",
  "requestId": "...",
  "userId": "...",
  "method": "GET",
  "path": "/api/books/library/:id",
  "status": 200,
  "durationMs": 34
}
```

O logger remove recursivamente campos relacionados a:

- senha;
- token e JWT;
- authorization;
- cookie e sessão;
- secret;
- API key;
- credenciais.

Objetos circulares, profundos ou strings excessivamente grandes também são limitados.

Mesmo com sanitização automática, não envie corpo integral de requisições, textos de Deep Review ou dados pessoais para o logger.

## Coletor externo de erros

Falhas HTTP 5xx e erros de processo podem ser enviados por POST para um coletor compatível com JSON:

```env
ERROR_REPORTING_URL=https://errors.example/collect
ERROR_REPORTING_TOKEN=<segredo-com-pelo-menos-16-caracteres>
ERROR_REPORTING_TIMEOUT_MS=3000
```

O payload contém serviço, ambiente, release, `requestId`, contexto sanitizado e exceção. O envio:

- não bloqueia a resposta HTTP;
- possui timeout;
- não derruba a aplicação quando o coletor falha;
- é drenado por alguns segundos no shutdown gracioso.

Este adaptador pode apontar para uma função serverless, gateway interno ou coletor que converta o evento para Sentry, OpenTelemetry ou outro provedor. O frontend nunca recebe a URL ou o token.

## Alertas mínimos

Crie alertas para:

- readiness em `503` por mais de dois ciclos;
- aumento de respostas 5xx;
- p95 ou p99 de latência acima do objetivo;
- event loop p99 persistentemente alto;
- memória RSS próxima do limite do container;
- reinícios repetidos;
- falhas do coletor externo;
- indisponibilidade ou saturação do MongoDB.

## Investigação de incidente

1. obtenha horário, ação e `requestId`;
2. filtre logs pelo `requestId`;
3. identifique o primeiro evento de erro, não apenas o último efeito;
4. confira release, status do MongoDB, memória e event loop;
5. reproduza em ambiente seguro quando necessário;
6. registre causa, correção, impacto e prevenção;
7. adicione teste automatizado antes de encerrar.

## Limitações atuais

As métricas são mantidas por processo. Em múltiplas réplicas, cada instância expõe seu próprio snapshot. A próxima fase introduzirá Redis, rate limit distribuído e coleta agregada.
