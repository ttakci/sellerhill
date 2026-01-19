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
- **Loading**: Use `useLoading(isLoading)` hook with RTK Query states.

### 3️⃣ Styling & Theme (EMOTION ONLY)
- **Provider**: Use `@emotion/styled`. NEVER `styled-components`.
- **Tokens**: Use TailAdmin semantic tokens: `theme.colors.{category}.{primary|secondary}`, `theme.spacing.{md|lg}`, `theme.radius.{md}`, etc.
- **Responsiveness**: ALL UI must be responsive. Sidebars hidden on mobile (<1024px). Mobile-first approach.

### 4️⃣ Form Components (forwardRef REQUIRED)
- **Form UI**: ALL inputs must use `React.forwardRef` and `value={value ?? ''}` to prevent uncontrolled component warnings.

### 5️⃣ Localization & Assets
- **i18n**: NO hardcoded strings. Use `t('key')` from `packages/shared/src/i18n/resources/{en|tr}/`.
- **Namespaces**: ALWAYS explicitly specify the namespace in `useTranslation` for feature-specific translations.
  - Example: `const { t } = useTranslation('storeSettings');`
  - **NEVER** use `useTranslation()` without arguments for feature pages, as the default namespace does NOT contain feature-specific keys.
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
- ❌ **Hardcoded strings** in UI (STRICT: All text must be i18n keys).
- ❌ **Inline styles** or `style={{...}}`. (STRICT: NO exceptions).
- ❌ **Raw HTML elements (`div`, `span`, `p`, etc.)** for layout or styling. MUST use named Styled Components from `*.style.ts`.
- ❌ **Direct flexbox/grid properties on native tags**. Define a styled component instead.
- ❌ **Direct fetch/axios** calls.
- ❌ **Inline SVG** (use Icon component).
- ❌ **Duplicate types** (use @repo/shared).
- ❌ **Local state** for global modals/loading (use UIContext).
- ❌ **Implicit i18n namespace** (always use `useTranslation('namespace')`).

## ✅ Success Criteria
- ✅ Zero `any` types.
- ✅ i18n for ALL text.
- ✅ RTK Query for ALL API.
- ✅ Container/Component split.
- ✅ Responsive Design (Mobile-First).
- ✅ Design System Tokens only.

**FAILING ANY RULE REJECTS THE CODE.**
