# Listing Settings Groups - Developer Quick Reference

## 🚀 Quick Start

### 1. Backend Setup (5 steps)

```bash
# 1. Create Prisma schema
# Add to apps/api/prisma/schema.prisma (see implementation plan)

# 2. Run migration
cd apps/api
pnpm prisma migrate dev --name add_listing_settings_groups

# 3. Seed predefined templates
pnpm prisma db seed

# 4. Create module files
mkdir -p src/modules/listing-settings/dto

# 5. Start API
pnpm dev
```

### 2. Frontend Setup (4 steps)

```bash
# 1. Create feature directory
cd apps/web
mkdir -p src/features/listing-settings/{api,components}

# 2. Add localization keys
# Edit packages/shared/src/i18n/resources/en/listing-settings.json
# Edit packages/shared/src/i18n/resources/tr/listing-settings.json

# 3. Create shared domain types
cd packages/shared
mkdir -p src/domain/listing-settings

# 4. Start web app
cd apps/web
pnpm dev
```

---

## 📁 File Checklist

### Shared Package (`packages/shared/src/`)

- [ ] `domain/listing-settings/listing-settings.types.ts`
- [ ] `domain/listing-settings/listing-settings.dto.ts`
- [ ] `domain/listing-settings/index.ts`
- [ ] `i18n/resources/en/listing-settings.json`
- [ ] `i18n/resources/tr/listing-settings.json`

### Backend (`apps/api/src/modules/listing-settings/`)

- [ ] `listing-settings.controller.ts`
- [ ] `listing-settings.service.ts`
- [ ] `listing-settings.module.ts`
- [ ] `dto/create-listing-group.dto.ts`
- [ ] `dto/update-listing-group.dto.ts`
- [ ] `dto/index.ts`

### Frontend (`apps/web/src/features/listing-settings/`)

- [ ] `ListingSettingsPage.container.tsx`
- [ ] `ListingSettingsPage.component.tsx`
- [ ] `ListingSettingsPage.style.ts`
- [ ] `ListingSettingsPage.types.ts`
- [ ] `ListingGroupForm.container.tsx`
- [ ] `ListingGroupForm.component.tsx`
- [ ] `ListingGroupForm.style.ts`
- [ ] `api/listing-settings.api.ts`
- [ ] `components/ListingGroupCard.tsx`
- [ ] `components/PriceRangeInput.tsx`
- [ ] `components/TemplateSelector.tsx`
- [ ] `components/HTMLEditor.tsx`
- [ ] `components/LivePreview.tsx`
- [ ] `index.ts`

### Database

- [ ] Prisma schema updated
- [ ] Migration created
- [ ] Seed data added

---

## 🔑 Key Code Snippets

### 1. Domain Type (Shared)

```typescript
// packages/shared/src/domain/listing-settings/listing-settings.types.ts
export interface ListingSettingsGroup {
  id: string;
  storeId: string;
  name: string;
  description?: string;
  repricingStrategy: PriceRange[];
  stock: StockConfig;
  fees: FeeConfig;
  templates: TemplateConfig;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  updatedBy: string;
}
```

### 2. Zod Schema (Shared)

```typescript
// packages/shared/src/domain/listing-settings/listing-settings.dto.ts
import { z } from 'zod';
import { TFunction } from 'i18next';

export const listingSettingsGroupSchema = (t: TFunction) =>
  z.object({
    name: z.string().min(1, t('listingSettings.validation.nameRequired')),
    description: z.string().optional(),
    repricingStrategy: z.array(priceRangeSchema(t)).min(1),
    stock: stockConfigSchema(t),
    fees: feeConfigSchema(t),
    templates: templateConfigSchema(t),
  });

export type ListingSettingsGroupFormData = z.infer<
  ReturnType<typeof listingSettingsGroupSchema>
>;
```

### 3. Controller (Backend)

```typescript
// apps/api/src/modules/listing-settings/listing-settings.controller.ts
import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('listing-settings')
@UseGuards(JwtAuthGuard)
export class ListingSettingsController {
  constructor(private readonly listingSettingsService: ListingSettingsService) {}

  @Get('groups')
  async getGroups(@CurrentUser() user: any, @Query('storeId') storeId?: string) {
    return this.listingSettingsService.getGroups(user.id, storeId);
  }

  @Post('groups')
  async createGroup(@Body() dto: CreateListingGroupDto, @CurrentUser() user: any) {
    return this.listingSettingsService.createGroup(dto, user.id);
  }
}
```

