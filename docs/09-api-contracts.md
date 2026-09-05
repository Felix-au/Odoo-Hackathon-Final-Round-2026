# DealFlow360 — API Contracts (Complete Reference)

> **CANONICAL REFERENCE**: All frontend and backend documents must use exactly these API definitions.  
> No contradictory definitions anywhere. This file is the single source of truth.

---

## API Conventions

### Base URLs
- Internal API: `https://app.dealflow360.com/api/v1`
- Customer Portal API: `https://app.dealflow360.com/portal/v1`
- During development: `http://localhost:3000/api/v1` and `http://localhost:3000/portal/v1`

### Authentication
- Internal endpoints: `Authorization: Bearer <JWT access token>`
- Portal endpoints: `Cookie: portal_session=<token>` OR `Authorization: Bearer <session token>`

### Common Headers
```
Content-Type: application/json
Accept: application/json
X-Request-ID: <uuid>   (auto-injected by frontend)
Idempotency-Key: <uuid>  (for POST requests that modify state)
```

### Error Response Format (RFC 7807)
```json
{
  "type": "https://dealflow360.com/errors/<error-code>",
  "title": "Human-readable title",
  "status": 400,
  "detail": "Detailed description",
  "instance": "/api/v1/quotations/uuid",
  "errors": [   // for VALIDATION_ERROR only
    { "field": "discountPct", "message": "Must be between 0 and 100" }
  ]
}
```

### Pagination
All list endpoints support:
```
?page=1&pageSize=20
```
Response includes:
```json
{
  "data": [...],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "total": 143,
    "totalPages": 8
  }
}
```

### Sorting
```
?sortBy=createdAt&sortOrder=desc
```

---

## Auth Service APIs (`/api/v1/auth` and `/portal/v1/auth`)

### POST /api/v1/auth/signup
```
Method: POST
Path: /api/v1/auth/signup
Auth: None
Rate limit: 5/min per IP
```

**Request**:
```json
{
  "email": "john@company.com",
  "password": "SecureP@ss123",
  "name": "John Doe",
  "role": "SALES_REP"
}
```
*role values*: `ADMIN | SALES_MANAGER | FINANCE | SALES_REP`

**Response 201**:
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "email": "john@company.com",
  "name": "John Doe",
  "role": "SALES_REP",
  "createdAt": "2026-09-05T04:00:00.000Z"
}
```

**Errors**: `400 VALIDATION_ERROR`, `409 EMAIL_ALREADY_EXISTS`, `429 RATE_LIMIT_EXCEEDED`

---

### POST /api/v1/auth/login
```
Method: POST
Path: /api/v1/auth/login
Auth: None
Rate limit: 10/min per IP
```

**Request**:
```json
{
  "email": "john@company.com",
  "password": "SecureP@ss123"
}
```

**Response 200**:
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1dWlkIiwicm9sZSI6IlNBTEVTX1JFUCIsImV4cCI6MTcyNTUyMzIwMH0.signature",
  "refreshToken": "eyJhbGciOiJIUzI1NiJ9...",
  "expiresIn": 28800,
  "user": {
    "id": "uuid",
    "email": "john@company.com",
    "name": "John Doe",
    "role": "SALES_REP"
  }
}
```

**Errors**: `401 INVALID_CREDENTIALS`, `403 ACCOUNT_INACTIVE`, `429 RATE_LIMIT_EXCEEDED`

---

### POST /api/v1/auth/refresh
```json
// Request
{ "refreshToken": "eyJ..." }

// Response 200
{ "accessToken": "eyJ...", "expiresIn": 28800 }
```
**Errors**: `401 TOKEN_EXPIRED | TOKEN_INVALID`

---

### POST /api/v1/auth/logout
```json
// Request
{ "refreshToken": "eyJ..." }

// Response 204 No Content
```

---

### GET /api/v1/auth/me
**Response 200**:
```json
{
  "id": "uuid",
  "email": "john@company.com",
  "name": "John Doe",
  "role": "SALES_REP",
  "companyId": "default"
}
```

---

### POST /portal/v1/auth/magic-link
```json
// Request
{ "email": "customer@acme.com" }

// Response 202
{ "message": "If this email is registered, a login link has been sent." }
```
Rate limit: 3/min per email

---

### GET /portal/v1/auth/verify?token=xxx
**Response 200**:
```json
{
  "sessionToken": "abc123opaque",
  "customerId": "uuid",
  "email": "customer@acme.com"
}
```
Sets `Set-Cookie: portal_session=abc123opaque; HttpOnly; SameSite=Strict; Secure; Path=/portal`

