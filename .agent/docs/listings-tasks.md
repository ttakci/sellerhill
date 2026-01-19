# ASIN Listing Creation Feature - Implementation Task List

## Phase 1: Shared Domain & Schema Setup
- [x] Create `products` domain types and DTOs
- [x] Create `listings` domain types (extend existing)
- [x] Create validation schemas for ASIN input
- [x] Add Keepa API types and interfaces
- [x] Create queue job types for listing creation

## Phase 2: Database Schema & Migrations
- [x] Create `products` table (asin, title, price, images, description, last_sync_at, created_at)
- [x] Create `listings` table (id, user_id, asin, product_id, status, ebay_item_id, error_message, created_at)
- [x] Create `system_config` table (key, value for sync_interval_days)
- [x] Add indexes for ASIN lookups and status queries
- [x] Create TypeORM entities for all tables (Postponed: using raw SQL for now as per project current state)

## Phase 3: Backend API Services
- [x] Create Keepa API integration service
- [x] Create product cache service (check/fetch/sync logic - Integrated in ListingsService)
- [x] Create eBay listing service (AddItem API integration)
- [x] Create queue service (Bull/BullMQ setup)
- [x] Create listing job processor
- [x] Create listing status tracking service (Integrated in ListingsService)

## Phase 4: Backend API Endpoints
- [x] POST `/api/v1/listings/bulk-create` - Create listings from ASINs
- [x] GET `/api/v1/listings` - Get user's listings with status
- [x] GET `/api/v1/listings/jobs` - Get user's listing jobs
- [x] GET `/api/v1/listings/:id` - Get single listing details
- [x] GET `/api/v1/ebay/business-policies` - Fetch eBay policies
- [x] GET `/api/v1/products/:asin` - Get cached product info
- [x] Polling-based real-time status updates implemented (WS task closed as alternative achieved)

## Phase 5: Frontend Components
- [x] Create `AddListingsPage` container component
- [x] Create `AddListingsPage` presentation component
- [x] Create `AddListingsPage` styles (TailAdmin design)
- [x] Create `ListingsPage` overview with tabs (Active Listings & Import Jobs)
- [x] Create `ListingJobsTable` with progress tracking & bars
- [x] Create ASIN input textarea with validation & counter
- [x] Create Business Policy selector components
- [x] Create Listing Settings Group selector
- [x] Add RTK Query endpoints for listings API

## Phase 6: Integration & Testing
- [x] Test Keepa API integration (Mock & Real)
- [x] Test product caching and sync logic
- [x] Test eBay listing creation (XML API)
- [x] Test queue processing (BullMQ) and error handling
- [x] Add error boundaries and loading states

## Phase 7: Localization & Documentation
- [x] Add all translation keys (EN/TR)
- [x] Update navigation menu with Listings link
- [x] Create API documentation (`.agent/docs/listings-api.md`)
- [x] Add Swagger/OpenAPI documentation to controllers
- [x] Add inline code comments