### 4. Service (Backend)

```typescript
// apps/api/src/modules/listing-settings/listing-settings.service.ts
import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ListingSettingsService {
  constructor(private prisma: PrismaService) {}

  async getGroups(userId: string, storeId?: string) {
    const where: any = { createdBy: userId };
    if (storeId) where.storeId = storeId;
    
    return this.prisma.listingSettingsGroup.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
    });
  }

  async createGroup(dto: CreateListingGroupDto, userId: string) {
    return this.prisma.listingSettingsGroup.create({
      data: { ...dto, createdBy: userId, updatedBy: userId },
    });
  }
}
```

### 5. RTK Query API (Frontend)

```typescript
// apps/web/src/features/listing-settings/api/listing-settings.api.ts
import { baseApi } from '@/store/api/baseApi';
import { ListingSettingsGroup } from '@repo/shared';

export const listingSettingsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getListingGroups: builder.query<ListingSettingsGroup[], string | undefined>({
      query: (storeId) => ({
        url: '/listing-settings/groups',
        params: storeId ? { storeId } : undefined,
      }),
      providesTags: ['ListingGroups'],
    }),

    createListingGroup: builder.mutation<ListingSettingsGroup, any>({
      query: (data) => ({
        url: '/listing-settings/groups',
        method: 'POST',
        body: data,
      }),
      invalidatesTags: ['ListingGroups'],
    }),
  }),
});

export const {
  useGetListingGroupsQuery,
  useCreateListingGroupMutation,
} = listingSettingsApi;
```

### 6. Container Component (Frontend)

```typescript
// apps/web/src/features/listing-settings/ListingSettingsPage.container.tsx
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useLoading } from '@/hooks/useLoading';
import { useGetListingGroupsQuery, useDeleteListingGroupMutation } from './api/listing-settings.api';
import { ListingSettingsPageComponent } from './ListingSettingsPage.component';

export const ListingSettingsPageContainer = () => {
  const navigate = useNavigate();
  const { data: groups = [], isLoading } = useGetListingGroupsQuery(undefined);
  const [deleteGroup] = useDeleteListingGroupMutation();

  useLoading(isLoading);

  const handleCreateGroup = () => {
    navigate('/settings/listing-groups/new');
  };

  const handleEditGroup = (id: string) => {
    navigate(`/settings/listing-groups/${id}/edit`);
  };

  const handleDeleteGroup = async (id: string) => {
    if (confirm(t('listingSettings.confirmDelete'))) {
      await deleteGroup(id);
    }
  };

  return (
    <ListingSettingsPageComponent
      groups={groups}
      onCreateGroup={handleCreateGroup}
      onEditGroup={handleEditGroup}
      onDeleteGroup={handleDeleteGroup}
    />
  );
};
```

### 7. Presentation Component (Frontend)

```typescript
// apps/web/src/features/listing-settings/ListingSettingsPage.component.tsx
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Card, Icon, Text } from '@repo/ui';
import * as S from './ListingSettingsPage.style';
import { ListingSettingsPageProps } from './ListingSettingsPage.types';

export const ListingSettingsPageComponent = ({
  groups,
  onCreateGroup,
  onEditGroup,
  onDeleteGroup,
}: ListingSettingsPageProps) => {
  const { t } = useTranslation();

  return (
    <S.Container>
      <S.Header>
        <S.HeaderContent>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Icon name="clipboard" size={28} color="brand.primary" />
            <Text variant="h3" weight="bold" style={{ fontSize: '26px' }}>
              {t('listingSettings.title')}
            </Text>
          </div>
          <Text variant="body" color="text.secondary">
            {t('listingSettings.subtitle')}
          </Text>
        </S.HeaderContent>
        <S.Actions>
          <Button variant="primary" size="md" onClick={onCreateGroup}>
            <Icon name="plus" size={18} />
            <Text variant="body" weight="medium" color="inherit">
              {t('listingSettings.createNewGroup')}
            </Text>
          </Button>
        </S.Actions>
      </S.Header>

      <S.CardGrid>
        {groups.map((group) => (
          <ListingGroupCard
            key={group.id}
            group={group}
            onEdit={() => onEditGroup(group.id)}
            onDelete={() => onDeleteGroup(group.id)}
          />
        ))}
      </S.CardGrid>
    </S.Container>
  );
};
```

