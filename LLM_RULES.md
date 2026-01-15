# 🤖 LLM Development Rules & Guidelines

> **Purpose**: System prompt / rules for AI code generation to maintain architecture consistency

## 🎯 Core Principles

You are generating code for a **production-ready pnpm workspace monorepo** with the following stack:

- **Backend**: NestJS 10+ (TypeScript)
- **Frontend**: React 18 + Vite + Redux Toolkit
- **Shared**: Type-safe DTOs, schemas, i18n
- **UI Library**: Emotion CSS-in-JS, Atomic Design

**CRITICAL**: Always maintain type safety, DRY principles, and separation of concerns.

---

## 📋 MANDATORY RULES

### ✅ RULE 1: Single Source of Truth for Types

**ALL types, DTOs, interfaces MUST be defined in `packages/shared`**

```typescript
// ❌ WRONG - Defining types in API
// apps/api/src/modules/users/users.types.ts
export interface User {
  id: string;
  name: string;
}

// ✅ CORRECT - Define in shared package
// packages/shared/src/domain/user/user.dto.ts
export interface UserDto {
  id: string;
  name: string;
  email: string;
  createdAt: string;
}

// ✅ CORRECT - Define request/response types
// packages/shared/src/domain/user/user.types.ts
export interface CreateUserRequest {
  name: string;
  email: string;
}

export interface GetUsersResponse {
  items: UserItem[];
  total: number;
  page: number;
  pageSize: number;
}
```

**WHY**: Frontend and backend must share the exact same types. No duplication.

---

### ✅ RULE 2: Validation Schemas in Shared Package

**ALL Zod schemas MUST be in `packages/shared/src/schemas`**

```typescript
// ✅ CORRECT
// packages/shared/src/schemas/user/createUser.schema.ts
import { z } from 'zod';
import type { TFunction } from 'i18next';

export const createUserFormDataSchema = (t: TFunction) =>
  z.object({
    name: z
      .string()
      .min(3, { message: t('validation.minLength', { min: 3 }) })
      .max(50, { message: t('validation.maxLength', { max: 50 }) }),
    email: z.string().email({ message: t('validation.email') }),
  });

// Type inference
export type CreateUserFormData = z.infer<ReturnType<typeof createUserFormDataSchema>>;
```

**WHY**: Frontend forms and backend validators use the same schema. Single source of truth.

---

## 📖 REFERENCE IMPLEMENTATION (MANDATORY STUDY)

**Before generating ANY code, you MUST study the `examples` module as the reference implementation.**

### Backend Reference: `apps/api/src/modules/examples/`

**File Structure:**

```
examples/
├── examples.controller.ts      # REST endpoints with @Controller({ version: '1' })
├── examples.service.ts         # Business logic with in-memory store
├── examples.module.ts          # Module definition
└── dto/
    ├── create-example.dto.ts   # class-validator decorators
    ├── update-example.dto.ts   # PartialType(CreateExampleDto)
    └── list-examples.query.dto.ts # Query params with @IsOptional
```

**Key Patterns to Copy:**

- ✅ API versioning: `@Controller({ path: 'examples', version: '1' })`
- ✅ Validation pipe: `@UsePipes(new ValidationPipe({ transform: true }))`
- ✅ DTOs implement shared types: `implements CreateExampleRequest`
- ✅ Service methods return domain types from `@repo/shared`
- ✅ Error handling with ErrorDTO: `throw new NotFoundException(errorDTO)`

### Frontend Reference: `apps/web/src/features/examples/`

**File Structure:**

```
examples/
├── ExamplesPage.container.tsx  # Smart: useGetExamplesQuery(), useUI(), useTheme()
├── ExamplesPage.component.tsx  # Dumb: receives props, renders UI
├── ExamplesPage.style.ts       # Emotion with theme.colors.background.primary
├── ExamplesPage.types.ts       # Props interfaces
├── index.ts                    # exports default ExamplesPageContainer
├── api/
│   └── examplesApi.ts          # RTK Query: providesTags, invalidatesTags
├── adapters/
│   └── exampleAdapter.ts       # DTO transformations (if needed)
├── ExampleList/
│   ├── ExampleList.component.tsx
│   ├── ExampleList.style.ts
│   └── ExampleList.types.ts
└── ExampleForm/
    ├── ExampleForm.component.tsx  # React Hook Form + Controller
    ├── ExampleForm.style.ts
    └── ExampleForm.types.ts
```

**Key Patterns to Copy:**

- ✅ Container imports: `useGetExamplesQuery`, `useUI`, `useTheme`, `useTranslation`
- ✅ Component receives props only (no hooks except `useTranslation`)
- ✅ Styled components use new theme: `theme.colors.background.primary`, `theme.spacing.md`
- ✅ RTK Query cache invalidation: `invalidatesTags: ['Example']`
- ✅ Form inputs use `React.forwardRef`: see `ExampleForm.component.tsx`
- ✅ Icons: `<Icon name="trash" size={20} />` (Wrapper: `div`, Child: `TrashIcon`)
- ✅ i18n: `{t('examples.title')}`, `{t('examples.createSuccess')}`
- ✅ UIContext: `showLoading()`, `showMessage()`, `hideLoading()`
- ✅ Input Safety: `value={value ?? ''}` in Input atoms to prevent uncontrolled warnings.

