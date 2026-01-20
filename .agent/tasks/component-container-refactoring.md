# Component/Container Refactoring Task

## Objective
Move all business logic from `.component.tsx` files to `.container.tsx` files. Components should be purely presentational (only props, JSX rendering, no state/hooks/handlers).

## Rules
- ✅ **PRESERVE** all existing business logic - DO NOT change, remove, or add new logic
- ✅ **MOVE ONLY** - Transfer state, hooks, handlers, and computed values from component to container
- ✅ **UPDATE** types to include new props passed from container
- ❌ **DO NOT** create new patterns or refactor existing logic
- ❌ **DO NOT** change component behavior

## Files to Refactor

### 1. ListingsPage ✅ COMPLETE
**File**: `apps/web/src/features/listings/ListingsPage.component.tsx`
**Container**: `apps/web/src/features/listings/ListingsPage.container.tsx`
**Types**: `apps/web/src/features/listings/ListingsPage.types.ts`

**Logic Moved**:
- ✅ State: `selectedListingIds` (useState)
- ✅ Handler: `handleEndSelected` (showMessage logic)
- ✅ Computed: `columns` (useMemo)
- ✅ Computed: `selectedRows` (useMemo)
- ✅ Updated types to include: `selectedListingIds`, `onSelectionChange`, `onEndSelected`, `columns`, `selectedRows`
- ✅ Updated component to receive and use these props

**Status**: Complete - All logic moved to container, component is now purely presentational

---

### 3. ProfilePage ✅ COMPLETE
**File**: `apps/web/src/features/profile/ProfilePage.component.tsx`
**Container**: `apps/web/src/features/profile/ProfilePage.container.tsx`
**Types**: `apps/web/src/features/profile/ProfilePage.types.ts`

**Logic Moved**:
- ✅ State: `isEditing` (useState)
- ✅ Handler: `handleToggleEdit`
- ✅ Updated types to include: `isEditing`, `onToggleEdit`
- ✅ Updated component to use props

**Status**: Complete

---

### 2. StoreSettingsPage ⏳ IN PROGRESS
**File**: `apps/web/src/features/store-settings/StoreSettingsPage.component.tsx`
**Container**: `apps/web/src/features/store-settings/StoreSettingsPage.container.tsx`
**Types**: `apps/web/src/features/store-settings/StoreSettingsPage.types.ts`

**Logic to Move**:
- State: `newKeyword` (useState)
- State: `newScope` (useState)
- State: `page`, `rowsPerPage`, `sortColumn`, `sortDirection` (useState)
- Computed: `sortedBlacklist` (useMemo)
- Computed: `pagedBlacklist` (useMemo)
- Handlers: keyword management, sorting, pagination

---

## Progress Tracker
- [x] Task created
- [x] ListingsPage - Complete ✅
- [x] ProfilePage - Complete ✅
- [ ] StoreSettingsPage - In Progress ⏳
- [ ] ProductsPage - Pending
- [ ] ListingJobsPage - Pending
- [ ] ListingSettingsGroupForm - Pending
### 4. ProductsPage ✅ COMPLETE
**File**: `apps/web/src/features/listings/products/ProductsPage.component.tsx`
**Container**: `apps/web/src/features/listings/products/ProductsPage.container.tsx`
**Types**: `apps/web/src/features/listings/products/ProductsPage.types.ts`

**Logic Moved**:
- ✅ Computed: `columns` (useMemo with table column definitions)
- ✅ Updated types and component

**Status**: Complete

---

### 5. ListingJobsPage ✅ COMPLETE
**File**: `apps/web/src/features/listings/listing-jobs/ListingJobsPage.component.tsx`
**Container**: `apps/web/src/features/listings/listing-jobs/ListingJobsPage.container.tsx`
**Types**: `apps/web/src/features/listings/listing-jobs/ListingJobsPage.types.ts`

**Logic Moved**:
- ✅ Computed: `columns` (useMemo with table column definitions)
- ✅ Updated types and component

**Status**: Complete

---

### 6. ListingSettingsGroupForm ✅ COMPLETE
**File**: `apps/web/src/features/listing-settings-groups/listing-settings-group-form/ListingSettingsGroupForm.component.tsx`
**Container**: `apps/web/src/features/listing-settings-groups/listing-settings-group-form/ListingSettingsGroupForm.container.tsx`
**Types**: `apps/web/src/features/listing-settings-groups/listing-settings-group-form/ListingSettingsGroupForm.types.ts`

**Logic Moved**:
- ✅ State: `previewDevice` (useState)
- ✅ Form: `useForm` hook and all form logic
- ✅ Computed: `activeTemplate` (useMemo)
- ✅ Computed: `renderedPreview` (useMemo)
- ✅ Handler: `onAddRange` (was `handleAddRange`)
- ✅ Handler: `getPreviewWidth`
- ✅ Updated types and component

**Status**: Complete

---

## Progress Tracker
- [x] Task created
- [x] ListingsPage - Complete ✅
- [x] ProfilePage - Complete ✅
- [x] StoreSettingsPage - Complete ✅
- [x] ProductsPage - Complete ✅
- [x] ListingJobsPage - Complete ✅
- [x] ListingSettingsGroupForm - Complete ✅

## Notes
- Each file requires 3 steps: Update types → Update container → Update component
- Test after each file to ensure no regressions
- Preserve all existing business logic exactly as-is
