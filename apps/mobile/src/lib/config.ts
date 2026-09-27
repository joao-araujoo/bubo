import { parsePublicEnv } from '@bubo/config';

/**
 * Public runtime config. `process.env.EXPO_PUBLIC_*` must be referenced statically so Expo can
 * inline it at build time. Only public values belong here — never secrets.
 */
const parsed = parsePublicEnv({ EXPO_PUBLIC_API_URL: process.env.EXPO_PUBLIC_API_URL });

if (!parsed.ok && __DEV__) {
  // Fail loudly in development; production falls back to the default below.
  throw new Error(
    `Invalid public env: ${parsed.issues.map((i) => `${i.path} (${i.message})`).join(', ')}. Check apps/mobile/.env.`,
  );
}

export const publicConfig = {
  apiUrl: (parsed.ok ? parsed.env.EXPO_PUBLIC_API_URL : 'http://localhost:8787').replace(
    /\/+$/,
    '',
  ),
} as const;
