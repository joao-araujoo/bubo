# Mobile app (`apps/mobile`)

## Navigation and guards (Expo Router, typed routes)

```
src/app/
  _layout.tsx                 fonts + splash, QueryClient, ThemeProvider, guards (Stack.Protected)
  (auth)/boas-vindas.tsx      1/6 Filosofia Bubo → Começar / Já tenho uma conta
  (auth)/cadastro.tsx         sign-up (name, e-mail, password + confirmation)
  (auth)/entrar.tsx           sign-in
  (auth)/esqueci-senha.tsx    request a reset link (same message whether or not the e-mail exists)
  onboarding/index.tsx        2/6 Ritmo atual (single choice)
  onboarding/objetivo.tsx     3/6 Metas pessoais (multi)
  onboarding/interesses.tsx   4/6 Gosto literário (multi)
  onboarding/primeiro-livro.tsx 5/6 first book (manual) or "Pular por enquanto" → saves everything
  onboarding/concluido.tsx    6/6 Pronto! → "Ir para o Bubo (Hoje)"
  (tabs)/…                    exactly 5 tabs: Hoje, Estante, Revisar, Comunidade, Você
  livro/[id].tsx              book detail: progress, status, page edit, session history, remove
  adicionar-livro.tsx         modal: manual add (quero ler / estou lendo)
  sessao/[id].tsx             full-screen focused session: timer → pages + reflection → result
  revisao.tsx                 full-screen review: try "sem espiar" → reveal note → self-grade → summary
  excluir-conta.tsx           in-app account deletion (password re-check)
  redefinir-senha.tsx         deep link bubo://redefinir-senha?token=… (reachable in any state)
  dev/showcase.tsx            DEV-only design-system showcase
```

`useAuthState()` (`src/lib/auth/session.ts`) combines the Better Auth session with `GET /v1/me`:

| state              | reachable                             |
| ------------------ | ------------------------------------- |
| `loading`          | native splash stays up                |
| `signed_out`       | `(auth)`                              |
| `needs_onboarding` | `onboarding`                          |
| `ready`            | `(tabs)`, `dev/showcase`              |
| `error`            | retry screen (offline or server down) |
| `error` + 401      | local sign-out, back to `(auth)`      |

Answers are kept in `OnboardingProvider` and submitted once, on step 5. The "Pronto!" screen is
shown **after** the save succeeds. Its CTA writes the saved profile into the query cache, which
flips the guard to the tabs. Existing answers are pre-filled if a reader redoes onboarding.

## Auth

- `src/lib/auth/client.ts`: Better Auth client + Expo plugin. The session cookie lives in
  SecureStore (keychain/keystore), and `authHeaders()` attaches it to Bubo API calls.
- Form validation is Zod in pt-BR (`src/features/auth/messages.ts`). Server errors map to friendly
  copy. Raw server messages are never shown.
- Sign-out (Você tab, with confirmation) clears the session and **every** cached query.
- The password-reset link uses `Linking.createURL('/redefinir-senha')`: `bubo://` in builds,
  `exp://…/--/` in Expo Go.

## Hoje, Estante and sessions

- **Hoje:**
  - The header streak and XP, the cognitive week and "Missão de hoje" come from
    `GET /v1/me/stats`, using the device's local date.
  - "Lendo agora" shows the reading book with **Continuar leitura** (starts a session) and
    **Atualizar** (opens the book).
- **Estante:**
  - Real entries grouped by status, plus "Adicionar livro".
  - Each row opens the book screen: status chips, progress editor, session history, remove.
- **Focused session** (ADR-014):
  - The timer runs on timestamps and keeps the screen awake while running.
  - Finishing needs at least 1 minute. Then the reader enters the page reached and an optional
    reflection.
  - The result screen shows real minutes, pages, XP and streak.
  - The session id is fixed when the timer stops, so retrying a failed save is safe.
- Recall (Revisar) is still an honest shell. It arrives in Task 04.

## State & data

- Server state is TanStack Query. Keys are scoped by user id (`queryKeys.me(userId)`).
- The API client validates every response with `@bubo/contracts` and throws `ApiError`.
- Public config is only `EXPO_PUBLIC_API_URL`.

## Checks

- `npm run typecheck --workspace @bubo/mobile`: typed routes are checked once `expo start` has
  generated `.expo/types`.
- `npm run expo:check --workspace @bubo/mobile`
- Bundle smoke test, run in `apps/mobile`:
  `npx expo export --platform android|ios --output-dir <tmp>`
