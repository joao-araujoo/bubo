/** The deployed API (docs/release.md), where the published e-mail pictures live (ADR-041). */
export const PRODUCTION_API_URL = 'https://bubo-api.bubo-api.workers.dev';

/**
 * Real sends need pictures the recipient's mail client can download: `--art-base <url>`, else an
 * https `BETTER_AUTH_URL`, else the deployed API. Pictures exist there only after a deploy that
 * includes them.
 */
export function emailArtBase(values: Record<string, string | undefined>, explicit?: string) {
  const base = explicit ?? values.BETTER_AUTH_URL;
  return base?.startsWith('https://') ? base : PRODUCTION_API_URL;
}
