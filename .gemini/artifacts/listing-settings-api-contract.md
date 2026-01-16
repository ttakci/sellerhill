# Listing Settings Groups - API Contract

## Base URL
```
/api/listing-settings
```

---

## Endpoints

### 1. Get All Listing Groups
```http
GET /groups?storeId={storeId}
```

**Query Parameters:**
- `storeId` (optional): Filter groups by store ID

**Response:**
```json
[
  {
    "id": "clx123abc",
    "storeId": "store_001",
    "name": "Premium Electronics",
    "description": "High-end electronics with premium pricing",
    "repricingStrategy": [
      {
        "id": "range_1",
        "minPrice": 19.99,
        "maxPrice": 499.00,
        "profitMarginPercent": 15
      },
      {
        "id": "range_2",
        "minPrice": 500.00,
        "maxPrice": 9999.00,
        "fixedProfitAmount": 2.50
      }
    ],
    "stock": {
      "defaultQuantity": 5
    },
    "fees": {
      "ebayFeePercent": 13.25,
      "fixedFeeAmount": 0.30,
      "taxPercent": 8.5
    },
    "templates": {
      "type": "predefined",
      "predefinedTemplateId": "template_premium_electronics"
    },
    "createdAt": "2026-01-15T10:00:00Z",
    "updatedAt": "2026-01-16T14:30:00Z",
    "createdBy": "user_123",
    "updatedBy": "user_123"
  }
]
```

---

### 2. Get Single Listing Group
```http
GET /groups/:id
```

**Path Parameters:**
- `id`: Listing group ID

**Response:**
```json
{
  "id": "clx123abc",
  "storeId": "store_001",
  "name": "Premium Electronics",
  "description": "High-end electronics with premium pricing",
  "repricingStrategy": [...],
  "stock": {...},
  "fees": {...},
  "templates": {...},
  "createdAt": "2026-01-15T10:00:00Z",
  "updatedAt": "2026-01-16T14:30:00Z",
  "createdBy": "user_123",
  "updatedBy": "user_123"
}
```

**Error Responses:**
- `404 Not Found`: Group not found
- `403 Forbidden`: Access denied (not owner)

---

### 3. Create Listing Group
```http
POST /groups
```

**Request Body:**
```json
{
  "storeId": "store_001",
  "name": "Flash Sale Strategy",
  "description": "Low margin, high volume listings for clearance items",
  "repricingStrategy": [
    {
      "minPrice": 0.99,
      "maxPrice": 50.00,
      "profitMarginPercent": 5
    }
  ],
  "stock": {
    "defaultQuantity": 10
  },
  "fees": {
    "ebayFeePercent": 13.25,
    "fixedFeeAmount": 0.30,
    "taxPercent": 0
  },
  "templates": {
    "type": "custom",
    "customTemplateHtml": "<div class=\"listing\"><h1>{{product_title}}</h1>...</div>"
  }
}
```

**Response:**
```json
{
  "id": "clx456def",
  "storeId": "store_001",
  "name": "Flash Sale Strategy",
  ...
  "createdAt": "2026-01-16T20:00:00Z",
  "updatedAt": "2026-01-16T20:00:00Z",
  "createdBy": "user_123",
  "updatedBy": "user_123"
}
```

**Validation Errors:**
```json
{
  "statusCode": 400,
  "message": [
    "name should not be empty",
    "repricingStrategy must contain at least 1 elements",
    "maxPrice must be greater than minPrice"
  ],
  "error": "Bad Request"
}
```

---

### 4. Update Listing Group
```http
PUT /groups/:id
```

**Path Parameters:**
- `id`: Listing group ID

**Request Body:** (Partial update supported)
```json
{
  "name": "Updated Premium Electronics",
  "description": "Updated description",
  "repricingStrategy": [
    {
      "minPrice": 20.00,
      "maxPrice": 600.00,
      "profitMarginPercent": 18
    }
  ]
}
```

