# ADR-027: encerramento com recordação obrigatória e checklist honesto

Date: 2026-10-03. Status: accepted in code; human corpus and device acceptance pending.

## Contexto

A sessão permitia registrar apenas tempo e páginas, com reflexão opcional. O produto precisa
transformar o encerramento em recuperação ativa: fechar o livro, reconstruir uma ideia, lembrar
um detalhe e relacionar o trecho a outra ideia ou a uma dúvida. Sem acesso ao trecho da edição,
o sistema não pode verificar se o relato corresponde ao livro. Uma IA com conhecimento geral
também não autentica páginas, edição ou interpretação literária.

## Decisão

Novas sessões exigem três respostas: `idea`, `detail`, `connection`. Uma dúvida específica é
uma ligação válida. A API avalia novamente o texto final, antes de gravar sessão, progresso,
XP ou cartão de revisão. A avaliação prévia autenticada em `POST /v1/sessions/assessment`
verifica que o livro está na estante do leitor; não concede uma autorização reutilizável.
O UUID de uma sessão já aceita continua idempotente, inclusive sessões históricas sem exercício.
O progresso é protegido por bloqueio da linha da estante e a inserção por unicidade do UUID.

`bubo-recall-v1` é uma regra determinística de produto em `@bubo/scoring`, com testes. Cada
resposta precisa de três palavras com letras e três palavras distintas após normalização.
Respostas ausentes, metacomentários inteiramente genéricos conhecidos, alguns exemplos comuns
de preenchimento artificial, repetição excessiva e comandos dirigidos ao avaliador são recusados.
As três respostas não podem repetir a mesma sequência de palavras. A comparação preserva ordem
e negação; compartilhar tema ou vocabulário não comprova duplicação. Acentos, grafia informal,
bullets e frases específicas curtas funcionam. Cada campo tem no máximo 600 caracteres, mantendo
a reflexão derivada e o cartão dentro dos limites existentes.

Os quatro checks têm peso fixo de 25. `score` é **preenchimento do checklist**, jamais correção
factual, compreensão, originalidade autoral, porcentagem de memória ou capacidade cognitiva.
Texto maior e escrita mais polida não geram mais pontos. `factualVerification: unavailable`
acompanha toda avaliação. Não existe mecanismo confiável para detectar toda resposta inventada,
copiada ou sem sentido; os testes registram que um relato fabricado plausível pode passar.
Os limiares são versionados e não foram calibrados como medida científica.

Migração aditiva `0014` guarda os três campos e o resultado versionado em JSON na sessão aceita.
Sessões antigas permanecem nulas; não recebem notas retroativas. A reflexão é derivada dos três
campos aceitos, não de um valor paralelo enviado pelo cliente, e gera um cartão para amanhã.
O cartão contém a nota pessoal do leitor. A revisão continua autoavaliada e agendada por SM-2.

O Gemini oferece apenas uma pergunta adicional, por ação e consentimento explícitos. Recebe
somente os três campos: não recebe título, id, nome, e-mail ou histórico. A interface informa
o tratamento possível de texto no serviço gratuito. O servidor pede JSON e valida uma única
pergunta de até 240 caracteres; nenhum resultado do provedor altera o checklist ou o aceite.
Não há fonte do livro, respostas, correções ou spoilers no objetivo do coach. Pergunta válida
em JSON ainda pode ser ruim semanticamente; avaliação humana do modelo continua pendente.

Uma tentativa diária tem limite persistente de cinco chamadas por conta, com timeout de oito
segundos; Gemini 2.5 Flash recebe `thinkingBudget: 0` para esta pergunta curta. Outros modelos
mantêm sua configuração padrão. Exercício sem nenhum campo válido não chama o provedor. Falta de chave, quota,
timeout, filtro de segurança e saída inválida mantêm o checklist e retornam coach indisponível.
Notas e saídas do provedor nunca são logadas. A exclusão da conta remove seu contador de quota.

## Consequências e validação

O fluxo impede encerramento vazio e cria uma base pessoal para revisão espaçada. Não demonstra
efeito de aprendizagem, não impede fraude sofisticada e pode bloquear respostas legítimas muito
curtas ou genéricas. Não corrigir esses limites com uma promessa de "100% de retenção" ou usando
uma IA como autoridade sem fonte. Preservar o rascunho e orientar elaboração; monitorar abandono
e falso bloqueio antes de ajustar uma nova versão.

Testes cobrem limites, Unicode, informalidade, dúvida, negação e direção dos personagens,
preenchimento artificial, reavaliação contra alteração do texto, ausência de efeitos durante
recusa, autenticação/contas, persistência, legados, idempotência concorrente e falhas do Gemini.
São testes de implementação. O corpus humano de referência e estudos longitudinais estão
planejados em [core-validation.md](../core-validation.md), com fontes primárias e limites.
Catálogo e ISBN não fornecem páginas do livro. Avaliação factual futura precisa de texto com
proveniência, evidências por afirmação, capacidade de abstenção e controles contra spoilers.
