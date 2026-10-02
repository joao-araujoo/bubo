import { createApp } from './app';
import { type Bindings } from './env';
import { runScheduled } from './scheduled';

const app = createApp();

/** Cloudflare Worker entry point: HTTP API and the hourly cron (review reminders). */
export default {
  fetch: app.fetch,
  scheduled(_controller, env, ctx) {
    ctx.waitUntil(runScheduled(env));
  },
} satisfies ExportedHandler<Bindings>;
