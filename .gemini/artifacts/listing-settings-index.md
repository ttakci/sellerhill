# Listing Settings Groups - Complete Documentation Index

## 📚 Overview

This directory contains the complete design and implementation documentation for the **Listing Settings Groups** feature. This feature allows users to create and manage reusable templates for eBay product listings with repricing strategies, stock settings, fees, and custom/predefined HTML templates.

**Status**: ✅ Design Complete - Ready for Implementation  
**Priority**: High (Second Settings Feature)  
**Estimated Effort**: 24-32 hours  
**Reference Pattern**: `store-settings` module  

---

## 📄 Documentation Files

### 1. **Implementation Plan** 📋
**File**: `listing-settings-implementation-plan.md`  
**Purpose**: Complete technical specification and implementation guide

**Contents**:
- Domain model (TypeScript interfaces)
- DTO schemas (Zod validation)
- Database schema (Prisma)
- Backend API (NestJS controller, service, DTOs)
- Frontend components (containers, components, API slice)
- Implementation checklist (4 phases)
- Seed data for predefined templates

**Use When**: Starting implementation, need technical details

---

### 2. **API Contract** 🔌
**File**: `listing-settings-api-contract.md`  
**Purpose**: RESTful API documentation and endpoint specifications

**Contents**:
- 6 REST endpoints (CRUD + predefined templates)
- Request/response examples with JSON
- Validation rules and constraints
- Error response formats
- Authentication requirements
- Rate limiting guidelines

**Use When**: Implementing backend, testing API, integrating frontend

---

### 3. **UI Design Specification** 🎨
**File**: `listing-settings-ui-design.md`  
**Purpose**: Detailed UI/UX design and layout specifications

**Contents**:
- Card grid layout (list view)
- Two-column form layout (edit view)
- Component breakdown and hierarchy
- Responsive breakpoints (mobile/tablet/desktop)
- Color palette (theme tokens only)
- Typography system
- Spacing and sizing
- Interactions and animations
- Accessibility guidelines
- Loading and error states
- Empty states

**Use When**: Implementing frontend UI, styling components

---

### 4. **Localization** 🌐
**File**: `listing-settings-localization.md`  
**Purpose**: Complete i18n keys for English and Turkish

**Contents**:
- English (en) translations (complete JSON)
- Turkish (tr) translations (complete JSON)
- Validation messages
- Error/success messages
- Tooltips and help text
- Pluralization examples
- Usage examples in components

**Use When**: Adding i18n keys, translating UI text

---

### 5. **Architecture & Data Flow** 🏗️
**File**: `listing-settings-architecture.md`  
**Purpose**: System architecture and data flow diagrams

**Contents**:
- System architecture diagram (frontend → API → database)
- Data flow diagrams (read, create, update, delete, preview)
- Component hierarchy tree
- State management structure (RTK Query, React Hook Form)
- Error handling flow
- Security flow (JWT auth, ownership checks)
- Performance optimizations
- Monitoring and logging
- Deployment pipeline

**Use When**: Understanding system design, debugging data flow

---

### 6. **Feature Summary** 📊
**File**: `listing-settings-summary.md`  
**Purpose**: Comprehensive feature summary and overview

**Contents**:
- Feature overview
- Deliverables list
- Key requirements (all fulfilled)
- File structure (complete tree)
- API endpoints table
- UI screens description
- Database schema
- Domain types
- Validation rules
- Design system tokens
- Localization namespaces
- Implementation phases
- Security and authorization
- Testing checklist
- Success criteria

**Use When**: Getting high-level overview, planning work

---

### 7. **Quick Reference** ⚡
**File**: `listing-settings-quick-reference.md`  
**Purpose**: Developer quick reference guide

**Contents**:
- Quick start (backend + frontend setup)
- File checklist
- Key code snippets (domain, API, components, styles)
- Theme token reference
- i18n usage examples
- Testing commands
- Common issues and solutions
- Performance tips
- Security checklist
- Git workflow
- Pre-deployment checklist
- Success metrics

**Use When**: Quick lookup, troubleshooting, daily development

