const axios = require('axios');
const OpenAI = require('openai');

const EVALUATION_VERSION = '3.0';
const MIN_REVIEW_WORDS = 100;
const DEFAULT_TIMEOUT_MS = 30000;
const CRITERIA_KEYS = ['comprehension', 'specificity', 'connections', 'reflection'];

const SYSTEM_PROMPT = `Você é o Bubo, tutor socrático de leitura profunda.
Sua função é avaliar uma síntese escrita pelo leitor, sem premiar texto prolixo nem exigir linguagem acadêmica.

Avalie quatro dimensões, cada uma de 0 a 25:
- comprehension: compreensão do trecho e das ideias centrais;
- specificity: uso de acontecimentos, conceitos, relações ou evidências concretas;
- connections: conexões entre ideias, outras partes do livro, experiências ou conhecimentos;
- reflection: interpretação própria, perguntas, tensões e implicações.

Regras:
- GUIDING quando o texto for curto, genérico, apenas recontar o enredo ou não demonstrar reflexão suficiente;
- APPROVED quando houver compreensão real, especificidade e elaboração própria;
- cognitiveDepth deve ser a soma das quatro dimensões, de 0 a 100;
- uma aprovação exige no mínimo 60 pontos e conteúdo substantivo;
- seja específico, respeitoso, rigoroso e útil;
- nunca invente acontecimentos do livro que não estejam no texto do leitor;
- não use emojis;
- escreva em português do Brasil.

Responda somente com JSON neste formato:
{
  "state": "APPROVED" | "GUIDING",
  "cognitiveDepth": 0,
  "criteria": {
    "comprehension": 0,
    "specificity": 0,
    "connections": 0,
    "reflection": 0
  },
  "feedback": "feedback objetivo em 2 ou 3 frases",
  "encouragement": "uma frase curta, sóbria e acolhedora",
  "strengths": ["até 3 pontos fortes"],
  "nextSteps": ["até 3 ações concretas"],
  "socraticQuestion": "uma pergunta que ajude o leitor a aprofundar sem entregar resposta",
  "retentionPrompt": "uma pergunta curta para revisar essa ideia no futuro"
}`;

const clamp = (value, min, max) => Math.min(max, Math.max(min, Number(value) || 0));
const countWords = (text) => String(text || '').trim().split(/\s+/).filter(Boolean).length;

const normalizeList = (value, fallback = []) => {
  const list = Array.isArray(value) ? value : [];
  const normalized = list
    .map((item) => String(item || '').trim())
    .filter(Boolean)
    .slice(0, 3);
  return normalized.length > 0 ? normalized : fallback;
};

const extractJson = (value) => {
  if (value && typeof value === 'object') return value;
  const text = String(value || '').trim();
  const unfenced = text
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
  const firstBrace = unfenced.indexOf('{');
  const lastBrace = unfenced.lastIndexOf('}');
  const candidate = firstBrace >= 0 && lastBrace > firstBrace
    ? unfenced.slice(firstBrace, lastBrace + 1)
    : unfenced;
  return JSON.parse(candidate);
};

const normalizeCriteria = (criteria = {}) => {
  const normalized = {};
  CRITERIA_KEYS.forEach((key) => {
    normalized[key] = clamp(criteria[key], 0, 25);
  });
  return normalized;
};

const normalizeEvaluation = (raw, reviewText) => {
  const parsed = extractJson(raw);
  const criteria = normalizeCriteria(parsed.criteria);
  const criteriaTotal = CRITERIA_KEYS.reduce((sum, key) => sum + criteria[key], 0);
  const requestedState = String(parsed.state || '').toUpperCase();
  const wordCount = countWords(reviewText);
  const canApprove = wordCount >= MIN_REVIEW_WORDS && criteriaTotal >= 60;
  const state = requestedState === 'APPROVED' && canApprove ? 'APPROVED' : 'GUIDING';
  const cognitiveDepth = state === 'APPROVED'
    ? clamp(criteriaTotal || parsed.cognitiveDepth, 60, 100)
    : 0;

  return {
    state,
    cognitiveDepth,
    criteria,
    feedback: String(parsed.feedback || 'A avaliação chegou incompleta. Tente novamente para receber uma orientação detalhada.').trim(),
    encouragement: String(parsed.encouragement || 'Sua reflexão foi preservada. Uma nova tentativa pode completar a orientação.').trim(),
    strengths: normalizeList(parsed.strengths),
    nextSteps: normalizeList(parsed.nextSteps, ['Tente enviar novamente para obter recomendações completas.']),
    socraticQuestion: String(parsed.socraticQuestion || 'Qual evidência do trecho sustenta melhor a sua interpretação?').trim(),
    retentionPrompt: String(parsed.retentionPrompt || 'Qual é a ideia central deste trecho?').trim(),
    wordCount,
  };
};

