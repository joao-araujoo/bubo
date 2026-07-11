const test = require('node:test');
const assert = require('node:assert/strict');
const {
  evaluateDeepReview,
  extractJson,
  getReadingCoachStatus,
  normalizeEvaluation,
  resolveProvider,
} = require('../src/services/ai/readingCoach');

const longText = Array.from({ length: 120 }, () => 'palavra').join(' ');

const payload = {
  book: { title: 'Livro de teste', author: 'Autora' },
  pageFrom: 1,
  pageTo: 20,
  reviewText: longText,
};

test('extractJson accepts fenced provider output', () => {
  const parsed = extractJson('```json\n{"state":"GUIDING","cognitiveDepth":0}\n```');
  assert.equal(parsed.state, 'GUIDING');
});

test('resolveProvider only returns configured real providers', () => {
  assert.equal(resolveProvider({ AI_PROVIDER: 'local' }), null);
  assert.equal(resolveProvider({ AI_PROVIDER: 'openai' }), null);
  assert.equal(resolveProvider({ AI_PROVIDER: 'gemini' }), null);
  assert.equal(resolveProvider({ AI_PROVIDER: 'openai', OPENAI_API_KEY: 'test' }), 'openai');
  assert.equal(resolveProvider({ AI_PROVIDER: 'gemini', GEMINI_API_KEY: 'test' }), 'gemini');
  assert.equal(resolveProvider({ AI_PROVIDER: 'auto', GEMINI_API_KEY: 'test' }), 'gemini');
  assert.equal(resolveProvider({ AI_PROVIDER: 'auto' }), null);
});

test('status reports an unavailable coach when credentials are missing', () => {
  const status = getReadingCoachStatus({ AI_PROVIDER: 'gemini' });
  assert.equal(status.connected, false);
  assert.equal(status.mode, 'unavailable');
  assert.equal(status.localFallbackEnabled, false);
  assert.equal(status.reason, 'missing_credentials');
});

test('normalizeEvaluation never approves short text', () => {
  const result = normalizeEvaluation({
    state: 'APPROVED',
    cognitiveDepth: 100,
    criteria: {
      comprehension: 25,
      specificity: 25,
      connections: 25,
      reflection: 25,
    },
  }, 'Texto curto sem elaboração suficiente.');

  assert.equal(result.state, 'GUIDING');
  assert.equal(result.cognitiveDepth, 0);
});

test('normalizeEvaluation requires at least sixty criteria points', () => {
  const result = normalizeEvaluation({
    state: 'APPROVED',
    criteria: {
      comprehension: 15,
      specificity: 10,
      connections: 10,
      reflection: 10,
    },
  }, longText);

  assert.equal(result.state, 'GUIDING');
  assert.equal(result.cognitiveDepth, 0);
});

test('evaluateDeepReview rejects missing AI configuration instead of creating a local score', async () => {
  await assert.rejects(
    () => evaluateDeepReview(payload, { AI_PROVIDER: 'auto' }),
    (error) => error.code === 'AI_NOT_CONFIGURED',
  );
});
