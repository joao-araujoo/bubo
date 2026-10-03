import { describe, expect, it } from 'vitest';

import { assessRecallWriting } from '../src';

/**
 * Source-informed paraphrases after inspecting chapters I–II, not fabricated app data.
 * Machado de Assis, Dom Casmurro, 1899 transcription, inspected 2026-10-03:
 * https://www.gutenberg.org/cache/epub/55752/pg55752-images.html
 * These fixtures check the writing gate only; source support is not scored by this algorithm.
 */
const exercises = [
  {
    chapter: 'I — Do titulo',
    recall: {
      idea: 'O apelido nasceu de um encontro no trem.',
      detail: 'O rapaz interrompe os versos quando o narrador cochila.',
      connection: 'Como um mal-entendido muda a imagem de alguém?',
    },
  },
  {
    chapter: 'II — Do livro',
    recall: {
      idea: 'A casa reconstruída não devolve a juventude.',
      detail: 'A aparência se repete, mas o narrador sente que mudou.',
      connection: 'Recriar um lugar também recria quem fomos?',
    },
  },
];

describe('source-informed reading exercises, with factual verification still unavailable', () => {
  it.each(exercises)('accepts a concise exercise from $chapter', ({ recall }) => {
    expect(assessRecallWriting(recall)).toMatchObject({
      passed: true,
      kind: 'writing_checklist',
      factualVerification: 'unavailable',
    });
  });
  it('treats bullets and accent-free versions of the same exercise equivalently', () => {
    for (const { recall } of exercises) {
      const informal = {
        idea: `• ${recall.idea.normalize('NFD').replace(/\p{M}/gu, '')}`,
        detail: `- ${recall.detail.normalize('NFD').replace(/\p{M}/gu, '')}`,
        connection: `1. ${recall.connection.normalize('NFD').replace(/\p{M}/gu, '')}`,
      };
      expect(assessRecallWriting(informal).passed).toBe(assessRecallWriting(recall).passed);
    }
  });
  it('cannot distinguish a substantive fabrication from a supported account without the source', () => {
    expect(
      assessRecallWriting({
        idea: 'O apelido foi escolhido por uma tripulação marciana.',
        detail: 'Uma nave dourada pousou no quintal do narrador.',
        connection: 'Como seria reconstruir a juventude em outro planeta?',
      }),
    ).toMatchObject({ passed: true, factualVerification: 'unavailable' });
  });
});