### Shared Reference: `packages/shared/src/domain/example/`

**File Structure:**

```
example/
├── example.types.ts            # ExampleItem, ExampleStatus
├── example.constants.ts        # EXAMPLE_STATUS = { ACTIVE: 'active', ... }
├── example.dto.ts              # CreateExampleRequest, GetExamplesResponse
└── example.validators.ts       # Custom Zod validators (if needed)
```

**Key Patterns to Copy:**

- ✅ Domain types are interfaces: `export interface ExampleItem { ... }`
- ✅ Constants are `as const`: `export const EXAMPLE_STATUS = { ... } as const;`
- ✅ DTOs have Request/Response suffix: `CreateExampleRequest`, `GetExamplesResponse`
- ✅ Zod schemas in `packages/shared/src/schemas/example/`

### How to Use This Reference

**When creating a new feature (e.g., "products"):**

1. **Backend**: Copy `apps/api/src/modules/examples/` → `apps/api/src/modules/products/`
2. **Frontend**: Copy `apps/web/src/features/examples/` → `apps/web/src/features/products/`
3. **Shared**: Copy `packages/shared/src/domain/example/` → `packages/shared/src/domain/product/`
4. **Find & Replace**: `Example` → `Product`, `example` → `product`, `EXAMPLE` → `PRODUCT`
5. **Update Logic**: Modify business rules, validations, UI as needed

**Always include this comment in generated code:**

```typescript
// @reference: This follows the pattern from apps/api/src/modules/examples/
// @reference: See apps/web/src/features/examples/ for frontend implementation
```

---

### ✅ RULE 3: Backend DTOs Must Use class-validator

**Backend DTOs MUST use decorators from `class-validator`**

```typescript
// ✅ CORRECT
// apps/api/src/modules/users/dto/create-user.dto.ts
import { CreateUserRequest } from '@repo/shared';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateUserRequestDto implements CreateUserRequest {
  @IsString()
  @MinLength(3)
  @MaxLength(50)
  name: string;

  @IsEmail()
  email: string;
}
```

**WHY**: NestJS ValidationPipe uses class-validator. Frontend uses Zod. Both validate the same structure.

---

### ✅ RULE 4: Container/Component Split (Frontend)

**ALWAYS split React features into Container (smart) and Component (dumb)**

```typescript
// ✅ CORRECT STRUCTURE
features/users/
  ├── UsersPage.container.tsx   // Smart: data fetching, state
  ├── UsersPage.component.tsx   // Dumb: presentation only
  ├── UsersPage.types.ts        // Local types
  ├── UsersPage.style.ts        // Styled components
  ├── api/
  │   └── usersApi.ts           // RTK Query API
  ├── adapters/
  │   └── userAdapter.ts        // Data transformation
  ├── UserForm/                 // Sub-components
  │   ├── UserForm.component.tsx
  │   ├── UserForm.types.ts
  │   └── UserForm.style.ts
  └── UserList/
      ├── UserList.component.tsx
      ├── UserList.types.ts
      └── UserList.style.ts
```

**Container Template:**

```typescript
// UsersPage.container.tsx
export const UsersPageContainer = (): React.ReactElement => {
  // Data fetching
  const { data, isLoading } = useGetUsersQuery({ page: 1 });
  const [createUser] = useCreateUserMutation();

  // Business logic
  const handleCreateUser = (formData: CreateUserFormData) => {
    const request = toCreateUserRequest(formData);
    void createUser(request);
  };

  // Error handling
  useEffect(() => {
    if (createError) {
      const { key, params } = getErrorMessage(createError);
      showMessage({ type: 'error', descriptionKey: key, descriptionParams: params });
    }
  }, [createError]);

  // Render dumb component
  return (
    <UsersPageComponent
      users={data?.items || []}
      isLoading={isLoading}
      onCreateUser={handleCreateUser}
    />
  );
};
```

**Component Template:**

```typescript
// UsersPage.component.tsx
export const UsersPageComponent = (props: UsersPageProps): React.ReactElement => {
  return (
    <S.Container>
      <S.Header>
        <S.Title>Users</S.Title>
      </S.Header>
      <UserList items={props.users} isLoading={props.isLoading} />
      <UserForm onSubmit={props.onCreateUser} />
    </S.Container>
  );
};
```

**WHY**: Separation of concerns. Components are reusable, testable, pure.

---

### ✅ RULE 5: RTK Query API Pattern

**ALL API calls MUST use RTK Query in `features/*/api/*.ts`**