### 8. Styled Component (Frontend)

```typescript
// apps/web/src/features/listing-settings/ListingSettingsPage.style.ts
import styled from '@emotion/styled';
import { tkn } from '@repo/ui';

export const Container = styled.div`
  width: 100%;
  margin: 0 auto;
  padding: 0 ${tkn('spacing.md')};
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.md')};
  box-sizing: border-box;

  @media (min-width: 768px) {
    padding: 0 ${tkn('spacing.xl')};
    gap: ${tkn('spacing.lg')};
  }
`;

export const Header = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.md')};
  position: sticky;
  top: calc(-1 * ${tkn('spacing.md')});
  z-index: 99;
  background-color: ${tkn('colors.background.secondary')};
  border-bottom: 1px solid ${tkn('colors.border.secondary')};
  margin-left: calc(-1 * ${tkn('spacing.md')});
  margin-right: calc(-1 * ${tkn('spacing.md')});
  padding: ${tkn('spacing.md')};

  @media (min-width: 768px) {
    flex-direction: row;
    justify-content: space-between;
    align-items: center;
    top: calc(-1 * ${tkn('spacing.xl')});
    margin-left: calc(-1 * ${tkn('spacing.xl')});
    margin-right: calc(-1 * ${tkn('spacing.xl')});
    padding: ${tkn('spacing.md')} ${tkn('spacing.xl')};
  }
`;

export const CardGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr;
  gap: ${tkn('spacing.lg')};
  margin-top: ${tkn('spacing.xl')};

  @media (min-width: 768px) {
    grid-template-columns: repeat(2, 1fr);
  }

  @media (min-width: 1200px) {
    grid-template-columns: repeat(3, 1fr);
  }
`;
```

---

## 🎨 Theme Token Reference

```typescript
// Colors
tkn('colors.background.primary')      // Main background
tkn('colors.background.secondary')    // Card background
tkn('colors.background.tertiary')     // Subtle highlight
tkn('colors.border.primary')          // Main border
tkn('colors.border.secondary')        // Subtle border
tkn('colors.text.primary')            // Main text
tkn('colors.text.secondary')          // Muted text
tkn('colors.brand.primary')           // Primary brand color
tkn('colors.semantic.success')        // Success/active
tkn('colors.semantic.warning')        // Warning/draft
tkn('colors.semantic.error')          // Error/delete

// Spacing
tkn('spacing.xs')   // 4px
tkn('spacing.sm')   // 8px
tkn('spacing.md')   // 16px
tkn('spacing.lg')   // 24px
tkn('spacing.xl')   // 32px

// Radius
tkn('radius.sm')    // 4px
tkn('radius.md')    // 8px
tkn('radius.lg')    // 12px

// Shadows
tkn('shadows.sm')   // Small shadow
tkn('shadows.md')   // Medium shadow

// Transitions
tkn('transitions.fast')    // 150ms
tkn('transitions.normal')  // 300ms
```

---

## 🌐 i18n Usage

```typescript
import { useTranslation } from 'react-i18next';

const { t } = useTranslation();

// Simple translation
t('listingSettings.title')  // "Listing Settings Groups"

// With variables
t('listingSettings.productsCount', { count: 5 })  // "5 products"

// Nested keys
t('listingSettings.validation.nameRequired')  // "Group name is required"

// In validation schema
const schema = (t: TFunction) => z.object({
  name: z.string().min(1, t('listingSettings.validation.nameRequired')),
});
```

---

## 🧪 Testing Commands

```bash
# Type check
pnpm typecheck

# Lint
pnpm lint

# Format
pnpm format

# Unit tests
pnpm test

# E2E tests
pnpm test:e2e

# Build
pnpm build

# Run all checks
pnpm validate
```

---

## 🐛 Common Issues & Solutions

