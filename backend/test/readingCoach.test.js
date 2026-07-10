const test = require('node:test');
const assert = require('node:assert/strict');
const {
  evaluateDeepReview,
  extractJson,
  normalizeEvaluation,
  resolveProvider,
  scoreHeuristic
} = require('../src/services/ai/readingCoach');

const reflectiveReview = `
O trecho mostra que a escolha do personagem não nasce apenas de uma decisão individual, porque o ambiente limita as alternativas possíveis. Quando ele observa que “cada recurso pertence a alguém”, percebo uma relação entre sobrevivência e poder. Isso conecta o conflito atual ao início do livro, porém também lembra situações reais em que uma instituição controla aquilo de que todos dependem. A consequência não é somente econômica: ela muda a confiança entre as pessoas e transforma qualquer ajuda em negociação.

Penso que o ponto mais importante está na contradição entre liberdade e necessidade. O personagem afirma que escolheu, mas sua escolha foi construída por pressões anteriores. Portanto, interpretar a cena apenas como coragem esconderia as causas que tornaram o risco inevitável. Também questiono se o autor quer criticar o líder ou mostrar que ninguém consegue agir fora do sistema. Se esse detalhe fosse diferente, talvez a decisão parecesse heroica; do modo como aparece, ela sugere responsabilidade coletiva e não apenas mérito individual.

Essa ideia se relaciona ao tema central porque mostra como o poder organiza possibilidades antes mesmo da ação. Quero lembrar que uma decisão pode ser pessoal e ainda assim depender de estruturas maiores.
`;

test('extractJson accepts fenced provider output', () => {
  const parsed = extractJson('```json\n{"state":"GUIDING","cognitiveDepth":0}\n```');
  assert.equal(parsed.state, 'GUIDING');
});

test('resolveProvider follows explicit and automatic configuration', () => {
  assert.equal(resolveProvider({ AI_PROVIDER: 'local' }), 'local');
  assert.equal(resolveProvider({ AI_PROVIDER: 'openai', OPENAI_API_KEY: 'test' }), 'openai');
  assert.equal(resolveProvider({ AI_PROVIDER: 'gemini', GEMINI_API_KEY: 'test' }), 'gemini');
  assert.equal(resolveProvider({ AI_PROVIDER: 'auto', GEMINI_API_KEY: 'test' }), 'gemini');
  assert.equal(resolveProvider({ AI_PROVIDER: 'auto' }), 'local');
});

test('normalizeEvaluation never approves short text', () => {
  const result = normalizeEvaluation({
    state: 'APPROVED',
    cognitiveDepth: 100,
    criteria: {
      comprehension: 25,
      specificity: 25,
      connections: 25,
      reflection: 25
    }
  }, 'Texto curto sem elaboração suficiente.');

  assert.equal(result.state, 'GUIDING');
  assert.equal(result.cognitiveDepth, 0);
});

test('normalizeEvaluation requires at least sixty criteria points', () => {
  const longText = Array.from({ length: 120 }, () => 'palavra').join(' ');
  const result = normalizeEvaluation({
    state: 'APPROVED',
    criteria: {
      comprehension: 15,
      specificity: 10,
      connections: 10,
      reflection: 10
    }
  }, longText);

  assert.equal(result.state, 'GUIDING');
  assert.equal(result.cognitiveDepth, 0);
});

test('local heuristic guides superficial text and approves substantive reflection', () => {
  const shortResult = scoreHeuristic('Aconteceu algo interessante e eu gostei do capítulo.');
  const deepResult = scoreHeuristic(reflectiveReview);

  assert.equal(shortResult.state, 'GUIDING');
  assert.equal(deepResult.state, 'APPROVED');
  assert.ok(deepResult.cognitiveDepth >= 60);
  assert.ok(deepResult.nextSteps.length > 0);
  assert.ok(deepResult.retentionPrompt);
});

test('evaluateDeepReview runs in explicit local mode with transparent metadata', async () => {
  const evaluation = await evaluateDeepReview({
    book: { title: 'Livro de teste', author: 'Autora' },
    pageFrom: 1,
    pageTo: 20,
    reviewText: reflectiveReview
  }, {
    AI_PROVIDER: 'local',
    AI_ALLOW_LOCAL_FALLBACK: 'true'
  });

  assert.equal(evaluation.meta.provider, 'local');
  assert.equal(evaluation.meta.connected, false);
  assert.equal(evaluation.meta.degraded, false);
  assert.equal(evaluation.result.state, 'APPROVED');
});
