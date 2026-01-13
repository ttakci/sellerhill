---
trigger: always_on
---

# GitHub Copilot Instructions

This is a **production-ready pnpm workspace monorepo** with strict architectural patterns. Follow these rules **WITHOUT EXCEPTION**.

## 🚨 CRITICAL RULES - NEVER VIOLATE

### 1️⃣ Type Safety (ZERO TOLERANCE)

- **ALL domain types MUST be in `packages/shared/src/domain/`**
- **NEVER** duplicate types between frontend/backend
- **NO** `any` types - use proper TypeScript types
- **NO** type assertions without validation

### 2️⃣ Validation (MANDATORY)

- **Frontend forms**: React Hook Form + Zod schemas from `packages/shared/src/schemas/`
- **Backend DTOs**: class-validator decorators
- **ALL schemas** MUST be in shared package
- Validation MUST happen on both frontend and backend

### 3️⃣ Component Architecture (STRICT)

- **Container/Component pattern REQUIRED**:
  - `[Feature]Page.container.tsx` - Smart component (data fetching, state)
  - `[Feature]Page.component.tsx` - Dumb component (presentation only)
- **NO logic in presentation components**
- **NO UI in container components**

### 4️⃣ Styling (EMOTION ONLY)

```typescript
// ✅ CORRECT - New semantic structure
background: ${({ theme }) => theme.colors.background.primary};
padding: ${({ theme }) => theme.spacing.md};
border-radius: ${({ theme }) => theme.radius.md};
box-shadow: ${({ theme }) => theme.shadows.sm};
font-size: ${({ theme }) => theme.typography.fontSize.md};

// ❌ WRONG - Old flat structure
background: ${({ theme }) => theme.tokens.colors.background};
padding: ${({ theme }) => theme.space.md};
```

**Available theme paths**:

- Colors: `theme.colors.{background|surface|text|border|semantic|brand}.{primary|secondary|...}`
- Spacing: `theme.spacing.{xs|sm|md|lg|xl|xxl|xxxl}`
- Radius: `theme.radius.{sm|md|lg|full}`
- Shadows: `theme.shadows.{sm|md|lg|xl}`
- Typography: `theme.typography.{fontSize|fontWeight|lineHeight}.{...}`
- Transitions: `theme.transitions.{fast|normal|slow}`

### 5️⃣ i18n (NO HARDCODED TEXT)

```typescript
// ✅ CORRECT
<Text>{t('examples.title')}</Text>
showMessage({ message: t('examples.createSuccess') });

// ❌ WRONG
<Text>Examples</Text>
showMessage({ message: 'Created successfully' });
```

**Translation keys** MUST be in `packages/shared/src/i18n/resources/{en|tr}/`

### 6️⃣ API Calls (RTK QUERY ONLY)

```typescript
// ✅ CORRECT - RTK Query
export const examplesApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getExamples: builder.query<GetExamplesResponse, void>({
      query: () => ({ url: '/examples', method: 'GET' }),
      providesTags: ['Example'],
    }),
  }),
});

// ❌ WRONG - Direct fetch/axios
const response = await fetch('/api/examples');
const response = await axios.get('/api/examples');
```

### 7️⃣ Icons (COMPONENT ONLY)

```tsx
// ✅ CORRECT
import { Icon } from '@repo/ui';
<Icon name="inbox" size={20} />

// ❌ WRONG
<svg>...</svg>
<i className="icon-inbox"></i>
```

**Available icons**: inbox, calendar, chevron-right, trash, archive, alert-circle, moon, sun

### 8️⃣ Form Components (forwardRef REQUIRED)

```typescript
// ✅ CORRECT
export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ value, onChange, ...props }, ref) => {
    return <S.InputField ref={ref} {...props} />;
  }
);
Input.displayName = 'Input';

// ❌ WRONG
export const Input = ({ value, onChange }: InputProps) => {
  return <S.InputField {...props} />;
};
```

### 9️⃣ Global UI State (UIContext ONLY)

```typescript
// ✅ CORRECT
const { showMessage, showLoading, hideLoading } = useUI();

try {
  showLoading({ message: t('common.loading') });
  await createExample(data);
  showMessage({
    type: 'success',
    message: t('examples.createSuccess'),
  });
} finally {
  hideLoading();
}

// ❌ WRONG
const [isLoading, setIsLoading] = useState(false);
const [message, setMessage] = useState('');
```

### 🔟 Theme System (REQUIRED)

```typescript
// ✅ CORRECT - main.tsx setup
<Provider store={store}>
  <ThemeProvider>
    <UIProvider>
      <App />
    </UIProvider>
  </ThemeProvider>
</Provider>

// ✅ CORRECT - Component usage
const { theme, themeMode, toggleTheme } = useTheme();
<ThemeToggle />

// ❌ WRONG
const [theme, setTheme] = useState('light');
```

---

## 📂 File Structure (STRICT PATTERN)

```
features/[feature]/
├── [Feature]Page.container.tsx    # Smart - RTK Query, useUI, useTheme
├── [Feature]Page.component.tsx    # Dumb - props only, no hooks
├── [Feature]Page.types.ts         # Local component types
├── [Feature]Page.style.ts         # Emotion styled-components
├── index.ts                       # Export container as default
├── api/
│   └── [feature]Api.ts            # RTK Query endpoints
├── adapters/
│   └── [feature]Adapter.ts        # DTO transformations
└── [SubComponent]/                # Sub-components follow same pattern
    ├── [SubComponent].component.tsx
    ├── [SubComponent].types.ts
    └── [SubComponent].style.ts
```

