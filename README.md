# React + NestJS pnpm Monorepo Template

> **Production-ready monorepo template optimized for AI-assisted development with GitHub Copilot.**

A comprehensive full-stack TypeScript monorepo combining React 18, NestJS 10, and pnpm workspaces with strict architectural patterns, dark/light mode theme system, and extensive documentation for LLM code generation.

## ✨ Features

### 🏗️ Architecture

- **Monorepo Structure**: Nx + pnpm workspaces for unified dependency management
- **Type Safety**: Shared TypeScript types across frontend and backend (zero duplication)
- **Container/Component Pattern**: Strict separation of smart (data) and dumb (UI) components
- **Platform-Agnostic**: Ready for Web and Mobile with shared business logic

### 🎨 Frontend (React 18 + Vite)

- **Styling**: Emotion CSS-in-JS with semantic design tokens
- **Theme System**: Dark/light mode with localStorage persistence and system preference detection
- **State Management**: Redux Toolkit + RTK Query for API state
- **Forms**: React Hook Form + Zod validation (schemas in shared package)
- **i18n**: react-i18next with English and Turkish translations
- **UI Components**: Atomic design with forwardRef support
- **Icons**: SVG icon system as React components

### ⚙️ Backend (NestJS 10)

- **Validation**: class-validator DTOs with automatic validation
- **API Versioning**: URI versioning (/v1, /v2)
- **Rate Limiting**: 3-tier rate limiting (global, per-route, authenticated)
- **Health Checks**: Terminus health endpoints
- **Logging**: Winston with request tracking
- **Security**: Helmet, CORS, compression

### 📦 Packages

- **@repo/shared**: Domain types, DTOs, Zod schemas, i18n keys, validators
- **@repo/ui**: Design system, theme tokens, UI components, contexts (Theme, UI)
- **@repo/mcp**: Model Context Protocol documentation

### 🤖 AI-Assisted Development

- **GitHub Copilot Configuration**: Workspace settings and code snippets
- **Copilot Instructions**: Critical architectural rules (.github/copilot-instructions.md)
- **LLM Rules**: 1366-line comprehensive guide for AI code generation
- **Architecture Docs**: 1106-line detailed architecture documentation
- **Code Snippets**: 8 custom templates for Container, Component, RTK Query, NestJS, etc.

## 📂 Project Structure

```
├── apps/
│   ├── api/                    # NestJS backend (port 3000)
│   │   └── src/
│   │       ├── modules/        # Feature modules (examples, users, etc.)
│   │       ├── main.ts         # Bootstrap with rate limiting, compression
│   │       └── app.module.ts   # Root module with health checks
│   └── web/                    # React frontend (port 5173)
│       └── src/
│           ├── features/       # Feature modules (Container/Component split)
│           ├── layouts/        # AppLayout with ThemeToggle
│           ├── services/       # RTK Query baseApi
│           └── main.tsx        # ThemeProvider + UIProvider setup
├── packages/
│   ├── shared/                 # Shared types and logic
│   │   └── src/
│   │       ├── domain/         # Domain types (Product, User, etc.)
│   │       ├── schemas/        # Zod validation schemas
│   │       └── i18n/           # Translation keys and types
│   ├── ui/                     # Design system
│   │   └── src/
│   │       ├── atoms/          # Button, Input, Label, Text, Icon
│   │       ├── molecules/      # ThemeToggle, GeneralMessage, GeneralLoading
│   │       ├── theme/          # designTokens, themes, tkn helper
│   │       ├── context/        # ThemeContext, UIContext
│   │       └── hooks/          # useTheme, useUI
│   └── mcp/                    # MCP server documentation
├── .github/
│   └── copilot-instructions.md # GitHub Copilot critical rules (v3.0.0)
├── .vscode/
│   ├── settings.json           # Workspace settings for Copilot
│   ├── copilot-snippets.code-snippets  # 8 custom code templates
│   ├── extensions.json         # Recommended VS Code extensions
│   └── launch.json             # Debug configurations
├── LLM_RULES.md                # 1366-line AI code generation rules
├── ARCHITECTURE.md             # 1106-line architecture documentation
├── .copilotignore              # Files Copilot should not modify
└── package.json                # Monorepo scripts (dev, build, lint)
```

## 🚀 Getting Started

### Prerequisites

- **Node.js**: 18+ (LTS recommended)
- **pnpm**: 8.6+ (faster than npm/yarn)
- **VS Code**: Recommended for GitHub Copilot integration

### Installation

```bash
# Clone the repository
git clone <your-repo-url>
cd react-nestjs-nodejs-nx-monorepo-template

# Install dependencies
pnpm install
```