**Errors**: `400 TOKEN_MISSING`, `401 TOKEN_INVALID | TOKEN_ALREADY_USED | TOKEN_EXPIRED`

---

### POST /portal/v1/auth/login
```json
// Request
{ "email": "customer@acme.com", "password": "CustomerPass!" }

// Response 200
{ "sessionToken": "abc123opaque", "customerId": "uuid" }
```

---

## Catalog Service APIs (`/api/v1/catalog`)

### Products

#### GET /api/v1/catalog/products
**Query**: `?page=1&pageSize=20&categoryId=uuid&search=laptop&isActive=true&currency=USD`

**Response 200**:
```json
{
  "data": [
    {
      "id": "uuid",
      "name": "Enterprise Laptop Pro",
      "category": { "id": "uuid", "name": "Hardware", "discountCeilingPct": 15.0 },
      "basePrice": "1299.00",
      "unit": "unit",
      "taxRate": 18.0,
      "costPrice": "900.00",
      "description": "High-performance enterprise laptop",
      "isActive": true,
      "variants": [
        { "id": "uuid", "attribute": "Size", "value": "16-inch", "extraPrice": "200.00" }
      ]
    }
  ],
  "pagination": { "page": 1, "pageSize": 20, "total": 45, "totalPages": 3 }
}
```

#### POST /api/v1/catalog/products
**Auth**: Admin  
**Request**:
```json
{
  "name": "Enterprise Laptop Pro",
  "categoryId": "uuid",
  "basePrice": 1299.00,
  "unit": "unit",
  "taxRate": 18.0,
  "costPrice": 900.00,
  "description": "High-performance enterprise laptop",
  "variants": [
    { "attribute": "Size", "value": "16-inch", "extraPrice": 200.00 }
  ]
}
```
**Response 201**: Product object

---

#### GET /api/v1/catalog/price-lists/resolve
**Query**: `?productId=uuid&customerTier=GOLD&currency=USD&quantity=5`

**Response 200**:
```json
{
  "productId": "uuid",
  "resolvedPrice": "1100.00",
  "currency": "USD",
  "priceListId": "uuid",
  "appliedRule": "tier_discount",
  "discount": 15.3
}
```

---

#### GET /api/v1/catalog/discount-tiers/ceilings
**Auth**: Any internal user

**Response 200**:
```json
{
  "tierCeilings": {
    "BRONZE": 5.0,
    "SILVER": 10.0,
    "GOLD": 15.0
  },
  "categoryCeilings": {
    "uuid-hardware": 15.0,
    "uuid-services": 10.0,
    "uuid-subscriptions": 20.0
  },
  "cachedAt": "2026-09-05T04:00:00Z",
  "ttlSeconds": 300
}
```

---

#### GET /api/v1/catalog/approval-chains/resolve?riskScore=75
**Response 200**:
```json
{
  "riskScore": 75.0,
  "requiresApproval": true,
  "requiredRoles": ["SALES_MANAGER", "FINANCE"],
  "chainId": "uuid",
  "chainName": "High Risk"
}
```

---

#### GET /api/v1/catalog/upsell-rules/suggestions?productIds=id1,id2&customerTier=GOLD
**Response 200**:
```json
{
  "suggestions": [
    {
      "suggestedProductId": "uuid",
      "suggestedProduct": {
        "id": "uuid",
        "name": "ProSupport 1yr Warranty",
        "basePrice": "299.00",
        "categoryName": "Services"
      },
      "estimatedMarginPct": 65.0,
      "isPromoted": true,
      "promotionTag": "🔥 Hot Deal",
      "priority": 10
    }
  ]
}
```

---

## Quotation Service APIs (`/api/v1/quotations` and `/portal/v1/quotations`)

### GET /api/v1/quotations
**Query**: `?page=1&pageSize=20&status=DRAFT&repId=uuid&customerId=uuid&from=2026-09-01&to=2026-09-05&sortBy=createdAt&sortOrder=desc`

