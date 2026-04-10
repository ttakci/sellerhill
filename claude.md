# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development
pnpm dev              # Build packages, then run api + web concurrently
pnpm dev:web          # Build packages, run web only
pnpm dev:api          # Build packages, run api only

# Build
pnpm build            # Build all packages and apps

# Quality
pnpm lint             # ESLint check (max-warnings 0)
pnpm lint:fix         # ESLint auto-fix
pnpm format           # Prettier write all files
pnpm typecheck        # TypeScript check across all packages
pnpm validate         # lint + typecheck (runs on pre-commit)

# Docker (PostgreSQL 16, Redis 7, pgAdmin)
pnpm docker:up        # Start services
pnpm docker:down      # Stop services
pnpm docker:logs      # Follow logs
pnpm docker:clean     # Remove containers and volumes
```

Packages must be built before apps can run (`pnpm dev` handles this automatically). No tests exist yet — Jest and ts-jest are installed but unused.

## Architecture

**pnpm workspace monorepo** with two apps and three packages:

| Path | Description |
|---|---|
| `apps/api` | NestJS 10.3+ backend. Raw PostgreSQL via `pg` (no ORM). BullMQ job queues (Redis). JWT auth (Passport). |
| `apps/web` | React 18 + Vite 5. Redux Toolkit + RTK Query. Emotion CSS-in-JS. i18n (EN + TR). |
| `packages/shared` | Domain types, DTOs, Zod schemas, constants, i18n resources. Dual-format build (ESM + CJS). |
| `packages/ui` | Design system (Atomic Design). Theme tokens, styled components, contexts. |
| `packages/mcp` | Stub — no source code yet. |

### Key Patterns

**Container/Component split** — Every page:
- `[Feature]Page.container.tsx` — Logic, RTK Query hooks, state management
- `[Feature]Page.component.tsx` — Presentation only (only `useTranslation` hook allowed)
- `[Feature]Page.style.ts` — Emotion styled components
- `[Feature]Page.types.ts` — Feature-specific types

**API calls** — All frontend API interactions use RTK Query via `baseApi.injectEndpoints`. No direct fetch/axios.

**Shared types** — All domain types/DTOs/interfaces in `packages/shared/src/domain/`. All Zod schemas in `packages/shared/src/schemas/`. No duplicates, no `any`.

**Database** — Raw `pg` driver via `DatabaseService` (query, getClient, transaction methods). Schema in `docker/postgres/init.sql`. No ORM.

**i18n** — No hardcoded UI strings. Files in `packages/shared/src/i18n/resources/{en,tr}/`. Keys use namespace prefix: `"namespace:key.path"`.

**Reference module** — `store-settings` is the canonical pattern:
- Backend: `apps/api/src/modules/store-settings/`
- Frontend: `apps/web/src/features/store-settings/`
- Shared: `packages/shared/src/domain/store-settings/`

### Custom ESLint Plugin (`eslint-plugin-design-system.js`)

- `no-hardcoded-colors` — Use theme tokens, not hex/rgb
- `no-hardcoded-spacing` — Use theme spacing tokens
- `no-inline-styles` — No style prop in JSX
- `no-styled-typography` — Use `<Text>` component, not styled.h1/h2/etc.
- `no-bare-text-in-button` — Wrap Button children in `<Text>`
- `no-implicit-i18n-namespaces` — Require namespace prefix in i18n keys

## Domain Concepts

- **Product**: Source of truth from Amazon (ASIN, images, price). Cached to save API costs.
- **Listing**: An active offer on eBay. Always linked to a Listing Setting Group.
- **Listing Setting Group**: Defines repricing strategy, stock logic, eBay fees, profit margins. Multiple listings share one group — adjusting a group instantly changes all its listings.

## Architectural Rules

1. **Type Safety** — Types in `packages/shared/src/domain/`. No `any`. No duplicates.
2. **Validation** — Zod schemas in `packages/shared/src/schemas/`. Backend DTOs use `class-validator` but implement shared interfaces.
3. **UI & Styling** — Emotion with semantic tokens. No inline styles. Use `Icon` component, no inline SVGs.
4. **Forms** — Use `ModernTextInput` molecule. Inputs must use `React.forwardRef` and `value={value ?? ''}`.
5. **Loading & Errors** — `useLoading(isLoading)` for global UI overlay. `showMessage` from `UIContext` for errors.

## Environment Setup

1. `pnpm docker:up` (PostgreSQL on :5432, Redis on :6379)
2. Copy `apps/api/.env.example` to `apps/api/.env` and fill in values
3. Copy `apps/web/.env.example` to `apps/web/.env` (defaults work for local dev)
4. `pnpm dev`

API: `http://localhost:3000` (Swagger at `/api/docs`). Web: Vite dev server (default :5173).
