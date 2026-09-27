# ADR-007 — TanStack Query for server state, no Redux

- Status: Accepted
- Date: 2026-09-26

## Context

The app mostly shows server data (shelf, reviews, clubs). It must behave well offline and on flaky
mobile networks, and the brief rules out Redux.

## Decision

- `@tanstack/react-query@5` is the only server-state store. `createQueryClient()` sets:
  - 60 s `staleTime`
  - retries only for retryable `ApiError`s (network, timeout, 429, 5xx) with exponential backoff
  - no mutation retries
- `wireQueryToReactNative()` connects NetInfo to `onlineManager`, so queries pause offline and
  resume on reconnect. It connects `AppState` to `focusManager` for refetch on foreground.
- A typed API client (`src/lib/api/client.ts`) validates every response against the Zod contracts
  in `@bubo/contracts` and turns the error envelope into `ApiError`.
- Query keys are centralised in `src/lib/api/queries.ts`.
- Local UI state uses React state or context. Example: the theme preference in `ThemeProvider`.
- `OfflineBanner` shows only when NetInfo _knows_ the device is offline. Unknown reachability
  doesn't trigger it.

## Consequences

- Caching, dedupe, retries and offline pause come for free. Screens stay declarative.
- Persisting the query cache to disk (for full offline reads) is a later, explicit decision.

## Alternatives considered

- **Redux Toolkit / RTK Query:** ruled out by the brief, and more boilerplate.
- **Zustand for server data:** no caching or retry semantics.
- **SWR:** fewer React Native integration hooks (online and focus managers).