---

## 🗂️ Document Usage Matrix

| Task | Primary Document | Secondary Documents |
|------|------------------|---------------------|
| **Planning** | Summary | Implementation Plan, Architecture |
| **Backend API** | API Contract, Implementation Plan | Architecture, Quick Reference |
| **Frontend UI** | UI Design, Implementation Plan | Quick Reference, Summary |
| **Localization** | Localization | Quick Reference |
| **Testing** | Quick Reference | API Contract, Summary |
| **Debugging** | Architecture | Quick Reference, API Contract |
| **Code Review** | Implementation Plan | Quick Reference, Summary |
| **Deployment** | Quick Reference | Summary, Architecture |

---

## 🎯 Implementation Roadmap

### Phase 1: Foundation (Backend) - 8-10 hours
**Documents**: Implementation Plan, API Contract

1. Create shared domain types (`listing-settings.types.ts`)
2. Create Zod validation schemas (`listing-settings.dto.ts`)
3. Create Prisma schema (add to `schema.prisma`)
4. Run migration and seed predefined templates
5. Create NestJS module, controller, service
6. Create DTOs (create, update)
7. Test all API endpoints

**Deliverables**:
- ✅ 6 working API endpoints
- ✅ Database tables created and seeded
- ✅ Backend validation working

---

### Phase 2: Frontend - List View - 6-8 hours
**Documents**: UI Design, Implementation Plan, Localization

1. Create RTK Query API slice (`listing-settings.api.ts`)
2. Create ListingSettingsPage container
3. Create ListingSettingsPage component (card grid)
4. Create ListingGroupCard component
5. Add localization keys (en/tr)
6. Style with Emotion (follow StoreSettings pattern)
7. Test responsive layout

**Deliverables**:
- ✅ Card grid view working
- ✅ Create/Edit/Delete actions functional
- ✅ Responsive on all devices

---

### Phase 3: Frontend - Form View - 6-8 hours
**Documents**: UI Design, Implementation Plan, Localization

1. Create ListingGroupForm container
2. Create ListingGroupForm component (two-column layout)
3. Create PriceRangeInput component (dynamic array)
4. Create TemplateSelector component
5. Create HTMLEditor component (Monaco/CodeMirror)
6. Create LivePreview component
7. Implement form validation with React Hook Form + Zod
8. Test all form interactions

**Deliverables**:
- ✅ Form view working
- ✅ Live preview rendering
- ✅ Validation working (frontend + backend)

---

### Phase 4: Polish & Testing - 4-6 hours
**Documents**: Quick Reference, Summary

1. Responsive design refinement
2. Sticky header behavior
3. Loading states (skeletons, spinners)
4. Error handling (toasts, inline errors)
5. Confirmation modals (delete)
6. Preview toggles (desktop/mobile, dark mode)
7. E2E testing
8. Accessibility audit
9. Performance optimization
10. Documentation review

**Deliverables**:
- ✅ All edge cases handled
- ✅ Tests passing
- ✅ Production-ready

---

## 📋 Key Design Decisions

### 1. **No New Patterns**
Follow `store-settings` module exactly. No architectural innovations.

### 2. **Theme Tokens Only**
Use global theme tokens, NOT custom colors from design mockup.

### 3. **Sticky Header**
Same pattern as StoreSettings (negative margin, z-index 99).

### 4. **Responsive Design**
Mobile-first approach. Sidebar hidden <1024px.

### 5. **Validation**
Frontend (Zod) + Backend (class-validator) dual validation.

### 6. **i18n**
All strings localized (en/tr). No hardcoded text.

### 7. **RTK Query**
All API calls via `baseApi.injectEndpoints`. No direct fetch/axios.

### 8. **Container/Component**
Strict separation of logic (container) and presentation (component).

### 9. **Predefined Templates**
3 professional HTML templates seeded in database.

### 10. **Live Preview**
Sandboxed iframe/div with mock product data injection.

---

## 🚫 Anti-Patterns to Avoid

