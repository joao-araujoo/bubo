import { describe, expect, it } from 'vitest';

import { buildOpenApiDocument, meResponseSchema, onboardingRequestSchema } from '../src';

const valid = {
  readingHabit: 'daily',
  goals: ['remember_more', 'build_habit'],
  interests: ['philosophy'],
  firstBook: { title: '  O Estrangeiro ', author: 'Albert Camus', totalPages: 128 },
};

describe('onboardingRequestSchema', () => {
  it('accepts a complete answer and trims text', () => {
    const parsed = onboardingRequestSchema.parse(valid);
    expect(parsed.firstBook && 'title' in parsed.firstBook ? parsed.firstBook.title : null).toBe(
      'O Estrangeiro',
    );
  });

  it('accepts a catalog pick by id only', () => {
    const parsed = onboardingRequestSchema.parse({
      ...valid,
      firstBook: { catalogId: 'gb:zyTCAlFPjgYC' },
    });
    expect(parsed.firstBook).toEqual({ catalogId: 'gb:zyTCAlFPjgYC' });
    expect(
      onboardingRequestSchema.safeParse({ ...valid, firstBook: { catalogId: 'https://x' } })
        .success,
    ).toBe(false);
  });

  it('allows skipping the first book', () => {
    expect(onboardingRequestSchema.safeParse({ ...valid, firstBook: null }).success).toBe(true);
  });

  it('requires at least one goal and one interest', () => {
    expect(onboardingRequestSchema.safeParse({ ...valid, goals: [] }).success).toBe(false);
    expect(onboardingRequestSchema.safeParse({ ...valid, interests: [] }).success).toBe(false);
  });

  it('rejects unknown ids and invalid books', () => {
    expect(onboardingRequestSchema.safeParse({ ...valid, readingHabit: 'sometimes' }).success).toBe(
      false,
    );
    expect(onboardingRequestSchema.safeParse({ ...valid, goals: ['be_famous'] }).success).toBe(
      false,
    );
    expect(
      onboardingRequestSchema.safeParse({ ...valid, firstBook: { title: '   ' } }).success,
    ).toBe(false);
    expect(
      onboardingRequestSchema.safeParse({ ...valid, firstBook: { title: 'X', totalPages: 0 } })
        .success,
    ).toBe(false);
    expect(
      onboardingRequestSchema.safeParse({ ...valid, firstBook: { title: 'X', totalPages: 12.5 } })
        .success,
    ).toBe(false);
  });
});

describe('meResponseSchema', () => {
  it('validates a fresh reader without onboarding', () => {
    const me = {
      user: {
        id: 'u1',
        name: 'Ana',
        email: 'ana@example.test',
        emailVerified: false,
        image: null,
        createdAt: new Date().toISOString(),
      },
      profile: { readingHabit: null, goals: [], interests: [], onboardingCompletedAt: null },
      onboardingCompleted: false,
    };
    expect(meResponseSchema.parse(me)).toEqual(me);
  });
});

describe('OpenAPI for authenticated routes', () => {
  const doc = buildOpenApiDocument({ title: 'Bubo API', version: '0.2.0', prefix: '/v1' });
  const paths = doc.paths as Record<
    string,
    Record<string, { security?: unknown; requestBody?: unknown }>
  >;

  it('marks session-protected routes and documents request bodies', () => {
    expect(paths['/v1/me']?.get?.security).toBeDefined();
    expect(paths['/v1/me/onboarding']?.put?.requestBody).toBeDefined();
    expect(paths['/v1/health']?.get?.security).toBeUndefined();
  });
});