```typescript
// ✅ CORRECT
// features/users/api/usersApi.ts
import { baseApi } from '@/services/api';
import type { CreateUserRequest, GetUsersRequest, GetUsersResponse, UserItem } from '@repo/shared';

// ⚠️ IMPORTANT: Always refer to apps/web/src/features/examples/api/examplesApi.ts
// as the reference implementation for RTK Query patterns

export const usersApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getUsers: builder.query<GetUsersResponse, GetUsersRequest>({
      query: (params) => ({
        url: '/users',
        method: 'GET',
        params,
      }),
      providesTags: ['Users'],
    }),

    createUser: builder.mutation<UserItem, CreateUserRequest>({
      query: (body) => ({
        url: '/users',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Users'],
    }),

    updateUser: builder.mutation<UserItem, { id: string; data: UpdateUserRequest }>({
      query: ({ id, data }) => ({
        url: `/users/${id}`,
        method: 'PATCH',
        body: data,
      }),
      invalidatesTags: ['Users'],
    }),

    deleteUser: builder.mutation<void, string>({
      query: (id) => ({
        url: `/users/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Users'],
    }),
  }),
});

export const { useGetUsersQuery, useCreateUserMutation, useUpdateUserMutation, useDeleteUserMutation } = usersApi;
```

**WHY**: Automatic caching, refetching, loading states. No manual fetch/axios.

---

### ✅ RULE 6: Adapter Pattern for Data Transformation

**ALWAYS create adapters for DTO → Frontend Type transformation**

```typescript
// ✅ CORRECT
// features/users/adapters/userAdapter.ts
import type {
  CreateUserFormData,
  CreateUserRequest,
  UpdateUserFormData,
  UpdateUserRequest,
  UserDto,
  UserItem,
} from '@repo/shared';

// Backend → Frontend
export const toUserItem = (dto: UserDto): UserItem => ({
  id: dto.id,
  name: dto.name,
  email: dto.email,
  createdAt: new Date(dto.createdAt),
  updatedAt: new Date(dto.updatedAt),
});

// Frontend → Backend
export const toCreateUserRequest = (formData: CreateUserFormData): CreateUserRequest => ({
  name: formData.name.trim(),
  email: formData.email.toLowerCase().trim(),
});

export const toUpdateUserRequest = (formData: UpdateUserFormData): UpdateUserRequest => ({
  name: formData.name?.trim(),
  email: formData.email?.toLowerCase().trim(),
});
```

**WHY**: Separates transformation logic. Frontend types !== Backend DTOs (e.g., Date objects vs ISO strings).

---

### ✅ RULE 7: Form Input Pattern - TextInput Molecule

**ALWAYS use TextInput molecule for form fields (NOT raw Input + manual Controller)**

```typescript
// ❌ WRONG - Manual Controller wrapping
import { Controller } from 'react-hook-form';
import { Input, Label } from '@repo/ui';

<Controller
  name="email"
  control={control}
  render={({ field, fieldState: { error } }) => (
    <>
      <Text as="label" variant="body" weight="medium">Email</Text>
      <Input {...field} hasError={!!error} />
      {error && <ErrorText>{error.message}</ErrorText>}
    </>
  )}
/>

// ✅ CORRECT - Use TextInput molecule
import { TextInput } from '@repo/ui';

<TextInput
  name="email"
  control={control}
  label={t('auth.login.emailLabel')}
  type="email"
  disabled={isLoading}
/>

**Atomic Design Pattern:**

- **Atoms**: `Input`, `Button`, `Label`, `Text`, `Icon` (Base components, `forwardRef` for inputs. `Icon` uses a `div` wrapper to prevent prop leakage to SVG).
- **Molecules**: `TextInput` (Controller-wrapped atoms + error display).
- **Organisms**: `Header`, `Sidebar` (Collapsible, supports badges).
- **Templates**: `AppLayout`.

**TextInput Features:**

- ✅ Controller integration built-in
- ✅ Automatic error display from `fieldState`
- ✅ Optional label with `required` indicator
- ✅ Type-safe `name` prop (Path<TFieldValues>)
- ✅ One line per field instead of 10+

**Future Molecules:**

- `SelectInput` - Dropdown with Controller
- `DatePickerInput` - Date picker with Controller
- `TextAreaInput` - Multi-line text with Controller

---

### ✅ RULE 8: React Hook Form + Zod Integration

**ALL forms MUST use React Hook Form with Zod resolver + TextInput molecule**

```typescript
// ✅ CORRECT
// UserForm.component.tsx
import { zodResolver } from '@hookform/resolvers/zod';
import { createUserFormDataSchema, type CreateUserFormData } from '@repo/shared';
import { TextInput, Button } from '@repo/ui';
import { useForm } from 'react-hook-form';

export const UserForm = (props: UserFormProps): React.ReactElement => {
  const { t } = useTranslation();

  const {
    control,
    handleSubmit,
    formState: { isSubmitting },
    reset,
  } = useForm<CreateUserFormData>({
    resolver: zodResolver(createUserFormDataSchema(t)),
    defaultValues: {
      name: '',
      email: '',
    },
  });

  const onSubmit = async (data: CreateUserFormData): Promise<void> => {
    await props.onSubmit(data);
    reset();
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <TextInput
        name="name"
        control={control}
        label={t('user.nameLabel')}
        disabled={isSubmitting}
      />
      
      <TextInput
        name="email"
        control={control}
        label={t('user.emailLabel')}
        type="email"
        disabled={isSubmitting}
      />
      
      <Button type="submit" disabled={isSubmitting}>
        {t('user.createButton')}
      </Button>
    </form>
  );
};
```

