# ScraperAPI Integration Guide

## Overview

The system now uses **ScraperAPI** as the primary product data provider instead of Keepa. ScraperAPI provides structured product specifications which significantly improves eBay listing accuracy.

## Setup

### 1. Get ScraperAPI Key

1. Sign up at [https://www.scraperapi.com](https://www.scraperapi.com)
2. Get your API key from the dashboard
3. Add to your environment variables:

```bash
SCRAPER_API_KEY=your_api_key_here
```

### 2. Configuration

The system is already configured to use ScraperAPI. No code changes needed.

## Architecture

### Provider-Agnostic Design

```
┌─────────────────────────────────────────┐
│      IProductDataProvider Interface      │
│  (Common contract for all providers)    │
└─────────────────────────────────────────┘
                    ▲
                    │
        ┌───────────┴───────────┐
        │                       │
┌───────────────┐      ┌────────────────┐
│ KeepaService  │      │ ScraperApiService│
│  (Deprecated) │      │    (Active)     │
└───────────────┘      └────────────────┘
```

### Data Flow

```
ASIN Input
    │
    ▼
ScraperApiService.getProductDetails()
    │
    ▼
Normalized ProductData
    │
    ├─→ title
    ├─→ description
    ├─→ imageUrls
    ├─→ brand
    ├─→ features (bullet points)
    ├─→ specs (✨ structured key-value pairs)
    └─→ price
    │
    ▼
eBay Listing Creation
    │
    ├─→ Priority 1: Use specs directly
    ├─→ Priority 2: Extract from features
    └─→ Priority 3: Fill required fields with "Unknown"
```

## Advantages over Keepa

### 1. Structured Specifications

**Keepa:**
```json
{
  "features": [
    "Processor: Intel Core i5-1135G7",
    "RAM: 8GB DDR4",
    "Screen: 15.6 inch FHD"
  ]
}
```
Requires regex parsing, error-prone.

**ScraperAPI:**
```json
{
  "specs": {
    "Processor": "Intel Core i5-1135G7",
    "RAM": "8GB DDR4",
    "Screen Size": "15.6 inches"
  }
}
```
Direct mapping to eBay aspects, highly accurate.

### 2. Better Image Quality

- ScraperAPI provides full-resolution image URLs
- Keepa only provides filenames (requires manual URL construction)

### 3. More Reliable Data

- ScraperAPI scrapes live Amazon pages
- Keepa relies on historical database (may be outdated)

## Cost Comparison

| Provider   | Price/Request | Structured Specs | Live Data |
|------------|---------------|------------------|-----------|
| Keepa      | ~$0.005       | ❌ No            | ❌ No     |
| ScraperAPI | ~$0.001-0.01  | ✅ Yes           | ✅ Yes    |

*Note: ScraperAPI pricing varies by plan and request complexity*

## Switching Back to Keepa (If Needed)

If you need to switch back to Keepa:

1. Edit `apps/api/src/modules/listings/listings.module.ts`:
```typescript
providers: [
  // ScraperApiService, // Disable
  KeepaService,        // Enable
  // ...
]
```

2. Edit `apps/api/src/modules/listings/listing-processor.service.ts`:
```typescript
constructor(
  // private readonly scraperApiService: ScraperApiService, // Disable
  private readonly keepaService: KeepaService,              // Enable
  // ...
)
```

3. Update method calls from `scraperApiService` to `keepaService`

## Monitoring

### Check API Credits

```typescript
const credits = await scraperApiService.checkCredits();
console.log(`Remaining: ${credits.remaining}/${credits.total}`);
```

### Logs

The service logs all API calls:
```
[ScraperApiService] Fetching product details for ASIN: B08N5WRWNW via ScraperAPI
[ScraperApiService] Successfully fetched product with 15 specs
```

## Troubleshooting

### "SCRAPER_API_KEY not configured"

**Solution:** Add `SCRAPER_API_KEY` to your `.env` file

### "Product not found for ASIN"

**Possible causes:**
- Invalid ASIN
- Product not available on Amazon US
- ScraperAPI rate limit reached

**Solution:** Check ASIN validity and API credits

### "Failed to fetch product from ScraperAPI"

**Possible causes:**
- Network timeout
- API key invalid
- Service outage

**Solution:** Check API key, network connection, and ScraperAPI status page

## Future Enhancements

- [ ] Add caching layer to reduce API calls
- [ ] Implement fallback to Keepa if ScraperAPI fails
- [ ] Support multiple Amazon marketplaces (UK, DE, etc.)
- [ ] Add webhook for price change notifications
- [ ] Implement batch product fetching

## Support

For ScraperAPI issues: [https://www.scraperapi.com/support](https://www.scraperapi.com/support)
For integration issues: Check application logs and error messages
