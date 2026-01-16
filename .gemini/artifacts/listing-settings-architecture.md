# Listing Settings Groups - Architecture & Data Flow

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         FRONTEND (React + Vite)                      │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │  ListingSettingsPage.container.tsx                         │    │
│  │  ┌──────────────────────────────────────────────────────┐  │    │
│  │  │ RTK Query Hooks:                                     │  │    │
│  │  │ - useGetListingGroupsQuery()                         │  │    │
│  │  │ - useCreateListingGroupMutation()                    │  │    │
│  │  │ - useUpdateListingGroupMutation()                    │  │    │
│  │  │ - useDeleteListingGroupMutation()                    │  │    │
│  │  │ - useGetPredefinedTemplatesQuery()                   │  │    │
│  │  └──────────────────────────────────────────────────────┘  │    │
│  │                           │                                 │    │
│  │                           ▼                                 │    │
│  │  ┌──────────────────────────────────────────────────────┐  │    │
│  │  │ Props: { groups, onCreateGroup, onEditGroup, ... }  │  │    │
│  │  └──────────────────────────────────────────────────────┘  │    │
│  └────────────────────────────────────────────────────────────┘    │
│                           │                                         │
│                           ▼                                         │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │  ListingSettingsPage.component.tsx                         │    │
│  │  ┌──────────────────────────────────────────────────────┐  │    │
│  │  │ UI Components:                                       │  │    │
│  │  │ - Header (Sticky)                                    │  │    │
│  │  │ - Card Grid (Responsive)                             │  │    │
│  │  │ - ListingGroupCard (for each group)                  │  │    │
│  │  │ - Empty State                                        │  │    │
│  │  └──────────────────────────────────────────────────────┘  │    │
│  └────────────────────────────────────────────────────────────┘    │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │  ListingGroupForm.container.tsx                            │    │
│  │  ┌──────────────────────────────────────────────────────┐  │    │
│  │  │ React Hook Form:                                     │  │    │
│  │  │ - useForm<ListingSettingsGroupFormData>()            │  │    │
│  │  │ - Zod Validation (listingSettingsGroupSchema)        │  │    │
│  │  │ - handleSubmit, watch, setValue                      │  │    │
│  │  └──────────────────────────────────────────────────────┘  │    │
│  │                           │                                 │    │
│  │                           ▼                                 │    │
│  │  ┌──────────────────────────────────────────────────────┐  │    │
│  │  │ Props: { group, onSave, onCancel, ... }             │  │    │
│  │  └──────────────────────────────────────────────────────┘  │    │
│  └────────────────────────────────────────────────────────────┘    │
│                           │                                         │
│                           ▼                                         │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │  ListingGroupForm.component.tsx                            │    │
│  │  ┌──────────────────────────────────────────────────────┐  │    │
│  │  │ Two-Column Layout:                                   │  │    │
│  │  │ - Left: Form Sections (Group Details, Repricing,     │  │    │
│  │  │         Stock, Fees, Templates)                      │  │    │
│  │  │ - Right: Live Preview (Desktop/Mobile, Dark Mode)    │  │    │
│  │  └──────────────────────────────────────────────────────┘  │    │
│  └────────────────────────────────────────────────────────────┘    │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
                                 │
                                 │ HTTP Requests (JWT Auth)
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      API LAYER (RTK Query)                           │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │  listing-settings.api.ts (RTK Query Slice)                 │    │
│  │  ┌──────────────────────────────────────────────────────┐  │    │
│  │  │ baseApi.injectEndpoints({                            │  │    │
│  │  │   getListingGroups: builder.query(...)               │  │    │
│  │  │   getListingGroupById: builder.query(...)            │  │    │
│  │  │   createListingGroup: builder.mutation(...)          │  │    │
│  │  │   updateListingGroup: builder.mutation(...)          │  │    │
│  │  │   deleteListingGroup: builder.mutation(...)          │  │    │
│  │  │   getPredefinedTemplates: builder.query(...)         │  │    │
│  │  │ })                                                    │  │    │
│  │  └──────────────────────────────────────────────────────┘  │    │
│  │                                                              │    │
│  │  Cache Tags: ['ListingGroups', 'PredefinedTemplates']      │    │
│  │  Auto-invalidation on mutations                             │    │
│  └────────────────────────────────────────────────────────────┘    │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
                                 │
                                 │ REST API Calls
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       BACKEND (NestJS)                               │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │  listing-settings.controller.ts                            │    │
│  │  ┌──────────────────────────────────────────────────────┐  │    │
│  │  │ @Controller('listing-settings')                      │  │    │
│  │  │ @UseGuards(JwtAuthGuard)                             │  │    │
│  │  │                                                       │  │    │
│  │  │ GET    /groups?storeId={id}                          │  │    │
│  │  │ GET    /groups/:id                                   │  │    │
│  │  │ POST   /groups                                       │  │    │
│  │  │ PUT    /groups/:id                                   │  │    │
│  │  │ DELETE /groups/:id                                   │  │    │
│  │  │ GET    /predefined-templates                         │  │    │
│  │  └──────────────────────────────────────────────────────┘  │    │
│  └────────────────────────────────────────────────────────────┘    │
│                           │                                         │
│                           ▼                                         │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │  listing-settings.service.ts                               │    │
│  │  ┌──────────────────────────────────────────────────────┐  │    │
│  │  │ Business Logic:                                      │  │    │
│  │  │ - getGroups(userId, storeId?)                        │  │    │
│  │  │ - getGroupById(id, userId)                           │  │    │
│  │  │ - createGroup(dto, userId)                           │  │    │
│  │  │ - updateGroup(id, dto, userId)                       │  │    │
│  │  │ - deleteGroup(id, userId)                            │  │    │
│  │  │ - getPredefinedTemplates()                           │  │    │
│  │  │                                                       │  │    │
│  │  │ Authorization: Check userId ownership                │  │    │
│  │  │ Validation: class-validator DTOs                     │  │    │
│  │  └──────────────────────────────────────────────────────┘  │    │
│  └────────────────────────────────────────────────────────────┘    │
│                           │                                         │
│                           ▼                                         │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │  PrismaService                                             │    │
│  │  ┌──────────────────────────────────────────────────────┐  │    │
│  │  │ Database Operations:                                 │  │    │
│  │  │ - prisma.listingSettingsGroup.findMany()             │  │    │
│  │  │ - prisma.listingSettingsGroup.findUnique()           │  │    │
│  │  │ - prisma.listingSettingsGroup.create()               │  │    │
│  │  │ - prisma.listingSettingsGroup.update()               │  │    │
│  │  │ - prisma.listingSettingsGroup.delete()               │  │    │
│  │  │ - prisma.predefinedTemplate.findMany()               │  │    │
│  │  └──────────────────────────────────────────────────────┘  │    │
│  └────────────────────────────────────────────────────────────┘    │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
                                 │
                                 │ SQL Queries
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       DATABASE (PostgreSQL)                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │  ListingSettingsGroup Table                                │    │
│  │  ┌──────────────────────────────────────────────────────┐  │    │
│  │  │ id (cuid, PK)                                        │  │    │
│  │  │ storeId (string, indexed)                            │  │    │
│  │  │ name (string)                                        │  │    │
│  │  │ description (string, nullable)                       │  │    │
│  │  │ repricingStrategy (json)                             │  │    │
│  │  │ stock (json)                                         │  │    │
│  │  │ fees (json)                                          │  │    │
│  │  │ templates (json)                                     │  │    │
│  │  │ createdAt (datetime)                                 │  │    │
│  │  │ updatedAt (datetime)                                 │  │    │
│  │  │ createdBy (string, indexed)                          │  │    │
│  │  │ updatedBy (string)                                   │  │    │
│  │  └──────────────────────────────────────────────────────┘  │    │
│  └────────────────────────────────────────────────────────────┘    │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │  PredefinedTemplate Table                                  │    │
│  │  ┌──────────────────────────────────────────────────────┐  │    │
│  │  │ id (cuid, PK)                                        │  │    │
│  │  │ name (string)                                        │  │    │
│  │  │ description (string)                                 │  │    │
│  │  │ htmlContent (text)                                   │  │    │
│  │  │ previewImage (string, nullable)                      │  │    │
│  │  │ createdAt (datetime)                                 │  │    │
│  │  └──────────────────────────────────────────────────────┘  │    │
│  │                                                              │    │
│  │  Seed Data: 3 templates (Modern, Premium, Classic)         │    │
│  └────────────────────────────────────────────────────────────┘    │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Data Flow Diagrams