### Development

```bash
# Run both frontend and backend concurrently
pnpm dev
```

**Servers:**

- 🎨 **Frontend**: http://localhost:5173
- 🚀 **Backend API**: http://localhost:3000/api
- 📚 **API Docs**: http://localhost:3000/api/docs (Swagger)

**Individual Commands:**

````bash
# Run only backend
pnpm --filter api run dev

# Run only frontend
pnp🏛️ Architecture Highlights

### 📋 Strict Architectural Rules

This template enforces **ZERO TOLERANCE** rules for consistency and maintainability:

1. ✅ **Type Safety**: ALL types in `packages/shared/src/domain/` (no duplication)
2. ✅ **No `any` Types**: Use proper TypeScript types everywhere
3. ✅ **No Hardcoded Strings**: ALL text uses `t('translation.key')`
4. ✅ **Container/Component Split**: Smart (data) vs Dumb (UI) separation
5. ✅ **RTK Query Only**: No direct fetch/axios calls
6. ✅ **Icon Components**: No inline SVG elements
7. ✅ **forwardRef Required**: Form components must use `React.forwardRef`
8. ✅ **UIContext for Modals**: No local state for loading/message modals
9. ✅ **ThemeProvider Required**: Use dark/light mode system
10. ✅ **Semantic Tokens**: Use hierarchical theme structure

### 🎨 Theme System (Dark/Light Mode)

**New Semantic Token Structure:**
```typescript
// ✅ CORRECT - Hierarchical semantic tokens
background: ${({ theme }) => theme.colors.background.primary};
padding: ${({ theme }) => theme.spacing.md};
border-radius: ${({ theme }) => theme.radius.md};
box-shadow: ${({ theme }) => theme.shadows.sm};
font-size: ${({ theme }) => theme.typography.fontSize.lg};

// ❌ WRONG - Old flat structure
background: ${({ theme }) => theme.tokens.colors.background};
padding: ${({ theme }) => theme.space.md};
````

**Theme Provider Setup:**

```tsx
// apps/web/src/main.tsx
<Provider store={store}>
  <ThemeProvider>
    <UIProvider>
      <App />
    </UIProvider>
  </ThemeProvider>
</Provider>
```

**Theme Hook Usage:**

```tsx
import { useTheme } from '@repo/ui';

const MyComponent = () => {
  const { theme, themeMode, toggleTheme } = useTheme();
  // theme.colors.background.primary
  // themeMode: 'light' | 'dark'
};
```

### 🧩 Container/Component Pattern

**Container (Smart - Data & Logic):**

```tsx
// features/products/ProductsPage.container.tsx
import { useGetProductsQuery } from './api/productsApi';
import { useUI } from '@repo/ui';

export const ProductsPageContainer = () => {
  const { data, isLoading } = useGetProductsQuery();
  const { showMessage } = useUI();

  return <ProductsPageComponent products={data?.items} />;
};
```

**Component (Dumb - Presentation Only):**

```tsx
// features/products/ProductsPage.component.tsx
import * as S from './ProductsPage.style';

export const ProductsPageComponent = ({ products }: Props) => {
  const { t } = useTranslation();

  return (
    <S.Container>
      <S.Title>{t('products.title')}</S.Title>
      {/* UI only, no hooks except useTranslation */}
    </S.Container>
  );
};
```

### 🌐 Internationalization (i18n)

\*\*T🤖 GitHub Copilot Integration

This template is **optimized for AI-assisted development** with GitHub Copilot.

### Copilot Configuration Files

- **[.github/copilot-instructions.md](.github/copilot-instructions.md)**: Critical architectural rules (automatically read by Copilot)
- **[.vscode/settings.json](.vscode/settings.json)**: Workspace settings with Copilot auto-completions
- **[.vscode/copilot-snippets.code-snippets](.vscode/copilot-snippets.code-snippets)**: 8 custom code templates
- **[.copilotignore](.copilotignore)**: Files Copilot should not modify

### Custom Code Snippets

Type these prefixes and press `Tab`:

- `container` → Smart component (RTK Query, useUI, useTheme)
- `component` → Dumb component (props only, presentation)
- `styled` → Styled components with new theme structure
- `rtkapi` → RTK Query API with cache invalidation
- `controller` → NestJS controller with validation
- `rhf` → React Hook Form with Zod validation
- `forwardref` → forwardRef input component
- `types` → Component types file

### Using Copilot Chat

```
@workspace Create a new "Orders" CRUD feature