**Response 200**:
```json
{
  "data": [
    {
      "id": "uuid",
      "customer": { "id": "uuid", "name": "Acme Corp", "tier": "GOLD" },
      "repId": "uuid",
      "repName": "John Doe",
      "status": "DRAFT",
      "blendedRiskScore": 18.5,
      "totalAmount": "5720.00",
      "totalMarginPct": 28.3,
      "currency": "USD",
      "lineCount": 2,
      "lastActivityAt": "2026-09-05T04:00:00Z",
      "createdAt": "2026-09-04T10:00:00Z"
    }
  ],
  "pagination": { "page": 1, "pageSize": 20, "total": 47, "totalPages": 3 }
}
```

---

### POST /api/v1/quotations
**Auth**: SALES_REP, ADMIN

**Request**:
```json
{
  "customerId": "uuid",
  "currency": "USD",
  "notes": "Annual renewal discussion",
  "validUntil": "2026-10-31"
}
```

**Response 201**:
```json
{
  "id": "uuid",
  "customer": {
    "id": "uuid",
    "name": "Acme Corp",
    "tier": "GOLD",
    "email": "procurement@acme.com"
  },
  "repId": "uuid",
  "status": "DRAFT",
  "blendedRiskScore": 0,
  "totalAmount": "0.00",
  "totalMarginPct": 0,
  "currency": "USD",
  "lines": [],
  "notes": "Annual renewal discussion",
  "validUntil": "2026-10-31",
  "version": 1,
  "createdAt": "2026-09-05T04:00:00Z"
}
```

---

### POST /api/v1/quotations/:id/lines
**Auth**: SALES_REP (own quotation), ADMIN

**Request**:
```json
{
  "productId": "uuid",
  "variantId": null,
  "quantity": 5,
  "discountPct": 12.0,
  "version": 1
}
```
*version*: Current quotation version for optimistic concurrency

**Response 200** (updated quotation):
```json
{
  "id": "uuid",
  "status": "DRAFT",
  "blendedRiskScore": 0,
  "totalAmount": "5720.00",
  "totalMarginPct": 30.6,
  "version": 2,
  "lines": [
    {
      "id": "uuid",
      "productId": "uuid",
      "productName": "Enterprise Laptop Pro",
      "categoryId": "uuid",
      "categoryName": "Hardware",
      "quantity": 5,
      "unitPrice": "1299.00",
      "costPrice": "900.00",
      "discountPct": 12.0,
      "lineTotal": "5720.00",
      "taxAmount": "1029.60",
      "marginPct": 30.6,
      "isRecurring": false,
      "sortOrder": 0
    }
  ],
  "lineViolations": []
}
```

**Errors**: `404 QUOTATION_NOT_FOUND`, `409 CONCURRENCY_CONFLICT` (version mismatch), `400 VALIDATION_ERROR`

---

### PUT /api/v1/quotations/:id/lines/:lineId
**Request**:
```json
{
  "quantity": 8,
  "discountPct": 18.0,
  "version": 2
}
```
**Response 200**: Full updated quotation (same shape as above)

---

### DELETE /api/v1/quotations/:id/lines/:lineId
**Query**: `?version=2`  
**Response 200**: Updated quotation without the deleted line

---

### GET /api/v1/quotations/:id/risk-score
**Response 200**:
```json
{
  "quotationId": "uuid",
  "blendedRiskScore": 45.2,
  "requiresApproval": true,
  "requiredRoles": ["SALES_MANAGER", "FINANCE"],
  "lineViolations": [
    {
      "lineId": "uuid",
      "productName": "Setup Service",
      "categoryName": "Services",
      "appliedDiscount": 18.0,
      "allowedCeiling": 10.0,
      "violationPoints": 8.0,
      "isViolating": true
    }
  ]
}
```

---

### GET /api/v1/quotations/:id/upsell-suggestions
**Response 200**:
```json
{
  "quotationId": "uuid",
  "suggestions": [
    {
      "suggestedProductId": "uuid",
      "suggestedProduct": {
        "id": "uuid",
        "name": "ProSupport 1yr Warranty",
        "basePrice": "299.00"
      },
      "marginDeltaIfAdded": "+4.2%",
      "isPromoted": true,
      "promotionTag": "🔥 Hot Deal"
    }
  ]
}
```

---

### POST /api/v1/quotations/:id/submit
**Auth**: SALES_REP (own quotation), ADMIN

**Request**: `{}`  
**Response 200**:
```json
{
  "id": "uuid",
  "status": "PENDING_MANAGER_APPROVAL",
  "blendedRiskScore": 45.2,
  "approvalRequired": true,
  "requiredApprovers": ["SALES_MANAGER", "FINANCE"],
  "approvalLog": []
}
```

