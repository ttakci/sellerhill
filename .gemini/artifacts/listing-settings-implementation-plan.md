# Listing Settings Groups - Implementation Plan

## Overview
This document defines the **Listing Settings Groups** feature, which allows users to create and manage listing group templates for eBay product listings. Each group contains repricing strategies, stock settings, fees, and listing templates.

**Reference Pattern**: All implementation follows the `store-settings` module pattern exactly.

---

## 1. Domain Model (Shared Package)

### File: `packages/shared/src/domain/listing-settings/listing-settings.types.ts`

```typescript
/**
 * Price Range for Repricing Strategy
 */
export interface PriceRange {
  id: string;
  minPrice: number;
  maxPrice: number;
  profitMarginPercent?: number;
  fixedProfitAmount?: number;
}

/**
 * Stock Configuration
 */
export interface StockConfig {
  defaultQuantity: number;
}

/**
 * Fee Configuration
 */
export interface FeeConfig {
  ebayFeePercent: number;
  fixedFeeAmount: number;
  taxPercent: number;
}

/**
 * Template Configuration
 */
export interface TemplateConfig {
  type: 'custom' | 'predefined';
  customTemplateHtml?: string;
  predefinedTemplateId?: string;
}

/**
 * Listing Settings Group Domain Interface
 */
export interface ListingSettingsGroup {
  id: string;
  storeId: string;
  name: string;
  description?: string;
  
  // Repricing Strategy
  repricingStrategy: PriceRange[];
  
  // Stock
  stock: StockConfig;
  
  // Fees
  fees: FeeConfig;
  
  // Templates
  templates: TemplateConfig;
  
  // Audit
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  updatedBy: string;
}

/**
 * Predefined Template
 */
export interface PredefinedTemplate {
  id: string;
  name: string;
  description: string;
  htmlContent: string;
  previewImage?: string;
  createdAt: Date;
}
```

### File: `packages/shared/src/domain/listing-settings/listing-settings.dto.ts`

```typescript
import { z } from 'zod';
import { TFunction } from 'i18next';

/**
 * Price Range Schema
 */
export const priceRangeSchema = (t: TFunction) =>
  z.object({
    id: z.string(),
    minPrice: z.number().min(0, t('validation.minPrice')),
    maxPrice: z.number().min(0, t('validation.maxPrice')),
    profitMarginPercent: z.number().min(0).max(100).optional(),
    fixedProfitAmount: z.number().min(0).optional(),
  }).refine(
    (data) => data.profitMarginPercent !== undefined || data.fixedProfitAmount !== undefined,
    { message: t('validation.profitRequired'), path: ['profitMarginPercent'] }
  ).refine(
    (data) => data.maxPrice > data.minPrice,
    { message: t('validation.maxPriceGreaterThanMin'), path: ['maxPrice'] }
  );

/**
 * Stock Config Schema
 */
export const stockConfigSchema = (t: TFunction) =>
  z.object({
    defaultQuantity: z.number().int().min(1, t('validation.minQuantity')),
  });

/**
 * Fee Config Schema
 */
export const feeConfigSchema = (t: TFunction) =>
  z.object({
    ebayFeePercent: z.number().min(0).max(100, t('validation.maxFeePercent')),
    fixedFeeAmount: z.number().min(0, t('validation.minFixedFee')),
    taxPercent: z.number().min(0).max(100, t('validation.maxTaxPercent')),
  });

/**
 * Template Config Schema
 */
export const templateConfigSchema = (t: TFunction) =>
  z.object({
    type: z.enum(['custom', 'predefined']),
    customTemplateHtml: z.string().optional(),
    predefinedTemplateId: z.string().optional(),
  }).refine(
    (data) => {
      if (data.type === 'custom') return !!data.customTemplateHtml;
      if (data.type === 'predefined') return !!data.predefinedTemplateId;
      return true;
    },
    { message: t('validation.templateRequired'), path: ['customTemplateHtml'] }
  );

/**
 * Listing Settings Group Form Schema
 */
export const listingSettingsGroupSchema = (t: TFunction) =>
  z.object({
    name: z.string().min(1, t('validation.nameRequired')),
    description: z.string().optional(),
    repricingStrategy: z.array(priceRangeSchema(t)).min(1, t('validation.minOnePriceRange')),
    stock: stockConfigSchema(t),
    fees: feeConfigSchema(t),
    templates: templateConfigSchema(t),
  });

export type ListingSettingsGroupFormData = z.infer<ReturnType<typeof listingSettingsGroupSchema>>;
```

