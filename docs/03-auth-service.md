# DealFlow360 — Auth Service

---

## 1. Purpose

The Auth Service is the **identity and access management boundary** of DealFlow360. It is the sole authority for:
- User account lifecycle (signup, login, password management)
- JWT issuance and refresh for internal users
- Customer portal session management
- Magic link generation and validation

It exists as a separate service because authentication is a **security boundary**: compromising this service must not give an attacker access to business data in other services.

---

## 2. Responsibilities

- `POST /auth/signup` — Register new internal user
- `POST /auth/login` — Authenticate internal user, issue JWT access + refresh token
- `POST /auth/refresh` — Refresh access token using refresh token
- `POST /auth/logout` — Invalidate refresh token
- `POST /portal/auth/magic-link` — Request magic link for customer
- `GET /portal/auth/verify` — Validate magic link token, issue portal session
- `POST /portal/auth/login` — Customer email + password login
- `POST /portal/auth/logout` — Invalidate portal session
- `GET /auth/me` — Return current user profile (internal)
- `GET /auth/users` — List internal users (Admin only)
- `PUT /auth/users/:id/role` — Update user role (Admin only)
- Validate tokens on behalf of other services (via shared JWT secret)

---

## 3. Non-Responsibilities

- Business data (quotations, products, etc.) — owned by other services
- Authorization decisions beyond role assignment — each service enforces its own authz rules
- Customer data beyond portal access credentials — Customer entity is in Quotation Service

---

## 4. Requirements Implemented

| Requirement | Description |
|------------|-------------|
| REQ-F-001 | Internal users can sign up with email + password |
| REQ-F-002 | Internal users can log in with email + password |
| REQ-F-003 | Customers access quotations via portal login |
| REQ-F-004 | Portal login supports magic link |
| REQ-F-005 | Portal login supports email + password |
| REQ-F-006 | After login, internal users access backend |
| REQ-F-007 | After login, internal users open sales workspace |
| REQ-F-008 | Customer portal is a real, separate, restricted view |
| REQ-SEC-001 | RBAC roles defined and assigned |
| REQ-SEC-004 | JWT-based auth for internal users |
| REQ-SEC-005 | Magic link tokens: single-use, time-limited |
| REQ-SEC-006 | Passwords hashed with bcrypt |
| REQ-IMP-010 | Rate limiting on auth endpoints |

---

## 5. Dependencies

| Dependency | Type | Purpose |
|-----------|------|---------|
| PostgreSQL `auth_db` | Data | User accounts, refresh tokens |
| Redis | Cache | Magic link tokens (TTL), portal sessions (TTL) |
| Email Service | Outbound | Send magic links |

---

## 6. Internal Module Structure

```
auth-service/src/
├── config/
│   └── env.ts              # Zod-validated env vars
├── db/
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── migrations/
│   └── repositories/
│       ├── user.repository.ts
│       └── refresh-token.repository.ts
├── domain/
│   ├── entities/
│   │   ├── user.entity.ts
│   │   └── roles.ts        # Role enum: ADMIN, SALES_MANAGER, FINANCE, SALES_REP
│   └── services/
│       ├── auth.service.ts           # Signup/login/JWT logic
│       ├── magic-link.service.ts     # Magic link generation/validation
│       └── portal-session.service.ts # Portal session management
├── api/
│   ├── routes/
│   │   ├── internal-auth.routes.ts
│   │   └── portal-auth.routes.ts
│   ├── schemas/
│   │   ├── signup.schema.ts
│   │   ├── login.schema.ts
│   │   └── magic-link.schema.ts
│   └── middleware/
│       ├── rate-limit.middleware.ts
│       └── admin-only.middleware.ts
├── integrations/
│   └── email.client.ts
└── app.ts
```

---

## 7. Database Schema