**WHY**: Type-safe forms with automatic validation. TextInput reduces boilerplate from 10+ lines to 1 line per field.

---

### ✅ RULE 9: i18n for ALL User-Facing Text

**NO hardcoded strings in UI. ALWAYS use i18n**

```typescript
// ❌ WRONG
<Button>Create User</Button>

// ✅ CORRECT
<Button>{t('user.createButton')}</Button>

// ✅ CORRECT - With parameters
<Text>{t('validation.minLength', { min: 3 })}</Text>
```

**Translation files:**

```typescript
// packages/shared/src/i18n/resources/en/user.json
{
  "user": {
    "title": "Users",
    "createButton": "Create User",
    "editButton": "Edit User",
    "deleteButton": "Delete User",
    "nameLabel": "Name",
    "emailLabel": "Email"
  }
}
```

**WHY**: Multi-language support. Centralized text management.

---

### ✅ RULE 10: Error Handling Pattern

**ALWAYS use standardized error handling**

```typescript
// ✅ CORRECT - Container
useEffect(() => {
  if (createError) {
    const { key, params } = getErrorMessage(createError as FetchBaseQueryError);
    showMessage({
      type: 'error',
      headerKey: 'message.error.header',
      descriptionKey: key,
      descriptionParams: params,
      primaryButton: {
        labelKey: 'message.error.close',
        onClick: closeMessage,
      },
    });
  }
}, [createError]);

// ✅ CORRECT - Backend
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    // Extract request ID
    const requestId = request.headers['x-request-id'];

    const errorResponse: ApiErrorResponse = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      message: exception.message,
      errorCode: 'validation.minLength', // i18n key
      details: { min: 3 }, // i18n params
      requestId,
    };

    response.status(status).json(errorResponse);
  }
}
```

**WHY**: Consistent error UX. Request ID for debugging. i18n-ready error messages.

---

### ✅ RULE 10: Backend Module Structure

**EVERY backend feature MUST follow NestJS module structure**

```typescript
// ✅ CORRECT STRUCTURE
apps/api/src/modules/users/
  ├── users.controller.ts    // HTTP endpoints
  ├── users.service.ts       // Business logic
  ├── users.module.ts        // Module definition
  └── dto/
      ├── create-user.dto.ts
      ├── update-user.dto.ts
      └── list-users.query.dto.ts

// users.controller.ts
@ApiTags('users')
@Controller({ path: 'users', version: '1' })
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @ApiOperation({ summary: 'Get all users' })
  @ApiOkResponse({ description: 'List of users' })
  async list(@Query() query: GetUsersRequestDto): Promise<GetUsersResponse> {
    return this.usersService.list(query);
  }

  @Post()
  @ApiOperation({ summary: 'Create new user' })
  @ApiCreatedResponse({ description: 'User created successfully' })
  async create(@Body() dto: CreateUserRequestDto): Promise<UserItem> {
    return this.usersService.create(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update user' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateUserRequestDto
  ): Promise<UserItem> {
    return this.usersService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete user' })
  async delete(@Param('id') id: string): Promise<void> {
    return this.usersService.delete(id);
  }
}

// users.service.ts
@Injectable()
export class UsersService {
  private users: Map<string, UserItem> = new Map();

  list(query: GetUsersRequest): GetUsersResponse {
    const items = Array.from(this.users.values());
    return {
      items,
      total: items.length,
      page: query.page || 1,
      pageSize: query.pageSize || 10,
    };
  }

  create(dto: CreateUserRequest): UserItem {
    const user: UserItem = {
      id: crypto.randomUUID(),
      ...dto,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.users.set(user.id, user);
    return user;
  }

  update(id: string, dto: UpdateUserRequest): UserItem {
    const user = this.users.get(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    const updated = { ...user, ...dto, updatedAt: new Date() };
    this.users.set(id, updated);
    return updated;
  }

  delete(id: string): void {
    if (!this.users.has(id)) {
      throw new NotFoundException('User not found');
    }
    this.users.delete(id);
  }
}

// users.module.ts
@Module({
  controllers: [UsersController],
  providers: [UsersService],
})
export class UsersModule {}
```

**WHY**: NestJS conventions. Dependency injection. Swagger auto-documentation.

---

### ✅ RULE 11: Emotion Styling Pattern

**ALL styling MUST use Emotion styled components with NEW theme structure**

