import { describe, expect, it } from 'vitest';
import { buildTrustedOrigins } from './trusted-origins';

describe('buildTrustedOrigins', () => {
  it('keeps Expo wildcard origins out of production', () => {
    expect(
      buildTrustedOrigins({
        APP_ENV: 'production',
        BETTER_AUTH_URL: 'https://api.bubo.app',
      }),
    ).toEqual(['bubo://', 'https://api.bubo.app']);
  });

  it('adds Expo development origins outside production', () => {
    const origins = buildTrustedOrigins({
      APP_ENV: 'development',
      BETTER_AUTH_URL: 'http://localhost:8787',
    });

    expect(origins).toContain('bubo://');
    expect(origins).toContain('exp://**');
    expect(origins).toContain('http://localhost:8787');
  });
});