### 1. Load Listing Groups (Read)

```
User Opens Page
      │
      ▼
ListingSettingsPage.container
      │
      ├─ useGetListingGroupsQuery()
      │       │
      │       ▼
      │  RTK Query Cache Check
      │       │
      │       ├─ Cache Hit ──────────────┐
      │       │                          │
      │       └─ Cache Miss              │
      │             │                    │
      │             ▼                    │
      │       GET /listing-settings/groups
      │             │                    │
      │             ▼                    │
      │    listing-settings.controller  │
      │             │                    │
      │             ▼                    │
      │    listing-settings.service     │
      │             │                    │
      │             ▼                    │
      │    prisma.listingSettingsGroup  │
      │         .findMany()              │
      │             │                    │
      │             ▼                    │
      │       PostgreSQL Query           │
      │             │                    │
      │             ▼                    │
      │       Return Groups[]            │
      │             │                    │
      │             ▼                    │
      │       RTK Query Cache Update     │
      │             │                    │
      │             └────────────────────┤
      │                                  │
      ▼                                  ▼
ListingSettingsPage.component
      │
      ▼
Render Card Grid
```

### 2. Create Listing Group (Write)

```
User Clicks "Create New Group"
      │
      ▼
ListingGroupForm.container
      │
      ├─ useForm() with Zod validation
      │
      ▼
User Fills Form
      │
      ├─ Group Name: "Premium Electronics"
      ├─ Description: "High-end items..."
      ├─ Price Ranges: [{ min: 19.99, max: 499, margin: 15% }]
      ├─ Stock: { defaultQuantity: 5 }
      ├─ Fees: { ebay: 13.25%, fixed: 0.30, tax: 8.5% }
      └─ Template: { type: "predefined", id: "template_premium" }
      │
      ▼
User Clicks "Save Changes"
      │
      ▼
Frontend Validation (Zod)
      │
      ├─ Valid ─────────────────┐
      │                         │
      └─ Invalid                │
            │                   │
            ▼                   ▼
      Show Errors     useCreateListingGroupMutation()
                                │
                                ▼
                      POST /listing-settings/groups
                                │
                                ▼
                      listing-settings.controller
                                │
                                ▼
                      Backend Validation (class-validator)
                                │
                                ├─ Valid ─────────────┐
                                │                     │
                                └─ Invalid            │
                                      │               │
                                      ▼               ▼
                                400 Bad Request   listing-settings.service
                                      │               │
                                      │               ▼
                                      │     prisma.listingSettingsGroup
                                      │           .create()
                                      │               │
                                      │               ▼
                                      │         PostgreSQL Insert
                                      │               │
                                      │               ▼
                                      │         Return New Group
                                      │               │
                                      │               ▼
                                      │         201 Created
                                      │               │
                                      └───────────────┤
                                                      │
                                                      ▼
                                            RTK Query Cache Invalidation
                                            (Tag: 'ListingGroups')
                                                      │
                                                      ▼
                                            Auto-refetch Groups List
                                                      │
                                                      ▼
                                            Show Success Toast
                                                      │
                                                      ▼
                                            Navigate to List View
```