*or if no approval needed*:
```json
{
  "id": "uuid",
  "status": "APPROVED",
  "approvalRequired": false,
  "requiredApprovers": []
}
```

**Errors**: `400 INVALID_TRANSITION` (not in DRAFT status), `422 NO_LINES` (empty quotation)

---

### POST /api/v1/quotations/:id/approve
**Auth**: SALES_MANAGER (for manager-level), FINANCE (for finance-level)

**Request**:
```json
{
  "reason": "Margins acceptable for strategic account",
  "approverNote": "Customer has 5-year history with us"
}
```
*reason*: Optional for approvals, required for rejections

**Response 200**:
```json
{
  "id": "uuid",
  "status": "APPROVED",
  "approvalLog": [
    {
      "id": "uuid",
      "approverName": "Jane Manager",
      "approverRole": "SALES_MANAGER",
      "action": "APPROVE",
      "reason": "Margins acceptable for strategic account",
      "riskScore": 45.2,
      "createdAt": "2026-09-05T05:00:00Z"
    }
  ]
}
```

---

### POST /api/v1/quotations/:id/reject
**Auth**: SALES_MANAGER, FINANCE

**Request**:
```json
{
  "reason": "Discount exceeds acceptable margin for this product category"
}
```
*reason*: **REQUIRED** for reject

**Response 200**:
```json
{
  "id": "uuid",
  "status": "REJECTED",
  "approvalLog": [...]
}
```

---

### POST /api/v1/quotations/:id/return
**Auth**: SALES_MANAGER, FINANCE

**Request**:
```json
{
  "reason": "Please reduce Service line discount to under 10%"
}
```
**Response 200**: `{ "id": "uuid", "status": "DRAFT" }`

---

### POST /api/v1/quotations/:id/send
**Auth**: SALES_REP, SALES_MANAGER, ADMIN

**Request**: `{}`  
**Response 200**: `{ "id": "uuid", "status": "SENT", "portalLink": "https://app.dealflow360.com/portal/quotations/uuid" }`

---

### POST /api/v1/quotations/:id/confirm
**Auth**: SALES_REP, ADMIN  
**Idempotency-Key**: Required

**Request**: `{}`  
**Response 200**:
```json
{
  "id": "uuid",
  "status": "CONFIRMED",
  "confirmedAt": "2026-09-05T06:00:00Z"
}
```

---

### GET /api/v1/quotations/pipeline
**Response 200**:
```json
{
  "stages": [
    {
      "status": "DRAFT",
      "label": "Draft",
      "count": 12,
      "quotations": [
        {
          "id": "uuid",
          "customer": { "name": "Acme Corp", "tier": "GOLD" },
          "totalAmount": "45000.00",
          "blendedRiskScore": 18.5,
          "repName": "John Doe",
          "lastActivityAt": "2026-09-05T04:00:00Z"
        }
      ]
    }
  ]
}
```

---

### GET /portal/v1/quotations/:id
**Auth**: Portal session (customer must own quotation)

**Response 200**:
```json
{
  "id": "uuid",
  "status": "SENT",
  "customer": { "name": "Acme Corp" },
  "lines": [
    {
      "id": "uuid",
      "productName": "Enterprise Laptop Pro",
      "quantity": 5,
      "unitPrice": "1299.00",
      "discountPct": 12.0,
      "lineTotal": "5720.00",
      "isRecurring": false
    }
  ],
  "totalAmount": "5720.00",
  "currency": "USD",
  "validUntil": "2026-10-31",
  "negotiations": [
    {
      "id": "uuid",
      "message": "Can you improve pricing on the Service line?",
      "proposedDiscount": 22.0,
      "status": "PENDING",
      "createdAt": "2026-09-05T03:00:00Z"
    }
  ]
}
```

---

### POST /portal/v1/quotations/:id/negotiate
**Auth**: Portal session

**Request**:
```json
{
  "message": "We would like a higher discount on the Service line given our volume",
  "proposedDiscount": 22.0,
  "lineComments": {
    "line-uuid-1": "This price is fine",
    "line-uuid-2": "Can this be reduced?"
  }
}
```

**Response 200**:
```json
{
  "id": "uuid",
  "status": "UNDER_NEGOTIATION",
  "negotiationId": "uuid",
  "reEnteredApproval": false,
  "message": "Your request has been submitted. The sales team will review and respond."
}
```

