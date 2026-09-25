# Bubo 4

**Read deeply.**

Bubo 4 is a greenfield, app-first rebuild of Bubo around one core question: **what actually stayed with you after reading?**

The previous implementation is preserved in the branch `legacy/bubo-v3.3`. The code on this branch starts from zero and treats the new Stitch export, the Bubo brand, and the new scientific/product direction as the source material.

## Stack

- **Mobile:** React Native + Expo SDK 57 + Expo Router + TypeScript
- **API:** Cloudflare Workers + Hono + TypeScript
- **Database:** Neon PostgreSQL
- **Storage:** Cloudflare R2
- **Contracts:** shared TypeScript/Zod contracts
- **Scoring:** isolated, versioned Bubo Score package
- **Design source:** Stitch export documented in `docs/design/`

## Monorepo

```text
apps/
  mobile/        Expo / React Native application
  api/           Cloudflare Workers HTTP API
packages/
  contracts/     API/domain contracts shared across app/API
  domain/        Pure product rules
  scoring/       Versioned Bubo Score engine
docs/
  architecture/  Architecture decisions and target data model
  design/        Stitch source notes and screen inventory
  product/       MVP vertical-slice roadmap
  algorithm/     Bubo Score architecture contract
```

## Start

Requires Node.js 22.13+.

```bash
npm install
npm run dev:mobile
```

In another terminal:

```bash
npm run dev:api
```

The permanent mobile destinations are **Hoje · Estante · Revisar · Comunidade · Você**.

The AI is infrastructure, not a primary navigation destination.

## Implementation rule

A vertical slice is only complete when UI, API contract, persistence, authorization, loading/error/empty states and tests work together. Do not rebuild the old Bubo architecture.
