const axios = require('axios');
const OpenAI = require('openai');

const EVALUATION_VERSION = '2.0';
const MIN_REVIEW_WORDS = 100;
const DEFAULT_TIMEOUT_MS = 25000;
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
  "encouragement": "uma frase curta na voz de uma coruja sábia",
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
    feedback: String(parsed.feedback || 'Aprofunde sua síntese com exemplos concretos e conexões entre as ideias do trecho.').trim(),
    encouragement: String(parsed.encouragement || 'Cada conexão bem explicada fortalece sua memória de leitor.').trim(),
    strengths: normalizeList(parsed.strengths, ['Você registrou uma tentativa de síntese com suas próprias palavras.']),
    nextSteps: normalizeList(parsed.nextSteps, ['Inclua um acontecimento ou conceito específico do trecho.', 'Explique por que essa ideia importa para você ou para o livro.']),
    socraticQuestion: String(parsed.socraticQuestion || 'Que relação entre causa e consequência neste trecho ainda merece ser explicada?').trim(),
    retentionPrompt: String(parsed.retentionPrompt || 'Qual é a ideia central deste trecho e que evidência sustenta sua interpretação?').trim(),
    wordCount
  };
};

const scoreHeuristic = (reviewText) => {
  const text = String(reviewText || '').trim();
  const lower = text.toLowerCase();
  const wordCount = countWords(text);
  const sentenceCount = text.split(/[.!?]+/).filter((part) => part.trim().length > 8).length;
  const paragraphCount = text.split(/\n\s*\n/).filter(Boolean).length;
  const specificitySignals = (text.match(/\b\d+\b|[“”"'][^“”"']{8,}[“”"']/g) || []).length;
  const connectionSignals = (lower.match(/\b(porque|portanto|assim|porém|entretanto|relaciona|conecta|lembra|compar|consequ|causa|implica)\w*/g) || []).length;
  const reflectionSignals = (lower.match(/\b(acho|penso|percebo|interpreto|questiono|talvez|significa|sugere|tensão|contradição|ideia)\w*/g) || []).length;
  const questionSignals = (text.match(/\?/g) || []).length;

  const comprehension = clamp(6 + Math.floor(wordCount / 14) + Math.min(sentenceCount, 7), 0, 25);
  const specificity = clamp(4 + Math.floor(wordCount / 25) + specificitySignals * 4, 0, 25);
  const connections = clamp(3 + Math.floor(wordCount / 30) + connectionSignals * 2, 0, 25);
  const reflection = clamp(3 + Math.floor(wordCount / 28) + reflectionSignals * 2 + questionSignals * 2 + paragraphCount, 0, 25);
  const criteria = { comprehension, specificity, connections, reflection };
  const total = CRITERIA_KEYS.reduce((sum, key) => sum + criteria[key], 0);
  const state = wordCount >= MIN_REVIEW_WORDS && total >= 60 ? 'APPROVED' : 'GUIDING';

  const ranked = [
    ['comprehension', comprehension, 'A síntese demonstra compreensão das ideias centrais.'],
    ['specificity', specificity, 'Você incluiu elementos concretos que tornam a interpretação verificável.'],
    ['connections', connections, 'O texto estabelece conexões relevantes entre ideias.'],
    ['reflection', reflection, 'Há elaboração própria e reflexão além do resumo do enredo.']
  ].sort((a, b) => b[1] - a[1]);

  const nextStepByKey = {
    comprehension: 'Explique com mais clareza o que mudou ou foi revelado neste trecho.',
    specificity: 'Inclua um acontecimento, conceito ou relação específica como evidência.',
    connections: 'Relacione a ideia principal a outra parte do livro, experiência ou conhecimento.',
    reflection: 'Acrescente uma interpretação própria, tensão ou pergunta que permaneceu em aberto.'
  };

  const weaknesses = [...ranked].sort((a, b) => a[1] - b[1]);
  const feedback = state === 'APPROVED'
    ? 'Sua síntese demonstra envolvimento real com o trecho e apresenta elaboração própria. Para torná-la ainda mais memorável, preserve as evidências concretas e explicite as relações de causa, contraste ou consequência.'
    : wordCount < MIN_REVIEW_WORDS
      ? `Sua síntese possui ${wordCount} palavras e ainda não oferece material suficiente para uma avaliação confiável. Amplie o texto com acontecimentos concretos, conexões e uma interpretação própria.`
      : 'A síntese registra o conteúdo, mas ainda precisa mostrar com mais clareza como as ideias se relacionam e por que elas importam. Use um exemplo do trecho como evidência e desenvolva uma conclusão própria.';

  return {
    state,
    cognitiveDepth: state === 'APPROVED' ? total : 0,
    criteria,
    feedback,
    encouragement: state === 'APPROVED'
      ? 'Boa leitura: você transformou informação em uma conexão que pode permanecer.'
      : 'Aprofundar não é escrever bonito; é tornar suas conexões visíveis.',
    strengths: ranked.filter((item) => item[1] >= 14).slice(0, 3).map((item) => item[2]),
    nextSteps: weaknesses.slice(0, 2).map((item) => nextStepByKey[item[0]]),
    socraticQuestion: 'Qual detalhe do trecho melhor sustenta sua interpretação, e o que mudaria se esse detalhe fosse diferente?',
    retentionPrompt: 'Explique em uma frase a ideia central e cite uma evidência concreta do trecho.',
    wordCount
  };
};

