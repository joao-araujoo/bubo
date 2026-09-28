import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Each suite boots its own PGlite (WASM Postgres). One fork per core exhausted memory on a
    // 12-core/16 GB Windows machine (workers exited 0x80000003); four keeps the run stable.
    maxWorkers: 4,
    server: {
      deps: {
        // Processed by Vitest (not loaded natively) so the React Native / Expo modules it imports
        // can be replaced with fakes in test/mobile-auth-client.test.ts.
        inline: ['@better-auth/expo'],
      },
    },
  },
});
