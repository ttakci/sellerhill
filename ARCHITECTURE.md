# 🏗️ Project Architecture Documentation

> **Purpose**: Complete architectural guide for AI/LLM code generation and human developers

## 📋 Table of Contents

1. [Project Overview](#project-overview)
2. [Technology Stack](#technology-stack)
3. [Monorepo Structure](#monorepo-structure)
4. [Architecture Patterns](#architecture-patterns)
5. [Data Flow](#data-flow)
6. [API Design](#api-design)
7. [Frontend Architecture](#frontend-architecture)
8. [Shared Package System](#shared-package-system)
9. [Type Safety Strategy](#type-safety-strategy)
10. [Error Handling](#error-handling)
11. [Security & Best Practices](#security--best-practices)
12. [Development Workflow](#development-workflow)

---

## 🎯 Project Overview

### **What is this?**

Production-ready, enterprise-grade monorepo template for building full-stack TypeScript applications.

### **Design Philosophy**

- **Type-Safe End-to-End**: Single source of truth for types
- **DRY (Don't Repeat Yourself)**: Shared code across frontend/backend
- **Platform-Agnostic**: Works with web and React Native
- **Scalable**: pnpm workspace monorepo with independent deployments
- **Production-Ready**: Best practices, security, monitoring built-in

### **Target Use Cases**

- SaaS applications
- Enterprise web apps
- Mobile + Web apps (React Native compatible)
- Microservices architecture
- Rapid MVP development

---

## 🛠️ Technology Stack

### **Monorepo Management**

- **pnpm Workspaces**: Dependency management, task orchestration
- **pnpm**: Fast, disk-efficient package manager
- **TypeScript 5.3+**: Type safety across entire stack

### **Backend (apps/api)**

```yaml
Framework: NestJS 10.3+
Language: TypeScript
Runtime: Node.js 20+
API Docs: Swagger/OpenAPI
Validation: class-validator + class-transformer
Testing: Jest
Key Libraries:
  - @nestjs/throttler: Rate limiting
  - @nestjs/terminus: Health checks
  - @nestjs/config: Environment validation
  - helmet: Security headers
  - compression: Response compression
  - winston: Structured logging
```

### **Frontend (apps/web)**

```yaml
Framework: React 18
Build Tool: Vite 5
State Management: Redux Toolkit + RTK Query
Styling: Emotion (CSS-in-JS)
Forms: React Hook Form + Zod
i18n: i18next
Routing: React Router v6
Testing: Vitest + React Testing Library
```

### **Shared Packages**

```yaml
packages/shared:
  - DTOs (Data Transfer Objects)
  - Validation schemas (Zod)
  - Constants
  - Types
  - i18n translations
  - Utility functions

packages/ui:
  - Reusable React components
  - Design system (Emotion)
  - Theme system (light/dark mode)
  - Design tokens & semantic colors
  - Atomic design pattern
  - Global UI context (modals, loading)
  - Icon components (React functional components)
  - Icon wrapper (div) to prevent leaking transient props to SVG elements


packages/mcp:
  - Model Context Protocol (future use)
```

---

## 🎨 Design System & Theme Architecture

### **Theme System Overview**

```typescript
// Dual theme support with automatic switching
Provider Hierarchy:
  ThemeProvider (light/dark mode)
    └── UIProvider (global modals, loading)
        └── App
```

**Features:**

- ✅ Light & Dark mode
- ✅ localStorage persistence
- ✅ System preference detection (prefers-color-scheme)
- ✅ Smooth transitions
- ✅ Platform-agnostic (Web + Mobile)

---

## 📂 Monorepo Structure

```
project-root/
├── apps/
│   ├── api/                    # NestJS Backend
│   │   ├── src/
│   │   │   ├── main.ts         # App entry point
│   │   │   ├── app.module.ts   # Root module
│   │   │   ├── common/         # Shared utilities
│   │   │   │   ├── config/     # Configuration (logger, env validation)
│   │   │   │   ├── filters/    # Exception filters
│   │   │   │   ├── interceptors/ # Logging, transform interceptors
│   │   │   │   └── middlewares/ # Request ID middleware
│   │   │   ├── health/         # Health check module
│   │   │   └── modules/        # Feature modules
│   │   │       └── examples/   # Example CRUD module
│   │   │           ├── examples.controller.ts
│   │   │           ├── examples.service.ts
│   │   │           ├── examples.module.ts
│   │   │           └── dto/    # Request/Response DTOs
│   │   └── test/               # E2E tests
│   │
│   └── web/                    # React Frontend
│       ├── src/
│       │   ├── main.tsx        # App entry point
│       │   ├── App.tsx         # Root component
│       │   ├── app/
│       │   │   └── store.ts    # Redux store
│       │   ├── features/       # Feature modules
│       │   │   └── examples/   # Example feature
│       │   │       ├── ExamplesPage.container.tsx  # Smart component
│       │   │       ├── ExamplesPage.component.tsx  # Dumb component
│       │   │       ├── ExamplesPage.types.ts
│       │   │       ├── ExamplesPage.style.ts
│       │   │       ├── api/
│       │   │       │   └── examplesApi.ts  # RTK Query API
│       │   │       ├── adapters/
│       │   │       │   └── exampleAdapter.ts  # Data transformation
│       │   │       ├── ExampleForm/
│       │   │       │   ├── ExampleForm.component.tsx
│       │   │       │   ├── ExampleForm.types.ts
│       │   │       │   └── ExampleForm.style.ts
│       │   │       └── ExampleList/
│       │   │           └── ...
│       │   ├── pages/          # Route pages
│       │   ├── services/       # Base API service
│       │   └── utils/          # Error handlers, helpers
│       └── public/
│
├── packages/
│   ├── shared/                 # Shared code (Backend + Frontend)
│   │   ├── src/
│   │   │   ├── domain/         # Business domain logic
│   │   │   │   ├── common/     # Common validators, DTOs
│   │   │   │   └── example/    # Example domain
│   │   │   │       ├── example.dto.ts       # DTOs
│   │   │   │       ├── example.types.ts     # Types
│   │   │   │       ├── example.validators.ts
│   │   │   │       └── example.constants.ts
│   │   │   ├── schemas/        # Zod validation schemas
│   │   │   │   ├── common/     # Form utilities
│   │   │   │   └── example/    # Example schemas
│   │   │   │       ├── createExample.schema.ts
│   │   │   │       ├── updateExample.schema.ts
│   │   │   │       └── listExamples.schema.ts
│   │   │   ├── i18n/           # Translations
│   │   │   │   └── resources/
│   │   │   │       ├── en/
│   │   │   │       └── tr/
│   │   │   ├── types/          # Global types
│   │   │   └── utils/          # Utility functions
│   │   └── dist/               # Built outputs (ESM, CJS, Types)
│   │
│   ├── ui/                     # UI Component Library
│   │   ├── src/
│   │   │   ├── atoms/          # Atomic components
│   │   │   │   ├── Button/
│   │   │   │   ├── Input/
│   │   │   │   ├── Label/
│   │   │   │   └── Text/
│   │   │   └── theme/          # Design tokens
│   │   │       ├── theme.ts
│   │   │       ├── tokens.ts
│   │   │       └── styled.d.ts
│   │   └── dist/
│   │
│   └── mcp/                    # Model Context Protocol (future)
│
├── .github/                    # CI/CD workflows (future)
├── docs/                       # Additional documentation (future)
├── package.json                # Root workspace config
├── pnpm-workspace.yaml         # pnpm workspace definition
└── tsconfig.json               # Root TypeScript config
```

---

## 🏛️ Architecture Patterns

### **1. Monorepo Pattern**

```
┌─────────────────────────────────────────────────┐
│              pnpm Workspace                     │
├─────────────────────────────────────────────────┤
│                                                 │
│  ┌─────────┐  ┌─────────┐  ┌────────────────┐ │
│  │   API   │  │   Web   │  │    Packages    │ │
│  │ (NestJS)│  │ (React) │  │ shared/ui/mcp  │ │
│  └────┬────┘  └────┬────┘  └───────┬────────┘ │
│       │            │                │          │
│       └────────────┴────────────────┘          │
│              Depends on Shared                 │
└─────────────────────────────────────────────────┘
```

**Benefits:**

- ✅ Code sharing without npm publishing
- ✅ Atomic commits across apps
- ✅ Type safety across boundaries
- ✅ Unified versioning

### **2. Clean Architecture (Backend)**

```
┌─────────────────────────────────────────┐
│         Presentation Layer              │
│  (Controllers, DTOs, Guards)            │
├─────────────────────────────────────────┤
│         Application Layer               │
│  (Services, Use Cases)                  │
├─────────────────────────────────────────┤
│         Domain Layer                    │
│  (Entities, Business Logic)             │
├─────────────────────────────────────────┤
│         Infrastructure Layer            │
│  (Database, External APIs)              │
└─────────────────────────────────────────┘
```

**Example:**

```typescript
// Controller (Presentation)
@Controller('examples')
export class ExamplesController {
  @Post()
  create(@Body() dto: CreateExampleRequestDto) {
    return this.service.create(dto);
  }
}

// Service (Application)
@Injectable()
export class ExamplesService {
  create(dto: CreateExampleRequestDto): ExampleItem {
    // Business logic here
    return this.repository.save(dto);
  }
}

// Repository (Infrastructure) - Future DB integration
```

### **3. Container/Component Pattern (Frontend)**

```
┌─────────────────────────────────────────┐
│         Container (Smart)               │
│  - Data fetching (RTK Query)            │
│  - State management                     │
│  - Business logic                       │
│  - Error handling                       │
└───────────────┬─────────────────────────┘
                │ Props
                ▼
┌─────────────────────────────────────────┐
│         Component (Dumb)                │
│  - Presentation only                    │
│  - No side effects                      │
│  - Receives data via props              │
│  - Emits events via callbacks           │
└─────────────────────────────────────────┘
```

**Example:**

```typescript
// CONTAINER (Smart Component)
export const ExamplesPageContainer = () => {
  // Data fetching
  const { data, isLoading } = useGetExamplesQuery({ page: 1 });
  const [createExample] = useCreateExampleMutation();

  // Business logic
  const handleCreate = (formData) => {
    const request = toCreateExampleRequest(formData);
    createExample(request);
  };

  // Render dumb component
  return (
    <ExamplesPageComponent
      examples={data?.items || []}
      isLoading={isLoading}
      onCreateExample={handleCreate}
    />
  );
};

// COMPONENT (Dumb Component)
export const ExamplesPageComponent = (props) => {
  return (
    <div>
      <ExampleList items={props.examples} />
      <ExampleForm onSubmit={props.onCreateExample} />
    </div>
  );
};
```

### **4. Adapter Pattern (Data Transformation)**

```typescript
// Backend → Frontend transformation
export const toExampleItem = (dto: ExampleDto): ExampleItem => ({
  id: dto.id,
  name: dto.name,
  createdAt: new Date(dto.createdAt),
});

// Frontend → Backend transformation
export const toCreateExampleRequest = (formData: CreateExampleFormData): CreateExampleRequest => ({
  name: formData.name.trim(),
});
```

---

## 🔄 Data Flow

### **Complete Request/Response Flow**

```
┌─────────────────────────────────────────────────────────────┐
│ 1. USER INTERACTION                                         │
│    User fills form and clicks "Create"                      │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. FORM COMPONENT (ExampleForm.component.tsx)               │
│    - React Hook Form validates with Zod schema             │
│    - Calls: props.onSubmit(formData)                        │
└────────────────────┬────────────────────────────────────────┘
                     │ CreateExampleFormData
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. CONTAINER (ExamplesPage.container.tsx)                   │
│    - Transforms form data → API request                     │
│    - const request = toCreateExampleRequest(formData)       │
│    - Calls RTK Query mutation: createExample(request)       │
└────────────────────┬────────────────────────────────────────┘
                     │ CreateExampleRequest
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. RTK QUERY API (examplesApi.ts)                           │
│    - Adds headers (X-Request-ID, Authorization)             │
│    - POST /api/v1/examples                                  │
│    - Body: { name: "..." }                                  │
└────────────────────┬────────────────────────────────────────┘
                     │ HTTP Request
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ 5. BACKEND MIDDLEWARE (NestJS)                              │
│    - RequestIdMiddleware: Generate/extract request ID       │
│    - ThrottlerGuard: Rate limiting check                    │
│    - ValidationPipe: Validate DTO with class-validator      │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ 6. CONTROLLER (examples.controller.ts)                      │
│    @Post()                                                  │
│    create(@Body() dto: CreateExampleRequestDto) {           │
│      return this.service.create(dto);                       │
│    }                                                        │
└────────────────────┬────────────────────────────────────────┘
                     │ CreateExampleRequestDto
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ 7. SERVICE (examples.service.ts)                            │
│    - Business logic                                         │
│    - Create example entity                                  │
│    - Return: ExampleItem                                    │
└────────────────────┬────────────────────────────────────────┘
                     │ ExampleItem
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ 8. INTERCEPTOR (LoggingInterceptor)                         │
│    - Log response with request ID                           │
│    - Transform response                                     │
└────────────────────┬────────────────────────────────────────┘
                     │ HTTP Response
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ 9. RTK QUERY (Frontend)                                     │
│    - Receives response                                      │
│    - Updates cache                                          │
│    - Triggers re-render                                     │
└────────────────────┬────────────────────────────────────────┘
                     │ ExampleItem
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ 10. CONTAINER (ExamplesPage.container.tsx)                  │
│     - onSuccess: Show success message                       │
│     - Update UI with new data                               │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ 11. UI UPDATE                                               │
│     - Form resets                                           │
│     - New item appears in list                              │
│     - Success toast shown                                   │
└─────────────────────────────────────────────────────────────┘
```

---

## 🌐 API Design

### **RESTful Conventions**

```typescript
// Resource: /api/v1/examples
GET    /api/v1/examples          → List all (paginated)
GET    /api/v1/examples/:id      → Get one by ID
POST   /api/v1/examples          → Create new
PATCH  /api/v1/examples/:id      → Update existing
DELETE /api/v1/examples/:id      → Delete by ID
```

### **Request/Response Standards**

```typescript
// REQUEST
POST /api/v1/examples
Headers:
  Content-Type: application/json
  Authorization: Bearer <token>
  X-Request-ID: req_abc123...
Body:
  {
    "name": "Example Name"
  }

// SUCCESS RESPONSE (201 Created)
{
  "id": "123",
  "name": "Example Name",
  "createdAt": "2026-01-11T19:00:00Z",
  "updatedAt": "2026-01-11T19:00:00Z"
}

// ERROR RESPONSE (400 Bad Request)
{
  "statusCode": 400,
  "timestamp": "2026-01-11T19:00:00Z",
  "path": "/api/v1/examples",
  "method": "POST",
  "message": "Validation failed",
  "error": "Bad Request",
  "errorCode": "validation.minLength",  // i18n key
  "details": { "min": 3 },              // i18n params
  "requestId": "req_abc123..."          // Correlation ID
}
```

### **Versioning Strategy**

```typescript
// URI-based versioning (current)
/api/v1/examples
/api/v2/examples  // Future version

// Controller configuration
@Controller({ path: 'examples', version: '1' })
```

---

## 🎨 Frontend Architecture

### **State Management Strategy**

```typescript
// GLOBAL STATE (Redux Toolkit)
// - User authentication
// - Global UI state (modals, toasts)
// - Theme preferences

// SERVER STATE (RTK Query)
// - API data caching
// - Automatic refetching
// - Optimistic updates

// LOCAL STATE (React useState/useReducer)
// - Form state (React Hook Form)
// - Component UI state
// - Temporary data
```

### **Component Hierarchy**

```
App (Router)
  ├── Pages (Routes)
  │     └── ExamplesPage
  │           └── ExamplesPageContainer (Smart)
  │                 └── ExamplesPageComponent (Dumb)
  │                       ├── ExampleList
  │                       │     └── ExampleListItem
  │                       └── ExampleForm
  │                             ├── Input (UI package)
  │                             ├── Button (UI package)
  │                             └── Label (UI package)
  └── Global Components
        ├── MessageModal
        └── ErrorBoundary
```

### **Styling Strategy**

```typescript
// Emotion CSS-in-JS (Strictly enforced)
export const Container = styled.div`
  display: flex;
  flex-direction: column;
  padding: ${({ theme }) => theme.spacing.md};
  background: ${({ theme }) => theme.colors.background.primary};
`;

// Theme tokens (packages/ui/src/theme/designTokens.ts)
// TailAdmin-inspired semantic structure
export const theme = {
  colors: {
    brand: { primary: '#3C50E0', ... },
    background: { primary: '#FFFFFF', ... },
    // ...
  },
  // ...
};
```

---

## 📦 Shared Package System

### **Package: @repo/shared**

**Purpose**: Single source of truth for types, DTOs, validation schemas

**Structure:**

```typescript
// Domain Objects (DTOs)
export interface ExampleDto {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

// Request/Response Types
export interface CreateExampleRequest {
  name: string;
}

export interface GetExamplesResponse {
  items: ExampleItem[];
  total: number;
  page: number;
  pageSize: number;
}

// Validation Schemas (Zod)
export const createExampleFormDataSchema = (t: TFunction) =>
  z.object({
    name: z.string().min(3).max(50),
  });

// Constants
export const EXAMPLE_CONSTANTS = {
  MAX_NAME_LENGTH: 50,
  MIN_NAME_LENGTH: 3,
} as const;
```

**Build Output:**

```
packages/shared/dist/
  ├── esm/       # ES Modules (for frontend)
  ├── cjs/       # CommonJS (for backend)
  └── types/     # TypeScript declarations
```

### **Package: @repo/ui**

**Purpose**: Reusable UI components, design system

**Atomic Design:**

```
Atoms → Input, Button, Label, Text, Icon (Base components, forwardRef)
Molecules → TextInput, SelectInput, ThemeToggle, GeneralMessage, GeneralLoading
            (Controller-wrapped atoms + logic + layout)
Organisms → Header, Footer, Navigation
Templates → PageLayout
Pages → (in apps/web)
```

**Form Input Molecules Pattern:**

```typescript
// Atom: Input (packages/ui/src/atoms/Input/)
export const Input = React.forwardRef<HTMLInputElement, InputProps>((props, ref) => {
  return <S.InputField ref={ref} {...props} />;
});

// Molecule: TextInput (packages/ui/src/molecules/TextInput/)
export const TextInput = <TFieldValues extends FieldValues = FieldValues>({
  name,
  control,
  label,
  type = 'text',
  ...props
}: TextInputProps<TFieldValues>) => {
  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState: { error } }) => (
        <S.Container>
          {label && <Text as="label" variant="body" weight="medium">{label}</Text>}
          <Input {...field} type={type} hasError={!!error} {...props} />
          {error && <S.ErrorText>{error.message}</S.ErrorText>}
        </S.Container>
      )}
    />
  );
};

// Usage in Forms
<TextInput
  name="email"
  control={control}
  label={t('auth.emailLabel')}
  type="email"
  disabled={isLoading}
/>
```

**Benefits:**

- ✅ Single line per field (Label + Input + Error)
- ✅ Controller pattern enforced everywhere
- ✅ Consistent error handling
- ✅ Type-safe field name binding

### **Theme Token Structure**

```typescript
// Design Tokens (packages/ui/src/theme/designTokens.ts)
export const colorTokens = {
  primary: { 50: '#E3F2FD', 500: '#2196F3', 900: '#0D47A1' },
  neutral: { 0: '#FFFFFF', 500: '#9E9E9E', 900: '#212121', 1000: '#000000' },
  success: { light: '#4CAF50', main: '#2E7D32' },
  error: { light: '#EF5350', main: '#D32F2F' },
  // ...
};

// Semantic Colors (packages/ui/src/theme/themes.ts)
const lightColors: ThemeColors = {
  background: { primary: '#FFFFFF', secondary: '#FAFAFA' },
  surface: { primary: '#FFFFFF', secondary: '#FAFAFA' },
  text: { primary: '#212121', secondary: '#757575' },
  border: { primary: '#E0E0E0', focus: '#2196F3' },
  semantic: { success, error, warning, info },
  brand: { primary: '#2196F3', primaryHover: '#1976D2' },
};

const darkColors: ThemeColors = {
  background: { primary: '#1A222C', secondary: '#1C2434', tertiary: '#1B2430' },
  surface: { primary: '#24303F', secondary: '#1B2430' },
  // ...
};

// Usage in Components
const Container = styled.div`
  background: ${({ theme }) => theme.colors.background.primary};
  padding: ${({ theme }) => theme.spacing.md};
  border-radius: ${({ theme }) => theme.radius.lg};
  box-shadow: ${({ theme }) => theme.shadows.md};
`;
```

### **Global UI State Management**

```typescript
// UIContext for global modals and loading
import { useUI } from '@repo/ui';

const Component = () => {
  const { showMessage, showLoading, hideLoading } = useUI();

  const handleSubmit = async () => {
    showLoading({ overlay: true });
    try {
      await api.create(data);
      showMessage(
        {
          type: 'success',
          headerKey: 'success',
          descriptionKey: 'exampleCreated',
        },
        t
      );
    } finally {
      hideLoading();
    }
  };
};
```

### **Icon System**

```typescript
// Icon components as separate .tsx files
import { Icon } from '@repo/ui';

<Icon name="inbox" size={48} />
<Icon name="calendar" size={20} />
<Icon name="moon" size={20} /> // Theme toggle
<Icon name="sun" size={20} />

// Available icons:
// inbox, calendar, chevron-right, trash, archive,
// alert-circle, moon, sun, menu, user

```

---

## 🔒 Type Safety Strategy

### **End-to-End Type Flow**

```typescript
// 1. BACKEND DTO (packages/shared)
export class CreateExampleRequestDto {
  @IsString()
  @MinLength(3)
  @MaxLength(50)
  name: string;
}

// 2. FRONTEND TYPE (packages/shared)
export interface CreateExampleRequest {
  name: string;
}

// 3. FORM DATA (packages/shared)
export interface CreateExampleFormData {
  name: string;
}

// 4. ZOD SCHEMA (packages/shared)
export const createExampleFormDataSchema = (t) =>
  z.object({
    name: z.string().min(3).max(50),
  });

// 5. TYPE INFERENCE
type CreateExampleFormData = z.infer<typeof createExampleFormDataSchema>;
```

**Benefits:**

- ✅ Change DTO once → Frontend auto-updates
- ✅ Compile-time errors if types don't match
- ✅ Autocomplete in IDE
- ✅ Refactoring safety

---

## ⚠️ Error Handling

### **Backend Error Flow**

```typescript
// 1. Custom Exception Filter
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();

    // Extract request ID
    const requestId = request.headers['x-request-id'];

    // Build error response
    const errorResponse: ApiErrorResponse = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      message: exception.message,
      error: exception.name,
      errorCode: 'error.validation', // i18n key
      details: { field: 'name' }, // i18n params
      requestId,
    };

    response.status(status).json(errorResponse);
  }
}
```

### **Frontend Error Flow**

```typescript
// 1. RTK Query Error
const [createExample, { error }] = useCreateExampleMutation();

// 2. Error Handler Utility
const { key, params } = getErrorMessage(error);
// key = 'validation.minLength'
// params = { min: 3 }

// 3. Display Error
showMessage({
  type: 'error',
  headerKey: 'message.error.header',
  descriptionKey: key,
  descriptionParams: params,
});

// 4. i18n Translation
t('validation.minLength', { min: 3 });
// → "Minimum 3 characters required"
```

---

## 🔐 Security & Best Practices

### **Implemented Security Features**

```typescript
// 1. Rate Limiting (3-tier)
ThrottlerModule.forRoot([
  { name: 'short', ttl: 1000, limit: 10 },    // 10/sec
  { name: 'medium', ttl: 60000, limit: 100 }, // 100/min
  { name: 'long', ttl: 3600000, limit: 1000 }, // 1000/hr
]);

// 2. Security Headers (Helmet)
app.use(helmet({
  contentSecurityPolicy: { /* ... */ },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
}));

// 3. CORS Configuration
app.enableCors({
  origin: allowedOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
  exposedHeaders: ['X-Request-ID', 'X-RateLimit-Remaining'],
  maxAge: 86400,
});

// 4. Request ID Correlation
RequestIdMiddleware → Generates UUID for each request

// 5. Environment Validation
ConfigModule.forRoot({
  validate: validateEnv, // class-validator schema
});

// 6. Input Validation
@Post()
create(@Body() dto: CreateExampleRequestDto) {
  // Auto-validated by ValidationPipe
}

// 7. Response Compression
app.use(compression({
  threshold: 1024, // 1KB
  filter: (req, res) => !req.headers['x-no-compression'],
}));

// 8. Graceful Shutdown
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);
```

### **Health Checks**

```typescript
// Kubernetes-ready health endpoints
GET / api / v1 / health; // Full health check
GET / api / v1 / health / live; // Liveness probe
GET / api / v1 / health / ready; // Readiness probe
```

---

## 🔧 Development Workflow

### **Adding a New Feature**

```bash
# 1. Create shared types/DTOs
packages/shared/src/domain/feature/
  ├── feature.dto.ts
  ├── feature.types.ts
  ├── feature.validators.ts
  └── feature.constants.ts

# 2. Create validation schemas
packages/shared/src/schemas/feature/
  ├── createFeature.schema.ts
  ├── updateFeature.schema.ts
  └── listFeatures.schema.ts

# 3. Build shared package
pnpm --filter shared build

# 4. Create backend module
apps/api/src/modules/feature/
  ├── feature.controller.ts
  ├── feature.service.ts
  ├── feature.module.ts
  └── dto/

# 5. Create frontend feature
apps/web/src/features/feature/
  ├── FeaturePage.container.tsx
  ├── FeaturePage.component.tsx
  ├── FeaturePage.types.ts
  ├── FeaturePage.style.ts
  ├── api/
  │   └── featureApi.ts
  ├── adapters/
  │   └── featureAdapter.ts
  └── components/
      ├── FeatureForm/
      └── FeatureList/

# 6. Add i18n translations
packages/shared/src/i18n/resources/en/feature.json
packages/shared/src/i18n/resources/tr/feature.json

# 7. Test & Run
pnpm dev  # Runs API + Web concurrently
```

### **Common Commands**

```bash
# Install dependencies
pnpm install

# Development
pnpm dev                    # Run all apps
pnpm --filter api dev       # Run API only
pnpm --filter web dev       # Run Web only

# Build
pnpm build                  # Build all
pnpm --filter shared build  # Build shared package
pnpm --filter api build     # Build API

# Test
pnpm test                   # Run all tests
pnpm --filter api test      # API tests only

# Lint
pnpm lint                   # Lint all
pnpm lint:fix               # Auto-fix issues

# Type check
pnpm type-check

# Clean
pnpm clean                  # Remove node_modules, dist
```

---

## 📊 Performance Optimization

### **Backend**

- ✅ Response compression (gzip/brotli)
- ✅ Request ID for distributed tracing
- ✅ Structured logging (Winston)
- ✅ Memory health checks

### **Frontend**

- ✅ Code splitting (Vite)
- ✅ RTK Query caching
- ✅ Lazy loading routes
- UI Library: Emotion CSS-in-JS, Atomic Design, TailAdmin Aesthetics

---

## 🚀 Deployment Strategy

### **Backend (NestJS API)**

```yaml
Environment: Node.js 20+
Build: pnpm --filter api build
Start: node dist/main.js
Port: 3000
Health: /api/v1/health/ready
```

### **Frontend (React)**

```yaml
Environment: Static hosting (Vercel, Netlify, S3)
Build: pnpm --filter web build
Output: apps/web/dist/
Serve: Any static server
```

### **Environment Variables**

```env
# API
NODE_ENV=production
PORT=3000
CORS_ORIGINS=https://app.example.com
DATABASE_URL=postgresql://...
JWT_SECRET=...

# Web
VITE_API_URL=https://api.example.com
```

---

## 📚 Key Conventions

### **File Naming**

```
PascalCase: Components, Classes
camelCase: Functions, variables
kebab-case: File names (except React components)
SCREAMING_SNAKE_CASE: Constants
```

### **Code Organization**

```
- Feature-based folders (not technical)
- Colocation (keep related files together)
- Index files for public API
- Separate types, styles, logic
```

### **Import Order**

```typescript
// 1. External libraries
import React from 'react';
import { useForm } from 'react-hook-form';

// 2. Internal packages
import { Button } from '@repo/ui';
import { CreateExampleFormData } from '@repo/shared';

// 3. Relative imports
import * as S from './Component.style';
import { ComponentProps } from './Component.types';
```

---

## 🎯 Summary

This architecture provides:

✅ **Type Safety**: End-to-end TypeScript
✅ **Code Reuse**: Shared packages
✅ **Scalability**: Monorepo with pnpm workspaces
✅ **Production-Ready**: Security, logging, health checks
✅ **Developer Experience**: Fast builds, hot reload, autocomplete
✅ **Platform-Agnostic**: Web + Mobile ready
✅ **Best Practices**: Clean architecture, SOLID principles
✅ **Error Handling**: Standardized, i18n-ready
✅ **Testable**: Unit + E2E test structure
✅ **Theme System**: Dark/light mode with persistence
✅ **UI Context**: Global modals and loading states

**Perfect for**: Enterprise apps, SaaS products, MVPs, full-stack TypeScript projects

---

**Last Updated**: January 12, 2026  
**Version**: 3.0.0

**Latest Features** (v3.1.0):

- ✅ **Emotion Migration**: Removed `styled-components` in favor of `@emotion/styled` and `@emotion/react`.
- ✅ **TailAdmin UI**: Integrated premium dashboard layout with Sidebar and Header.
- ✅ Dark/Light mode theme system with localStorage persistence.
- ✅ Global UIContext for modals and loading states.
- ✅ Icon atom components (SVG as React components).
- ✅ Semantic color tokens (background, surface, text, border, semantic, brand).
- ✅ forwardRef support for form components (React Hook Form integration).
