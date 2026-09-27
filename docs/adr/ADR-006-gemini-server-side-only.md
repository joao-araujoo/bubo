# ADR-006 — Gemini is the AI provider, server-side only (no OpenAI)

- Status: Accepted
- Date: 2026-09-26

## Context

Future features (recall questions, reflection feedback) need an LLM. The brief says no OpenAI,
Gemini only, and server-side only. There is also no AI or chat tab.

## Decision

- `apps/api/src/services/gemini.ts` holds `GeminiService`, which calls the REST `generateContent`
  endpoint with `fetch`:
  - The API key goes in the `x-goog-api-key` header, never in the URL.
  - Timeout via `AbortSignal.timeout`.
  - The response is validated with Zod.
  - Provider errors map to stable codes: `SERVICE_UNAVAILABLE` when there's no key,
    `RATE_LIMITED`, `UPSTREAM_ERROR`.
- No SDK dependency. REST keeps the Worker bundle small and avoids Node-only transports.
- `GEMINI_API_KEY` exists only as a Worker secret. `GEMINI_MODEL` defaults to `gemini-2.5-flash`.
- The mobile app never calls Gemini. `npm run audit:repo` fails if Gemini keys or endpoints appear
  in `apps/mobile/src`, or if any OpenAI package or endpoint appears anywhere.
- Task 01 exposes no AI route. The service is ready for feature routes behind auth.

## Consequences

- Prompts, quotas and cost controls live in one place, on the server.
- Rate limiting per user must be added when the first AI route ships.

## Alternatives considered

- **`@google/genai` SDK:** convenient, but it adds bundle weight, and REST covers what we need.
- **Calling Gemini from the app:** would leak the key. Rejected.
- **OpenAI:** forbidden by the brief.
