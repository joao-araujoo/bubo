import { describe, expect, it } from 'vitest';

import {
  API_ROUTES,
  API_ROUTE_DEFINITIONS,
  SESSION_RECALL_FIELD_MAX_LENGTH,
  assessSessionRequestSchema,
  sessionRecallSchema,
} from '../src';

const recall = {
  idea: 'Ana sentiu medo',
  detail: 'Carta caiu aberta',
  connection: 'Saudade vira coragem',
};

describe('session recall contracts', () => {
  it('defaults AI consent off, trims only boundary whitespace and bounds every field', () => {
    expect(
      assessSessionRequestSchema.parse({
        shelfEntryId: 'entry',
        recall: { ...recall, idea: ' Ana sentiu medo ' },
      }),
    ).toEqual({
      shelfEntryId: 'entry',
      recall,
      coach: false,
    });
    expect(SESSION_RECALL_FIELD_MAX_LENGTH).toBe(600);
    for (const key of ['idea', 'detail', 'connection']) {
      expect(sessionRecallSchema.safeParse({ ...recall, [key]: 'a'.repeat(600) }).success).toBe(
        true,
      );
      expect(sessionRecallSchema.safeParse({ ...recall, [key]: 'a'.repeat(601) }).success).toBe(
        false,
      );
      expect(sessionRecallSchema.safeParse({ ...recall, [key]: null }).success).toBe(false);
    }
  });

  it('accepts incomplete strings for helpful assessment, but requires all three fields', () => {
    expect(sessionRecallSchema.safeParse({ idea: '', detail: '', connection: '' }).success).toBe(
      true,
    );
    expect(sessionRecallSchema.safeParse({ idea: '', detail: '' }).success).toBe(false);
  });

  it('registers the new route as authenticated with request and response schemas', () => {
    expect(
      API_ROUTE_DEFINITIONS.find((route) => route.path === API_ROUTES.sessionAssessment),
    ).toMatchObject({
      method: 'post',
      auth: true,
      requestBody: assessSessionRequestSchema,
    });
  });
});