*If re-entered approval*:
```json
{
  "status": "PENDING_MANAGER_APPROVAL",
  "reEnteredApproval": true,
  "message": "The requested discount requires additional approval. We will notify you once reviewed."
}
```

---

### POST /portal/v1/quotations/:id/confirm
**Auth**: Portal session

**Request**: `{}`  
**Response 200**:
```json
{
  "id": "uuid",
  "status": "CONFIRMED",
  "confirmedAt": "2026-09-05T06:00:00Z",
  "message": "Order confirmed! You will receive fulfillment and billing information shortly."
}
```

---

## Fulfillment Service APIs (`/api/v1/fulfillment`)

### GET /api/v1/fulfillment/stock
**Query**: `?warehouseId=uuid&productId=uuid&page=1&pageSize=20`

**Response 200**:
```json
{
  "data": [
    {
      "warehouseId": "uuid",
      "warehouseName": "Main Warehouse",
      "productId": "uuid",
      "productName": "Enterprise Laptop Pro",
      "variantId": null,
      "quantityOnHand": 50,
      "quantityReserved": 10,
      "quantityAvailable": 40,
      "reorderPoint": 10,
      "reorderQty": 50
    }
  ],
  "pagination": { ... }
}
```

---

### GET /api/v1/fulfillment/split-recommendation?orderId=:id
**Response 200**:
```json
{
  "orderId": "uuid",
  "recommendedSplits": [
    {
      "warehouseId": "uuid",
      "warehouseName": "Main Warehouse",
      "shippingCostWeight": 1.0,
      "items": [
        {
          "productId": "uuid",
          "productName": "Enterprise Laptop Pro",
          "quantityRequested": 5,
          "quantityFromHere": 3,
          "quantityBackordered": 0
        }
      ]
    },
    {
      "warehouseId": "uuid-east",
      "warehouseName": "East Depot",
      "shippingCostWeight": 1.3,
      "items": [
        {
          "productId": "uuid",
          "productName": "Enterprise Laptop Pro",
          "quantityRequested": 5,
          "quantityFromHere": 2,
          "quantityBackordered": 0
        }
      ]
    }
  ],
  "estimatedShipmentCount": 2,
  "estimatedTotalShippingCost": 2.3,
  "hasBackorder": false,
  "backorderedItems": []
}
```

---

### POST /api/v1/fulfillment/orders
**Auth**: SALES_REP, FINANCE, ADMIN

**Request**:
```json
{
  "orderId": "uuid",
  "splits": [
    {
      "warehouseId": "uuid",
      "productId": "uuid",
      "variantId": null,
      "quantity": 3
    },
    {
      "warehouseId": "uuid-east",
      "productId": "uuid",
      "variantId": null,
      "quantity": 2
    }
  ],
  "isOverride": false
}
```

**Response 201**:
```json
{
  "id": "uuid",
  "orderId": "uuid",
  "splits": [...],
  "isOverride": false,
  "status": "RESERVED",
  "createdAt": "2026-09-05T06:00:00Z"
}
```

---

## Billing Service APIs (`/api/v1/billing`)

### GET /api/v1/billing/invoices
**Query**: `?orderId=uuid&status=SENT&customerId=uuid&page=1&pageSize=20`

**Response 200**:
```json
{
  "data": [
    {
      "id": "uuid",
      "orderId": "uuid",
      "type": "ONE_TIME",
      "status": "SENT",
      "currency": "USD",
      "subtotal": "5720.00",
      "taxAmount": "1029.60",
      "totalAmount": "6749.60",
      "dueDate": "2026-09-20",
      "createdAt": "2026-09-05T06:00:00Z"
    }
  ],
  "pagination": { ... }
}
```

---

### POST /api/v1/billing/invoices/:id/payments
**Auth**: FINANCE, ADMIN  
**Idempotency-Key**: Required

**Request**:
```json
{
  "amount": "6749.60",
  "currency": "USD",
  "method": "bank_transfer",
  "reference": "TXN-20260905-001"
}
```

**Response 200**:
```json
{
  "invoiceId": "uuid",
  "status": "PAID",
  "paidAt": "2026-09-05T07:00:00Z",
  "payment": {
    "id": "uuid",
    "amount": "6749.60",
    "method": "bank_transfer",
    "reference": "TXN-20260905-001",
    "recordedAt": "2026-09-05T07:00:00Z"
  }
}
```

---

