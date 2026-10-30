# Mobile app (`apps/mobile`)

## Navigation and guards (Expo Router, typed routes)

```
src/app/
  _layout.tsx                 fonts + splash, QueryClient, ThemeProvider, guards (Stack.Protected)
  (auth)/boas-vindas.tsx      1/6 Filosofia Bubo → Começar / Já tenho uma conta
  (auth)/cadastro.tsx         sign-up (name, e-mail, password + confirmation)
  (auth)/entrar.tsx           sign-in (password → e-mailed code on untrusted devices, ADR-038)
  (auth)/codigo.tsx           six-digit login code, "Lembrar este aparelho", resend with cooldown
  (auth)/esqueci-senha.tsx    reset by e-mailed code typed in the app (same message whether or not the e-mail exists)
  configuracoes/index.tsx     settings hub (ADR-039) → leitura, notificacoes, emails, aparelho, seguranca
  legal/termos.tsx, legal/privacidade.tsx   Terms and Privacy (reachable in any state)
  onboarding/index.tsx        2/6 Ritmo atual (single choice)
  onboarding/objetivo.tsx     3/6 Metas pessoais (multi)
  onboarding/interesses.tsx   4/6 Gosto literário (multi)
  onboarding/primeiro-livro.tsx 5/6 first book (manual) or "Pular por enquanto" → saves everything
  onboarding/concluido.tsx    6/6 Pronto! → "Ir para o Bubo (Hoje)"
  (tabs)/…                    exactly 5 tabs: Hoje, Estante, Revisar, Comunidade, Você
  livro/[id].tsx              book detail: progress, status, page edit, session history, remove
  replay.tsx                 monthly/yearly accepted-reading chapters + complete report (Você)
  story/[id].tsx              book Story preview, optional ephemeral rating and native export
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
- Sign-out (Você tab, with confirmation) clears the session and **every** cached query, but
  keeps the server-signed `trust_device` cookie aside (`lib/auth/trusted-device.ts`) so a
  remembered device is not asked for a code again (ADR-038).
- The client registers `twoFactorClient()` and `emailOTPClient()`; `signIn.email` may answer
  `twoFactorRedirect`, and the sign-in screen then sends the code and opens `codigo`.
- The legacy password-reset link (`redefinir-senha`) uses `Linking.createURL('/redefinir-senha')`:
  `bubo://` in builds, `exp://…/--/` in Expo Go. New app versions reset by code instead.

## Hoje, Estante and sessions

- **Hoje:**
  - The header streak and XP, the cognitive week and "Missão de hoje" come from
    `GET /v1/me/stats`, using the device's local date.
  - "Lendo agora" shows the reading book with **Continuar leitura** (starts a session) and
    **Atualizar** (opens the book).
- **Estante:**
  - Real entries in a virtualized list, with counts and filters for Todos, Lendo, Quero ler,
    Lidos, Pausados and Abandonados. Local title/author search ignores accents; ordering can be
    Recentes, Título or Autor.
  - "Adicionar livro" respects the active reading/finished filter. Search, detail, ISBN and
    manual entry offer Quero ler, Lendo and Já li. Search remains open to add several books.
  - Each row opens the book screen and offers quick status changes; status controls are at the
    top of the detail, before the memory path, progress editor, session history and remove.
  - The book detail opens on a 3D book (`Book3D`, ADR-036): the flat `BookCover` hinged and
    tilted, a paper fore-edge whose depth comes from `bookThickness(totalPages)`, a hinge
    groove, gloss and shadow. Pressing turns it to face the reader; reduced motion keeps it
    still. Grids, search and Stories keep the flat cover.
  - **Estante 3D** (`estante-3d`, ADR-037) is a visualisation of the same shelf query: a wooden
    bookcase (`Bookcase3D`) with spines sized by `spineWidth`, rows from `packShelfRows`,
    reading books face out and Bubo on top; tapping opens `ShelfSpotlight` (Book3D + real
    details + "Abrir livro"). Nothing is written from it.
  - API-accepted entries appear immediately; recommendations refresh in the background.
    Marking Já li organizes the shelf without recording sessions, XP or streaks (ADR-033).
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
- Public config includes `EXPO_PUBLIC_API_URL` and optional `EXPO_PUBLIC_INSTAGRAM_APP_ID`.

## Replay and Stories (ADR-034)

Replay uses the validated owner-scoped API report and account-scoped TanStack Query keys. The
chosen calendar month/year and device IANA time zone determine the query. Manual chapters use
brief `FadeIn` transitions; there is no autoplay. The complete report keeps all books and annual
monthly evolution, with honest zero/partial history and no private writing or invented metadata.

The server's mandatory `generatedAt` dates current-period art as `até DD/MM` in the selected zone
and supplies the visible update timestamp. Replay is excluded from persisted query caches and
refetches on mount. A paused initial query without data shows offline; any in-memory snapshot
keeps its actual server date instead of claiming freshness from the device clock. Ranking ties
use non-exclusive highlights rather than claiming a sole winner.

The book Story composer previews Papel/Noite/Violeta with current shelf metadata and an optional
1–5 rating held only in screen state. `react-native-view-shot` 5.1.0 captures the static art at
1080 × 1920; controls stay outside it. The local `bubo-stories` module validates cache-local PNGs
and handles system sharing/saving and Instagram Stories handoff. Direct Instagram requires the
public App ID, Instagram and a compiled native build; Expo Go reports unavailability honestly.
No share action publishes automatically or changes friends-feed preferences. Native/visual
acceptance remains pending; see [replay.md](replay.md).

## Checks

- `npm run typecheck --workspace @bubo/mobile`: typed routes are checked once `expo start` has
  generated `.expo/types`.
- `npm run expo:check --workspace @bubo/mobile`
- Bundle smoke test, run in `apps/mobile`:
  `npx expo export --platform android|ios --output-dir <tmp>`