### File: `packages/shared/src/domain/listing-settings/index.ts`

```typescript
export * from './listing-settings.types';
export * from './listing-settings.dto';
```

---

## 2. Backend API (NestJS)

### File: `apps/api/src/modules/listing-settings/listing-settings.controller.ts`

```typescript
import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ListingSettingsService } from './listing-settings.service';
import { CreateListingGroupDto, UpdateListingGroupDto } from './dto';

@Controller('listing-settings')
@UseGuards(JwtAuthGuard)
export class ListingSettingsController {
  constructor(private readonly listingSettingsService: ListingSettingsService) {}

  @Get('groups')
  async getGroups(@CurrentUser() user: any, @Query('storeId') storeId?: string) {
    return this.listingSettingsService.getGroups(user.id, storeId);
  }

  @Get('groups/:id')
  async getGroupById(@Param('id') id: string, @CurrentUser() user: any) {
    return this.listingSettingsService.getGroupById(id, user.id);
  }

  @Post('groups')
  async createGroup(@Body() dto: CreateListingGroupDto, @CurrentUser() user: any) {
    return this.listingSettingsService.createGroup(dto, user.id);
  }

  @Put('groups/:id')
  async updateGroup(
    @Param('id') id: string,
    @Body() dto: UpdateListingGroupDto,
    @CurrentUser() user: any,
  ) {
    return this.listingSettingsService.updateGroup(id, dto, user.id);
  }

  @Delete('groups/:id')
  async deleteGroup(@Param('id') id: string, @CurrentUser() user: any) {
    return this.listingSettingsService.deleteGroup(id, user.id);
  }

  @Get('predefined-templates')
  async getPredefinedTemplates() {
    return this.listingSettingsService.getPredefinedTemplates();
  }
}
```

### File: `apps/api/src/modules/listing-settings/listing-settings.service.ts`

```typescript
import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateListingGroupDto, UpdateListingGroupDto } from './dto';

@Injectable()
export class ListingSettingsService {
  constructor(private prisma: PrismaService) {}

  async getGroups(userId: string, storeId?: string) {
    const where: any = { createdBy: userId };
    if (storeId) {
      where.storeId = storeId;
    }

    return this.prisma.listingSettingsGroup.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
    });
  }

  async getGroupById(id: string, userId: string) {
    const group = await this.prisma.listingSettingsGroup.findUnique({
      where: { id },
    });

    if (!group) {
      throw new NotFoundException('Listing group not found');
    }

    if (group.createdBy !== userId) {
      throw new ForbiddenException('Access denied');
    }

    return group;
  }

  async createGroup(dto: CreateListingGroupDto, userId: string) {
    return this.prisma.listingSettingsGroup.create({
      data: {
        ...dto,
        createdBy: userId,
        updatedBy: userId,
      },
    });
  }

  async updateGroup(id: string, dto: UpdateListingGroupDto, userId: string) {
    const group = await this.getGroupById(id, userId);

    return this.prisma.listingSettingsGroup.update({
      where: { id },
      data: {
        ...dto,
        updatedBy: userId,
      },
    });
  }

  async deleteGroup(id: string, userId: string) {
    const group = await this.getGroupById(id, userId);

    await this.prisma.listingSettingsGroup.delete({
      where: { id },
    });

    return { success: true };
  }

  async getPredefinedTemplates() {
    return this.prisma.predefinedTemplate.findMany({
      orderBy: { createdAt: 'asc' },
    });
  }
}
```

### File: `apps/api/src/modules/listing-settings/dto/create-listing-group.dto.ts`

```typescript
import { IsString, IsOptional, IsArray, ValidateNested, IsNumber, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';

class PriceRangeDto {
  @IsNumber()
  minPrice: number;

  @IsNumber()
  maxPrice: number;

  @IsOptional()
  @IsNumber()
  profitMarginPercent?: number;

  @IsOptional()
  @IsNumber()
  fixedProfitAmount?: number;
}

class StockConfigDto {
  @IsNumber()
  defaultQuantity: number;
}

class FeeConfigDto {
  @IsNumber()
  ebayFeePercent: number;

  @IsNumber()
  fixedFeeAmount: number;

  @IsNumber()
  taxPercent: number;
}

class TemplateConfigDto {
  @IsEnum(['custom', 'predefined'])
  type: 'custom' | 'predefined';

  @IsOptional()
  @IsString()
  customTemplateHtml?: string;

  @IsOptional()
  @IsString()
  predefinedTemplateId?: string;
}

export class CreateListingGroupDto {
  @IsString()
  storeId: string;

  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PriceRangeDto)
  repricingStrategy: PriceRangeDto[];

  @ValidateNested()
  @Type(() => StockConfigDto)
  stock: StockConfigDto;

  @ValidateNested()
  @Type(() => FeeConfigDto)
  fees: FeeConfigDto;

  @ValidateNested()
  @Type(() => TemplateConfigDto)
  templates: TemplateConfigDto;
}
```

