import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    server: {
      deps: {
        // Processed by Vitest (not loaded natively) so the React Native / Expo modules it imports
        // can be replaced with fakes in test/mobile-auth-client.test.ts.
        inline: ['@better-auth/expo'],
      },
    },
  },
});