```typescript
// ✅ CORRECT - Using Emotion
// UserList.style.ts
import styled from '@emotion/styled';

export const Container = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.md};
  padding: ${({ theme }) => theme.spacing.lg};
  background: ${({ theme }) => theme.colors.background.primary};
  border-radius: ${({ theme }) => theme.radius.md};
  box-shadow: ${({ theme }) => theme.shadows.sm};
`;
```

**WHY**: Type-safe styles. Theme integration. Component-scoped CSS. Dark mode support. No `styled-components` library usage.

---

### ✅ RULE 11B: Theme System Usage

**Use ThemeProvider and useTheme hook for dark/light mode**

```typescript
// ✅ CORRECT - App setup
import { ThemeProvider, UIProvider } from '@repo/ui';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <ThemeProvider>
    <UIProvider>
      <App />
    </UIProvider>
  </ThemeProvider>
);

// ✅ CORRECT - Toggle theme
import { useTheme } from '@repo/ui';

const Header = () => {
  const { themeMode, toggleTheme } = useTheme();

  return (
    <button onClick={toggleTheme}>
      {themeMode === 'light' ? 'Switch to Dark' : 'Switch to Light'}
    </button>
  );
};

// ✅ CORRECT - Access theme in component
import { useTheme } from '@repo/ui';

const Card = () => {
  const { theme } = useTheme();

  return (
    <div style={{
      background: theme.colors.surface.primary,
      color: theme.colors.text.primary
    }}>
      Content
    </div>
  );
};
```

**WHY**: Automatic dark/light mode. localStorage persistence. System preference detection.

---

### ✅ RULE 12: UI Components from @repo/ui

**ALWAYS use atomic components from UI package**

```typescript
// ❌ WRONG
<input type="text" />
<button>Click me</button>

// ✅ CORRECT
import { Button, Input, Label, Icon } from '@repo/ui';

<Text as="label" variant="body" weight="medium">{t('user.nameLabel')}</Text>
<Input
  {...field}
  type="text"
  error={errors.name?.message}
/>
<Button variant="primary" type="submit">
  <Icon name="chevron-right" size={16} />
  {t('user.createButton')}
</Button>
```

**Available Components**:

- **Atoms**: Button, Input, Label, Text, Icon
- **Molecules**: GeneralMessage, GeneralLoading, ThemeToggle
- **Hooks**: useUI, useTheme
- **Context**: UIProvider, ThemeProvider

**Icon Usage**:

```typescript
import { Icon } from '@repo/ui';

// Available icons:
<Icon name="inbox" size={48} />
<Icon name="calendar" size={20} />
<Icon name="moon" size={20} /> // Dark mode icon
<Icon name="sun" size={20} /> // Light mode icon
<Icon name="alert-circle" size={16} /> // Error states
<Icon name="chevron-right" size={16} />
<Icon name="trash" size={20} />
<Icon name="archive" size={20} />
```

**WHY**: Consistent design system. Reusable across projects. Theme-aware.

---

### ✅ RULE 12B: Global UI State with UIContext

**Use UIContext for modals and loading states**

```typescript
import { useUI } from '@repo/ui';

const ExampleForm = () => {
  const { showMessage, showLoading, hideLoading } = useUI();
  const { t } = useTranslation();

  const handleSubmit = async (data) => {
    showLoading({ overlay: true });

    try {
      await createExample(data);

      showMessage(
        {
          type: 'success',
          headerKey: 'success',
          descriptionKey: 'exampleCreated',
        },
        t
      );
    } catch (error) {
      showMessage(
        {
          type: 'error',
          headerKey: 'error',
          descriptionKey: 'somethingWentWrong',
        },
        t
      );
    } finally {
      hideLoading();
    }
  };
};
```

**WHY**: Platform-agnostic (Web + Mobile). Centralized modal management. No prop drilling.

---

### ✅ RULE 13: File Naming Conventions

```typescript
// React Components (PascalCase.tsx)
UserForm.component.tsx;
UserList.component.tsx;
UsersPage.container.tsx;

// Types (PascalCase.types.ts)
UserForm.types.ts;
UsersPage.types.ts;

// Styles (PascalCase.style.ts)
UserForm.style.ts;
UserList.style.ts;

// API (camelCase.ts)
usersApi.ts;
userAdapter.ts;

// Backend (kebab-case.ts)
users.controller.ts;
users.service.ts;
create - user.dto.ts;

// Constants (SCREAMING_SNAKE_CASE)
export const MAX_NAME_LENGTH = 50;
```

---

### ✅ RULE 14: Import Order

```typescript
// ✅ CORRECT ORDER
// 1. External libraries
import React from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

// 2. Internal packages (@repo/*)
import { Button, Input } from '@repo/ui';
import { CreateUserFormData, createUserFormDataSchema } from '@repo/shared';

// 3. Absolute imports (@/*)
import { useGetUsersQuery } from '@/features/users/api/usersApi';