### 3. Update Listing Group (Write)

```
User Clicks Edit Icon on Card
      │
      ▼
Navigate to Edit Form
      │
      ▼
ListingGroupForm.container
      │
      ├─ useGetListingGroupByIdQuery(groupId)
      │       │
      │       ▼
      │  GET /listing-settings/groups/:id
      │       │
      │       ▼
      │  Return Group Data
      │       │
      │       ▼
      │  Populate Form Fields
      │
      ▼
User Edits Form
      │
      ├─ Change Name: "Updated Premium Electronics"
      ├─ Add Price Range: { min: 500, max: 9999, fixed: 2.50 }
      └─ Switch Template: Custom HTML
      │
      ▼
User Clicks "Save Changes"
      │
      ▼
Frontend Validation (Zod)
      │
      ▼
useUpdateListingGroupMutation({ id, data })
      │
      ▼
PUT /listing-settings/groups/:id
      │
      ▼
listing-settings.controller
      │
      ▼
listing-settings.service.updateGroup()
      │
      ├─ Check Ownership (userId === createdBy)
      │       │
      │       ├─ Authorized ──────────┐
      │       │                       │
      │       └─ Unauthorized         │
      │             │                 │
      │             ▼                 ▼
      │       403 Forbidden   prisma.listingSettingsGroup
      │                             .update()
      │                               │
      │                               ▼
      │                         PostgreSQL Update
      │                               │
      │                               ▼
      │                         Return Updated Group
      │                               │
      │                               ▼
      │                         200 OK
      │                               │
      └───────────────────────────────┤
                                      │
                                      ▼
                            RTK Query Cache Update
                            (Invalidate specific group + list)
                                      │
                                      ▼
                            Show Success Toast
                                      │
                                      ▼
                            Navigate to List View
```

