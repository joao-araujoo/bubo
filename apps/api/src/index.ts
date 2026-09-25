import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { database } from './db';

type Bindings = {
  APP_ENV: string;
  DATABASE_URL?: string;
  MEDIA?: R2Bucket;
};

const app = new Hono<{ Bindings: Bindings }>();

app.use('/v1/*', cors());

app.get('/health', (c) =>
  c.json({
    status: 'ok',
    service: 'bubo-api',
    environment: c.env.APP_ENV ?? 'unknown',
  }),
);

app.get('/ready', async (c) => {
  if (!c.env.DATABASE_URL) {
    return c.json({ status: 'not_ready', database: 'missing DATABASE_URL' }, 503);
  }

  try {
    const sql = database(c.env.DATABASE_URL);
    await sql`select 1 as ok`;
    return c.json({ status: 'ready', database: 'connected' });
  } catch {
    return c.json({ status: 'not_ready', database: 'unavailable' }, 503);
  }
});

app.get('/v1', (c) =>
  c.json({
    name: 'Bubo API',
    version: '4.0.0-alpha.0',
    message: 'Read deeply.',
  }),
);

export default app;