### File: `apps/api/src/modules/listing-settings/dto/update-listing-group.dto.ts`

```typescript
import { PartialType } from '@nestjs/mapped-types';
import { CreateListingGroupDto } from './create-listing-group.dto';

export class UpdateListingGroupDto extends PartialType(CreateListingGroupDto) {}
```

---

## 3. Database Schema (Prisma)

Add to `schema.prisma`:

```prisma
model ListingSettingsGroup {
  id                String   @id @default(cuid())
  storeId           String
  name              String
  description       String?
  
  repricingStrategy Json     // Array of PriceRange
  stock             Json     // StockConfig
  fees              Json     // FeeConfig
  templates         Json     // TemplateConfig
  
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  createdBy         String
  updatedBy         String
  
  @@index([storeId])
  @@index([createdBy])
}

model PredefinedTemplate {
  id           String   @id @default(cuid())
  name         String
  description  String
  htmlContent  String   @db.Text
  previewImage String?
  createdAt    DateTime @default(now())
}
```

### Seed Data for Predefined Templates

```typescript
// apps/api/prisma/seeds/predefined-templates.seed.ts

export const predefinedTemplates = [
  {
    name: 'Modern Minimalist',
    description: 'Clean and professional design with focus on product details',
    htmlContent: `
      <div class="listing-container">
        <h1>{{product_title}}</h1>
        <div class="product-image">
          <img src="{{product_image}}" alt="{{product_title}}">
        </div>
        <div class="description">
          <h2>Product Description</h2>
          <p>{{product_description}}</p>
        </div>
        <div class="specifications">
          <h2>Specifications</h2>
          {{product_specs}}
        </div>
      </div>
      <style>
        .listing-container { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; }
        h1 { color: #333; font-size: 28px; }
        .product-image img { width: 100%; border-radius: 8px; }
        .description, .specifications { margin-top: 24px; }
      </style>
    `,
  },
  {
    name: 'Premium Electronics',
    description: 'High-end design for electronics with technical specifications',
    htmlContent: `
      <div class="premium-listing">
        <div class="header">
          <span class="badge">TOP RATED PLUS</span>
          <span class="badge new">NEW IN BOX</span>
        </div>
        <h1>{{product_title}}</h1>
        <div class="gallery">
          <img src="{{product_image}}" alt="{{product_title}}">
        </div>
        <div class="features">
          <h2>Key Features</h2>
          {{product_features}}
        </div>
        <div class="tech-specs">
          <h2>Technical Specifications</h2>
          {{product_specs}}
        </div>
        <div class="shipping-info">
          <p>✓ Fast & Free Shipping</p>
          <p>✓ 30-Day Returns</p>
          <p>✓ 1-Year Warranty</p>
        </div>
      </div>
      <style>
        .premium-listing { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 40px; }
        .badge { background: #ffd700; color: #000; padding: 4px 12px; border-radius: 4px; margin-right: 8px; }
        .gallery img { width: 100%; box-shadow: 0 10px 40px rgba(0,0,0,0.3); }
      </style>
    `,
  },
  {
    name: 'E-commerce Classic',
    description: 'Traditional layout with clear sections and call-to-action',
    htmlContent: `
      <div class="classic-template">
        <div class="banner">
          <h1>{{product_title}}</h1>
          <p class="price">US ${{product_price}}</p>
        </div>
        <div class="content">
          <div class="image-section">
            <img src="{{product_image}}" alt="{{product_title}}">
          </div>
          <div class="info-section">
            <h2>About This Item</h2>
            <p>{{product_description}}</p>
            <div class="cta">
              <button>Buy It Now</button>
              <button>Add to Cart</button>
            </div>
          </div>
        </div>
        <div class="footer">
          <p>Estimated delivery: {{delivery_date}}</p>
        </div>
      </div>
      <style>
        .classic-template { max-width: 1000px; margin: 0 auto; font-family: 'Helvetica Neue', sans-serif; }
        .banner { background: #f7f7f7; padding: 20px; text-align: center; }
        .content { display: flex; gap: 40px; margin-top: 20px; }
        .cta button { background: #3665f3; color: white; padding: 12px 24px; border: none; border-radius: 4px; margin-right: 10px; cursor: pointer; }
      </style>
    `,
  },
];
```

---

## 4. Frontend Implementation

### File: `apps/web/src/features/listing-settings/ListingSettingsPage.types.ts`

```typescript
import { ListingSettingsGroup, PredefinedTemplate } from '@repo/shared';

export interface ListingSettingsPageProps {
  groups: ListingSettingsGroup[];
  predefinedTemplates: PredefinedTemplate[];
  onCreateGroup: () => void;
  onEditGroup: (id: string) => void;
  onDeleteGroup: (id: string) => void;
}

export interface ListingGroupFormProps {
  group?: ListingSettingsGroup;
  predefinedTemplates: PredefinedTemplate[];
  onSave: (data: any) => void;
  onCancel: () => void;
}
```

### File: `apps/web/src/features/listing-settings/api/listing-settings.api.ts`

```typescript
import { baseApi } from '@/store/api/baseApi';
import { ListingSettingsGroup, PredefinedTemplate } from '@repo/shared';

export const listingSettingsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getListingGroups: builder.query<ListingSettingsGroup[], string | undefined>({
      query: (storeId) => ({
        url: '/listing-settings/groups',
        params: storeId ? { storeId } : undefined,
      }),
      providesTags: ['ListingGroups'],
    }),

    getListingGroupById: builder.query<ListingSettingsGroup, string>({
      query: (id) => `/listing-settings/groups/${id}`,
      providesTags: (result, error, id) => [{ type: 'ListingGroups', id }],
    }),

    createListingGroup: builder.mutation<ListingSettingsGroup, any>({
      query: (data) => ({
        url: '/listing-settings/groups',
        method: 'POST',
        body: data,
      }),
      invalidatesTags: ['ListingGroups'],
    }),

    updateListingGroup: builder.mutation<ListingSettingsGroup, { id: string; data: any }>({
      query: ({ id, data }) => ({
        url: `/listing-settings/groups/${id}`,
        method: 'PUT',
        body: data,
      }),
      invalidatesTags: (result, error, { id }) => [{ type: 'ListingGroups', id }, 'ListingGroups'],
    }),

    deleteListingGroup: builder.mutation<void, string>({
      query: (id) => ({
        url: `/listing-settings/groups/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['ListingGroups'],
    }),

    getPredefinedTemplates: builder.query<PredefinedTemplate[], void>({
      query: () => '/listing-settings/predefined-templates',
      providesTags: ['PredefinedTemplates'],
    }),
  }),
});