### 4. Delete Listing Group (Write)

```
User Clicks Delete Icon on Card
      │
      ▼
Show Confirmation Modal
      │
      ├─ "Are you sure you want to delete this group?"
      │
      ▼
User Confirms
      │
      ▼
useDeleteListingGroupMutation(groupId)
      │
      ▼
DELETE /listing-settings/groups/:id
      │
      ▼
listing-settings.controller
      │
      ▼
listing-settings.service.deleteGroup()
      │
      ├─ Check Ownership (userId === createdBy)
      │       │
      │       ├─ Authorized ──────────┐
      │       │                       │
      │       └─ Unauthorized         │
      │             │                 │
      │             ▼                 ▼
      │       403 Forbidden   prisma.listingSettingsGroup
      │                             .delete()
      │                               │
      │                               ▼
      │                         PostgreSQL Delete
      │                               │
      │                               ▼
      │                         Return { success: true }
      │                               │
      │                               ▼
      │                         200 OK
      │                               │
      └───────────────────────────────┤
                                      │
                                      ▼
                            RTK Query Cache Invalidation
                            (Tag: 'ListingGroups')
                                      │
                                      ▼
                            Auto-refetch Groups List
                                      │
                                      ▼
                            Show Success Toast
                                      │
                                      ▼
                            Card Removed from Grid
```

### 5. Live Preview Rendering

```
User Types in HTML Editor
      │
      ▼
Debounced onChange (300ms)
      │
      ▼
Update Form State (customTemplateHtml)
      │
      ▼
LivePreview Component
      │
      ├─ Inject Mock Product Data:
      │   - {{product_title}} → "Next-Gen Wireless Pro Smartphone"
      │   - {{product_price}} → "$849.00"
      │   - {{product_image}} → "https://example.com/image.jpg"
      │   - {{product_description}} → "Experience the pinnacle..."
      │
      ▼
Replace Template Variables
      │
      ▼
Render in Sandboxed Iframe/Div
      │
      ├─ Apply Desktop/Mobile Width
      ├─ Apply Dark Mode (if toggled)
      │
      ▼
Display Live Preview
```

---

## Component Hierarchy

