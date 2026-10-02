# ADR-025: emails transacionais acolhedores com Resend

Date: 2026-10-01. Status: accepted.

## Decision

Provide dependency-free text/HTML templates, presentation tables, preheaders, safe escaping,
one primary action and official inline CID PNGs. Generate artwork/palette from the existing app
assets/theme, verify in assets:check; no public image host or new dependency.

Combine welcome with optional one-hour signed verification on signup. Preserve existing accounts,
auto sign-in, trusted origins and redirect guards; do not resend on every login. Keep signup usable
during email failures. Notify after password reset; catch delivery failure so Better Auth still
revokes old sessions. Preserve one-use reset tokens and uniform 503 for unconfigured production email.

Call Resend only from API, require accepted IDs, use hashed idempotency keys. Log category/id/status,
never content, recipient, credentials or authentication links. No automatic retry or engagement
campaign. Diagnostics are read-only by default; sending requires an explicit recipient. Local
previews need no credentials. A real test was confirmed delivered and found in the owner's Gmail
inbox with official inline artwork; browser rendering was unavailable in this session.

Prepare bubo.nyoneo.com.br with open/click tracking off and receiving disabled. The owner deferred
DNS setup; do not configure runtime credentials for an unverified sender or silently fall back
to resend.dev in production. The root .env does not configure the Worker.

## Consequences

DNS verification/Worker secrets gate public delivery. No schema or mobile route change. Mandatory
verification for store readiness is a later access decision. Daily/weekly/re-engagement campaigns
need explicit opt-in, unsubscribe/suppression, real activity, deduplication and frequency limits.
Prioritize account transactions within the free quota. Native deep links depend on email client
support; textual instructions remain available. Automated checks and delivery differ from visual
client acceptance. Sources/operational steps: [emails.md](../emails.md), [emails-dns.md](../emails-dns.md).
