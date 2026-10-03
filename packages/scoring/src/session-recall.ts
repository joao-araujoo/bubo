/**
 * Product checklist for a retrieval exercise, not a validated psychometric or factual measure.
 * V1 checks observable writing only: three brief, distinct answers with basic anti-padding rules.
 * The content of the book is unknown, so even a passing exercise may be factually wrong.
 */
export const SESSION_RECALL_VERSION = 'bubo-recall-v1' as const;

export type RecallExercise = { idea: string; detail: string; connection: string };
type CheckKey = keyof RecallExercise | 'originality';
export type RecallWritingAssessment = {
  version: typeof SESSION_RECALL_VERSION;
  passed: boolean;
  score: number;
  kind: 'writing_checklist';
  factualVerification: 'unavailable';
  checks: { key: CheckKey; passed: boolean; message: string }[];
  feedback: string;
};

const KEYS = ['idea', 'detail', 'connection'] as const;
/** Conservative product thresholds, versioned so saved results never change retroactively. */
const MIN_WORDS = 3;
const MIN_DIFFERENT_WORDS = 3;
const MAX_SINGLE_WORD_SHARE = 0.6;
const GENERIC_META_WORDS = new Set(
  'eu me mim meu minha que de da do das dos um uma uns umas o os as a e em no na nos nas para por com foi era eh ser estar esta isso esse essa esses essas deste desta desse dessa desses dessas isto aquilo aqui la agora li leio ler leitura livro livros trecho texto coisa coisas gostei gosto bom boa bons boas muito bastante legal interessante interessantes otimo otima aprendi entendi aprendo entendo tudo nada gostei aprender entender nao sei se lembro lembrar consigo explicar responder'.split(
    ' ',
  ),
);

function normalize(text: string): string {
  return text
    .normalize('NFKC')
    .replace(/\p{Cf}/gu, '')
    .toLocaleLowerCase('pt-BR')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\s+/gu, ' ')
    .trim();
}

function words(text: string): string[] {
  return (normalize(text).match(/[\p{L}\p{N}]+/gu) ?? []).filter(
    (word) =>
      /\p{L}/u.test(word) &&
      !/^(?:asdf\w*|qwer\w*|lorem|ipsum)$/u.test(word) &&
      (!/^[a-z]$/u.test(word) || /^[aeo]$/u.test(word)),
  );
}

function hasSubstance(text: string): boolean {
  const normalized = normalize(text);
  if (/^lorem ipsum\b/u.test(normalized)) return false;
  // A request to pass the evaluator is not a retrieval answer. Quotes embedded in an answer work.
  if (
    /^(?:ignore (?:as |todas |previous|all)|(?:me )?(?:aprove|aprova|give me (?:a )?score)|(?:nota|score)\s*[:=]\s*100)/u.test(
      normalized,
    )
  ) {
    return false;
  }
  const tokens = words(text).filter((word) => !/(.)\1{4}/u.test(word));
  if (tokens.length < MIN_WORDS || new Set(tokens).size < MIN_DIFFERENT_WORDS) return false;
  if (tokens.every((word) => GENERIC_META_WORDS.has(word))) return false;
  const counts = new Map<string, number>();
  for (const token of tokens) counts.set(token, (counts.get(token) ?? 0) + 1);
  if (Math.max(...counts.values()) / tokens.length > MAX_SINGLE_WORD_SHARE) return false;
  // Repeating a short sentence is still padding, even when its individual words are different.
  if (tokens.length >= 12 && new Set(tokens).size / tokens.length < 0.3) return false;
  return true;
}

function similar(left: string, right: string): boolean {
  const a = words(left);
  const b = words(right);
  if (a.length === 0 || b.length === 0) return false;
  // Preserve order, negation and actor direction. Shared vocabulary is not proof of duplication.
  return a.join(' ') === b.join(' ');
}

/** Fixed four-check completion score; more text, polished spelling and time never earn points. */
export function assessRecallWriting(recall: RecallExercise): RecallWritingAssessment {
  const messages: Record<keyof RecallExercise, { pass: string; fail: string }> = {
    idea: {
      pass: 'Resposta da ideia preenchida.',
      fail: 'Conte uma ideia ou acontecimento do trecho em uma frase curta, com suas palavras.',
    },
    detail: {
      pass: 'Resposta do detalhe preenchida.',
      fail: 'Acrescente um detalhe: uma ação, exemplo, imagem ou argumento que ficou com você.',
    },
    connection: {
      pass: 'Resposta da ligação ou dúvida preenchida.',
      fail: 'Escreva uma ligação com a ideia, ou uma dúvida específica que o trecho deixou.',
    },
  };
  const checks: RecallWritingAssessment['checks'] = KEYS.map((key) => {
    const passed = hasSubstance(recall[key]);
    return { key, passed, message: passed ? messages[key].pass : messages[key].fail };
  });
  const hasAllAnswers = KEYS.every((key) => words(recall[key]).length > 0);
  const different =
    hasAllAnswers &&
    !KEYS.some((key, index) =>
      KEYS.slice(index + 1).some((other) => similar(recall[key], recall[other])),
    );
  checks.push({
    key: 'originality',
    passed: different,
    message: !hasAllAnswers
      ? 'Preencha as três respostas para conferir se elas repetem o mesmo texto.'
      : different
        ? 'As respostas não repetem o mesmo texto.'
        : 'As respostas estão muito parecidas. Use o detalhe e a ligação para acrescentar algo.',
  });
  const passed = checks.every((check) => check.passed);
  return {
    version: SESSION_RECALL_VERSION,
    passed,
    score: checks.filter((check) => check.passed).length * 25,
    kind: 'writing_checklist',
    factualVerification: 'unavailable',
    checks,
    feedback: passed
      ? 'Exercício preenchido! Amanhã, tente lembrar de novo antes de abrir sua nota. Este checklist não confirma a exatidão do livro.'
      : 'Vamos guardar uma lembrança sua do trecho. Pode ser simples, sem palavras difíceis. Este checklist não confirma a exatidão do livro.',
  };
}

/** Text persisted in the existing reflection/card flow, generated from the accepted exercise. */
export function reflectionFromRecall(recall: RecallExercise): string {
  return `Ideia: ${recall.idea.trim()}\nDetalhe: ${recall.detail.trim()}\nLigação ou dúvida: ${recall.connection.trim()}`;
}