const resolveProvider = (env = process.env) => {
  const requested = String(env.AI_PROVIDER || 'auto').toLowerCase();
  const hasOpenAI = Boolean(env.OPENAI_API_KEY);
  const hasGemini = Boolean(env.GEMINI_API_KEY);

  if (requested === 'openai') return hasOpenAI ? 'openai' : null;
  if (requested === 'gemini') return hasGemini ? 'gemini' : null;
  if (requested === 'auto' && hasOpenAI) return 'openai';
  if (requested === 'auto' && hasGemini) return 'gemini';
  return null;
};

const resolveRequestedProvider = (env = process.env) => {
  const requested = String(env.AI_PROVIDER || 'auto').toLowerCase();
  return ['openai', 'gemini'].includes(requested) ? requested : 'auto';
};

const buildUserPrompt = ({ book, pageFrom, pageTo, reviewText }) => `Livro: "${book.title}"
Autor: ${book.author || 'não informado'}
Páginas: ${pageFrom}-${pageTo}

Síntese do leitor:
${reviewText}`;

const callOpenAI = async (payload, env = process.env) => {
  const model = env.OPENAI_MODEL || 'gpt-4o-mini';
  const client = new OpenAI({
    apiKey: env.OPENAI_API_KEY,
    timeout: Number(env.AI_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS,
    maxRetries: 2,
  });
  const completion = await client.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: buildUserPrompt(payload) },
    ],
    temperature: 0.2,
    response_format: { type: 'json_object' },
  });

  const content = completion.choices?.[0]?.message?.content;
  if (!content) {
    const error = new Error('A OpenAI não retornou conteúdo para avaliação.');
    error.code = 'AI_EMPTY_RESPONSE';
    throw error;
  }
  return { content, model };
};

const callGemini = async (payload, env = process.env) => {
  const model = env.GEMINI_MODEL || 'gemini-2.0-flash';
  const timeout = Number(env.AI_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS;
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(env.GEMINI_API_KEY)}`;
  let lastError;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const { data } = await axios.post(endpoint, {
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [{
          role: 'user',
          parts: [{ text: buildUserPrompt(payload) }],
        }],
        generationConfig: {
          temperature: 0.2,
          responseMimeType: 'application/json',
        },
      }, { timeout });

      const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!content) {
        const error = new Error('O Gemini não retornou conteúdo para avaliação.');
        error.code = 'AI_EMPTY_RESPONSE';
        throw error;
      }
      return { content, model };
    } catch (error) {
      lastError = error;
      if (attempt === 0) await new Promise((resolve) => setTimeout(resolve, 450));
    }
  }

  throw lastError;
};

const getReadingCoachStatus = (env = process.env) => {
  const provider = resolveProvider(env);
  const requestedProvider = resolveRequestedProvider(env);
  const model = provider === 'openai'
    ? env.OPENAI_MODEL || 'gpt-4o-mini'
    : provider === 'gemini'
      ? env.GEMINI_MODEL || 'gemini-2.0-flash'
      : null;

  return {
    provider,
    requestedProvider,
    model,
    evaluationVersion: EVALUATION_VERSION,
    mode: provider ? 'connected' : 'unavailable',
    connected: Boolean(provider),
    reason: provider ? null : 'missing_credentials',
    localFallbackEnabled: false,
  };
};

const evaluateDeepReview = async (payload, env = process.env) => {
  const provider = resolveProvider(env);
  if (!provider) {
    const error = new Error('A IA do Bubo ainda não foi configurada. Adicione uma chave OpenAI ou Gemini e tente novamente.');
    error.code = 'AI_NOT_CONFIGURED';
    throw error;
  }

  try {
    const response = provider === 'openai'
      ? await callOpenAI(payload, env)
      : await callGemini(payload, env);
    const result = normalizeEvaluation(response.content, payload.reviewText);

    return {
      result,
      meta: {
        provider,
        model: response.model,
        evaluationVersion: EVALUATION_VERSION,
        mode: 'connected',
        connected: true,
        localFallbackEnabled: false,
        degraded: false,
      },
    };
  } catch (cause) {
    const error = new Error('O serviço de IA está temporariamente indisponível. Sua escrita foi mantida; aguarde alguns instantes e tente novamente.');
    error.code = cause?.code === 'AI_EMPTY_RESPONSE' ? 'AI_EMPTY_RESPONSE' : 'AI_PROVIDER_UNAVAILABLE';
    error.cause = cause;
    throw error;
  }
};

module.exports = {
  EVALUATION_VERSION,
  MIN_REVIEW_WORDS,
  evaluateDeepReview,
  extractJson,
  getReadingCoachStatus,
  normalizeEvaluation,
  resolveProvider,
};
