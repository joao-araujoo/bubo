# ADR-001 — App-first client: React Native + Expo

## Status
Accepted.

## Decision
Bubo 4 is an **app-first** product. The primary client is React Native using Expo and Expo Router.

The browser is not the primary product surface. Expo web may remain useful for development or a future companion surface, but Bubo 4 is designed, tested and shipped around native iOS/Android behavior.

## Why
- Native navigation and touch behavior fit the approved Stitch designs.
- ISBN scanning, notifications, haptics, secure local storage, deep links and app lifecycle are first-class mobile concerns.
- One TypeScript/React codebase targets Android and iOS.
- Expo reduces native setup cost while retaining React Native APIs and escape hatches.

## Consequences
- Mobile frames are the canonical UX reference.
- Browser-specific CSS/DOM code from Stitch is reference material, not production code.
- UI primitives are rebuilt in React Native from Bubo design tokens.
- Any future web/admin product is a deliberate surface, not an accidental side effect.
