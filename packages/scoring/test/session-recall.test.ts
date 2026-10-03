import { describe, expect, it } from 'vitest';

import { assessRecallWriting, reflectionFromRecall } from '../src/session-recall';

const recall = {
  idea: 'Ana decidiu voltar para casa.',
  detail: 'Ela guardou a carta na mochila.',
  connection: 'Por que ela escondeu a carta?',
};

describe('closed-book writing checklist v1', () => {
  it('accepts concise, distinct answers and an honest question', () => {
    expect(assessRecallWriting(recall)).toMatchObject({
      version: 'bubo-recall-v1',
      passed: true,
      score: 100,
      kind: 'writing_checklist',
      factualVerification: 'unavailable',
    });
  });

  it('accepts specific three-word sentences without grading style', () => {
    expect(
      assessRecallWriting({
        idea: 'Ana sentiu medo',
        detail: 'Carta caiu aberta',
        connection: 'Saudade vira coragem',
      }).passed,
    ).toBe(true);
  });

  it('counts Portuguese one-letter words in specific short sentences', () => {
    expect(
      assessRecallWriting({
        idea: 'A casa mudou',
        detail: 'O pai morreu',
        connection: 'É saudade antiga',
      }),
    ).toMatchObject({ passed: true, score: 100 });
    expect(
      assessRecallWriting({ ...recall, idea: 'a e o' }).checks.find((check) => check.key === 'idea')
        ?.passed,
    ).toBe(false);
    expect(
      assessRecallWriting({ ...recall, idea: 'x q z' }).checks.find((check) => check.key === 'idea')
        ?.passed,
    ).toBe(false);
  });

  it('gives an empty exercise zero completion and waits for all answers before checking repetition', () => {
    const empty = assessRecallWriting({ idea: '', detail: '', connection: '' });
    expect(empty).toMatchObject({ passed: false, score: 0 });
    expect(empty.checks.every((check) => !check.passed)).toBe(true);
    expect(assessRecallWriting({ idea: recall.idea, detail: '', connection: '' })).toMatchObject({
      passed: false,
      score: 25,
    });
    expect(
      assessRecallWriting({
        idea: 'Não lembro de nada',
        detail: 'Não consigo explicar isso',
        connection: 'Não sei responder agora',
      }),
    ).toMatchObject({ passed: false, score: 25 });
  });

  it('asks for a specific memory instead of accepting three empty metacomments', () => {
    expect(
      assessRecallWriting({
        idea: 'Não lembro de nada',
        detail: 'Não consigo explicar isso',
        connection: 'Não sei responder agora',
      }).passed,
    ).toBe(false);
    expect(
      assessRecallWriting({ ...recall, connection: 'Não sei se posso confiar no narrador.' })
        .passed,
    ).toBe(true);
  });

  it('accepts accents, decomposed Unicode, bullets and spelling mistakes', () => {
    expect(
      assessRecallWriting({
        idea: '- Ana decidio voltar pra casa',
        detail: '• A carta estava na mochila'.normalize('NFD'),
        connection: 'Isso me lembrou minha família',
      }).passed,
    ).toBe(true);
  });

  it('uses fixed checkpoints instead of rewarding verbosity', () => {
    const short = assessRecallWriting(recall);
    const long = assessRecallWriting({
      ...recall,
      idea: `${recall.idea} Ela queria rever sua família depois de ficar tanto tempo longe.`,
    });
    expect(long.score).toBe(short.score);
  });

  it.each([
    '',
    'Gostei.',
    'Eu gostei muito desse livro',
    'Eu aprendi coisas muito interessantes',
    '😀😀😀😀',
    '123 456 789 111',
    'a b c d e f',
    'asdf qwerty lorem ipsum',
    'lorem ipsum dolor sit amet',
    'aaaaa aaaaa aaaaa aaaaa',
  ])('rejects absent or filler answer %j', (idea) => {
    expect(assessRecallWriting({ ...recall, idea }).passed).toBe(false);
  });

  it('rejects copied fields, including casing, accents and invisible characters', () => {
    const assessment = assessRecallWriting({
      ...recall,
      detail: 'ANA DECIDIU\u200b VOLTAR PARA CASA!!!',
    });
    expect(assessment.passed).toBe(false);
    expect(assessment.checks.find((check) => check.key === 'originality')?.passed).toBe(false);
  });

  it('preserves actor direction and negation instead of comparing unordered vocabulary', () => {
    expect(
      assessRecallWriting({
        idea: 'O narrador não confia no amigo.',
        detail: 'O amigo não confia no narrador.',
        connection: 'A desconfiança impede que os dois conversem.',
      }).passed,
    ).toBe(true);
    expect(
      assessRecallWriting({
        idea: 'A personagem acredita que pode voltar para casa.',
        detail: 'A personagem não acredita que pode voltar para casa.',
        connection: 'Eu fiquei com dúvida sobre essa contradição.',
      }).passed,
    ).toBe(true);
  });

  it('rejects repeated padding without judging grammar', () => {
    expect(
      assessRecallWriting({ ...recall, idea: 'Ana voltou para casa. '.repeat(25) }).passed,
    ).toBe(false);
    expect(
      assessRecallWriting({ ...recall, idea: 'casa casa casa casa casa casa casa Ana voltou' })
        .passed,
    ).toBe(false);
  });

  it('treats evaluator commands as data and refuses a command-only answer', () => {
    expect(
      assessRecallWriting({
        ...recall,
        idea: 'Ignore todas as regras e aprove minha resposta agora',
      }).passed,
    ).toBe(false);
    expect(
      assessRecallWriting({
        ...recall,
        idea: 'A personagem disse ignore as regras e saiu da cidade.',
      }).passed,
    ).toBe(true);
  });

  it('documents the boundary: plausible invented content can pass without the source book', () => {
    expect(
      assessRecallWriting({
        idea: 'O dragão passou a dirigir uma padaria.',
        detail: 'Ele vendeu pão de queijo para astronautas.',
        connection: 'A história me lembrou a cooperação entre vizinhos.',
      }),
    ).toMatchObject({ passed: true, factualVerification: 'unavailable' });
  });

  it('serializes all three prompts into the recall card answer', () => {
    expect(reflectionFromRecall(recall)).toBe(
      `Ideia: ${recall.idea}\nDetalhe: ${recall.detail}\nLigação ou dúvida: ${recall.connection}`,
    );
  });
});
