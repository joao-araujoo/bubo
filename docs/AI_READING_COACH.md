# Bubo AI Reading Coach

O AI Reading Coach avalia Deep Reviews, explica os critérios utilizados e constrói um mapa cognitivo por leitor e por livro.

## Modos de operação

O backend seleciona o provedor pela variável `AI_PROVIDER`:

- `auto`: usa OpenAI quando `OPENAI_API_KEY` estiver preenchida, depois Gemini e, por fim, o avaliador local;
- `openai`: usa o modelo definido por `OPENAI_MODEL`;
- `gemini`: usa o modelo definido por `GEMINI_MODEL`;
- `local`: não envia a síntese para serviços externos.

Quando um provedor conectado falha, `AI_ALLOW_LOCAL_FALLBACK=true` mantém o fluxo funcionando e identifica o resultado como fallback local. Com `AI_ALLOW_LOCAL_FALLBACK=false`, a API devolve `503` e não registra uma avaliação artificial.

## Variáveis de ambiente

```env
AI_PROVIDER=auto
AI_ALLOW_LOCAL_FALLBACK=true
AI_TIMEOUT_MS=25000

OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o-mini

GEMINI_API_KEY=
GEMINI_MODEL=gemini-2.0-flash
```

Nenhuma chave é enviada ao frontend. O endpoint `/api/deep-review/status` expõe apenas provedor, modelo, versão da avaliação e modo atual.

## Critérios

Cada avaliação distribui até 25 pontos entre:

1. compreensão;
2. especificidade;
3. conexões;
4. reflexão.

A aprovação exige pelo menos 100 palavras, 60 pontos e estado `APPROVED` retornado pelo avaliador. Uma resposta malformada, uma nota inconsistente ou um texto curto é normalizado para `GUIDING`.

Além da nota, a resposta contém:

- feedback específico;
- pontos fortes;
- próximos passos;
- pergunta socrática;
- prompt de retenção futura;
- metadados do provedor e da versão da avaliação.

## Avaliador local

O modo local é determinístico e usa sinais textuais para oferecer uma orientação básica. Ele não substitui a compreensão semântica de um modelo conectado, mas permite:

- desenvolvimento sem custos externos;
- funcionamento sem chave de IA;
- fallback explícito em indisponibilidades;
- testes reproduzíveis.

A interface sempre informa quando o resultado veio do avaliador local ou de um fallback.

## Memória cognitiva

`GET /api/deep-review/profile` agrega o histórico do usuário e retorna:

- média e maior profundidade;
- tendência recente;
- desempenho por dimensão;
- ponto forte e dimensão de crescimento;
- recomendação de prática;
- evolução e prompt de retenção por livro.

O conteúdo integral das sínteses permanece nos registros de Deep Review do próprio usuário. Logs de aplicação não devem imprimir o texto submetido nem as chaves dos provedores.

## Testes

O serviço é testado sem chamadas externas. A suíte cobre:

- seleção de provedor;
- extração de JSON cercado por Markdown;
- bloqueio de aprovações inconsistentes;
- comportamento do avaliador local;
- metadados transparentes;
- store e componentes do frontend.
