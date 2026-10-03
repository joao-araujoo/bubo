import { afterAll, beforeAll, expect, it, vi } from 'vitest';

vi.mock('../../mobile/src/lib/auth/client', () => ({ authHeaders: async () => ({}) }));
vi.mock('../../mobile/src/lib/config', () => ({
  publicConfig: { apiUrl: 'http://localhost:8787' },
}));

import { createApiClient } from '../../mobile/src/lib/api/client';
import { createHarness } from './harness';

let h: Awaited<ReturnType<typeof createHarness>>;
let cookie: string;
let shelfEntryId: string;
const paths: string[] = [];
const bridge: typeof fetch = async (input, init) => {
  const request = new Request(input, init);
  const url = new URL(request.url);
  paths.push(url.pathname);
  return h.call(`${url.pathname}${url.search}`, {
    method: request.method,
    headers: request.headers,
    body: request.method === 'GET' ? undefined : await request.text(),
  });
};
const client = () =>
  createApiClient({
    baseUrl: 'http://localhost:8787',
    fetch: bridge,
    getHeaders: async () => ({ cookie, 'expo-origin': 'bubo://' }),
  });
const recall = {
  idea: 'A personagem escolhe partir apesar do medo.',
  detail: 'Ela guarda a carta e deixa a casa cedo.',
  connection: 'Isso lembra como coragem depende de agir com dúvida.',
};

beforeAll(async () => {
  h = await createHarness();
  cookie = (await h.signUp()).cookie;
  const entry = await client().addBook({
    title: 'Livro de teste de recordação',
    author: null,
    totalPages: 100,
    status: 'reading',
  });
  shelfEntryId = entry.id;
}, 60_000);
afterAll(async () => h.close());

it('checks without recording and uses the real authenticated mobile API route', async () => {
  const result = await client().assessSession({ shelfEntryId, recall });
  expect(paths.at(-1)).toBe('/v1/sessions/assessment');
  expect(result.assessment).toMatchObject({ passed: true, factualVerification: 'unavailable' });
  expect(result.coach.status).toBe('not_requested');
  expect((await client().getShelfEntry(shelfEntryId)).sessions).toEqual([]);
  const incomplete = await client().assessSession({
    shelfEntryId,
    recall: { idea: '', detail: '', connection: '' },
  });
  expect(incomplete.assessment.passed).toBe(false);
});

it('blocks unfinished recall at the server then accepts and retries the same session once', async () => {
  const now = new Date();
  const body = {
    id: crypto.randomUUID(),
    shelfEntryId,
    startedAt: new Date(now.getTime() - 60_000).toISOString(),
    endedAt: now.toISOString(),
    focusedSeconds: 60,
    endPage: 10,
    reflection: null,
    localDate: now.toISOString().slice(0, 10),
  };
  await expect(client().recordSession(body)).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
  expect((await client().getShelfEntry(shelfEntryId)).entry.currentPage).toBe(0);
  const accepted = await client().recordSession({ ...body, recall });
  expect(accepted.session.assessment?.passed).toBe(true);
  expect(accepted.session.recall).toEqual(recall);
  const retried = await client().recordSession({ ...body, recall });
  expect(retried.session.id).toBe(accepted.session.id);
  expect((await client().getShelfEntry(shelfEntryId)).sessions).toHaveLength(1);
});

it('preserves auth and network failures for recall assessment', async () => {
  const anonymous = createApiClient({ baseUrl: 'http://localhost:8787', fetch: bridge });
  await expect(anonymous.assessSession({ shelfEntryId, recall })).rejects.toMatchObject({
    code: 'UNAUTHORIZED',
  });
  const offline = createApiClient({
    baseUrl: 'http://localhost:8787',
    fetch: async () => {
      throw new TypeError('offline');
    },
  });
  await expect(offline.assessSession({ shelfEntryId, recall })).rejects.toMatchObject({
    code: 'NETWORK_ERROR',
  });
});