### GET /api/v1/billing/schedules?orderId=:id
**Response 200**:
```json
{
  "orderId": "uuid",
  "oneTimeInvoice": {
    "id": "uuid",
    "type": "ONE_TIME",
    "amount": "6749.60",
    "status": "SENT",
    "dueDate": "2026-09-20"
  },
  "recurringLines": [
    {
      "id": "uuid",
      "planName": "ProSupport Monthly",
      "interval": "MONTHLY",
      "quantity": 5,
      "unitPrice": "49.99",
      "currency": "USD",
      "status": "ACTIVE",
      "nextBillingDate": "2026-10-05",
      "schedule": [
        { "date": "2026-10-05", "amount": "249.95" },
        { "date": "2026-11-05", "amount": "249.95" },
        { "date": "2026-12-05", "amount": "249.95" }
      ]
    }
  ]
}
```

---

## Analytics Service APIs (`/api/v1/analytics`)

### GET /api/v1/analytics/dashboard
**Auth**: SALES_MANAGER, FINANCE, ADMIN  
**Query**: `?from=2026-09-01&to=2026-09-05`

**Response 200** (see analytics-service.md for full schema)

---

### GET /api/v1/analytics/deal-health
**Auth**: SALES_MANAGER, FINANCE, ADMIN

**Response 200** (see analytics-service.md)

---

### POST /api/v1/analytics/alerts/:id/nudge
**Auth**: SALES_MANAGER, ADMIN

**Request**:
```json
{
  "type": "EMAIL_NUDGE",
  "message": "This deal needs follow-up action today."
}
```
**Response 200**:
```json
{
  "alertId": "uuid",
  "nudgeId": "uuid",
  "type": "EMAIL_NUDGE",
  "sentTo": ["john.doe@company.com"],
  "createdAt": "2026-09-05T09:00:00Z"
}
```

---

### POST /api/v1/analytics/reports/export
**Auth**: SALES_MANAGER, ADMIN

**Request**:
```json
{
  "reportType": "quotations",
  "format": "PDF",
  "filters": {
    "from": "2026-09-01",
    "to": "2026-09-05",
    "repId": null,
    "status": null,
    "productId": null
  }
}
```
*format*: `PDF | XLS`
*reportType*: `quotations | products | discounts | recurring`

**Response 200**:
```json
{
  "exportId": "uuid",
  "downloadUrl": "/api/v1/analytics/reports/exports/uuid.pdf",
  "expiresAt": "2026-09-05T10:00:00Z",
  "format": "PDF"
}
```

---

## HTTP Status Code Reference

| Code | Meaning | When |
|------|---------|------|
| 200 | OK | Successful GET, PUT, POST (update) |
| 201 | Created | Successful POST (create) |
| 202 | Accepted | Async action queued |
| 204 | No Content | Successful DELETE, logout |
| 400 | Bad Request | Validation error |
| 401 | Unauthorized | Missing or invalid auth |
| 403 | Forbidden | Valid auth, insufficient role |
| 404 | Not Found | Resource doesn't exist |
| 409 | Conflict | Concurrency conflict, duplicate key |
| 422 | Unprocessable | Valid format but business rule violation |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Unexpected server error |
| 503 | Service Unavailable | Dependent service down |

---

## Implementation Checkpoints — API Contracts

**CHECK-API-001**
- **Covers**: REQ-IMP-004
- **Precondition**: Any error condition
- **Action**: Trigger a 400 error from any endpoint
- **Expected**: Response body matches RFC 7807 format with `type`, `title`, `status`, `detail`
- **Verification**: All error tests validate response shape

**CHECK-API-002**
- **Covers**: REQ-IMP-005
- **Precondition**: List endpoint with 100+ items
- **Action**: `GET /api/v1/quotations?pageSize=20`
- **Expected**: Response includes `pagination.total`, `pagination.totalPages`; only 20 items in `data`
- **Verification**: Automated API test

**CHECK-API-003**
- **Covers**: REQ-IMP-007
- **Precondition**: Quotation at version=2
- **Action**: `POST /api/v1/quotations/:id/lines` with `version: 1`
- **Expected**: HTTP 409 with error `CONCURRENCY_CONFLICT`
- **Verification**: Automated concurrency test

**CHECK-API-004**
- **Covers**: All service APIs
- **Precondition**: OpenAPI docs generated
- **Action**: Visit `http://localhost:3001/docs` through `3006/docs`
- **Expected**: Swagger UI shows all endpoints with correct schemas
- **Verification**: Manual check of each service's Swagger UI
