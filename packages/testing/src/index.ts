/** Server bindings fixture (development defaults, no real secrets). */
export function createTestServerBindings(
  overrides: Record<string, string | undefined> = {},
): Record<string, string | undefined> {
  return {
    APP_ENV: 'development',
    DATABASE_URL: undefined,
    BETTER_AUTH_SECRET: undefined,
    BETTER_AUTH_URL: 'http://localhost:8787',
    GEMINI_API_KEY: undefined,
    GEMINI_MODEL: 'gemini-2.5-flash',
    ...overrides,
  };
}

export type RecordedRequest = {
  url: string;
  method: string;
  headers: Headers;
  body: string | null;
};

export type MockFetch = typeof fetch & { calls: RecordedRequest[] };

/** A fetch replacement that records every request and answers with `handler`. */
export function createMockFetch(
  handler: (request: RecordedRequest) => Response | Promise<Response>,
): MockFetch {
  const calls: RecordedRequest[] = [];
  const mock = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const request = new Request(input, init);
    const recorded: RecordedRequest = {
      url: request.url,
      method: request.method,
      headers: request.headers,
      body: request.body ? await request.text() : null,
    };
    calls.push(recorded);
    return handler(recorded);
  };
  return Object.assign(mock, { calls }) as MockFetch;
}

export function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: { 'content-type': 'application/json', ...init.headers },
  });
}

/** Deterministic clock for time-dependent code. */
export function createFixedClock(start = Date.UTC(2026, 0, 1)) {
  let current = start;
  return {
    now: () => current,
    advance: (ms: number) => {
      current += ms;
    },
  };
}
