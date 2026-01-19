# Listings API Documentation

## Overview
The Listings API provides endpoints for importing products from Amazon via ASIN, managing eBay listings, and tracking background import jobs.

**Base Path**: `/api/v1/listings`

---

## Endpoints

### 1. Get All Listings
Retrieves all active eBay listings for the authenticated user.
- **URL**: `GET /listings`
- **Auth**: Required (Bearer JWT)
- **Response**: `ListingDto[]`

### 2. Get Single Listing
Retrieves details for a specific listing.
- **URL**: `GET /listings/:id`
- **Auth**: Required (Bearer JWT)
- **Response**: `ListingDto`

### 3. Bulk Create Listings
Queues a background job to import products by ASIN and list them on eBay.
- **URL**: `POST /listings/bulk-create`
- **Auth**: Required (Bearer JWT)
- **Body**: `CreateListingsRequest`
  ```json
  {
    "asins": ["B00X4WHP5E", "B08P2H5L8H"],
    "listingSettingsGroupId": "uuid",
    "paymentPolicyId": "string",
    "shippingPolicyId": "string"
  }
  ```
- **Response**: `ListingJobDto`

### 4. Get All Jobs
Retrieves a list of all background import jobs for the user.
- **URL**: `GET /listings/jobs`
- **Auth**: Required (Bearer JWT)
- **Response**: `ListingJobDto[]`

### 5. Get Job Status
Retrieves the real-time status and progress counts for a specific job.
- **URL**: `GET /listings/jobs/:jobId`
- **Auth**: Required (Bearer JWT)
- **Response**: `ListingJobDto`

### 6. Get Job Items
Retrieves individual item statuses for a specific job (useful for identifying which ASINs failed).
- **URL**: `GET /listings/jobs/:jobId/items`
- **Auth**: Required (Bearer JWT)
- **Response**: `ListingJobItemDto[]`

### 7. Get Product Info
Retrieves cached product data (Keepa) for a given ASIN.
- **URL**: `GET /listings/products/:asin`
- **Auth**: Required (Bearer JWT)
- **Response**: `KeepaProductData`

---

## Real-Time Updates
Currently, the front-end uses **Polling** (every 5 seconds) to track job progress via the `/jobs/:jobId` endpoint. 

- **WebSocket Support**: Not yet implemented. Pending infrastructure setup for `@nestjs/websockets`.
