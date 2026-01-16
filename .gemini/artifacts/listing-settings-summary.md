# Listing Settings Groups - Feature Summary

## 📋 Overview

The **Listing Settings Groups** feature allows users to create and manage reusable templates for eBay product listings. Each group contains:
- **Repricing Strategy**: Multiple price ranges with profit margins
- **Stock Settings**: Default quantities and auto-restock options
- **Fees**: eBay fees, fixed fees, and tax percentages
- **Templates**: Custom HTML or predefined professional templates

---

## 📦 Deliverables

### 1. Implementation Plan
**File**: `listing-settings-implementation-plan.md`

Complete technical specification including:
- Domain models (TypeScript interfaces)
- DTO schemas (Zod validation)
- Database schema (Prisma)
- NestJS backend (controller, service, DTOs)
- React frontend (containers, components, API slice)
- Implementation checklist (4 phases)

### 2. API Contract
**File**: `listing-settings-api-contract.md`

RESTful API documentation:
- 6 endpoints (CRUD + predefined templates)
- Request/response examples
- Validation rules
- Error handling
- Authentication requirements

### 3. UI Design Specification
**File**: `listing-settings-ui-design.md`

Detailed UI/UX design:
- Card grid layout (list view)
- Two-column form layout (edit view)
- Component breakdown
- Responsive breakpoints
- Color palette (theme tokens)
- Typography system
- Interactions and animations
- Accessibility guidelines

### 4. Localization
**File**: `listing-settings-localization.md`

Complete i18n keys:
- English (en) translations
- Turkish (tr) translations
- Validation messages
- Error/success messages
- Tooltips and help text
- Pluralization support

---

## 🎯 Key Requirements (Fulfilled)

✅ **No New Patterns**: Follows `store-settings` module exactly  
✅ **Theme Tokens**: Uses global theme, NOT custom colors from mockup  
✅ **Sticky Header**: Same pattern as StoreSettings  
✅ **Responsive**: Mobile-first, sidebar hidden <1024px  
✅ **Validation**: Frontend (Zod) + Backend (class-validator)  
✅ **i18n**: All strings localized (en/tr)  
✅ **RTK Query**: All API calls via `baseApi.injectEndpoints`  
✅ **Container/Component**: Strict separation of logic and presentation  
✅ **Predefined Templates**: 3 professional HTML templates seeded in database  

---

## 🗂️ File Structure

```
zonds/
├── packages/shared/src/
│   ├── domain/listing-settings/
│   │   ├── listing-settings.types.ts       # Domain interfaces
│   │   ├── listing-settings.dto.ts         # Zod schemas
│   │   └── index.ts
│   └── i18n/resources/
│       ├── en/listing-settings.json        # English translations
│       └── tr/listing-settings.json        # Turkish translations
│
├── apps/api/src/modules/listing-settings/
│   ├── listing-settings.controller.ts      # REST endpoints
│   ├── listing-settings.service.ts         # Business logic
│   ├── listing-settings.module.ts          # NestJS module
│   └── dto/
│       ├── create-listing-group.dto.ts     # Create DTO
│       └── update-listing-group.dto.ts     # Update DTO
│
├── apps/web/src/features/listing-settings/
│   ├── ListingSettingsPage.container.tsx   # Logic & RTK Query
│   ├── ListingSettingsPage.component.tsx   # Card Grid UI
│   ├── ListingSettingsPage.style.ts        # Emotion styles
│   ├── ListingSettingsPage.types.ts        # Component types
│   ├── ListingGroupForm.container.tsx      # Form logic
│   ├── ListingGroupForm.component.tsx      # Form UI
│   ├── ListingGroupForm.style.ts           # Form styles
│   ├── api/listing-settings.api.ts         # RTK Query slice
│   ├── components/
│   │   ├── ListingGroupCard.tsx            # Individual card
│   │   ├── PriceRangeInput.tsx             # Dynamic price ranges
│   │   ├── TemplateSelector.tsx            # Template picker
│   │   ├── HTMLEditor.tsx                  # Code editor
│   │   └── LivePreview.tsx                 # Preview pane
│   └── index.ts
│
└── apps/api/prisma/
    ├── schema.prisma                        # Database schema
    └── seeds/predefined-templates.seed.ts   # Template seeds
```

---

## 🔌 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/listing-settings/groups` | Get all groups (optional `?storeId` filter) |
| `GET` | `/listing-settings/groups/:id` | Get single group by ID |
| `POST` | `/listing-settings/groups` | Create new group |
| `PUT` | `/listing-settings/groups/:id` | Update existing group |
| `DELETE` | `/listing-settings/groups/:id` | Delete group |
| `GET` | `/listing-settings/predefined-templates` | Get all predefined templates |