const resolveProvider = (env = process.env) => {
  const requested = String(env.AI_PROVIDER || 'auto').toLowerCase();
  const hasOpenAI = Boolean(env.OPENAI_API_KEY);
  const hasGemini = Boolean(env.GEMINI_API_KEY);

  if (requested === 'openai' && hasOpenAI) return 'openai';
  if (requested === 'gemini' && hasGemini) return 'gemini';
  if (requested === 'local') return 'local';
  if (requested === 'auto' && hasOpenAI) return 'openai';
  if (requested === 'auto' && hasGemini) return 'gemini';
  return 'local';
};

const buildUserPrompt = ({ book, pageFrom, pageTo, reviewText }) => `Livro: "${book.title}"\nAutor: ${book.author || 'não informado'}\nPáginas: ${pageFrom}-${pageTo}\n\nSíntese do leitor:\n${reviewText}`;

const callOpenAI = async (payload, env = process.env) => {
  const model = env.OPENAI_MODEL || 'gpt-4o-mini';
  const client = new OpenAI({
    apiKey: env.OPENAI_API_KEY,
    timeout: Number(env.AI_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS,
    maxRetries: 2
  });
  const completion = await client.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: buildUserPrompt(payload) }
    ],
    temperature: 0.25,
    response_format: { type: 'json_object' }
  });
  return {
    content: completion.choices?.[0]?.message?.content,
    model
  };
};

const callGemini = async (payload, env = process.env) => {
  const model = env.GEMINI_MODEL || 'gemini-2.0-flash';
  const timeout = Number(env.AI_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS;
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(env.GEMINI_API_KEY)}`;
  let lastError;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const { data } = await axios.post(endpoint, {
        systemInstruction: {
          parts: [{ text: SYSTEM_PROMPT }]
        },
        contents: [{
          role: 'user',
          parts: [{ text: buildUserPrompt(payload) }]
        }],
        generationConfig: {
          temperature: 0.25,
          responseMimeType: 'application/json'
        }
      }, { timeout });

      return {
        content: data.candidates?.[0]?.content?.parts?.[0]?.text,
        model
      };
    } catch (error) {
      lastError = error;
      if (attempt === 0) await new Promise((resolve) => setTimeout(resolve, 350));
    }
  }

  throw lastError;
};

const getReadingCoachStatus = (env = process.env) => {
  const provider = resolveProvider(env);
  const model = provider === 'openai'
    ? env.OPENAI_MODEL || 'gpt-4o-mini'
    : provider === 'gemini'
      ? env.GEMINI_MODEL || 'gemini-2.0-flash'
      : 'bubo-local-evaluator-v2';

  return {
    provider,
    model,
    evaluationVersion: EVALUATION_VERSION,
    mode: provider === 'local' ? 'local' : 'connected',
    connected: provider !== 'local',
    localFallbackEnabled: env.AI_ALLOW_LOCAL_FALLBACK !== 'false'
  };
};

const evaluateDeepReview = async (payload, env = process.env) => {
  const provider = resolveProvider(env);
  const fallbackEnabled = env.AI_ALLOW_LOCAL_FALLBACK !== 'false';

  if (provider === 'local') {
    return {
      result: normalizeEvaluation(scoreHeuristic(payload.reviewText), payload.reviewText),
      meta: {
        ...getReadingCoachStatus(env),
        degraded: false
      }
    };
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
        localFallbackEnabled: fallbackEnabled,
        degraded: false
      }
    };
  } catch (error) {
    if (!fallbackEnabled) {
      const unavailable = new Error('O serviço de IA está temporariamente indisponível. Tente novamente em alguns instantes.');
      unavailable.code = 'AI_PROVIDER_UNAVAILABLE';
      unavailable.cause = error;
      throw unavailable;
    }

    return {
      result: normalizeEvaluation(scoreHeuristic(payload.reviewText), payload.reviewText),
      meta: {
        provider: 'local',
        requestedProvider: provider,
        model: 'bubo-local-evaluator-v2',
        evaluationVersion: EVALUATION_VERSION,
        mode: 'local',
        connected: false,
        localFallbackEnabled: true,
        degraded: true
      }
    };
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
  scoreHeuristic
};