---

## ⚠️ PRE-CODE CHECKLIST

Before generating ANY code:

1. **Types**: Check if types exist in `packages/shared/src/domain/`
2. **Validation**: Check if schemas exist in `packages/shared/src/schemas/`
3. **i18n**: Verify translation keys are defined in `packages/shared/src/i18n/resources/`
4. **Components**: Use `@repo/ui` components (Button, Input, Label, Text, Icon)
5. **Patterns**: Follow Container/Component split
6. **Theme**: Use NEW semantic token structure (colors._, spacing._, etc.)
7. **Forms**: Add `React.forwardRef` to ALL form inputs
8. **API**: Use RTK Query, not fetch/axios
9. **State**: Use UIContext for modals/loading
10. **Icons**: Use Icon component, not inline SVG

---

## � REFERENCE IMPLEMENTATION (MANDATORY)

**The `examples` module is the CANONICAL REFERENCE for all code patterns.**

**Before creating ANY new feature, study these files:**

### Backend Reference: `apps/api/src/modules/examples/`

```
examples/
├── examples.controller.ts      # REST endpoints, class-validator
├── examples.service.ts         # Business logic
├── examples.module.ts          # NestJS module
└── dto/
    ├── create-example.dto.ts   # @IsString, @IsNotEmpty
    ├── update-example.dto.ts   # PartialType pattern
    └── list-examples.query.dto.ts
```

### Frontend Reference: `apps/web/src/features/examples/`

```
examples/
├── ExamplesPage.container.tsx  # RTK Query, useUI, useTheme
├── ExamplesPage.component.tsx  # Presentation only
├── ExamplesPage.style.ts       # Emotion + new theme
├── ExamplesPage.types.ts       # TypeScript interfaces
├── api/examplesApi.ts          # RTK Query endpoints
├── adapters/exampleAdapter.ts  # DTO transformations
├── ExampleList/                # Sub-component (same pattern)
└── ExampleForm/                # React Hook Form + forwardRef
```

### Shared Reference: `packages/shared/src/domain/example/`

```
example/
├── example.types.ts            # ExampleItem interface
├── example.constants.ts        # EXAMPLE_STATUS constants
├── example.dto.ts              # Request/Response DTOs
└── example.validators.ts       # Custom validators
```

**When Copilot generates code:**

```typescript
// @copilot: Follow the exact structure from apps/api/src/modules/examples/
// @copilot: Mirror the pattern in apps/web/src/features/examples/
// @copilot: Use domain types from packages/shared/src/domain/example/
```

---

## �🚫 FORBIDDEN PATTERNS

```typescript
// ❌ NEVER use 'any'
const data: any = response;

// ❌ NEVER hardcode strings
<Text>Click here</Text>

// ❌ NEVER use inline styles
<div style={{ color: 'red' }}>...</div>

// ❌ NEVER use old theme structure
theme.tokens.colors.text

// ❌ NEVER use fetch/axios directly
const response = await fetch('/api/examples');

// ❌ NEVER use inline SVG
<svg>...</svg>

// ❌ NEVER duplicate types
// types.ts in both frontend and backend

// ❌ NEVER use local state for modals/loading
const [isLoading, setIsLoading] = useState(false);

// ❌ NEVER use styled-components package
import styled from 'styled-components';
```

---

## 📖 Full Documentation

For complete architectural guidelines, design patterns, and detailed examples:

- **LLM_RULES.md** - Comprehensive rules (1366 lines)
- **ARCHITECTURE.md** - Architecture documentation (1106 lines)

---

## 🎯 Code Generation Examples

### Example 1: Create New Feature

```typescript
// STEP 1: Define types in packages/shared/src/domain/product/
export interface Product {
  id: string;
  name: string;
  price: number;
  status: 'active' | 'inactive';
}

// STEP 2: Create schema in packages/shared/src/schemas/product/
export const createProductSchema = z.object({
  name: z.string().min(1),
  price: z.number().positive(),
});

// STEP 3: Add i18n keys in packages/shared/src/i18n/resources/en/
{
  "products": {
    "title": "Products",
    "createSuccess": "Product created successfully"
  }
}

// STEP 4: Create RTK Query API
export const productsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getProducts: builder.query<GetProductsResponse, void>({
      query: () => ({ url: '/products', method: 'GET' }),
      providesTags: ['Product'],
    }),
  }),
});

// STEP 5: Create Container
export const ProductsPageContainer = (): React.ReactElement => {
  const { t } = useTranslation();
  const { showMessage } = useUI();
  const { data } = useGetProductsQuery();

  return <ProductsPageComponent products={data?.items ?? []} />;
};

// STEP 6: Create Component
export const ProductsPageComponent = ({
  products
}: ProductsPageProps): React.ReactElement => {
  const { t } = useTranslation();

  return (
    <S.Container>
      <S.Title>{t('products.title')}</S.Title>
      {/* UI elements only */}
    </S.Container>
  );
};
```

---

## ✅ Success Criteria

Code is acceptable ONLY if:

- ✅ Zero `any` types
- ✅ Zero hardcoded strings
- ✅ All types from `@repo/shared`
- ✅ Container/Component split
- ✅ RTK Query for API calls
- ✅ UIContext for modals/loading
- ✅ ThemeProvider setup
- ✅ Icon components (no inline SVG)
- ✅ forwardRef on form inputs
- ✅ New semantic theme structure
- ✅ i18n for all user-facing text

**If ANY rule is violated, the code is REJECTED.**

---

**Template Version**: 3.0.0  
**Last Updated**: January 12, 2026
