import { describe, expect, it } from 'vitest';

import { DEFAULT_GEMINI_MODEL, parsePublicEnv, parseServerEnv } from '../src';

describe('parseServerEnv', () => {
  it('boots in development with no secrets and applies defaults', () => {
    const result = parseServerEnv({});
    expect(result).toEqual({
      ok: true,
      env: expect.objectContaining({ APP_ENV: 'development', GEMINI_MODEL: DEFAULT_GEMINI_MODEL }),
    });
  });

  it('treats empty strings as unset', () => {
    const result = parseServerEnv({ DATABASE_URL: '', GEMINI_API_KEY: '  ', BETTER_AUTH_URL: '' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.env.DATABASE_URL).toBeUndefined();
      expect(result.env.GEMINI_API_KEY).toBeUndefined();
    }
  });

  it('rejects non-postgres database URLs', () => {
    const result = parseServerEnv({ DATABASE_URL: 'mysql://localhost/db' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues[0]?.path).toBe('DATABASE_URL');
  });

  it('requires database and auth settings in production', () => {
    const result = parseServerEnv({ APP_ENV: 'production' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.map((i) => i.path).sort()).toEqual([
        'BETTER_AUTH_SECRET',
        'BETTER_AUTH_URL',
        'DATABASE_URL',
        'EMAIL_FROM',
        'RESEND_API_KEY',
      ]);
    }
  });

  it('accepts a complete production config and requires https for auth links', () => {
    const production = {
      APP_ENV: 'production',
      DATABASE_URL: 'postgresql://db.example.test/bubo',
      BETTER_AUTH_SECRET: 'x'.repeat(40),
      BETTER_AUTH_URL: 'https://api.bubo.example',
      RESEND_API_KEY: 're_test',
      EMAIL_FROM: 'Bubo <nao-responda@bubo.example>',
    };
    expect(parseServerEnv(production).ok).toBe(true);
    const insecure = parseServerEnv({ ...production, BETTER_AUTH_URL: 'http://api.bubo.example' });
    expect(insecure.ok).toBe(false);
  });

  it('never echoes secret values in issues', () => {
    const secret = 'too-short-secret';
    const result = parseServerEnv({ BETTER_AUTH_SECRET: secret });
    expect(result.ok).toBe(false);
    expect(JSON.stringify(result)).not.toContain(secret);
  });

  it('rejects unknown APP_ENV values', () => {
    expect(parseServerEnv({ APP_ENV: 'staging' }).ok).toBe(false);
  });
});

describe('parsePublicEnv', () => {
  it('defaults the API URL for local development', () => {
    expect(parsePublicEnv({})).toEqual({
      ok: true,
      env: { EXPO_PUBLIC_API_URL: 'http://localhost:8787' },
    });
  });

  it('rejects an invalid API URL', () => {
    expect(parsePublicEnv({ EXPO_PUBLIC_API_URL: 'not a url' }).ok).toBe(false);
  });
});