### Issue 1: "Cannot find module '@repo/shared'"
**Solution**: Build shared package first
```bash
cd packages/shared
pnpm build
```

### Issue 2: Emotion theme type errors
**Solution**: Ensure `@emotion/react` is in peerDependencies, not dependencies
```json
// packages/ui/package.json
{
  "peerDependencies": {
    "@emotion/react": "^11.11.0",
    "@emotion/styled": "^11.11.0"
  }
}
```

### Issue 3: i18n keys not found
**Solution**: Check namespace and key path
```typescript
// Correct
t('listingSettings.title')

// Wrong
t('title')  // Missing namespace
```

### Issue 4: RTK Query not refetching
**Solution**: Check cache tags and invalidation
```typescript
// Provide tags
providesTags: ['ListingGroups']

// Invalidate tags
invalidatesTags: ['ListingGroups']
```

### Issue 5: Form validation not working
**Solution**: Ensure Zod schema is passed to resolver
```typescript
const { control } = useForm({
  resolver: zodResolver(listingSettingsGroupSchema(t)),
  defaultValues: { /* ... */ },
});
```

---

## 📊 Performance Tips

1. **Memoize expensive computations**
   ```typescript
   const sortedGroups = useMemo(() => {
     return groups.sort((a, b) => /* ... */);
   }, [groups]);
   ```

2. **Debounce live preview updates**
   ```typescript
   const debouncedUpdate = useMemo(
     () => debounce((value) => setPreview(value), 300),
     []
   );
   ```

3. **Lazy load HTML editor**
   ```typescript
   const HTMLEditor = lazy(() => import('./components/HTMLEditor'));
   ```

4. **Use RTK Query cache**
   ```typescript
   // Automatically cached for 60 seconds
   const { data } = useGetListingGroupsQuery();
   ```

---

## 🔒 Security Checklist

- [ ] JWT authentication on all endpoints
- [ ] Ownership check in service methods
- [ ] Input validation (frontend + backend)
- [ ] XSS prevention in HTML preview
- [ ] CSRF protection (if using cookies)
- [ ] Rate limiting on API
- [ ] SQL injection prevention (Prisma ORM)
- [ ] Sensitive data not logged

---

## 📝 Git Workflow

```bash
# 1. Create feature branch
git checkout -b feature/listing-settings-groups

# 2. Make changes and commit
git add .
git commit -m "feat: add listing settings groups domain types"

# 3. Push to remote
git push origin feature/listing-settings-groups

# 4. Create pull request
# Review, test, merge

# 5. Delete branch after merge
git branch -d feature/listing-settings-groups
```

---

## 📚 Documentation Links

- **Implementation Plan**: `listing-settings-implementation-plan.md`
- **API Contract**: `listing-settings-api-contract.md`
- **UI Design**: `listing-settings-ui-design.md`
- **Localization**: `listing-settings-localization.md`
- **Architecture**: `listing-settings-architecture.md`
- **Summary**: `listing-settings-summary.md`

---

## ✅ Pre-Deployment Checklist

### Backend
- [ ] All endpoints tested (Postman/Insomnia)
- [ ] Validation working (invalid data returns 400)
- [ ] Authorization working (unauthorized returns 403)
- [ ] Database migration applied
- [ ] Seed data loaded
- [ ] Error handling tested
- [ ] Logs reviewed

### Frontend
- [ ] All pages render correctly
- [ ] Form validation working
- [ ] API calls successful
- [ ] Loading states working
- [ ] Error states working
- [ ] Responsive on mobile/tablet/desktop
- [ ] i18n working (en/tr)
- [ ] No TypeScript errors
- [ ] No ESLint errors
- [ ] No console errors

### General
- [ ] Code reviewed
- [ ] Tests passing
- [ ] Documentation updated
- [ ] Changelog updated
- [ ] Version bumped

---

## 🎯 Success Metrics

- ✅ **Code Quality**: 0 TypeScript errors, 0 ESLint errors
- ✅ **Test Coverage**: >80% unit test coverage
- ✅ **Performance**: Page load <2s, API response <500ms
- ✅ **Accessibility**: WCAG AA compliant
- ✅ **i18n**: 100% strings localized
- ✅ **Type Safety**: 0 `any` types

---

**Happy Coding! 🚀**