```prisma
// auth-service/src/db/prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("AUTH_DATABASE_URL")
}

enum Role {
  ADMIN
  SALES_MANAGER
  FINANCE
  SALES_REP
}

model User {
  id            String    @id @default(uuid())
  email         String    @unique
  passwordHash  String
  name          String
  role          Role      @default(SALES_REP)
  isActive      Boolean   @default(true)
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  refreshTokens RefreshToken[]

  @@index([email])
}

model RefreshToken {
  id        String   @id @default(uuid())
  userId    String
  tokenHash String   @unique
  expiresAt DateTime
  createdAt DateTime @default(now())
  revokedAt DateTime?

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([tokenHash])
}

// Portal customer credentials stored here (separate from Customer entity in quotation_db)
model CustomerPortalCredential {
  id           String   @id @default(uuid())
  customerId   String   @unique   // FK reference to quotation_db.Customer (logical, not enforced at DB level)
  email        String   @unique
  passwordHash String?  // null if customer uses magic link only
  isActive     Boolean  @default(true)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  @@index([email])
  @@index([customerId])
}
```

**Redis Keys**:
```
magic_link:<token_uuid>   → { customerId, email, used: false }   TTL: 86400s (24h)
portal_session:<token>    → { customerId, email }                  TTL: 604800s (7 days)
```

---

## 8. API Endpoints

### POST /auth/signup

**Purpose**: Register a new internal user  
**Auth**: None (public) — or Admin-only in production  
**Rate limit**: 5/minute per IP

**Request**:
```json
{
  "email": "john.doe@company.com",
  "password": "SecureP@ss123",
  "name": "John Doe",
  "role": "SALES_REP"
}
```

**Validation rules**:
- `email`: valid email format, max 255 chars
- `password`: min 8 chars, must contain uppercase + number + special char
- `name`: non-empty, max 100 chars
- `role`: one of `ADMIN | SALES_MANAGER | FINANCE | SALES_REP`

**Response 201**:
```json
{
  "id": "uuid",
  "email": "john.doe@company.com",
  "name": "John Doe",
  "role": "SALES_REP",
  "createdAt": "2026-09-05T04:00:00Z"
}
```

**Error responses**:
- `400` — Validation error: `{ "error": "VALIDATION_ERROR", "details": [...] }`
- `409` — Email already registered: `{ "error": "EMAIL_ALREADY_EXISTS" }`
- `429` — Rate limit exceeded

---

### POST /auth/login

**Purpose**: Authenticate internal user  
**Auth**: None  
**Rate limit**: 10/minute per IP

**Request**:
```json
{
  "email": "john.doe@company.com",
  "password": "SecureP@ss123"
}
```

