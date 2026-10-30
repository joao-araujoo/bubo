# ADR-041: light, hosted e-mail art and a minimal white frame

Date: 2026-10-13. Status: accepted. Supersedes the "inline CID artwork" part of ADR-038.

## Context

The owner reported that Bubo e-mails took long to show their images, that the images sometimes
appeared as attachments, and that the layout looked heavy. The cause was the ADR-038 frame: every
e-mail attached the full official PNGs as CID parts (horizontal logo ~128 KB plus one 640 px pose of
~220–320 KB, ~560 KB of base64 per message) and drew a lavender page with a bordered card. Several
clients (Apple Mail, some Outlook and Android apps, forwarded messages) list CID parts as
attachments, and half a megabyte per message is slow on mobile data.

The owner asked for a minimal white (or very minimal purple) design "in the vibe" of a reference
loading screen: one centred mascot inside soft concentric circles, the logo under it, very little
text and lots of breathing room.

## Decision

- **No attachments.** `EmailContent` no longer has `attachments`; the Resend payload carries only
  subject, text, HTML and optional headers (a few KB).
- **Hosted, content-hashed pictures.** The API serves the pictures itself at
  `GET /v1/email/art/:file` (`API_ROUTES.emailArt`, public, no session, no database). File names
  carry a 10-hex SHA-256 prefix (`hero-confident.d9cff8d401.png`), so responses are
  `Cache-Control: public, max-age=31536000, immutable` and mail-client image proxies (Gmail,
  Outlook, Apple Mail Privacy Protection) fetch each file once. Unknown names answer 404. The
  route answers `Cross-Origin-Resource-Policy: cross-origin` (every other route keeps
  `same-origin`) because webmails embed the images from their own origin. E-mails point at
  `<BETTER_AUTH_URL>/v1/email/art/<file>`; `BETTER_AUTH_URL` is already required (https) in
  production. The unsubscribe confirmation page reuses the same art by relative URL.
- **Derived from the official art, never redrawn.** `scripts/email-assets.mjs` (no new dependency;
  `scripts/lib/png.mjs`) builds:
  - one hero per pose in use (welcome, doubt, confident, curious, neutral), 440 × 440 px for a
    220 px display: the official pose, trimmed of transparent padding and downscaled to 62 % of
    the canvas, untouched, centred on three concentric circles in translucent `purpleLight`
    (alpha 26/44/66, outermost first) on a transparent background, so the art reads on light and
    dark mail backgrounds;
  - the official horizontal logo downscaled to 240 px wide (120 px display).

  Both are reduced to a ≤ 256-colour palette (median cut + k-means, deterministic) and written as
  8-bit indexed PNGs: ~23–25 KB per hero and ~6 KB for the logo, so one e-mail references ~30 KB
  instead of attaching ~420 KB. The palette reduction is a delivery optimisation like
  downscaling; no pose is recoloured, traced or regenerated.

- **Reproducible check.** `npm run assets:check` regenerates the pixels and compares palette and
  scanlines with the embedded files (deflate bytes can differ between zlib builds); unchanged
  pixels keep their bytes and file names, so the generated module never churns.
- **Minimal frame.** White page, single 480 px column, hero → small logo (the reference's
  mascot → logo order), eyebrow in purple small caps, one 28 px headline, greeting, one or two
  muted paragraphs, the code on a `purpleSoft` box **or** one purple pill button, a note under a
  hairline, and a two-line footer. Tables, inline styles, explicit image sizes, `alt="Bubo"` on the
  logo, no web fonts, `color-scheme: light`. Subjects, copy, codes, links, List-Unsubscribe headers
  and the text part are unchanged.

## Consequences

- E-mails are a few KB and their pictures load once from cache; nothing shows up as an attachment.
- Clients that block remote images show the layout without pictures (the hero is decorative,
  the logo shows "Bubo"). Codes, buttons and text never depend on images.
- The pictures exist only where the API is deployed: e-mails sent by `dev:api` on localhost point
  at `http://localhost:8787` (they still read fine), and `email:samples`/`email:check` point at
  the production API (or `--art-base <https-url>`), which needs a deploy that includes this route.
- Changing a pose or the ring tokens changes the hash, so already-sent e-mails keep the old
  picture only while the old file is still deployed; old names answer 404 after a deploy, which
  degrades to the "images blocked" layout.
