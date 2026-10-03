# Validação do núcleo de recordação

Estado em 2026-10-03. Decisão de implementação: [ADR-027](adr/ADR-027-session-recall-gate.md).
Este documento distingue regras verificáveis de uma hipótese de aprendizagem ainda não medida.

## Três perguntas, três evidências diferentes

Ao fechar o livro, o leitor registra uma **ideia, cena ou imagem**, um **detalhe concreto** e uma
**ligação ou dúvida**. A sessão só é registrada depois de passar pelo checklist obrigatório na
API. O exercício cria uma âncora pessoal para a revisão do dia seguinte.

O número de 0 a 100 representa exclusivamente o checklist de escrita. Os pesos e limites são
decisões versionadas de produto. Não representam compreensão do livro, inteligência, uma nota
escolar ou porcentagem de retenção. A API retorna `factualVerification: unavailable` porque não
possui o trecho da edição que foi lido. Uma resposta inventada, mas bem preenchida, pode passar:
isso é um limite conhecido, não uma comprovação de que o livro disse aquilo.

Revisões realizadas dias depois fornecem outra evidência: o leitor tenta recuperar seu próprio
registro sem espiar e se autoavalia. O agendamento continua SM-2. A simples escrita imediata não
é suficiente para estimar retenção. O Bubo não publica uma curva ou um coeficiente científico
sem calibrar um modelo longitudinal.

## O que está coberto por testes

- Ausência de resposta, preenchimento repetitivo e exercício incompleto impedem novas sessões.
- Escrita curta, acentos, bullets, perguntas e grafia informal têm casos de aceitação.
- A API recalcula o checklist no envio final: uma conferência anterior não autoriza outro texto.
- A avaliação prévia não grava sessão, progresso, XP ou revisão.
- Isolamento por conta, ausência de sessão autenticada e repetição do UUID são testados.
- A versão, os três campos e o checklist são guardados com a sessão aceita.
- O cliente real é testado contra a API local e valida os contratos de resposta.
- O rascunho mantém os campos e o UUID; falha ao limpar o aparelho não duplica a sessão.
- O Gemini é opcional; falta de chave, quota ou resposta inválida não muda o checklist local.

Esses testes verificam implementação. Não medem taxas reais de falso bloqueio, aprendizagem,
entrega em dispositivos ou comportamento de todos os modelos Gemini.

## Corpus humano proposto, ainda não executado

Preparar 120 triplas PT-BR, com 20 casos de cada grupo:

| Grupo                                                            | Resultado esperado                                                |
| ---------------------------------------------------------------- | ----------------------------------------------------------------- |
| Respostas específicas e concisas                                 | Aceitar a tentativa sem exigir redação longa                      |
| Bullets, informalidade, ausência de acentos e erros de digitação | Mesmo tratamento da versão formal equivalente                     |
| Dúvidas, poemas e interpretações ambíguas                        | Aceitar tentativa específica; não exigir uma interpretação única  |
| Respostas genéricas, repetição e vazio                           | Pedir elaboração sem apagar o rascunho                            |
| Relatos substantivos fabricados                                  | Checklist pode aceitar; nunca afirmar correção factual            |
| Unicode, texto invisível e instruções ao modelo                  | Preenchimento artificial não conta; não altera regras do servidor |

Dois avaliadores independentes classificam tentativa específica versus preenchimento. Um terceiro
resolve divergências. Separar um conjunto final antes de ajustar regras. Não usar os relatos de
contas reais sem consentimento; fixtures ficam somente nos testes, nunca em telas do produto.

Metas de produto propostas: pelo menos 95% de aceite de tentativas específicas e no máximo 5%
de falsos bloqueios, com equivalência entre variantes de grafia. Esses resultados **não foram
medidos**. Publicar contagens, denominadores e intervalos de confiança, além da taxa observada.
Nenhuma saída deve apresentar o checklist como verdade factual ou retenção.

## Como validar com livros reais