```
App
└── AppLayout
    └── Routes
        └── /settings/listing-groups
            ├── ListingSettingsPage.container
            │   └── ListingSettingsPage.component
            │       ├── Header (Sticky)
            │       │   ├── Icon + Title + Subtitle
            │       │   └── Button (Create New Group)
            │       │
            │       └── Card Grid
            │           ├── ListingGroupCard (x N)
            │           │   ├── Icon Badge
            │           │   ├── Group Name
            │           │   ├── Description
            │           │   ├── Product Count
            │           │   ├── Status Badge
            │           │   └── Actions (Edit, Delete)
            │           │
            │           └── AddNewGroupCard (Dashed Border)
            │
            └── /settings/listing-groups/:id/edit
                ├── ListingGroupForm.container
                │   └── ListingGroupForm.component
                │       ├── Header (Sticky)
                │       │   ├── Back Button
                │       │   ├── Title
                │       │   └── Actions (Cancel, Save)
                │       │
                │       └── Two-Column Layout
                │           ├── Left Column (Scrollable)
                │           │   ├── GroupDetailsSection
                │           │   │   ├── TextInput (name)
                │           │   │   └── Textarea (description)
                │           │   │
                │           │   ├── RepricingStrategySection
                │           │   │   ├── PriceRangeInput (x N)
                │           │   │   │   ├── NumberInput (minPrice)
                │           │   │   │   ├── NumberInput (maxPrice)
                │           │   │   │   ├── NumberInput (profitMargin)
                │           │   │   │   ├── NumberInput (fixedProfit)
                │           │   │   │   └── IconButton (Remove)
                │           │   │   │
                │           │   │   └── Button (Add Price Range)
                │           │   │
                │           │   ├── StockSection
                │           │   │   ├── NumberInput (defaultQuantity)
                │           │   │   └── Checkbox (autoRestock)
                │           │   │
                │           │   ├── FeesSection
                │           │   │   ├── NumberInput (ebayFeePercent)
                │           │   │   ├── NumberInput (fixedFeeAmount)
                │           │   │   └── NumberInput (taxPercent)
                │           │   │
                │           │   └── TemplateSection
                │           │       ├── TemplateSelector
                │           │       │   ├── ButtonGroup (Custom/Predefined)
                │           │       │   ├── Select (predefinedTemplateId)
                │           │       │   └── HTMLEditor (customTemplateHtml)
                │           │       │       └── Monaco/CodeMirror
                │           │
                │           └── Right Column (Fixed/Sticky)
                │               └── LivePreview
                │                   ├── Preview Controls
                │                   │   ├── IconButton (Desktop)
                │                   │   ├── IconButton (Mobile)
                │                   │   └── Toggle (Dark Mode)
                │                   │
                │                   └── Preview Container (Iframe/Div)
                │                       └── Rendered HTML
```

---

## State Management

### RTK Query Cache Structure

```typescript
{
  queries: {
    'getListingGroups(undefined)': {
      status: 'fulfilled',
      data: [
        {
          id: 'clx123abc',
          storeId: 'store_001',
          name: 'Premium Electronics',
          // ... full group data
        },
        // ... more groups
      ],
      endpointName: 'getListingGroups',
      requestId: 'abc123',
      startedTimeStamp: 1737059737000,
      fulfilledTimeStamp: 1737059738000,
    },
    'getListingGroupById("clx123abc")': {
      status: 'fulfilled',
      data: {
        id: 'clx123abc',
        // ... full group data
      },
    },
    'getPredefinedTemplates(undefined)': {
      status: 'fulfilled',
      data: [
        {
          id: 'template_modern_minimalist',
          name: 'Modern Minimalist',
          htmlContent: '<div>...</div>',
        },
        // ... more templates
      ],
    },
  },
  mutations: {
    'createListingGroup': {
      status: 'fulfilled',
      data: { id: 'clx456def', /* ... */ },
    },
  },
  provided: {
    ListingGroups: [
      { type: 'ListingGroups', id: 'LIST' },
      { type: 'ListingGroups', id: 'clx123abc' },
    ],
    PredefinedTemplates: [
      { type: 'PredefinedTemplates', id: 'LIST' },
    ],
  },
}
```

### Form State (React Hook Form)

```typescript
{
  name: 'Premium Electronics',
  description: 'High-end electronics with premium pricing',
  repricingStrategy: [
    {
      id: 'range_1',
      minPrice: 19.99,
      maxPrice: 499.00,
      profitMarginPercent: 15,
      fixedProfitAmount: undefined,
    },
    {
      id: 'range_2',
      minPrice: 500.00,
      maxPrice: 9999.00,
      profitMarginPercent: undefined,
      fixedProfitAmount: 2.50,
    },
  ],
  stock: {
    defaultQuantity: 5,
  },
  fees: {
    ebayFeePercent: 13.25,
    fixedFeeAmount: 0.30,
    taxPercent: 8.5,
  },
  templates: {
    type: 'predefined',
    predefinedTemplateId: 'template_premium_electronics',
    customTemplateHtml: undefined,
  },
}
```

---

## Error Handling Flow