Follow .github/copilot-instructions.md:
- Shared types in packages/shared
- NestJS backend with class-validator
- React frontend with Container/Component split
- RTK Query API
- i18n translations (EN/TR)
```

### Comment-Driven Development

```typescript
// STEP 1: Create shared types (Order interface in packages/shared)
// STEP 2: Create Zod schema (createOrderSchema)
// STEP 3: Add i18n keys (orders.title, orders.createSuccess)
// STEP 4: Create RTK Query API
// STEP 5: Create Container and Component
// @copilot: Generate following LLM_RULES.md patterns
```

## 📚 Documentation

- **[LLM_RULES.md](LLM_RULES.md)** (1366 lines): Comprehensive AI code generation rules
- **[ARCHITECTURE.md](ARCHITECTURE.md)** (1106 lines): Detailed architecture documentation
- **[.github/copilot-instructions.md](.github/copilot-instructions.md)**: Quick reference for critical rules

## 🛠️ Tech Stack

**Frontend:**

- React 18 + Vite 5
- TypeScript 5.3+
- Emotion (CSS-in-JS)
- Redux Toolkit + RTK Query
- React Hook Form + Zod
- react-i18next

**Backend:**

- NestJS 10.3+
- class-validator + class-transformer
- Winston (logging)
- Helmet (security)
- Terminus (health checks)

**Monorepo:**

- Nx workspace
- pnpm workspaces
- TypeScript project references

## 📋 Available Scripts

```bash
# Development
pnpm dev                  # Run API + Web concurrently
pnpm dev:api              # Run only NestJS backend
pnpm dev:web              # Run only React frontend

# Build
pnpm build                # Build all packages
pnpm build:ui             # Build UI package only
pnpm build:shared         # Build shared package only

# Code Quality
pnpm lint                 # Lint all packages
pnpm format               # Format all files
pnpm typecheck            # Type check all packages

# Testing
pnpm test                 # Run all tests
pnpm test:watch           # Run tests in watch mode
pnpm test:coverage        # Generate coverage report
```

## 🎯 Best Practices

### DO ✅

- Use `@repo/shared` for all domain types
- Follow Container/Component pattern
- Use UIContext for global state (modals, loading)
- Use ThemeProvider for dark/light mode
- Use Icon components (no inline SVG)
- Add `React.forwardRef` to form inputs
- Use `t('translation.key')` for all text
- Define API calls with RTK Query

### DON'T ❌

- Use `any` types
- Hardcode strings in JSX
- Use `fetch` or `axios` directly
- Use inline styles or inline SVG
- Duplicate types between frontend/backend
- Use local state for modals/loading
- Skip validation schemas in shared package
- Use old theme structure (`theme.tokens.*`)

## � Reference Implementation

The **`examples` module** is the **canonical reference** for all features in this template.

### 📍 Location

- **Backend**: `apps/api/src/modules/examples/`
- **Frontend**: `apps/web/src/features/examples/`
- **Shared**: `packages/shared/src/domain/example/`

### 🎓 What to Study

**Backend (`examples.controller.ts`, `examples.service.ts`)**:

- ✅ Complete CRUD implementation with in-memory store
- ✅ API versioning: `@Controller({ version: '1' })`
- ✅ class-validator DTOs with decorators
- ✅ Error handling with ErrorDTO
- ✅ Query params validation (pagination, search)

**Frontend (`ExamplesPage.container.tsx`, `ExamplesPage.component.tsx`)**:

- ✅ Container/Component pattern (smart vs dumb)
- ✅ RTK Query with cache invalidation (`providesTags`, `invalidatesTags`)
- ✅ UIContext usage (`showMessage`, `showLoading`, `hideLoading`)
- ✅ ThemeProvider with semantic tokens (`theme.colors.background.primary`)
- ✅ Icon components (`<Icon name="trash" />`)
- ✅ i18n translations (`t('examples.title')`)

**Form (`ExampleForm.component.tsx`)**:

- ✅ React Hook Form with Controller
- ✅ Zod validation schema from `@repo/shared`
- ✅ forwardRef on Input components
- ✅ Error handling with try/catch/finally

**Shared (`packages/shared/src/domain/example/`)**:

- ✅ Domain types (`ExampleItem`, `ExampleStatus`)
- ✅ Constants (`EXAMPLE_STATUS.ACTIVE`)
- ✅ DTOs for frontend/backend communication
- ✅ Zod schemas for validation

### 🚀 How to Use

**When creating a new feature (e.g., "products"):**

1. Copy the `examples` folder structure
2. Rename all files: `Example` → `Product`
3. Update types in `packages/shared/src/domain/product/`
4. Follow the exact same patterns

```bash
# Backend
cp -r apps/api/src/modules/examples apps/api/src/modules/products

