import { describe, expect, it } from 'vitest';

import { isAllowedRedirect } from '../src/auth/redirect-guard';

describe('isAllowedRedirect', () => {
  it('allows app deep links and same-origin paths', () => {
    expect(isAllowedRedirect('bubo://redefinir-senha', 'production')).toBe(true);
    expect(isAllowedRedirect('/v1/auth/callback', 'production')).toBe(true);
  });

  it('allows Expo Go links only in development', () => {
    expect(isAllowedRedirect('exp://192.168.0.2:8081/--/redefinir-senha', 'development')).toBe(
      true,
    );
    expect(isAllowedRedirect('exp://192.168.0.2:8081/--/redefinir-senha', 'production')).toBe(
      false,
    );
  });

  it('blocks external, protocol-relative and script URLs', () => {
    for (const value of [
      'https://evil.example',
      '//evil.example',
      '/\\evil.example',
      'javascript:alert(1)',
      'http://localhost:8787',
    ]) {
      expect(isAllowedRedirect(value, 'development')).toBe(false);
    }
  });
});

describe('trustedOriginsFor', () => {
  it('trusts Expo Go (exp://) only in development', async () => {
    const { trustedOriginsFor } = await import('../src/auth/auth');
    expect(trustedOriginsFor('development')).toEqual(expect.arrayContaining(['bubo://', 'exp://']));
    expect(trustedOriginsFor('production').some((o) => o.startsWith('exp://'))).toBe(false);
    expect(trustedOriginsFor('preview').some((o) => o.startsWith('exp://'))).toBe(false);
  });
});