// 4. Relative imports (./*)
import * as S from './UserForm.style';
import { UserFormProps } from './UserForm.types';
```

---

### ✅ RULE 15: After Creating Shared Package Changes

**ALWAYS rebuild shared package after modifications**

```bash
# After editing packages/shared/**
pnpm --filter shared build
```

**WHY**: Backend (CJS) and Frontend (ESM) consume built outputs, not source files.

---

## 🚫 FORBIDDEN PATTERNS

### ❌ DON'T: Duplicate Types

```typescript
// ❌ WRONG - Defining same type in multiple places
// apps/api/src/modules/users/types.ts
export interface User {
  id: string;
  name: string;
}

// apps/web/src/features/users/types.ts
export interface User {
  id: string;
  name: string;
}

// ✅ CORRECT - Define once in shared
// packages/shared/src/domain/user/user.types.ts
export interface UserItem {
  id: string;
  name: string;
}
```

---

### ❌ DON'T: Hardcode Strings

```typescript
// ❌ WRONG
<Button>Create User</Button>
throw new Error('User not found');

// ✅ CORRECT
<Button>{t('user.createButton')}</Button>
throw new NotFoundException(t('error.userNotFound'));
```

---

### ❌ DON'T: Use any or unknown Carelessly

```typescript
// ❌ WRONG
const data: any = await fetchUser();

// ✅ CORRECT
const data: UserItem = await fetchUser();

// ✅ CORRECT - If truly unknown
const error: unknown = catchError();
if (error instanceof FetchBaseQueryError) {
  // Type narrowing
}
```

---

### ❌ DON'T: Skip Validation

```typescript
// ❌ WRONG - No validation
@Post()
create(@Body() data: any) {
  return this.service.create(data);
}

// ✅ CORRECT - DTO validation
@Post()
create(@Body() dto: CreateUserRequestDto) {
  return this.service.create(dto);
}
```

---

### ❌ DON'T: Mix Smart/Dumb Components

```typescript
// ❌ WRONG - Data fetching in "dumb" component
export const UserList = () => {
  const { data } = useGetUsersQuery(); // ❌ Side effect!
  return <div>{data.map(...)}</div>;
};

// ✅ CORRECT - Receive data via props
export const UserList = (props: UserListProps) => {
  return <div>{props.users.map(...)}</div>;
};
```

---

### ❌ DON'T: Use Inline Styles

```typescript
// ❌ WRONG
<div style={{ padding: '16px', color: '#333' }}>Content</div>

// ✅ CORRECT
<S.Container>Content</S.Container>

