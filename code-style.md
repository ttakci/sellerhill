# Antigravity Code Style Guide

**Strict pnpm workspace monorepo rules. NO EXCEPTIONS.**

## 🚨 CRITICAL RULES

### 1️⃣ Type Safety & Validation (MANDATORY)

- **Shared Domain**: ALL domain types in `packages/shared/src/domain/`.
- **Validation**: Frontend (React Hook Form + Zod) and Backend (class-validator) MUST use schemas from `packages/shared/src/schemas/`.
- **Zero Tolerance**: NO `any`, NO type assertions without validation.

### 2️⃣ Architecture & Logic (STRICT)

- **Pattern**: Container/Component split REQUIRED.
  - `[Feature]Page.container.tsx`: Logic, RTK Query, state.
  - `[Feature]Page.component.tsx`: Markup, Props only, NO hooks.
- **API**: Use RTK Query via `baseApi.injectEndpoints`. NO fetch/axios directly.
- **Loading (MANDATORY)**: ALL API calls MUST trigger the global loading overlay. Use the `useLoading(isLoading)` hook with RTK Query's `isLoading` (or `isFetching` where appropriate) states. This is a non-negotiable standard for all containers.
- **Error Handling**: NEVER use `try-catch` for API calls in the frontend. RTK Query handles errors in the `mutate().unwrap()` result or through the `isError`/`error` flags.

### 3️⃣ Styling & Theme (EMOTION ONLY)

- **Provider**: Use `@emotion/styled`. NEVER `styled-components`.
- **Tokens**: Use TailAdmin semantic tokens: `theme.colors.{category}.{primary|secondary}`, `theme.spacing.{md|lg}`, `theme.radius.{md}`, etc.
- **Responsiveness**: ALL UI must be responsive. Sidebars hidden on mobile (<1024px). Mobile-first approach.

### 4️⃣ Responsive Design (MANDATORY)

- **Units**: Use `rem`, `em`, `%`, `vw`, `vh`, `fr`. NEVER `px` (except borders: `1px`, `2px`).
- **Base**: `1rem = 16px` (browser default).
- **Breakpoints** (Mobile-First):
  - Mobile: `30rem` (480px)
  - Tablet: `48rem` (768px)
  - Desktop: `64rem` (1024px)
  - Large: `80rem` (1280px)
- **Approach**: Mobile-first media queries with `min-width`.
- **Reference**: See `.agent/responsive-design-rules.md` for full guidelines.

### 5️⃣ Form Components (forwardRef REQUIRED)

- **Form UI**: ALL inputs must use `React.forwardRef` and `value={value ?? ''}` to prevent uncontrolled component warnings.

### 6️⃣ Localization & Zero Hardcoded Strings (CRITICAL)

- **Zero Tolerance Policy**: NO hardcoded strings allowed in JSX/TSX. Every piece of user-visible text MUST be localized.
- **UI Package Pattern (@repo/ui)**:
  - Components MUST be pure and agnostic of the translation engine.
  - **PROHIBITED**: Using `useTranslation()` or importing from `i18next` inside `@repo/ui`.
  - **PATTERN**: Accept localized strings as props (e.g., `label?: string`, `emptyMessage?: string`).
- **Web App Pattern (apps/web)**:
  - Use `useTranslation(['namespace', 'translation'])` in components.
  - Pass the translated strings down to the UI components.
  - ✅ `<Table emptyMessage={t('translation:common.noData')} ... />`
  - ✅ `const label = t('feature:settings.label');`
- **Standard rules**:
  - **Structure**: Root key in JSON MUST match the filename (e.g., `feature.json` -> `{ "feature": { ... } }`).
  - **Key Usage**: ALWAYS use explicit namespace prefixes (`namespace:key.path`).
    - ✅ `t('feature:feature.title')`
    - ✅ `t('translation:common.save')`
  - ❌ `t('title')` (Implicit: FORBIDDEN)
- **Icons**: Use `@repo/ui` `Icon` component. NO inline SVG.

---

## 📂 File Structure (STRICT PATTERN)

```
features/[feature]/
├── [Feature]Page.container.tsx    # Logic & RTK Query
├── [Feature]Page.component.tsx    # Presentation (Markup)
├── [Feature]Page.types.ts         # Types
├── [Feature]Page.style.ts         # Emotion Styles
├── index.ts                       # Export Container
├── api/                           # RTK Query Endpoints
└── adapters/                      # DTO Transformers
```

---

## 📘 REFERENCE IMPLEMENTATION (CANONICAL)

**The `store-settings` module is the ONLY reference for all patterns.**

- **Backend**: `apps/api/src/modules/store-settings/`
- **Frontend**: `apps/web/src/features/store-settings/`
- **Shared**: `packages/shared/src/domain/store-settings/`

---

## 🚫 FORBIDDEN PATTERNS

- ❌ **`any`** types.
- ❌ **`px` units** (except borders: `1px`, `2px`). Use `rem`, `%`, `vw`, `vh` instead.
- ❌ **Hardcoded strings** in UI (STRICT: All text must be i18n keys). No exceptions for placeholders, tooltips, or default props.
- ❌ **`useTranslation` inside @repo/ui**. UI components must receive localized strings via props.
- ❌ **Inline styles** or `style={{...}}`. (STRICT: NO exceptions).
- ❌ **Raw HTML elements (`div`, `span`, `p`, etc.)** for layout or styling. MUST use named Styled Components from `*.style.ts`.
- ❌ **Direct flexbox/grid properties on native tags**. Define a styled component instead.
- ❌ **Direct fetch/axios** calls. Use RTK Query.
- ❌ **Inline SVG** (use Icon component).
- ❌ **Duplicate types** (use @repo/shared).
- ❌ **Local state** for global modals/loading (use UIContext).
- ❌ **Implicit i18n namespace** (always use `useTranslation(['ns', 'translation'])`).
- ❌ **Implicit i18n keys** (always use `namespace:key.path` prefix).
- ❌ **`try-catch` for API calls** in frontend (use RTK Query error states).

## ✅ Success Criteria

- ✅ Zero `any` types.
- ✅ i18n for ALL text.
- ✅ RTK Query for ALL API.
- ✅ Container/Component split.
- ✅ Responsive Design (Mobile-First).
- ✅ Design System Tokens only.

**FAILING ANY RULE REJECTS THE CODE.**
