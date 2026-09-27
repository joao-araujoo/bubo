import {
  type AddBookRequest,
  type CreateCardRequest,
  type CreateSessionRequest,
  type ErrorCode,
  type OnboardingRequest,
  type ReviewRequest,
  type UpdateShelfEntryRequest,
  apiPath,
  catalogBookResponseSchema,
  catalogSearchResponseSchema,
  deleteResponseSchema,
  dueCardsResponseSchema,
  recallCardSchema,
  reviewResultSchema,
  errorResponseSchema,
  healthResponseSchema,
  meResponseSchema,
  sessionResultSchema,
  shelfEntryDetailSchema,
  shelfEntrySchema,
  shelfResponseSchema,
  statsResponseSchema,
  API_ROUTES,
} from '@bubo/contracts';
import { API_PREFIX } from '@bubo/config';
import { type z } from 'zod';

import { authHeaders } from '../auth/client';
import { publicConfig } from '../config';

/** Client-side failure modes on top of the API's own error codes. */
export type ApiErrorCode = ErrorCode | 'NETWORK_ERROR' | 'TIMEOUT' | 'INVALID_RESPONSE';

export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number | null;
  readonly requestId: string | null;

  constructor(
    code: ApiErrorCode,
    message: string,
    status: number | null,
    requestId: string | null,
  ) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.requestId = requestId;
  }

  /** Worth retrying automatically (network blips, 5xx, rate limits) — never 4xx logic errors. */
  get retryable(): boolean {
    return (
      this.code === 'NETWORK_ERROR' ||
      this.code === 'TIMEOUT' ||
      this.code === 'RATE_LIMITED' ||
      (this.status !== null && this.status >= 500)
    );
  }
}

type RequestOptions = { method?: string; body?: unknown; signal?: AbortSignal; timeoutMs?: number };

export type ApiClientOptions = {
  baseUrl: string;
  fetch?: typeof fetch;
  timeoutMs?: number;
  /** Extra headers per request (the session cookie). */
  getHeaders?: () => Promise<Record<string, string>>;
};

/** Typed fetch wrapper: every response is validated against its Zod contract. */
export function createApiClient({
  baseUrl,
  fetch: fetchImpl = fetch,
  timeoutMs = 15_000,
  getHeaders,
}: ApiClientOptions) {
  async function request<S extends z.ZodType>(
    path: string,
    schema: S,
    options: RequestOptions = {},
  ): Promise<z.infer<S>> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? timeoutMs);
    const onAbort = () => controller.abort();
    options.signal?.addEventListener('abort', onAbort);

    let response: Response;
    try {
      const extraHeaders = (await getHeaders?.()) ?? {};
      response = await fetchImpl(`${baseUrl}${API_PREFIX}${path}`, {
        method: options.method ?? 'GET',
        headers: {
          accept: 'application/json',
          ...(options.body !== undefined ? { 'content-type': 'application/json' } : {}),
          ...extraHeaders,
        },
        body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
        signal: controller.signal,
        // The cookie is set explicitly above; `include` could interfere with it on native.
        credentials: 'omit',
      });
    } catch (error) {
      const aborted = error instanceof Error && error.name === 'AbortError';
      const byCaller = options.signal?.aborted === true;
      throw new ApiError(
        aborted && !byCaller ? 'TIMEOUT' : 'NETWORK_ERROR',
        aborted && !byCaller ? 'O servidor demorou para responder.' : 'Sem conexão com o servidor.',
        null,
        null,
      );
    } finally {
      clearTimeout(timer);
      options.signal?.removeEventListener('abort', onAbort);
    }

    const requestId = response.headers.get('x-request-id');
    const json: unknown = await response.json().catch(() => null);

    if (!response.ok) {
      const envelope = errorResponseSchema.safeParse(json);
      if (envelope.success) {
        const { code, message } = envelope.data.error;
        throw new ApiError(code, message, response.status, envelope.data.error.requestId);
      }
      throw new ApiError(
        'INVALID_RESPONSE',
        `Resposta inesperada (HTTP ${response.status}).`,
        response.status,
        requestId,
      );
    }

    const parsed = schema.safeParse(json);
    if (!parsed.success) {
      throw new ApiError(
        'INVALID_RESPONSE',
        'Resposta do servidor em formato inesperado.',
        response.status,
        requestId,
      );
    }
    return parsed.data;
  }

  return {
    request,
    getHealth: (signal?: AbortSignal) =>
      request(API_ROUTES.health, healthResponseSchema, { signal }),
    getMe: (signal?: AbortSignal) => request(API_ROUTES.me, meResponseSchema, { signal }),
    completeOnboarding: (body: OnboardingRequest) =>
      request(API_ROUTES.onboarding, meResponseSchema, { method: 'PUT', body }),
    getShelf: (signal?: AbortSignal) => request(API_ROUTES.shelf, shelfResponseSchema, { signal }),
    addBook: (body: AddBookRequest) =>
      request(API_ROUTES.shelf, shelfEntrySchema, { method: 'POST', body }),
    getShelfEntry: (id: string, signal?: AbortSignal) =>
      request(apiPath(API_ROUTES.shelfEntry, { id }), shelfEntryDetailSchema, { signal }),
    updateShelfEntry: (id: string, body: UpdateShelfEntryRequest) =>
      request(apiPath(API_ROUTES.shelfEntry, { id }), shelfEntrySchema, { method: 'PATCH', body }),
    deleteShelfEntry: (id: string) =>
      request(apiPath(API_ROUTES.shelfEntry, { id }), deleteResponseSchema, { method: 'DELETE' }),
    recordSession: (body: CreateSessionRequest) =>
      request(API_ROUTES.sessions, sessionResultSchema, { method: 'POST', body }),
    getStats: (today: string, signal?: AbortSignal) =>
      request(`${API_ROUTES.stats}?today=${encodeURIComponent(today)}`, statsResponseSchema, {
        signal,
      }),
    getDueCards: (today: string, signal?: AbortSignal) =>
      request(
        `${API_ROUTES.recallDue}?today=${encodeURIComponent(today)}`,
        dueCardsResponseSchema,
        {
          signal,
        },
      ),
    createCard: (body: CreateCardRequest) =>
      request(API_ROUTES.recallCards, recallCardSchema, { method: 'POST', body }),
    deleteCard: (id: string) =>
      request(apiPath(API_ROUTES.recallCard, { id }), deleteResponseSchema, { method: 'DELETE' }),
    searchCatalog: (q: string, signal?: AbortSignal) =>
      request(`?q=${encodeURIComponent(q)}&limit=20`, catalogSearchResponseSchema, {
        signal,
        timeoutMs: 20_000,
      }),
    getCatalogBook: (catalogId: string, signal?: AbortSignal) =>
      request(apiPath(API_ROUTES.catalogBook, { catalogId }), catalogBookResponseSchema, {
        signal,
      }),
    lookupIsbn: (isbn: string, signal?: AbortSignal) =>
      request(apiPath(API_ROUTES.catalogIsbn, { isbn }), catalogBookResponseSchema, { signal }),
    reviewCard: (id: string, body: ReviewRequest) =>
      request(apiPath(API_ROUTES.recallReview, { id }), reviewResultSchema, {
        method: 'POST',
        body,
      }),
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;

export const api = createApiClient({ baseUrl: publicConfig.apiUrl, getHeaders: authHeaders });
