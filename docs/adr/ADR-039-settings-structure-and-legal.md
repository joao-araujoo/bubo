# ADR-039: settings information architecture, legal documents and consent screens

Date: 2026-10-12. Status: accepted.

## Context

Preferências was one long form mixing account preferences (review rhythm, goals, reminders),
device choices (theme, haptics) and system state (push permission), and Você listed features,
settings and account actions in a single "Sua conta" block. The owner found it confusing and
asked for a clear separation, plus Terms of Use and a Privacy Policy and a semantic place to choose
whether to receive e-mails.

## Decision

- **One hub, one screen per concern.** Você → Configurações (`configuracoes/index`) groups:
  Leitura e memória (`configuracoes/leitura`: review rhythm, cards per day, focus goal, yearly
  goal), Avisos (`configuracoes/notificacoes`: device push state, daily reminder and hour, club
  and friend switches; `configuracoes/emails`: optional reading reminders and the always-sent
  account e-mails), Aparelho (`configuracoes/aparelho`: theme and haptics, applied immediately;
  Widgets), Conta (`configuracoes/seguranca`: login code, password change, sign out other
  devices, delete account) and Sobre (Terms, Privacy, contact, version). Anti-spoiler stays
  visible as a locked rule.
- **Shared form shell.** `features/settings/PreferencesForm` loads the saved preferences once,
  keeps a draft and saves the whole object with one explicit "Salvar"; each screen edits its
  slice, so nothing is lost between screens and the API contract is unchanged (PUT replaces all).
- **Você** keeps the profile, achievements, goal and reading profile and lists three groups: Suas
  leituras (Replay, Minha memória), Comunidade (Amigos, Bloqueados, Moderação) and Conta
  (Notificações, Configurações, Sair). "Excluir conta" moved to Conta e segurança.
- **Legal documents** live in `features/legal/content.ts` as structured sections and render with
  the design system in `legal/termos` and `legal/privacidade`, reachable signed out (sign-up
  consent line) and signed in (Sobre). They describe what the code does: the data that exists,
  the providers that process it (Cloudflare, Neon, Resend, Expo, Google Books, Open Library,
  Gemini only with consent), retention, LGPD rights and how to exercise them. No company name,
  CNPJ or address is invented: the operator is the one identified in the stores and in the
  optional public contact `EXPO_PUBLIC_SUPPORT_EMAIL`, shown as "Fale conosco" only when set.
- **Sign-up** shows a consent sentence with links instead of a checkbox: the documents now exist,
  and a sentence keeps the form short while the links are one tap away.

## Consequences

- Deep links and in-app routes to `/configuracoes` keep working (hub); Revisar and Notificações
  point to the specific screen. Screens, test script and owner setup docs were updated.
- The legal texts must be revised whenever a data practice changes (new provider, new field);
  the date at the top is the version.
- A support contact is still the owner's decision; until set, the screens point to the store
  listing. Device acceptance of the new screens is pending.