# Frontend
cp -r apps/web/src/features/examples apps/web/src/features/products

# Shared
cp -r packages/shared/src/domain/example packages/shared/src/domain/product
```

**Or use Copilot Chat:**

```
@workspace Create a "Products" CRUD feature

Follow the exact structure from the examples module:
- Backend: apps/api/src/modules/examples/
- Frontend: apps/web/src/features/examples/
- Shared: packages/shared/src/domain/example/
```

## �🚀 Next Steps

1. **Read Documentation**: Start with [.github/copilot-instructions.md](.github/copilot-instructions.md)
2. **Install Extensions**: Accept VS Code extension recommendations
3. **Enable Copilot**: Ensure GitHub Copilot is active
4. **Create Feature**: Use `@workspace` in Copilot Chat to generate CRUD features
5. **Follow Patterns**: Use code snippets (`container`, `component`, `rtkapi`)

## 📄 License

MIT

---

**Template Version**: 3.0.0  
**Last Updated**: January 12, 2026PI Definition:\*\*

```typescript
// features/products/api/productsApi.ts
export const productsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getProducts: builder.query<GetProductsResponse, void>({
      query: () => ({ url: '/products', method: 'GET' }),
      providesTags: ['Product'],
    }),
    createProduct: builder.mutation<ProductItem, CreateProductRequest>({
      query: (body) => ({ url: '/products', method: 'POST', body }),
      invalidatesTags: ['Product'],
    }),
  }),
});
```

**Usage in Container:**

```typescript
const { data, isLoading } = useGetProductsQuery();
const [createProduct] = useCreateProductMutation();
```

### 🎯 Global UI State (UIContext)

**Never use local state for modals/loading:**

```typescript
// ✅ CORRECT - UIContext
import { useUI } from '@repo/ui';

const { showMessage, showLoading, hideLoading } = useUI();

try {
  showLoading({ message: t('common.loading') });
  await createProduct(data);
  showMessage({
    type: 'success',
    message: t('products.createSuccess'),
  });
} finally {
  hideLoading();
}

// ❌ WRONG - Local state
const [isLoading, setIsLoading] = useState(false);
const [message, setMessage] = useState('');
```

### 🎨 Icon System

**Use Icon component (no inline SVG):**

```tsx
// ✅ CORRECT
import { Icon } from '@repo/ui';
<Icon name="inbox" size={20} />

// ❌ WRONG
<svg>...</svg>
```

**Available icons**: inbox, calendar, chevron-right, trash, archive, alert-circle, moon, sun

### ✅ Form Validation (React Hook Form + Zod)

**Schema in Shared Package:**

```typescript
// packages/shared/src/schemas/product/createProduct.schema.ts
export const createProductSchema = z.object({
  name: z.string().min(1, 'validation.required'),
  price: z.number().positive('validation.positiveNumber'),
});
```

**Form with forwardRef:**

```tsx
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createProductSchema } from '@repo/shared';
import { Input } from '@repo/ui'; // Must use forwardRef

const { control, handleSubmit } = useForm({
  resolver: zodResolver(createProductSchema),
});

<Controller name="name" control={control} render={({ field }) => <Input {...field} />} />;
```

### 🔒 Backend Validation (class-validator)

**NestJS DTO:**

```typescript
import { IsString, IsNotEmpty, IsNumber, Min } from 'class-validator';

export class CreateProductDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsNumber()
  @Min(0)
  price: number;
}
```

### 📝 Domain Constants

**Define in Shared Package:**

````typescript
// packages/shared/src/domain/product/product.constants.ts
export const PRODUCT_STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  ARCHIVED: 'archived',
} as const;

export type ProductStatus = typeof PRODUCT_STATUS[keyof typeof PRODUCT_STATUS]
### Error Handling

Backend returns ErrorDTO:
```json
{
  "errorCode": "NOT_FOUND",
  "messageKey": "errors.example.notFound",
  "params": {}
}
````

Frontend uses `t(errorDTO.messageKey)` to display localized messages.

## Domain Constants

All domain string literals (e.g., 'active', 'archived') are defined as constants in `packages/shared/src/domain/*/`:

```ts
export const EXAMPLE_STATUS = {
  ACTIVE: 'active',
  ARCHIVED: 'archived',
} as const;
```

## Configuration Files

- **tsconfig.json**: Root TypeScript configuration with path mappings
- **.eslintrc.json**: Shared ESLint rules
- **.prettierrc**: Prettier formatting rules
- **pnpm-workspace.yaml**: Workspace definitions

## Next Steps

For detailed architecture rules and patterns, see [.github/copilot-instructions.md](.github/copilot-instructions.md).

## License

MIT