export const {
  useGetListingGroupsQuery,
  useGetListingGroupByIdQuery,
  useCreateListingGroupMutation,
  useUpdateListingGroupMutation,
  useDeleteListingGroupMutation,
  useGetPredefinedTemplatesQuery,
} = listingSettingsApi;
```

---

## 5. UI Layout Structure

### List View (Card Grid)
- **Header**: Sticky header with "Create New Group" button
- **Grid**: Responsive card grid showing all listing groups
- **Card**: Each card shows:
  - Icon/badge
  - Group name
  - Description
  - Product count
  - Status badge (Active/Draft/Inactive)
  - Edit/Delete actions

### Form View (Two-Column Layout)
- **Left Column (Scrollable)**: Form fields
  - Group Details (name, description)
  - Repricing Strategy (dynamic price ranges)
  - Stock Settings
  - Fees
  - Template Selection (Custom/Predefined toggle)
  - HTML Editor (if custom)
- **Right Column (Fixed)**: Live Preview
  - Desktop/Mobile toggle
  - Dark mode preview toggle
  - Rendered HTML preview

---

## 6. Localization Keys

### File: `packages/shared/src/i18n/resources/en/listing-settings.json`

```json
{
  "title": "Listing Settings Groups",
  "subtitle": "Manage and assign strategy templates to your product listings for automated optimization.",
  "createNewGroup": "Create New Group",
  "editGroup": "Edit Listing Group",
  "groupName": "Group Name",
  "groupNamePlaceholder": "e.g., Premium Electronics",
  "description": "Description",
  "descriptionPlaceholder": "Enter group internal notes...",
  "repricingStrategy": "Repricing Strategy",
  "addPriceRange": "Add Price Range",
  "minPrice": "Min Price ($)",
  "maxPrice": "Max Price ($)",
  "profitMargin": "Profit Margin (%)",
  "fixedProfit": "Fixed Profit ($)",
  "stock": "Stock",
  "defaultQuantity": "Default Quantity",
  "fees": "Fees",
  "ebayFee": "eBay Fee",
  "fixedFee": "Fixed Fee",
  "tax": "Tax",
  "templates": "Template",
  "customTemplate": "Custom",
  "predefinedTemplate": "Predefined",
  "selectTemplate": "Select Template",
  "htmlEditor": "HTML Editor",
  "preview": "Preview",
  "darkModePreview": "Dark Mode Preview",
  "saveChanges": "Save Changes",
  "cancel": "Cancel",
  "deleteGroup": "Delete Group",
  "confirmDelete": "Are you sure you want to delete this group?",
  "productsCount": "{{count}} products",
  "statusActive": "Active",
  "statusDraft": "Draft",
  "statusInactive": "Inactive",
  "validation": {
    "nameRequired": "Group name is required",
    "minPrice": "Minimum price must be greater than 0",
    "maxPrice": "Maximum price must be greater than 0",
    "maxPriceGreaterThanMin": "Maximum price must be greater than minimum price",
    "profitRequired": "Either profit margin or fixed profit is required",
    "minQuantity": "Quantity must be at least 1",
    "maxFeePercent": "Fee percentage cannot exceed 100%",
    "minFixedFee": "Fixed fee must be 0 or greater",
    "maxTaxPercent": "Tax percentage cannot exceed 100%",
    "templateRequired": "Template content is required",
    "minOnePriceRange": "At least one price range is required"
  }
}
```

---

## 7. Styling Tokens

All styles will use existing theme tokens from `StoreSettingsPage.style.ts`:
- `tkn('colors.background.secondary')` - Card backgrounds
- `tkn('colors.border.primary')` - Borders
- `tkn('spacing.md')`, `tkn('spacing.lg')` - Spacing
- `tkn('radius.lg')` - Border radius
- `tkn('shadows.sm')` - Shadows
- Sticky header pattern from StoreSettings

---

## 8. Implementation Checklist

### Phase 1: Domain & API
- [ ] Create `packages/shared/src/domain/listing-settings/` types
- [ ] Create DTO schemas with Zod validation
- [ ] Create Prisma schema models
- [ ] Seed predefined templates
- [ ] Create NestJS module, controller, service
- [ ] Test API endpoints

### Phase 2: Frontend - List View
- [ ] Create RTK Query API slice
- [ ] Create ListingSettingsPage container
- [ ] Create ListingSettingsPage component (card grid)
- [ ] Create ListingGroupCard component
- [ ] Add localization keys (en/tr)
- [ ] Style with Emotion (follow StoreSettings pattern)

### Phase 3: Frontend - Form View
- [ ] Create ListingGroupForm container
- [ ] Create ListingGroupForm component (two-column layout)
- [ ] Create PriceRangeInput component (dynamic array)
- [ ] Create TemplateSelector component
- [ ] Create HTMLEditor component
- [ ] Create LivePreview component
- [ ] Implement form validation with React Hook Form + Zod

### Phase 4: Polish
- [ ] Responsive design (mobile-first)
- [ ] Sticky header
- [ ] Loading states
- [ ] Error handling
- [ ] Confirmation modals
- [ ] Preview toggle (desktop/mobile, dark mode)

---

## 9. API Contract Summary

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/listing-settings/groups?storeId={id}` | Get all groups (optionally filtered by store) |
| GET | `/listing-settings/groups/:id` | Get single group by ID |
| POST | `/listing-settings/groups` | Create new group |
| PUT | `/listing-settings/groups/:id` | Update existing group |
| DELETE | `/listing-settings/groups/:id` | Delete group |
| GET | `/listing-settings/predefined-templates` | Get all predefined templates |

---

## 10. Notes

- **NO new patterns**: Follow `store-settings` module exactly
- **Colors/Typography**: Use global theme tokens, NOT custom colors from design mockup
- **Sticky Header**: Same pattern as StoreSettings
- **Responsive**: Mobile-first, sidebar hidden <1024px
- **Validation**: Frontend (Zod) + Backend (class-validator)
- **i18n**: All strings localized (en/tr)
- **RTK Query**: All API calls via `baseApi.injectEndpoints`
- **Container/Component**: Strict separation of logic and presentation