**Response:**
```json
{
  "id": "clx123abc",
  "storeId": "store_001",
  "name": "Updated Premium Electronics",
  ...
  "updatedAt": "2026-01-16T21:00:00Z",
  "updatedBy": "user_123"
}
```

**Error Responses:**
- `404 Not Found`: Group not found
- `403 Forbidden`: Access denied (not owner)

---

### 5. Delete Listing Group
```http
DELETE /groups/:id
```

**Path Parameters:**
- `id`: Listing group ID

**Response:**
```json
{
  "success": true
}
```

**Error Responses:**
- `404 Not Found`: Group not found
- `403 Forbidden`: Access denied (not owner)

---

### 6. Get Predefined Templates
```http
GET /predefined-templates
```

**Response:**
```json
[
  {
    "id": "template_modern_minimalist",
    "name": "Modern Minimalist",
    "description": "Clean and professional design with focus on product details",
    "htmlContent": "<div class=\"listing-container\">...</div>",
    "previewImage": "https://example.com/previews/modern-minimalist.png",
    "createdAt": "2026-01-01T00:00:00Z"
  },
  {
    "id": "template_premium_electronics",
    "name": "Premium Electronics",
    "description": "High-end design for electronics with technical specifications",
    "htmlContent": "<div class=\"premium-listing\">...</div>",
    "previewImage": "https://example.com/previews/premium-electronics.png",
    "createdAt": "2026-01-01T00:00:00Z"
  },
  {
    "id": "template_ecommerce_classic",
    "name": "E-commerce Classic",
    "description": "Traditional layout with clear sections and call-to-action",
    "htmlContent": "<div class=\"classic-template\">...</div>",
    "previewImage": "https://example.com/previews/ecommerce-classic.png",
    "createdAt": "2026-01-01T00:00:00Z"
  }
]
```

---

## Authentication

All endpoints require JWT authentication via `Authorization` header:

```http
Authorization: Bearer <jwt_token>
```

---

## Error Response Format

All errors follow the standard NestJS format:

```json
{
  "statusCode": 400 | 401 | 403 | 404 | 500,
  "message": "Error message" | ["Error 1", "Error 2"],
  "error": "Bad Request" | "Unauthorized" | "Forbidden" | "Not Found" | "Internal Server Error"
}
```

---

## Validation Rules

### Price Range
- `minPrice` >= 0
- `maxPrice` >= 0
- `maxPrice` > `minPrice`
- Either `profitMarginPercent` OR `fixedProfitAmount` must be provided
- `profitMarginPercent`: 0-100
- `fixedProfitAmount`: >= 0

### Stock
- `defaultQuantity`: integer >= 1

### Fees
- `ebayFeePercent`: 0-100
- `fixedFeeAmount`: >= 0
- `taxPercent`: 0-100

### Templates
- If `type` = "custom": `customTemplateHtml` required
- If `type` = "predefined": `predefinedTemplateId` required

### General
- `name`: required, non-empty string
- `description`: optional string
- `repricingStrategy`: array with at least 1 price range

---

## Rate Limiting

- **Standard**: 100 requests per minute per user
- **Burst**: 20 requests per second

---

## Pagination (Future Enhancement)

Currently not implemented. All groups are returned in a single response.

Future implementation will support:
```http
GET /groups?page=1&limit=20&sortBy=updatedAt&order=desc
```

---

## Filtering (Future Enhancement)

Future implementation will support:
```http
GET /groups?status=active&search=electronics
```

---

## Notes

1. **Audit Fields**: `createdBy`, `updatedBy`, `createdAt`, `updatedAt` are automatically managed by the backend
2. **Soft Delete**: Groups are hard-deleted (no soft delete implemented)
3. **Cascading**: Deleting a group does NOT affect products using that group (orphaned references should be handled by the product service)
4. **Concurrency**: No optimistic locking implemented (last write wins)
5. **Template Validation**: Custom HTML is NOT sanitized or validated (XSS prevention should be handled client-side during preview)
