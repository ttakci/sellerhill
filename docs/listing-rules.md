# Listing Logic & Mapping Documentation

This document describes the business logic and rules used to map product data to eBay inventory items.

## Architecture: Provider-Agnostic Design

The system uses a **provider-agnostic** architecture for product data sources:

- **Interface**: `IProductDataProvider` - All product data services must implement this interface
- **Normalized Type**: `ProductData` - Common data structure used throughout the application
- **Current Implementation**: `KeepaService` implements `IProductDataProvider`
- **Future Flexibility**: Easy to swap or add new providers (ScraperAPI, direct Amazon API, etc.) without changing business logic

### Switching Product Data Providers

To add a new provider (e.g., ScraperAPI):
1. Create a new service implementing `IProductDataProvider`
2. Return normalized `ProductData` from `getProductDetails(asin)`
3. Update dependency injection in the module
4. No changes needed in listing logic, eBay service, or other components

## 1. Product Title & Description
- **Title**: Constrained to **80 characters** max (eBay limit).
  - Source: `ProductData.title`
  - Logic: `title.substring(0, 80)`
- **Description**: Uses raw HTML description from product data or applies a custom template from `ListingSettingsGroup` if configured.

## 2. Images
- **Source**: `ProductData.imageUrls` (array of full URLs)
- **Keepa Implementation**: Filenames from `imagesCSV` are converted to full URLs using Amazon's media server
  - Format: `https://m.media-amazon.com/images/I/{filename}`

## 3. Categories
- **Source**: Basic keyword search using `getSuggestedCategory` (eBay Taxonomy API)
- **Current Logic**: Searches using the product title
- **Future Enhancement**: Map product category IDs to eBay Category IDs for better precision

## 4. Item Specifics (Aspects)

eBay requires detailed "Item Specifics" for certain categories (e.g., Electronics, Parts).

### Data Sources (Priority Order)
1. **Structured Specs** (`ProductData.specs`): Key-value pairs if provider supports them
2. **Feature Extraction**: Parse bullet points (`ProductData.features`) using regex for "Key: Value" patterns
3. **Required Aspects API**: Query eBay Taxonomy API for mandatory fields
4. **Safe Defaults**: Fill missing required fields with "Unknown"

### Extraction Logic
- **Regex Pattern**: `(?:^|\.\s+)([A-Za-z0-9\s\-\/\.]{2,30})[:]\s*(.+?)(?=\.|$)`
- **Case-Insensitive Matching**: "processor" matches "Processor" requirement
- **Auto-Fill**: Missing required aspects get "Unknown" value

### Self-Healing Retry
If eBay publish fails with "Missing Aspect" error:
1. Extract missing field name from error message
2. Add to required aspects list
3. Retry with "Unknown" value
4. Max 5 attempts

## 5. Location & Inventory
- **Location**: Derived from `StoreSettings`
  - Priority: Store-Specific Settings > Global User Settings > Default ('US')
  - **Country Code Validation**: Strictly enforced (ISO 3166-1 alpha-2: 'US', 'GB', 'DE', etc.)
- **Stock**: Defaults to `1` unless managed by repricer strategy

## 6. Price Calculation
- **Source**: `ProductData.price.current` -> + Profit Margin -> + eBay Fees -> + Tax
- **Logic**: Defined in `ListingStrategyService`

## 7. Provider-Specific Notes

### Keepa
- **Specs**: Not provided, extracted from `features` array
- **Images**: Filenames only, converted to Amazon CDN URLs
- **Price**: Returned in cents, divided by 100

### ScraperAPI (Future)
- **Specs**: Should provide structured `specs` object
- **Images**: Full URLs expected
- **Price**: Standard decimal format