---

## 🎨 UI Screens

### Screen 1: Listing Groups Overview
- **Layout**: Responsive card grid (1/2/3 columns)
- **Header**: Sticky header with "Create New Group" button
- **Cards**: Icon, name, description, product count, status badge, actions
- **Empty State**: Friendly message with CTA button

### Screen 2: Edit Listing Group
- **Layout**: Two-column (45% form / 55% preview)
- **Left Column**: Scrollable form sections
  - Group Details
  - Repricing Strategy (dynamic price ranges)
  - Stock Settings
  - Fees
  - Template (Custom/Predefined toggle + HTML editor)
- **Right Column**: Fixed live preview
  - Desktop/Mobile toggle
  - Dark mode preview toggle
  - Rendered HTML with mock data

---

## 🗄️ Database Schema

### `ListingSettingsGroup` Table
```prisma
model ListingSettingsGroup {
  id                String   @id @default(cuid())
  storeId           String
  name              String
  description       String?
  repricingStrategy Json     // PriceRange[]
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
```

### `PredefinedTemplate` Table
```prisma
model PredefinedTemplate {
  id           String   @id @default(cuid())
  name         String
  description  String
  htmlContent  String   @db.Text
  previewImage String?
  createdAt    DateTime @default(now())
}
```

**Seed Data**: 3 predefined templates
1. Modern Minimalist
2. Premium Electronics
3. E-commerce Classic

---

## 🧩 Domain Types

### Core Interfaces
```typescript
interface ListingSettingsGroup {
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

interface PriceRange {
  id: string;
  minPrice: number;
  maxPrice: number;
  profitMarginPercent?: number;
  fixedProfitAmount?: number;
}

interface StockConfig {
  defaultQuantity: number;
}

interface FeeConfig {
  ebayFeePercent: number;
  fixedFeeAmount: number;
  taxPercent: number;
}

interface TemplateConfig {
  type: 'custom' | 'predefined';
  customTemplateHtml?: string;
  predefinedTemplateId?: string;
}
```

---

## ✅ Validation Rules

### Price Range
- `minPrice` >= 0
- `maxPrice` > `minPrice`
- Either `profitMarginPercent` (0-100) OR `fixedProfitAmount` (>= 0) required

### Stock
- `defaultQuantity`: integer >= 1

### Fees
- `ebayFeePercent`: 0-100
- `fixedFeeAmount`: >= 0
- `taxPercent`: 0-100

### Templates
- If `type` = "custom": `customTemplateHtml` required (min 10 chars)
- If `type` = "predefined": `predefinedTemplateId` required

### General
- `name`: required, 3-100 chars
- `repricingStrategy`: min 1 price range, max 10

---

## 🎨 Design System

### Colors (Theme Tokens)
- `colors.background.secondary` - Card backgrounds
- `colors.border.primary` - Borders
- `colors.text.primary` - Main text
- `colors.text.secondary` - Muted text
- `colors.brand.primary` - Primary buttons
- `colors.semantic.success` - Active status
- `colors.semantic.warning` - Draft status

### Typography
- Page Title: `Text variant="h3" weight="bold" fontSize="26px"`
- Section Title: `Text variant="h4" weight="bold" fontSize="1.125rem"`
- Body: `Text variant="body"`
- Caption: `Text variant="caption" color="text.secondary"`

### Spacing
- Container: `spacing.md` (mobile), `spacing.xl` (desktop)
- Card Gap: `spacing.lg`
- Section Gap: `spacing.xl`

### Responsive
- Mobile: < 768px (1 column)
- Tablet: 768px-1024px (2 columns)
- Desktop: 1024px+ (3 columns, two-column form)

---

## 🌐 Localization

### Namespaces
- `listingSettings.title`
- `listingSettings.validation.nameRequired`
- `listingSettings.errors.loadFailed`
- `listingSettings.success.created`

### Pluralization
```typescript
t('listingSettings.productsCount', { count: 5 })
// English: "5 products"
// Turkish: "5 ürün"
```

### Template Variables
```html
<!-- In HTML templates -->
{{product_title}}
{{product_price}}
{{product_image}}
{{product_description}}
{{product_specs}}
```

---

## 🚀 Implementation Phases

### Phase 1: Domain & API (Backend)
1. Create shared domain types
2. Create Zod validation schemas
3. Create Prisma schema
4. Seed predefined templates
5. Create NestJS module, controller, service
6. Test API endpoints

### Phase 2: Frontend - List View
1. Create RTK Query API slice
2. Create ListingSettingsPage container
3. Create ListingSettingsPage component (card grid)
4. Create ListingGroupCard component
5. Add localization keys (en/tr)
6. Style with Emotion