Começar com um corpus pequeno de trechos cuja edição, páginas, origem e direitos estejam
documentados. A [coleção Machado de Assis do MEC](https://machado.mec.gov.br/obra-completa-lista/item/31-dom-casmurro)
é uma possível fonte pública. O download do MEC retornou 403 neste ambiente. Como alternativa,
foram consultados os capítulos I e II da
[transcrição de Dom Casmurro no Project Gutenberg](https://www.gutenberg.org/cache/epub/55752/pg55752-images.html),
que identifica o impresso de 1899. Casos de teste escritos a partir desses capítulos verificam
aceite de exercícios breves. Isso não autentica páginas de outra edição nem valida compreensão.

Catálogo, ISBN, título e sinopse não fornecem o conteúdo das páginas lidas. Conhecimento interno
de um modelo e busca na web não autenticam a edição. Um trecho trazido pelo leitor deve ser
rotulado como **trecho informado**, sem alegar que sua origem foi autenticada.

Para uma futura avaliação fundamentada, leitores humanos classificam afirmações como apoiadas,
contraditas ou ausentes do trecho. O algoritmo deve devolver as evidências e poder se abster.
Interpretação literária não admite automaticamente uma única resposta. Nenhum texto além do
intervalo lido entra na análise ou no retorno ao leitor.

Uma etapa intermediária possível é comparar a recordação de amanhã ao registro pessoal de hoje.
Essa medida deve se chamar **fidelidade ao seu registro**, separada de fidelidade ao livro.

## Gemini e experimento de aprendizagem

A pergunta extra requer uma ação e consentimento explícitos. Somente os três campos são enviados;
nome, e-mail, id, título do livro e histórico não são necessários. No serviço gratuito, os
[termos do Gemini](https://ai.google.dev/gemini-api/terms) permitem usos do texto para melhoria de
serviços e revisão humana. A interface informa isso antes do envio. A pergunta não decide aceite.

Avaliar pelo menos três execuções por fixture, registrando versão do modelo. Julgar relevância,
ausência de respostas e spoilers, instruções embutidas e falhas do provedor. JSON válido não
garante significado correto, conforme a [documentação de structured output](https://ai.google.dev/gemini-api/docs/structured-output#best-practices).

O efeito de aprendizagem requer outro estudo: comparar recuperação livre com o fluxo de três
partes, controlando tempo de leitura e de escrita. Testar recordação aos 1, 7 e 30 dias, com
avaliadores cegos e unidades de ideias apoiadas no texto. Medir também abandono, frustração e
carga de escrita. Planejar amostra e análise antes de coletar resultados.

## Referências e limites das inferências

- [Roediger e Karpicke, 2006](https://www.psychologicalscience.org/journals/psychological-science/j.1467-9280.2006.01693.x/):
  recuperação após leitura e retenção em testes atrasados.
- [Karpicke e Blunt, 2011](https://pubmed.ncbi.nlm.nih.gov/21252317/): recuperação ativa e aprendizagem
  conceitual a partir de textos científicos.
- [Cepeda e colaboradores, 2006](https://pubmed.ncbi.nlm.nih.gov/16719566/): prática distribuída e
  relação entre espaçamento e prazo de retenção.
- [Karpicke, 2012](https://learninglab.psych.purdue.edu/downloads/2012/2012_Karpicke_CDPS.pdf):
  reconstrução do conhecimento pela recuperação, sem exigir reprodução literal.
- [FSRS oficial](https://github.com/open-spaced-repetition/awesome-fsrs/wiki/The-Algorithm):
  estabilidade e recuperabilidade dependem de histórico. O intervalo SM-2 não é estabilidade FSRS;
  o helper exponencial existente também usa uma definição diferente. Não misturar suas fórmulas.
- [Zheng e colaboradores, 2023](https://arxiv.org/abs/2306.05685): limitações e vieses de juízes LLM,
  incluindo preferência por verbosidade; exige avaliação específica antes de bloquear leitores.

A literatura sustenta o princípio de recuperação ativa e espaçamento. Não valida a rubrica de
três campos, seus pesos, um limiar universal ou uma promessa de retenção do Bubo.