**Response 200**:
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiJ9...",
  "expiresIn": 28800,
  "user": {
    "id": "uuid",
    "email": "john.doe@company.com",
    "name": "John Doe",
    "role": "SALES_REP"
  }
}
```

**Error responses**:
- `401` — Invalid credentials: `{ "error": "INVALID_CREDENTIALS" }` (never reveal whether email exists)
- `403` — Account inactive: `{ "error": "ACCOUNT_INACTIVE" }`
- `429` — Rate limit exceeded

---

### POST /auth/refresh

**Purpose**: Exchange refresh token for new access token  
**Auth**: Bearer refresh token in body

**Request**:
```json
{ "refreshToken": "eyJ..." }
```

**Response 200**:
```json
{
  "accessToken": "eyJ...",
  "expiresIn": 28800
}
```

**Error**: `401` if refresh token invalid/expired/revoked

---

### POST /auth/logout

**Purpose**: Revoke refresh token  
**Auth**: JWT Bearer  

**Request**: `{ "refreshToken": "eyJ..." }`  
**Response**: `204 No Content`

---

### GET /auth/me

**Purpose**: Return current user  
**Auth**: JWT Bearer

**Response 200**:
```json
{
  "id": "uuid",
  "email": "john.doe@company.com",
  "name": "John Doe",
  "role": "SALES_REP"
}
```

---

### POST /portal/auth/magic-link

**Purpose**: Request magic link for customer portal access  
**Auth**: None  
**Rate limit**: 3/minute per email

**Request**:
```json
{ "email": "customer@acme.com" }
```

**Response 202**: Always returns 202 (prevents email enumeration)
```json
{ "message": "If this email is registered, a login link has been sent." }
```

---

### GET /portal/auth/verify?token=xxx

**Purpose**: Validate magic link token, issue portal session  
**Auth**: None

**Response 200**:
```json
{
  "sessionToken": "opaque-token-string",
  "customerId": "uuid",
  "email": "customer@acme.com"
}
```

Sets `Set-Cookie: portal_session=<token>; HttpOnly; SameSite=Strict; Secure; Path=/portal`

**Error responses**:
- `400` — Token missing
- `401` — Token invalid or expired or already used

---

### POST /portal/auth/login

**Purpose**: Customer email + password login  
**Auth**: None  
**Rate limit**: 10/minute per IP

**Request**:
```json
{
  "email": "customer@acme.com",
  "password": "CustomerP@ss123"
}
```

**Response 200**:
```json
{
  "sessionToken": "opaque-token-string",
  "customerId": "uuid"
}
```

---

### GET /auth/users (Admin only)

**Purpose**: List all internal users  
**Auth**: JWT Bearer, role = ADMIN

**Response 200**:
```json
{
  "data": [
    {
      "id": "uuid",
      "email": "...",
      "name": "...",
      "role": "SALES_REP",
      "isActive": true,
      "createdAt": "..."
    }
  ],
  "total": 10,
  "page": 1,
  "pageSize": 20
}
```

---

### PUT /auth/users/:id/role (Admin only)

**Purpose**: Update user role  
**Auth**: JWT Bearer, role = ADMIN

**Request**: `{ "role": "SALES_MANAGER" }`  
**Response 200**: Updated user object

---

## 9. JWT Payload Structure

```json
{
  "sub": "user-uuid",
  "email": "user@company.com",
  "role": "SALES_REP",
  "iat": 1725494400,
  "exp": 1725523200
}
```

**Portal session token** stored in Redis:
```json
{
  "customerId": "customer-uuid",
  "email": "customer@acme.com",
  "createdAt": "ISO-date"
}
```

---

## 10. Business Logic — Auth Service

### Password Policy
- Minimum 8 characters
- At least 1 uppercase letter
- At least 1 number
- At least 1 special character (`!@#$%^&*`)
- bcrypt salt rounds: 12

### JWT Strategy
- Access token: HS256, 8-hour expiry
- Refresh token: HS256, 30-day expiry
- Refresh tokens are stored hashed in DB; revoked on logout
- Rotation: each refresh issues new refresh token; old one revoked

### Magic Link Flow
1. Check if email exists in `CustomerPortalCredential`
2. If not, still return 202 (prevent enumeration)
3. If exists: generate `UUID v4` token, store `magic_link:<token> → {customerId, email, used: false}` in Redis with 24h TTL
4. Send email with link: `https://app.dealflow360.com/portal/auth/verify?token=<token>`
5. On verify: check token exists + `used == false` → set `used: true` → issue session → return session token

### Rate Limiting
- `/auth/login`: 10 req/min per IP
- `/auth/signup`: 5 req/min per IP
- `/portal/auth/magic-link`: 3 req/min per email address
- `/portal/auth/login`: 10 req/min per IP

---

## 11. Events Published

Auth Service publishes **no domain events** (auth is a leaf service). Other services do not need to subscribe to auth events.

---

## 12. Events Consumed

Auth Service consumes **no events**.

---

## 13. Error Handling

All errors follow RFC 7807 Problem Details:
```json
{
  "type": "https://dealflow360.com/errors/invalid-credentials",
  "title": "Invalid Credentials",
  "status": 401,
  "detail": "The provided email or password is incorrect.",
  "instance": "/auth/login"
}
```

Custom error codes for machine-readable errors:
- `VALIDATION_ERROR` — 400
- `EMAIL_ALREADY_EXISTS` — 409
- `INVALID_CREDENTIALS` — 401
- `TOKEN_EXPIRED` — 401
- `TOKEN_INVALID` — 401
- `TOKEN_ALREADY_USED` — 401
- `ACCOUNT_INACTIVE` — 403
- `INSUFFICIENT_ROLE` — 403
- `RATE_LIMIT_EXCEEDED` — 429

---

## 14. Security Considerations

- Never reveal whether an email exists (`magic-link` endpoint always returns 202)
- Refresh tokens stored hashed (SHA-256) in database — raw token only returned once
- Portal session token is opaque — no JWT structure for customers
- Portal session stored in httpOnly, SameSite=Strict cookie
- Service-to-service calls validated via `X-Service-Token` header (shared secret)
- All operations logged with requestId for audit