// S.Container from styled components
```

---

## 🎯 Code Generation Checklist

When generating new features, follow this checklist:

### **1. Shared Package**

- [ ] Create DTOs in `packages/shared/src/domain/[feature]/[feature].dto.ts`
- [ ] Create types in `packages/shared/src/domain/[feature]/[feature].types.ts`
- [ ] Create constants in `packages/shared/src/domain/[feature]/[feature].constants.ts`
- [ ] Create Zod schemas in `packages/shared/src/schemas/[feature]/`
- [ ] Add i18n translations in `packages/shared/src/i18n/resources/*/[feature].json`
- [ ] Export from `packages/shared/src/index.ts`
- [ ] Build: `pnpm --filter shared build`

### **2. Backend Module**

- [ ] Create `apps/api/src/modules/[feature]/[feature].controller.ts`
- [ ] Create `apps/api/src/modules/[feature]/[feature].service.ts`
- [ ] Create `apps/api/src/modules/[feature]/[feature].module.ts`
- [ ] Create DTOs in `apps/api/src/modules/[feature]/dto/`
- [ ] Add Swagger decorators
- [ ] Add to `app.module.ts`

### **3. Frontend Feature**

- [ ] Create `apps/web/src/features/[feature]/[Feature]Page.container.tsx`
- [ ] Create `apps/web/src/features/[feature]/[Feature]Page.component.tsx`
- [ ] Create `apps/web/src/features/[feature]/[Feature]Page.types.ts`
- [ ] Create `apps/web/src/features/[feature]/[Feature]Page.style.ts`
- [ ] Create `apps/web/src/features/[feature]/api/[feature]Api.ts`
- [ ] Create `apps/web/src/features/[feature]/adapters/[feature]Adapter.ts`
- [ ] Create sub-components ([Feature]Form, [Feature]List)
- [ ] Add route to router

### **4. Testing**

- [ ] Backend: `[feature].service.spec.ts`
- [ ] Backend: `[feature].e2e-spec.ts`
- [ ] Frontend: `[Feature].test.tsx`

---

## 📚 Example: Complete Feature Generation

### **Task**: Add "Products" CRUD feature

### **Step 1: Shared Package**

```typescript
// packages/shared/src/domain/product/product.dto.ts
export interface ProductDto {
  id: string;
  name: string;
  price: number;
  description: string;
  createdAt: string;
  updatedAt: string;
}

// packages/shared/src/domain/product/product.types.ts
export interface ProductItem {
  id: string;
  name: string;
  price: number;
  description: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateProductRequest {
  name: string;
  price: number;
  description: string;
}

export interface UpdateProductRequest {
  name?: string;
  price?: number;
  description?: string;
}

export interface GetProductsRequest {
  page?: number;
  pageSize?: number;
  search?: string;
}

export interface GetProductsResponse {
  items: ProductItem[];
  total: number;
  page: number;
  pageSize: number;
}

// packages/shared/src/domain/product/product.constants.ts
export const PRODUCT_CONSTANTS = {
  MAX_NAME_LENGTH: 100,
  MIN_NAME_LENGTH: 3,
  MIN_PRICE: 0,
  MAX_PRICE: 999999,
} as const;

// packages/shared/src/schemas/product/createProduct.schema.ts
import { z } from 'zod';
import { PRODUCT_CONSTANTS } from '../../domain/product/product.constants';

export const createProductFormDataSchema = (t: TFunction) =>
  z.object({
    name: z
      .string()
      .min(PRODUCT_CONSTANTS.MIN_NAME_LENGTH, {
        message: t('validation.minLength', { min: PRODUCT_CONSTANTS.MIN_NAME_LENGTH }),
      })
      .max(PRODUCT_CONSTANTS.MAX_NAME_LENGTH, {
        message: t('validation.maxLength', { max: PRODUCT_CONSTANTS.MAX_NAME_LENGTH }),
      }),
    price: z
      .number()
      .min(PRODUCT_CONSTANTS.MIN_PRICE, {
        message: t('validation.minValue', { min: PRODUCT_CONSTANTS.MIN_PRICE }),
      })
      .max(PRODUCT_CONSTANTS.MAX_PRICE, {
        message: t('validation.maxValue', { max: PRODUCT_CONSTANTS.MAX_PRICE }),
      }),
    description: z.string().optional(),
  });

export type CreateProductFormData = z.infer<ReturnType<typeof createProductFormDataSchema>>;

// packages/shared/src/i18n/resources/en/product.json
{
  "product": {
    "title": "Products",
    "createButton": "Create Product",
    "editButton": "Edit Product",
    "deleteButton": "Delete Product",
    "nameLabel": "Product Name",
    "priceLabel": "Price",
    "descriptionLabel": "Description"
  }
}

// packages/shared/src/index.ts
export * from './domain/product/product.dto';
export * from './domain/product/product.types';
export * from './domain/product/product.constants';
export * from './schemas/product/createProduct.schema';
```

**Build:**

```bash
pnpm --filter shared build
```

### **Step 2: Backend Module**

```typescript
// apps/api/src/modules/products/dto/create-product.dto.ts
import { CreateProductRequest } from '@repo/shared';
import { IsNumber, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { PRODUCT_CONSTANTS } from '@repo/shared';

export class CreateProductRequestDto implements CreateProductRequest {
  @IsString()
  @MinLength(PRODUCT_CONSTANTS.MIN_NAME_LENGTH)
  @MaxLength(PRODUCT_CONSTANTS.MAX_NAME_LENGTH)
  name: string;

  @IsNumber()
  @Min(PRODUCT_CONSTANTS.MIN_PRICE)
  @Max(PRODUCT_CONSTANTS.MAX_PRICE)
  price: number;

  @IsString()
  @IsOptional()
  description?: string;
}

// apps/api/src/modules/products/products.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import type {
  CreateProductRequest,
  GetProductsRequest,
  GetProductsResponse,
  ProductItem,
  UpdateProductRequest,
} from '@repo/shared';

@Injectable()
export class ProductsService {
  private products: Map<string, ProductItem> = new Map();

  list(query: GetProductsRequest): GetProductsResponse {
    const items = Array.from(this.products.values());
    return {
      items,
      total: items.length,
      page: query.page || 1,
      pageSize: query.pageSize || 10,
    };
  }

  create(dto: CreateProductRequest): ProductItem {
    const product: ProductItem = {
      id: crypto.randomUUID(),
      ...dto,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.products.set(product.id, product);
    return product;
  }

  findOne(id: string): ProductItem {
    const product = this.products.get(id);
    if (!product) {
      throw new NotFoundException('Product not found');
    }
    return product;
  }

  update(id: string, dto: UpdateProductRequest): ProductItem {
    const product = this.findOne(id);
    const updated = { ...product, ...dto, updatedAt: new Date() };
    this.products.set(id, updated);
    return updated;
  }

  delete(id: string): void {
    if (!this.products.has(id)) {
      throw new NotFoundException('Product not found');
    }
    this.products.delete(id);
  }
}

// apps/api/src/modules/products/products.controller.ts
import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiCreatedResponse, ApiNoContentResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { GetProductsRequest, GetProductsResponse, ProductItem } from '@repo/shared';

import { CreateProductRequestDto } from './dto/create-product.dto';
import { GetProductsRequestDto } from './dto/list-products.query.dto';
import { UpdateProductRequestDto } from './dto/update-product.dto';
import { ProductsService } from './products.service';

@ApiTags('products')
@Controller({ path: 'products', version: '1' })
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  @ApiOperation({ summary: 'Get all products' })
  @ApiOkResponse({ description: 'List of products' })
  async list(@Query() query: GetProductsRequestDto): Promise<GetProductsResponse> {
    return this.productsService.list(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get product by ID' })
  @ApiOkResponse({ description: 'Product details' })
  async findOne(@Param('id') id: string): Promise<ProductItem> {
    return this.productsService.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create new product' })
  @ApiCreatedResponse({ description: 'Product created successfully' })
  async create(@Body() dto: CreateProductRequestDto): Promise<ProductItem> {
    return this.productsService.create(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update product' })
  @ApiOkResponse({ description: 'Product updated successfully' })
  async update(@Param('id') id: string, @Body() dto: UpdateProductRequestDto): Promise<ProductItem> {
    return this.productsService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete product' })
  @ApiNoContentResponse({ description: 'Product deleted successfully' })
  async delete(@Param('id') id: string): Promise<void> {
    return this.productsService.delete(id);
  }
}

// apps/api/src/modules/products/products.module.ts
import { Module } from '@nestjs/common';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';

@Module({
  controllers: [ProductsController],
  providers: [ProductsService],
})
export class ProductsModule {}

// apps/api/src/app.module.ts
import { ProductsModule } from './modules/products/products.module';

@Module({
  imports: [
    // ... existing imports
    ProductsModule,
  ],
})
export class AppModule {}
```

### **Step 3: Frontend Feature**

```typescript
// apps/web/src/features/products/api/productsApi.ts
import { baseApi } from '@/services/api';
import type {
  CreateProductRequest,
  GetProductsRequest,
  GetProductsResponse,
  ProductItem,
  UpdateProductRequest,
} from '@repo/shared';

export const productsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getProducts: builder.query<GetProductsResponse, GetProductsRequest>({
      query: (params) => ({
        url: '/products',
        method: 'GET',
        params,
      }),
      providesTags: ['Products'],
    }),

    createProduct: builder.mutation<ProductItem, CreateProductRequest>({
      query: (body) => ({
        url: '/products',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Products'],
    }),

    updateProduct: builder.mutation<ProductItem, { id: string; data: UpdateProductRequest }>({
      query: ({ id, data }) => ({
        url: `/products/${id}`,
        method: 'PATCH',
        body: data,
      }),
      invalidatesTags: ['Products'],
    }),

    deleteProduct: builder.mutation<void, string>({
      query: (id) => ({
        url: `/products/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Products'],
    }),
  }),
});

export const { useGetProductsQuery, useCreateProductMutation, useUpdateProductMutation, useDeleteProductMutation } =
  productsApi;

// apps/web/src/features/products/adapters/productAdapter.ts
import type { CreateProductFormData, CreateProductRequest, ProductDto, ProductItem } from '@repo/shared';

export const toProductItem = (dto: ProductDto): ProductItem => ({
  id: dto.id,
  name: dto.name,
  price: dto.price,
  description: dto.description,
  createdAt: new Date(dto.createdAt),
  updatedAt: new Date(dto.updatedAt),
});

export const toCreateProductRequest = (formData: CreateProductFormData): CreateProductRequest => ({
  name: formData.name.trim(),
  price: formData.price,
  description: formData.description?.trim(),
});

// apps/web/src/features/products/ProductsPage.container.tsx
// ... (Similar to ExamplesPage.container.tsx)

// apps/web/src/features/products/ProductForm/ProductForm.component.tsx
// ... (Similar to ExampleForm.component.tsx with price field)
```

---

## 🎯 Final Checklist for LLM

Before generating code, verify:

- [ ] Types defined in `packages/shared`
- [ ] Zod schemas in `packages/shared/src/schemas`
- [ ] i18n translations added
- [ ] Backend uses class-validator DTOs
- [ ] Frontend uses Container/Component split
- [ ] RTK Query for API calls
- [ ] Adapters for data transformation
- [ ] React Hook Form + Zod
- [ ] Styled components with new theme structure (theme.colors._, theme.spacing._, etc.)
- [ ] No hardcoded strings
- [ ] No `any` types
- [ ] Swagger decorators on controller
- [ ] Proper error handling
- [ ] UIContext for modals/loading (no local state)
- [ ] ThemeProvider for dark/light mode
- [ ] Icon components instead of inline SVGs
- [ ] forwardRef for form components (React Hook Form integration)

---

**Last Updated**: January 12, 2026  
**Template Version**: 3.0.0

**Latest Features** (v3.0.0):

- ✅ Dark/Light mode theme system with localStorage persistence
- ✅ Semantic color tokens (background, surface, text, border, semantic, brand)
- ✅ Global UIContext for modals and loading states
- ✅ Icon atom components (moon, sun, inbox, calendar, etc.)
- ✅ Platform-agnostic architecture (Web + Mobile ready)
- ✅ forwardRef support for form components
- ✅ Removed deprecated hooks (useGeneralMessage, useGeneralLoading)
- ✅ New hook exports: useUI, useTheme