### Phase 3: Frontend - Form View
1. Create ListingGroupForm container
2. Create ListingGroupForm component (two-column)
3. Create PriceRangeInput component
4. Create TemplateSelector component
5. Create HTMLEditor component
6. Create LivePreview component
7. Implement form validation

### Phase 4: Polish
1. Responsive design
2. Sticky header
3. Loading states
4. Error handling
5. Confirmation modals
6. Preview toggles (desktop/mobile, dark mode)

---

## 🔒 Security & Authorization

- **Authentication**: JWT required for all endpoints
- **Authorization**: Users can only access their own groups
- **Validation**: Frontend (Zod) + Backend (class-validator)
- **XSS Prevention**: HTML templates should be sanitized during preview
- **Rate Limiting**: 100 requests/minute per user

---

## 🧪 Testing Checklist

### Backend
- [ ] Create group (valid data)
- [ ] Create group (invalid data - validation errors)
- [ ] Get all groups (with/without storeId filter)
- [ ] Get single group (exists)
- [ ] Get single group (not found)
- [ ] Update group (owner)
- [ ] Update group (not owner - forbidden)
- [ ] Delete group (owner)
- [ ] Delete group (not owner - forbidden)
- [ ] Get predefined templates

### Frontend
- [ ] List view renders cards
- [ ] Empty state shows when no groups
- [ ] Create new group opens form
- [ ] Form validation (all fields)
- [ ] Add/remove price ranges
- [ ] Toggle custom/predefined template
- [ ] HTML editor syntax highlighting
- [ ] Live preview updates on change
- [ ] Desktop/mobile preview toggle
- [ ] Dark mode preview toggle
- [ ] Save group (success)
- [ ] Save group (error handling)
- [ ] Delete group (confirmation modal)
- [ ] Responsive layout (mobile/tablet/desktop)
- [ ] Sticky header behavior
- [ ] Loading states
- [ ] i18n (switch language)

---

## 📚 Reference Implementation

**Golden Example**: `store-settings` module

All patterns, naming conventions, and architectural decisions should match the existing `store-settings` implementation:

- **Backend**: `apps/api/src/modules/store-settings/`
- **Frontend**: `apps/web/src/features/store-settings/`
- **Shared**: `packages/shared/src/domain/store-settings/`

---

## 🚫 Anti-Patterns (Avoid)

❌ Creating new architectural patterns  
❌ Using custom colors from mockup (use theme tokens)  
❌ Hardcoded strings (use i18n)  
❌ Direct fetch/axios calls (use RTK Query)  
❌ Inline styles (use Emotion styled components)  
❌ `any` types (use proper TypeScript types)  
❌ Logic in component files (use container pattern)  

---

## 📝 Notes

1. **Predefined Templates**: Users can select a predefined template, then switch to custom to edit the HTML
2. **Template Variables**: Support `{{product_title}}`, `{{product_price}}`, etc. in HTML templates
3. **Auto-save**: Optional feature for future enhancement (debounced save every 30s)
4. **Unsaved Changes**: Prompt user before navigating away if form is dirty
5. **Cascading Deletes**: Deleting a group does NOT delete products (orphaned references handled by product service)
6. **Concurrency**: No optimistic locking (last write wins)
7. **Pagination**: Not implemented initially (all groups returned in single response)
8. **Search/Filter**: Future enhancement (search by name, filter by status)

---

## 🎉 Success Criteria

✅ All API endpoints functional and tested  
✅ Frontend matches design specification  
✅ Responsive on mobile/tablet/desktop  
✅ All strings localized (en/tr)  
✅ Form validation working (frontend + backend)  
✅ Live preview rendering correctly  
✅ Sticky header behaves like StoreSettings  
✅ No TypeScript errors  
✅ No ESLint errors  
✅ No hardcoded strings  
✅ No `any` types  
✅ Container/Component pattern followed  
✅ Theme tokens used (no custom colors)  

---

## 📞 Support

For questions or clarifications, refer to:
1. **Implementation Plan**: Technical details
2. **API Contract**: Endpoint specifications
3. **UI Design**: Layout and styling
4. **Localization**: Translation keys
5. **StoreSettings Module**: Reference implementation

---

**Status**: ✅ Design Complete - Ready for Implementation

**Estimated Effort**: 
- Backend: 8-10 hours
- Frontend: 12-16 hours
- Testing: 4-6 hours
- **Total**: 24-32 hours

**Priority**: High (Second Settings Feature)

**Dependencies**: 
- Existing `store-settings` module (reference)
- `@repo/ui` components (Card, Badge, Table, etc.)
- `@repo/shared` domain types
- RTK Query setup
- i18n configuration