❌ Creating new architectural patterns  
❌ Using custom colors from mockup (use theme tokens)  
❌ Hardcoded strings (use i18n)  
❌ Direct fetch/axios calls (use RTK Query)  
❌ Inline styles (use Emotion styled components)  
❌ `any` types (use proper TypeScript types)  
❌ Logic in component files (use container pattern)  
❌ Duplicate types (use @repo/shared)  
❌ Local state for global modals/loading (use UIContext)  

---

## ✅ Success Criteria

### Code Quality
- ✅ Zero TypeScript errors
- ✅ Zero ESLint errors
- ✅ Zero `any` types
- ✅ Zero hardcoded strings

### Functionality
- ✅ All API endpoints working
- ✅ CRUD operations functional
- ✅ Form validation working (frontend + backend)
- ✅ Live preview rendering correctly

### Design
- ✅ Matches UI specification
- ✅ Responsive on mobile/tablet/desktop
- ✅ Sticky header behaves correctly
- ✅ Theme tokens used (no custom colors)

### i18n
- ✅ All strings localized (en/tr)
- ✅ Pluralization working
- ✅ Validation messages translated

### Architecture
- ✅ Container/Component pattern followed
- ✅ RTK Query for all API calls
- ✅ Shared domain types used
- ✅ Follows store-settings pattern

### Testing
- ✅ Unit tests passing
- ✅ E2E tests passing
- ✅ Manual testing complete

---

## 📞 Support & Resources

### Reference Implementation
**Module**: `store-settings`
- **Backend**: `apps/api/src/modules/store-settings/`
- **Frontend**: `apps/web/src/features/store-settings/`
- **Shared**: `packages/shared/src/domain/store-settings/`

### External Resources
- **NestJS Docs**: https://docs.nestjs.com/
- **React Hook Form**: https://react-hook-form.com/
- **Zod**: https://zod.dev/
- **RTK Query**: https://redux-toolkit.js.org/rtk-query/overview
- **Emotion**: https://emotion.sh/docs/introduction
- **Prisma**: https://www.prisma.io/docs

### Project Rules
- **Code Style Guide**: `code-style.md` (in user rules)
- **ESLint Config**: `.eslintrc.js`
- **TypeScript Config**: `tsconfig.json`
- **Prettier Config**: `.prettierrc`

---

## 🔄 Document Versioning

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 1.0 | 2026-01-16 | Initial design complete | Antigravity |

---

## 📝 Notes

1. **Predefined Templates**: Users can select a predefined template, then switch to custom to edit the HTML.
2. **Template Variables**: Support `{{product_title}}`, `{{product_price}}`, `{{product_image}}`, `{{product_description}}`, `{{product_specs}}` in HTML templates.
3. **Auto-save**: Optional feature for future enhancement (debounced save every 30 seconds).
4. **Unsaved Changes**: Prompt user before navigating away if form is dirty.
5. **Cascading Deletes**: Deleting a group does NOT delete products (orphaned references handled by product service).
6. **Concurrency**: No optimistic locking (last write wins).
7. **Pagination**: Not implemented initially (all groups returned in single response).
8. **Search/Filter**: Future enhancement (search by name, filter by status).

---

## 🎉 Ready to Implement!

All design documents are complete and ready for implementation. Follow the **Implementation Roadmap** above, using the appropriate documents for each phase.

**Estimated Total Effort**: 24-32 hours  
**Recommended Team Size**: 1-2 developers  
**Recommended Timeline**: 1-2 weeks  

**Good luck! 🚀**

---

## 📂 File Tree

```
.gemini/artifacts/
├── listing-settings-implementation-plan.md    (Technical spec)
├── listing-settings-api-contract.md           (API docs)
├── listing-settings-ui-design.md              (UI/UX spec)
├── listing-settings-localization.md           (i18n keys)
├── listing-settings-architecture.md           (Architecture)
├── listing-settings-summary.md                (Overview)
├── listing-settings-quick-reference.md        (Dev guide)
└── listing-settings-index.md                  (This file)
```

---

**Last Updated**: 2026-01-16  
**Status**: ✅ Complete  
**Next Step**: Begin Phase 1 (Backend Implementation)