---

## 15. Unit Tests

```typescript
// auth.service.test.ts
describe('AuthService', () => {
  describe('signup', () => {
    it('hashes password before storing');
    it('throws EMAIL_ALREADY_EXISTS when email taken');
    it('assigns default role SALES_REP when not specified');
    it('rejects password not meeting complexity requirements');
  });

  describe('login', () => {
    it('returns JWT access and refresh tokens on valid credentials');
    it('returns INVALID_CREDENTIALS for wrong password');
    it('returns INVALID_CREDENTIALS for unknown email (same error — no enumeration)');
    it('returns ACCOUNT_INACTIVE for inactive user');
  });

  describe('refreshToken', () => {
    it('issues new access token for valid refresh token');
    it('rejects expired refresh token');
    it('rejects revoked refresh token');
  });
});

describe('MagicLinkService', () => {
  it('stores token in Redis with 24h TTL');
  it('marks token as used after first verification');
  it('rejects already-used token');
  it('rejects expired token');
  it('returns 202 even when email does not exist');
});
```

---

## 16. Integration Tests

```typescript
// auth.api.test.ts — uses Fastify inject
describe('POST /auth/login', () => {
  it('CHECK-AUTH-001: returns 200 with tokens for valid credentials');
  it('CHECK-AUTH-002: returns 401 for invalid credentials');
  it('CHECK-AUTH-003: does not reveal whether email exists on wrong password');
  it('returns 429 after 10 rapid attempts from same IP');
});

describe('GET /portal/auth/verify', () => {
  it('returns 200 + session cookie for valid unused token');
  it('returns 401 for already-used token');
  it('returns 401 for expired token');
});

describe('Role enforcement', () => {
  it('GET /auth/users: returns 200 for ADMIN role');
  it('GET /auth/users: returns 403 for SALES_REP role');
  it('PUT /auth/users/:id/role: returns 403 for non-ADMIN');
});
```

---

## 17. Implementation Checkpoints

**CHECK-AUTH-001**
- **Covers**: REQ-F-002, REQ-SEC-004
- **Precondition**: User exists in DB with hashed password
- **Action**: `POST /auth/login` with valid email + password
- **Expected**: HTTP 200, response contains `accessToken` (valid JWT), `refreshToken`, `user.role`
- **Test**: `auth.api.test.ts > POST /auth/login > returns 200 with tokens`

**CHECK-AUTH-002**
- **Covers**: REQ-SEC-004
- **Precondition**: None required
- **Action**: `POST /auth/login` with invalid password
- **Expected**: HTTP 401, body = `{ "error": "INVALID_CREDENTIALS" }`
- **Test**: `auth.api.test.ts > POST /auth/login > returns 401 for invalid credentials`

**CHECK-AUTH-003**
- **Covers**: REQ-SEC-007
- **Precondition**: None
- **Action**: `GET /api/quotations` with no Authorization header
- **Expected**: HTTP 401 from gateway
- **Test**: Automated security test

**CHECK-AUTH-004**
- **Covers**: REQ-F-004, REQ-SEC-005
- **Precondition**: Customer exists in CustomerPortalCredential
- **Action**: `POST /portal/auth/magic-link { email }` → receive link → `GET /portal/auth/verify?token=xxx`
- **Expected**: First verify returns 200 + session cookie; second verify of same token returns 401
- **Test**: `auth.api.test.ts > GET /portal/auth/verify`

**CHECK-AUTH-005**
- **Covers**: REQ-F-008, REQ-SEC-002
- **Precondition**: Customer has valid portal session
- **Action**: Use portal session cookie to call `GET /api/quotations` (internal endpoint)
- **Expected**: HTTP 401 — portal session rejected by internal auth middleware
- **Test**: Automated security test

**CHECK-AUTH-006**
- **Covers**: REQ-IMP-010
- **Precondition**: Auth service running
- **Action**: Send 11 login requests per minute from same IP
- **Expected**: First 10 succeed or fail normally; 11th returns HTTP 429
- **Test**: Rate limit test script