```
API Error Occurs
      │
      ├─ 400 Bad Request (Validation)
      │     │
      │     ▼
      │ RTK Query onQueryStarted/onError
      │     │
      │     ▼
      │ Extract Validation Errors
      │     │
      │     ▼
      │ Map to Form Fields (setError)
      │     │
      │     ▼
      │ Display Inline Error Messages
      │
      ├─ 401 Unauthorized (Auth)
      │     │
      │     ▼
      │ Redirect to Login
      │
      ├─ 403 Forbidden (Authorization)
      │     │
      │     ▼
      │ Show Toast: "You don't have permission"
      │
      ├─ 404 Not Found
      │     │
      │     ▼
      │ Show Toast: "Group not found"
      │     │
      │     ▼
      │ Navigate to List View
      │
      ├─ 500 Internal Server Error
      │     │
      │     ▼
      │ Show Toast: "An unexpected error occurred"
      │     │
      │     ▼
      │ Log Error to Console/Sentry
      │
      └─ Network Error
            │
            ▼
      Show Toast: "Network error. Check connection."
            │
            ▼
      Retry Button (optional)
```

---

## Security Flow

```
User Makes Request
      │
      ▼
Frontend Sends JWT in Authorization Header
      │
      ▼
NestJS JwtAuthGuard
      │
      ├─ Valid Token ──────────┐
      │                        │
      └─ Invalid Token         │
            │                  │
            ▼                  ▼
      401 Unauthorized   Extract userId from Token
                               │
                               ▼
                         Controller Method
                               │
                               ▼
                         Service Method
                               │
                               ▼
                         Check Ownership
                         (group.createdBy === userId)
                               │
                               ├─ Authorized ────┐
                               │                 │
                               └─ Unauthorized   │
                                     │           │
                                     ▼           ▼
                               403 Forbidden   Proceed with Operation
```

---

## Performance Optimizations

### 1. RTK Query Caching
- **Cache Duration**: 60 seconds (default)
- **Tag-based Invalidation**: Automatic refetch on mutations
- **Optimistic Updates**: Optional for better UX

### 2. Form Debouncing
- **Live Preview**: 300ms debounce on HTML editor changes
- **Auto-save**: 30s debounce (future enhancement)

### 3. Lazy Loading
- **HTML Editor**: Code-split Monaco/CodeMirror
- **Preview Iframe**: Lazy render on tab switch

### 4. Pagination (Future)
- **Initial Load**: 20 groups
- **Infinite Scroll**: Load more on scroll

### 5. Memoization
- **Sorted/Filtered Lists**: `useMemo` for expensive operations
- **Preview Rendering**: `useMemo` for template variable replacement

---

## Monitoring & Logging

### Frontend
- **RTK Query DevTools**: Inspect cache and queries
- **React DevTools**: Component hierarchy and state
- **Console Logs**: Development mode only
- **Error Tracking**: Sentry (production)

### Backend
- **NestJS Logger**: Request/response logging
- **Prisma Query Logs**: Database query performance
- **Error Tracking**: Sentry (production)
- **Performance Monitoring**: New Relic/DataDog (optional)

---

## Deployment Pipeline

```
Developer Commits Code
      │
      ▼
Git Push to Branch
      │
      ▼
GitHub Actions / CI Pipeline
      │
      ├─ Run Linters (ESLint, Prettier)
      ├─ Run Type Checks (TypeScript)
      ├─ Run Unit Tests (Jest)
      ├─ Run E2E Tests (Playwright)
      │
      ▼
Merge to Main Branch
      │
      ▼
Build Production Bundle
      │
      ├─ pnpm build (Turbo)
      │   ├─ Build @repo/shared
      │   ├─ Build @repo/ui
      │   ├─ Build apps/api
      │   └─ Build apps/web
      │
      ▼
Run Database Migrations
      │
      ├─ prisma migrate deploy
      ├─ prisma db seed (predefined templates)
      │
      ▼
Deploy to Production
      │
      ├─ Deploy API (Docker/Kubernetes)
      ├─ Deploy Web (Vercel/Netlify)
      │
      ▼
Health Checks
      │
      ├─ API: GET /health
      ├─ Web: GET /
      │
      ▼
Production Live ✅
```

---

This architecture ensures:
- ✅ **Separation of Concerns**: Clear boundaries between layers
- ✅ **Type Safety**: End-to-end TypeScript
- ✅ **Scalability**: Modular, cacheable, optimized
- ✅ **Security**: JWT auth, ownership checks, validation
- ✅ **Maintainability**: Follows established patterns (store-settings)
- ✅ **Performance**: Caching, debouncing, lazy loading
- ✅ **Developer Experience**: DevTools, hot reload, type inference
