# HOMDROP — Project Context

## Overview
NEYOKART (formerly United Deals) is a hyper-local grocery delivery platform with a React frontend and NestJS backend. It supports multi-store inventory, auto-delivery assignment, store admin dashboards, and customer ordering with COD or Razorpay payment — all via OTP-based authentication.

## Tech Stack

### Client (`/client`)
| Layer | Technology |
|-------|-----------|
| Framework | React 19.2.0 + Vite 7.2.4 |
| Routing | React Router DOM 7.13.0 |
| State | React Context API (AuthContext, CategoryContext, AdminAuthContext, LocationContext) |
| HTTP | Axios 1.13.5 |
| Styling | TailwindCSS 3.4.19 + Konsta UI 4.0.1 |
| Validation | Zod |

### Server (`/server`)
| Layer | Technology |
|-------|-----------|
| Framework | NestJS 11 (Express) |
| Database | PostgreSQL + Prisma ORM 7.4 (via pg adapter) |
| Cache | Upstash Redis (graceful degradation if unavailable) |
| Auth | JWT (60-day expiry) + MSG91 SMS OTP + Store Manager PIN + Delivery Person PIN |
| Payment | Razorpay SDK (test mode: `rzp_test_*`, mock mode when credentials absent) |
| Storage | Supabase Storage (product images, graceful degradation) |
| Security | Helmet, CORS, ValidationPipe (whitelist + transform), RolesGuard, StoreGuard |
| Docs | Swagger at `/api` |
| Tests | Jest 30 + ts-jest + supertest |

## Project Structure

```
new grocery/
├── client/
│   └── src/
│       ├── components/
│       │   ├── auth/LoginModal.jsx              # OTP login (2-step) with resend cooldown
│       │   ├── united/
│       │   │   ├── CartSidebar.jsx              # Cart drawer + checkout (COD + Razorpay mock)
│       │   │   ├── ProductDetailView.jsx        # Product modal (Buy Now / Add to Cart)
│       │   │   ├── ImageCarousel.jsx            # Reusable image carousel (arrows + dots)
│       │   │   ├── ProfilePage.jsx              # User profile sidebar
│       │   │   ├── Header.jsx, HeroSection, ProductGrid, etc.
│       │   │   └── profile/
│       │   │       ├── AddressManager.jsx       # Address CRUD controller
│       │   │       ├── AddressForm.jsx          # Address form (HOME/WORK/OTHER)
│       │   │       └── AddressList.jsx          # Saved addresses display
│       │   ├── admin/                           # Admin Panel (SuperAdmin + StoreManager)
│       │   │   ├── AdminDashboard.jsx           # Main admin dashboard with stats
│       │   │   ├── AdminDelivery.jsx            # Delivery person management (ADMIN only)
│       │   │   ├── AdminInventory.jsx           # Store inventory management
│       │   │   ├── AdminLayout.jsx              # Admin layout wrapper
│       │   │   ├── AdminLedger.jsx              # Payment ledger entries
│       │   │   ├── AdminLogin.jsx               # Admin login (SuperAdmin or StoreManager)
│       │   │   ├── AdminManagers.jsx            # Store manager management (ADMIN only)
│       │   │   ├── AdminOrders.jsx              # Order management with status updates
│       │   │   ├── AdminProducts.jsx            # Product management (CRUD + images)
│       │   │   └── AdminStores.jsx              # Store management (ADMIN only)
│       │   ├── delivery/                        # Delivery Person App
│       │   │   ├── DeliveryDashboard.jsx        # Delivery person main dashboard
│       │   │   ├── DeliveryLogin.jsx            # Delivery person phone+PIN login
│       │   │   ├── DeliveryOrderCard.jsx        # Individual order card component
│       │   │   └── DeliveryStatusToggle.jsx     # FREE/BUSY/OFFLINE toggle
│       │   └── BottomTabBar, CategoryGrid, GhostState, PincodeHeader
│       ├── context/
│       │   ├── AuthContext.jsx                  # User auth, token, login/logout
│       │   ├── CategoryContext.jsx              # Cart, categories, product selection
│       │   ├── AdminAuthContext.jsx             # Store admin authentication state
│       │   └── LocationContext.jsx              # User location (lat/lng) for delivery
│       ├── hooks/
│       │   ├── useAddresses.js                  # Address API hook
│       │   ├── useAdminAuth.js                  # Admin authentication hook
│       │   ├── useProductList.js                # Product listing with pagination
│       │   ├── useProductSearch.js              # Debounced product search
│       │   └── useDebounce.js
│       ├── views/
│       │   ├── UnitedDealsHome.jsx              # Main home page
│       │   └── ProductDetails.jsx               # Product detail route
│       └── App.jsx, main.jsx
│
└── server/
    ├── CONTEXT.md                               # This file — project documentation
    ├── BUGFIX-REPORT.md                         # Comprehensive bug fix & E2E report
    └── src/
        ├── auth/                                # OTP login + JWT + RBAC
        │   ├── auth.module.ts                   # Global, exports RolesGuard
        │   ├── auth.controller.ts               # User OTP + Store Manager PIN + Super Admin endpoints
        │   ├── auth.service.ts                  # Auth logic, hardcoded admin phone +919999999999
        │   ├── jwt.strategy.ts                  # JWT → { sub, phone, role, storeId? }
        ├── sms/                                 # SMS via MSG91 (templates, logs, analytics)
        │   ├── sms.module.ts                   # Global, exports SmsService
        │   ├── sms.controller.ts               # Admin-only SMS management endpoints
        │   ├── sms.service.ts                  # OTP (replaces Twilio) + template CRUD + logs + analytics
        │   ├── msg91.service.ts                # MSG91 Flow API wrapper (DEV MODE when AUTH_KEY empty)
        │   └── dto/ (CreateTemplateDto, UpdateTemplateDto, SendSmsDto, SmsQueryDto)
        │   ├── decorators/roles.decorator.ts    # @Roles('ADMIN', 'STORE_MANAGER')
        │   ├── guards/roles.guard.ts            # RolesGuard (checks req.user.role)
        │   ├── guards/store.guard.ts            # StoreGuard (ownership validation, ADMIN bypasses)
        │   ├── dto/auth.dto.ts                  # Phone regex: ^\+91[6-9]\d{9}$
        │   └── interfaces/authenticated-request.interface.ts
        ├── cart/                                 # Redis-based cart (7-day TTL)
        │   ├── cart.module.ts
        │   ├── cart.controller.ts               # 5 endpoints, JWT protected
        │   ├── cart.service.ts                  # Optimistic stock validation, price snapshot
        │   ├── dto/ (AddToCartDto, UpdateCartItemDto)
        │   └── interfaces/cart.interface.ts     # CartItem, Cart
        ├── orders/                              # Order lifecycle + fulfillment
        │   ├── orders.module.ts
        │   ├── orders.controller.ts             # Customer + Admin endpoints
        │   ├── orders.service.ts                # Atomic stock, idempotency, state machine, admin ops
        │   ├── order-fulfillment.service.ts     # Store-level inventory allocation & nearest store
        │   ├── dto/ (CreateOrderDto, OrderQueryDto)
        │   └── interfaces/order-preview.interface.ts
        ├── payments/                            # Razorpay + COD + mock
        │   ├── payments.module.ts
        │   ├── payments.controller.ts           # 5 endpoints (status, create, mock, verify, webhook)
        │   ├── payments.service.ts              # Auto-detects mock vs test vs live mode
        │   └── dto/verify-payment.dto.ts
        ├── products/                            # Product CRUD + image upload
        │   ├── products.module.ts
        │   ├── products.controller.ts           # Public GET + admin CRUD with image upload
        │   ├── products.service.ts              # createWithImages, update, remove
        │   └── dto/ (CreateProductDto, UpdateProductDto, ProductQueryDto, RemoveImageDto)
        ├── search/                              # Full-text search with Redis cache
        │   ├── search.module.ts
        │   ├── search.controller.ts
        │   └── search.service.ts
        ├── users/                               # User + address management
        │   ├── users.module.ts
        │   ├── users.controller.ts
        │   └── users.service.ts
        ├── stores/                              # Store CRUD + inventory
        │   ├── stores.module.ts
        │   ├── stores.controller.ts             # Store CRUD, inventory bulk update
        │   ├── stores.service.ts
        │   └── dto/

        ├── store-manager/                       # Store Manager CRUD (ADMIN only)
        │   ├── store-manager.module.ts
        │   ├── store-manager.controller.ts     # CRUD endpoints at /store-managers
        │   ├── store-manager.service.ts        # Create, soft-delete, phone conflict check
        │   └── dto/
        ├── ledger/                              # Payment Ledger
        │   ├── ledger.module.ts
        │   ├── ledger.controller.ts            # Create, list, my-store endpoints
        │   ├── ledger.service.ts               # Counter-based TXN ID with P2002 retry
        │   └── dto/
        ├── dashboard/                           # Admin dashboard stats
        │   ├── dashboard.module.ts
        │   ├── dashboard.controller.ts          # Dashboard analytics endpoints
        │   └── dashboard.service.ts
        ├── delivery/                            # Delivery system
        │   ├── delivery.module.ts
        │   ├── delivery.controller.ts           # Delivery person CRUD, profile, orders, SSE
        │   ├── delivery.service.ts              # Assignment, completion, status management
        │   ├── delivery-auth.controller.ts      # POST /delivery/auth/login (phone + PIN)
        │   ├── auto-assign.service.ts           # Haversine nearest-FREE-person assignment
        │   ├── delivery-events.gateway.ts       # SSE for real-time delivery updates
        │   └── dto/
        ├── common/
        │   ├── common.module.ts                 # Global module (exports Redis + Supabase)
        │   ├── services/
        │   │   ├── redis-cache.service.ts       # get/set/del/delPattern
        │   │   └── supabase-storage.service.ts  # upload/delete images to Supabase Storage
        │   └── utils/
        │       └── geo.util.ts                  # Haversine distance, MAX_DELIVERY_RADIUS_KM = 9
        ├── prisma.service.ts, prisma.module.ts
        ├── app.module.ts, main.ts
        └── prisma/schema.prisma
```

## API Endpoints

### Auth
- `POST /auth/send-otp` — Send OTP to phone (`+91[6-9]XXXXXXXXX` format)
- `POST /auth/verify-otp` — Verify OTP, returns JWT + user
- `POST /auth/store-manager/login` — Store Manager login (phone + 4-digit PIN)
- `POST /auth/super-admin/login` — Super Admin login (hardcoded: +919999999999/0000)

### Store Managers (JWT + ADMIN only)
- `POST /store-managers` — Create store manager (name, phone, pin, storeId)
- `GET /store-managers` — List all active store managers
- `GET /store-managers/:id` — Get store manager by ID
- `PATCH /store-managers/:id` — Update store manager (name, phone, pin, isActive)
- `DELETE /store-managers/:id` — Soft-deactivate store manager

### Ledger (JWT + ADMIN/STORE_MANAGER)
- `POST /ledger` — Create ledger entry (storeId, date, amount, paymentMethod)
- `GET /ledger` — List all ledger entries (ADMIN, with filters)
- `GET /ledger/my-store` — Get ledger entries for own store


### Cart (JWT required)
- `GET /cart` — Get current cart (from Redis)
- `POST /cart/items` — Add item to cart (validates product stock)
- `PATCH /cart/items/:productId` — Update item quantity
- `DELETE /cart/items/:productId` — Remove item
- `DELETE /cart` — Clear cart

### Orders — Customer (JWT required)
- `POST /orders/preview` — Preview order totals from cart (optional `addressId` for fulfillment-aware preview)
- `POST /orders` — Create order (requires `idempotency-key` header)
- `GET /orders` — List orders (paginated, cached 5 min)
- `GET /orders/:id` — Order detail with items
- `POST /orders/:id/cancel` — Cancel order (PENDING/CONFIRMED only, restores stock)

### Orders — Admin (JWT + ADMIN/STORE_MANAGER)
- `GET /orders/admin/store` — List orders for admin's store (ADMIN sees all)
- `PATCH /orders/admin/:id/status` — Update order status (validates state machine)
- `POST /orders/admin/:id/assign-delivery` — Manually trigger delivery assignment

### Payments
- `GET /payments/status` — Check mock vs live mode (no auth)
- `POST /payments/create/:orderId` — Create Razorpay order (JWT)
- `POST /payments/mock/:orderId` — Mock payment for dev/test (JWT, blocked with `rzp_live_*` keys)
- `POST /payments/verify` — Verify Razorpay signature (JWT)
- `POST /payments/webhook` — Razorpay server webhook (signature auth)

### Users (JWT required)
- `GET /users/addresses` — List addresses
- `POST /users/addresses` — Create address (with lat/lng)
- `PATCH /users/addresses/:id` — Update address
- `DELETE /users/addresses/:id` — Delete address

### Products (Public)
- `GET /products` — List/search products (query params: category, subCategory, search, page, limit)
- `GET /products/:id` — Product detail

### Products — Admin (JWT + ADMIN/STORE_MANAGER)
- `POST /products` — Create product with image uploads (`multipart/form-data`, max 3 images)
- `PATCH /products/:id` — Update product fields (JSON body)
- `DELETE /products/:id` — Delete product + cleanup images from storage
- `POST /products/:id/images` — Add images to existing product (max 3 total)
- `DELETE /products/:id/images` — Remove specific image by URL in body

### Stores (JWT + ADMIN/STORE_MANAGER)
- `GET /stores` — List all stores
- `POST /stores` — Create store
- `PATCH /stores/:id` — Update store
- `POST /stores/:storeId/inventory/bulk` — Bulk update store inventory


### Dashboard (JWT + ADMIN/STORE_MANAGER)
- `GET /dashboard/store` — Dashboard analytics for store (orders, revenue, inventory health)
- `GET /dashboard/delivery/:id` — Delivery person stats

### Delivery — Admin (JWT + ADMIN)
- `POST /delivery/persons` — Create delivery person (returns auto-generated PIN once)
- `GET /delivery/persons` — List all delivery persons
- `PATCH /delivery/persons/:id` — Update delivery person (name, isActive, homeStoreId)
- `DELETE /delivery/persons/:id` — Delete delivery person

### Delivery — Auth & Self-Service
- `POST /delivery/auth/login` — Delivery person login (phone + PIN)
- `GET /delivery/me` — Get own profile (DELIVERY_PERSON)
- `POST /delivery/location` — Update own GPS location (lat/lng)
- `POST /delivery/status` — Set status (FREE/BUSY)
- `GET /delivery/orders` — Get assigned orders
- `POST /delivery/orders/:id/complete` — Mark delivery as DELIVERED/NOT_DELIVERED
- `GET /delivery/sse` — SSE stream for real-time delivery notifications

### SMS (JWT + ADMIN only)
- `POST /sms/templates` — Create SMS template (auto-extracts `##VAR##` variables)
- `GET /sms/templates` — List all templates
- `GET /sms/templates/:key` — Get template by key
- `PUT /sms/templates/:id` — Update template
- `POST /sms/send` — Send SMS using template (templateKey + recipients[{phone, variables}])
- `GET /sms/logs` — Get SMS logs (paginated, filters: templateId, recipientPhone, status, date range)
- `GET /sms/analytics` — Get SMS analytics for date range (totalSent, delivered, failed, deliveryRate)

### Search
- `GET /search/products` — Full-text product search
- `GET /search/suggestions` — Search autocomplete suggestions
- `GET /search/categories` — Category listing

## Order State Machine

```
PENDING → CONFIRMED → PROCESSING → ORDER_PICKED → SHIPPED → DELIVERED
   ↓          ↓           ↓             ↓            ↓
CANCELLED  CANCELLED   CANCELLED    CANCELLED    CANCELLED
```

### Valid Transitions
| From | Allowed To |
|------|-----------|
| `PENDING` | `CONFIRMED`, `CANCELLED` |
| `CONFIRMED` | `PROCESSING`, `ORDER_PICKED`, `CANCELLED` |
| `PROCESSING` | `ORDER_PICKED`, `CANCELLED` |
| `ORDER_PICKED` | `SHIPPED`, `DELIVERED`, `CANCELLED` |
| `SHIPPED` | `DELIVERED`, `CANCELLED` |
| `DELIVERED` | *(terminal)* |
| `CANCELLED` | *(terminal)* |

**Customer cancel:** Only allowed for `PENDING` and `CONFIRMED` (via `POST /orders/:id/cancel`). Restores stock atomically.

**Admin cancel:** Via `PATCH /orders/admin/:id/status` with `CANCELLED`. Works from any non-terminal state.

## Order Fulfillment Flow

1. Customer places order with `addressId` (includes lat/lng)
2. `OrderFulfillmentService` finds nearest store(s) with required inventory using Haversine distance
3. `StoreInventory` records are decremented per-store
4. If no nearby store has stock, falls back to global `Product.stock`
5. Order is created with fulfillment metadata (which store fulfills which items)
6. Auto-assignment triggers: finds nearest `FREE` delivery person to fulfilling store
7. Delivery person gets the assignment, marks order as delivered on completion

### Auto-Assignment Logic (`auto-assign.service.ts`)
- Uses Haversine distance (max radius: 9km) to find nearest FREE delivery person
- Runs inside a Prisma transaction with race condition guards:
  - Re-checks delivery person status (still FREE?)
  - Re-checks order status (not CANCELLED/DELIVERED?)
- Sets delivery person to BUSY, creates OrderAssignment record
- Triggered on: order creation, payment completion, delivery person becoming FREE

## Payment Flow

### Razorpay Flow
```
1. Client creates order:   POST /orders  { addressId, paymentMethod: "RAZORPAY" }
                           + header: idempotency-key: <unique-uuid>
2. Client creates payment: POST /payments/create/:orderId  → { razorpayOrderId, key, amount }
3. Client opens Razorpay checkout SDK with razorpayOrderId
4. On success, client verifies: POST /payments/verify { razorpay_order_id, razorpay_payment_id, razorpay_signature }
5. Server verifies HMAC-SHA256 signature (constant-time comparison)
6. Server marks order: status=CONFIRMED, paymentStatus=PAID
```

### COD Flow
```
1. Client creates order: POST /orders { addressId, paymentMethod: "COD" }
2. Order auto-confirmed: status=CONFIRMED, paymentStatus=COD_PENDING
3. Cart is cleared automatically
```

### Mock Payment (Dev/Test)
```
1. Client creates order: POST /orders { addressId, paymentMethod: "RAZORPAY" }
2. Client calls: POST /payments/mock/:orderId
3. Server auto-confirms payment, marks order as CONFIRMED + PAID
```

### Payment Modes
| Mode | Condition | Behavior |
|------|-----------|----------|
| **Mock** | `RAZORPAY_KEY_ID` empty | All payments auto-succeed, mock Razorpay order IDs |
| **Test** | Key starts with `rzp_test_*` | Real Razorpay API (test sandbox), mock endpoint allowed |
| **Live** | Key starts with `rzp_live_*` | Real Razorpay API (production), mock endpoint blocked |

## Database Models (Prisma)

### Enums
- **Role**: `USER`, `STORE_MANAGER`, `DELIVERY_PERSON`, `ADMIN`
- **OrderStatus**: `PENDING`, `CONFIRMED`, `PROCESSING`, `ORDER_PICKED`, `SHIPPED`, `DELIVERED`, `CANCELLED`
- **PaymentMethod**: `COD`, `RAZORPAY`
- **PaymentStatus**: `PENDING`, `COD_PENDING`, `PAID`, `FAILED`, `REFUNDED`
- **DeliveryPersonStatus**: `FREE`, `BUSY`
- **SmsStatus**: `PENDING`, `SENT`, `DELIVERED`, `FAILED`, `REJECTED`
- **SmsType**: `OTP`, `TRANSACTIONAL`, `PROMOTIONAL`

### Models
- **User** — id, phone (unique), name, role, orders[], addresses[]
- **Address** — id, userId, type (HOME/WORK/OTHER), houseNo, street, city, state, zipCode, landmark, mapsLink, recipientName, recipientPhone, lat, lng
- **Product** — id, name, price, mrp, category, subCategory, stock, storeLocation, isGrocery, images[], storeId?, storeInventory[]
  - Indexes: name, category, subCategory, storeLocation, isGrocery, createdAt, [category+createdAt], [isGrocery+category]
- **Store** — id, name, pincode, lat, lng, address?, storeType, storeCode (unique, auto-generated A1/A2...), isActive, managers[], inventory[], deliveryPersons[], products[], ledgerEntries[]
- **StoreManager** — id, name, phone (unique), pinHash, storeId, isActive, store (relation, onDelete: Cascade)
- **PaymentLedger** — id, storeId, transactionId (unique, TXN-YYYYMMDD-NNNN), date, amount, paymentMethod, referenceNotes?, store (relation, onDelete: Cascade)
- **StoreInventory** — id, storeId, productId, stock (unique: [storeId, productId])
- **DeliveryPerson** — id, name, phone (unique), pinHash, homeStoreId, status (FREE/BUSY), lat?, lng?, isActive, lastLocationAt?, assignments[]
- **OrderAssignment** — id, orderId, deliveryPersonId, assignedAt, completedAt, result
- **Order** — id, userId, orderNumber (UD-YYYYMMDD-XXXX), status, paymentMethod, paymentStatus, deliveryAddress (JSON snapshot), subtotal, deliveryFee, tax, total, idempotencyKey (unique), razorpayOrderId (unique), razorpayPaymentId, razorpaySignature, paidAt, deliveredAt, items[], assignments[], fulfillingStoreId?
  - Indexes: [userId+createdAt], orderNumber, razorpayOrderId, status
- **OrderItem** — id, orderId, productId, name (snapshot), price (snapshot), quantity, total
  - Cascade delete when order is deleted
- **SmsTemplate** — id, name, key (unique), content, variables[], type (SmsType), isActive, msg91TemplateId?, msg91FlowId?, logs[]
- **SmsLog** — id, templateId?, recipientPhone, variables (JSON), status (SmsStatus), msg91RequestId?, sentAt, deliveredAt?, failureReason?, metadata (JSON)

## Dev Accounts (DEV MODE)

| Role | Phone | PIN | Login Endpoint |
|------|-------|-----|----------------|
| Super Admin | `+919999999999` | `0000` | `POST /auth/super-admin/login` |
| Delivery Person | `+917777777777` | *(auto-generated)* | `POST /delivery/auth/login` |
| Any Customer | `+91[6-9]XXXXXXXXX` | — | `POST /auth/verify-otp` (OTP: `123456`) |

**Note**: STORE_ADMIN role has been removed. Only two admin-panel roles exist: ADMIN (SuperAdmin) and STORE_MANAGER.

**DEV MODE**: When `MSG91_AUTH_KEY` is empty, the SMS service skips actual SMS delivery and accepts OTP `123456` for any phone number.

## Key Configuration (`.env`)

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | — | PostgreSQL connection (pooled, pgbouncer) |
| `DIRECT_URL` | — | PostgreSQL connection (direct, for migrations) |
| `JWT_SECRET` | — | Secret for JWT signing |
| `MSG91_AUTH_KEY` | (empty) | MSG91 auth key (empty = DEV MODE, OTP 123456 accepted) |
| `MSG91_BASE_URL` | `https://control.msg91.com/api/v5` | MSG91 API base URL |
| `UPSTASH_REDIS_REST_URL` | — | Upstash Redis URL (empty = caching disabled) |
| `UPSTASH_REDIS_REST_TOKEN` | — | Upstash Redis token |
| `PORT` | 3000 | Server port |
| `DELIVERY_FEE` | 40 | Delivery fee in INR |
| `TAX_RATE` | 0.05 | Tax rate (5%) |
| `FREE_DELIVERY_THRESHOLD` | 500 | Free delivery above this subtotal |
| `RAZORPAY_KEY_ID` | (empty) | Empty = mock mode, `rzp_test_*` = test mode |
| `RAZORPAY_KEY_SECRET` | (empty) | Empty = mock mode |
| `RAZORPAY_WEBHOOK_SECRET` | (empty) | For webhook signature verification |
| `SUPABASE_URL` | — | Supabase project URL (empty = image uploads disabled) |
| `SUPABASE_SERVICE_ROLE_KEY` | — | Supabase service role key for storage access |

## Client-Side Constants (CartSidebar.jsx)

Must stay in sync with server `.env`:
- `DELIVERY_FEE = 40`
- `FREE_DELIVERY_THRESHOLD = 500`
- `TAX_RATE = 0.05`

## JWT Strategy

The JWT payload shape is `{ sub: userId, phone, role, storeId? }`.
In controllers, the user ID is accessed via `req.user.sub` (NOT `req.user.id`).
`storeId` is included for `STORE_MANAGER` role users. `ADMIN` role has no `storeId` (has access to all stores).

## Key Architecture Decisions

### Atomic Stock Management
Stock is decremented via raw SQL inside a Prisma transaction:
```sql
UPDATE "Product" SET "stock" = "stock" - $1 WHERE "id" = $2 AND "stock" >= $1
```
Returns 0 affected rows if stock is insufficient → triggers ConflictException.
On order cancellation, stock is atomically restored.

### Idempotency
Orders use a unique `idempotencyKey` column. If a duplicate key is sent, the existing order is returned (with userId ownership check) instead of creating a new one. This prevents double-charging on network retries.

### Address Snapshotting
The delivery address is stored as a JSON blob on the `Order` model, preserving historical accuracy even if the user later modifies or deletes their address.

### Cart in Redis
- 7-day TTL, key format: `cart:{userId}`
- Price/name snapshots refreshed on every add/update operation
- Optimistic stock check: uses max of global and best store stock (exact validation at fulfillment)
- Cart is auto-cleared after successful order creation
- Graceful degradation: if Redis is unavailable, returns empty cart

### Caching Strategy
| Data | TTL | Invalidation |
|------|-----|-------------|
| Cart | 7 days | On add/update/remove/clear/order-create |
| Order list | 5 min | On order create/cancel/payment |
| Search results | varies | Per RedisCacheService |

## Role-Based Authorization

Use `@UseGuards(AuthGuard('jwt'), RolesGuard)` + `@Roles(...)` on admin endpoints.
Use `StoreGuard` for store-scoped operations (validates `req.user.storeId` matches route param).

| Role | Permissions |
|------|------------|
| `USER` | Cart, orders, payments, addresses, browse products |
| `STORE_MANAGER` | Product CRUD, order management, inventory, ledger, dashboard — scoped to assigned store |
| `DELIVERY_PERSON` | View assigned orders, update location/status, complete deliveries |
| `ADMIN` | Full access — create/manage stores, store managers, delivery persons. Bypasses store ownership checks |

### Guards
- **RolesGuard**: Reads `@Roles()` metadata → if no decorator, passes through (auth-only). If roles specified, checks `req.user.role`.
- **StoreGuard**: ADMIN bypasses. STORE_MANAGER must match storeId from route params or use their `req.user.storeId` for scoped queries. USER and DELIVERY_PERSON are explicitly denied with ForbiddenException.

## Image Upload

- **Storage**: Supabase Storage bucket `product-images` (must be set to Public, hyphenated name)
- **Max**: 3 images per product (combined URL + file count enforced), 5MB each
- **Types**: JPEG, PNG, WebP (validated at Multer level before buffering)
- **Naming**: `products/{timestamp}-{uuid8}.{ext}`
- **Cleanup**: DB record deleted first, then images cleaned up (best-effort). Uploaded images rolled back on DB failure.
- **Concurrency**: `addImages` uses Prisma `$transaction` to prevent TOCTOU race conditions
- **Graceful degradation**: If Supabase env vars missing, upload endpoints return 400

## Security Measures

- Role-based access control with `RolesGuard` + `@Roles()` decorator
- Store ownership validation with `StoreGuard`
- Idempotency key ownership check (prevents IDOR — User A can't retrieve User B's order)
- Constant-time HMAC signature comparison (`crypto.timingSafeEqual`)
- Mock payment endpoint blocked with production Razorpay keys (`rzp_live_*`)
- JWT auth on all sensitive endpoints
- Helmet security headers
- Idempotency keys prevent duplicate orders
- Atomic stock decrement with race condition detection
- Auto-assign race condition guards (re-checks order + delivery person status in transaction)
- Raw body enabled (`rawBody: true` in NestFactory) for webhook signature verification
- `ValidationPipe` with whitelist + transform on all inputs
- File upload validation: MIME type, file size (5MB max)
- Phone validation regex: `^\+91[6-9]\d{9}$` (Indian mobile numbers)

## Bug Fixes Applied (2026-02-19)

See `server/BUGFIX-REPORT.md` for full details with before/after code.

### Backend
1. **CRITICAL — Idempotency Key IDOR** (`orders.service.ts`): Added userId ownership check when returning cached idempotent order
2. **Cart Stock Validation** (`cart.service.ts`): Added clarifying comment for optimistic stock check behavior
3. **PROCESSING → CANCELLED** (`orders.service.ts`): Verified transition exists in state machine
4. **SHIPPED → CANCELLED** (`orders.service.ts`): Added CANCELLED to SHIPPED transitions for edge cases
5. **Auto-Assign Race Condition** (`auto-assign.service.ts`): Added order status re-check inside assignment transaction

### Frontend
1. **LoginModal Resend OTP** (`LoginModal.jsx`): Implemented full resend with 30-second cooldown timer
2. **CartSidebar Online Payment** (`CartSidebar.jsx`): Implemented mock payment completion flow via `/payments/mock/:orderId`
3. **DeliveryDashboard Crash** (`DeliveryDashboard.jsx`): Added optional chaining for `a.order?.id`
4. **AdminOrders Payment Display** (`AdminOrders.jsx`): Split payment status and payment method into separate displays

## E2E Test Results (2026-02-22)

**Result: 28/28 PASSED** (post STORE_ADMIN removal QA audit)

### Tests Executed
| # | Category | Tests | Result |
|---|----------|-------|--------|
| 1 | Auth | Super admin login (200), removed store-admin endpoint (404), invalid phone (400) | 3/3 PASS |
| 2 | Store Management | Create (201), List (200), Update (200) | 3/3 PASS |
| 3 | Store Manager CRUD | Create (201), Duplicate conflict (409), List without pinHash (200), Update (200), Self-phone update (200), Soft delete (200) | 6/6 PASS |
| 4 | Deactivated Login | Rejected with 401 "Invalid credentials or inactive" | 1/1 PASS |
| 5 | Delivery CRUD | Create with auto-PIN (201), Invalid phone (400), List (200), Toggle isActive (200) | 4/4 PASS |
| 6 | Delivery Login | Login with generated PIN (201) | 1/1 PASS |
| 7 | Delivery Self-Service | GET /delivery/me (200), POST /delivery/location (201) | 2/2 PASS |
| 8 | RBAC Security | No token=401, Delivery on admin routes=403 (x3) | 4/4 PASS |
| 9 | Dashboard | Admin stats endpoint (200) | 1/1 PASS |
| 10 | Validation | pin="abcd" (400), phone="+91123" (400), delivery pin="ab" (400) | 3/3 PASS |

### Edge Cases Verified
- **STORE_ADMIN removed**: `/auth/store-admin/login` returns 404
- **Phone validation**: Indian mobile format `+91[6-9]XXXXXXXXX` enforced on all DTOs
- **PIN validation**: Digits-only, exactly 4 characters enforced
- **Duplicate phone**: Store manager creation with duplicate phone returns 409
- **Soft delete**: Manager deactivation sets isActive=false, blocks subsequent login
- **pinHash never leaked**: Verified absent from all list/detail responses
- **StoreGuard RBAC**: DELIVERY_PERSON cannot access store-scoped endpoints (403)
- **mockPayment blocks cancelled orders**: Cannot process payment for CANCELLED/DELIVERED orders

## Running Locally

```bash
# Server
cd server
npm install
npx prisma generate        # Generate Prisma client
npx prisma db push          # Sync schema to DB
npm run start:dev           # Start with hot-reload on :3000

# For production build
npx nest build              # Compile to dist/
node dist/src/main.js       # Run compiled

# Client
cd client
npm install
npm run dev                 # Start on :5173 or :5174
```

Swagger API docs available at: `http://localhost:3000/api`

## Fixed Store Categories

Stores have a `storeType` field. Each type has immutable subcategories defined in `server/src/common/constants/store-categories.ts` and `client/src/constants/index.js`:

| Store Type | Subcategories |
|------------|--------------|
| `GROCERY` | Vegetables & Fruits, Atta Rice & Dal, Dairy Bread & Eggs, etc. (28 categories) |
| `PIZZA_TOWN` | Pizza, Burger, Sandwich, French Fries, Cake |
| `AUTO_SERVICE` | Car Wash, Bike Wash, Car Products, Bike Products |
| `DROP_IN_FACTORY` | General, Photo Frames, Coffee Mugs, Custom T-Shirts, etc. |
| `AUTO_PARTS_SHOP` | Parts, Accessories, Tools |

Store naming follows auto-generated codes: A1, A2, A3... AN (with retry on unique constraint collision).

## Latency Benchmark (2026-02-22)

| Endpoint | Avg | Min | Max |
|----------|-----|-----|-----|
| `GET /` (health) | 0.6ms | 0.5ms | 0.9ms |
| `POST /auth/super-admin/login` | 58ms | 45ms | 107ms |
| `GET /stores` | 48ms | 47ms | 49ms |
| `GET /dashboard/store` | 1.1ms | 0.9ms | 1.5ms |
| `GET /products` | 129ms | 29ms | 435ms |
| `GET /search/products?q=milk` | 66ms | 29ms | 134ms |
| `GET /store-managers` | 110ms | 94ms | 166ms |
| `GET /delivery/persons` | 108ms | 92ms | 155ms |
| `GET /ledger/my-store` | 60ms | 46ms | 106ms |

*Note: First request for cached endpoints (products, search) is slower; subsequent requests hit Redis cache.*

## Remaining Recommendations

1. **Rate limiting on OTP endpoints** — No rate limiting on `POST /auth/send-otp`. Add throttling (e.g., 3 attempts per minute per phone).
2. **Razorpay live integration** — CartSidebar currently uses mock endpoint. For production, integrate the Razorpay checkout SDK widget.
3. **Customer cancellation scope** — `POST /orders/:id/cancel` only allows PENDING/CONFIRMED. Consider whether customers should request cancellation for PROCESSING/SHIPPED.
4. **Stock restoration on admin cancel** — When admin cancels via `PATCH /orders/admin/:id/status`, stock is NOT restored (only customer `cancel()` restores stock). The `updateStatus` method should handle stock restoration when transitioning to CANCELLED.
5. **Super Admin credentials** — Currently hardcoded in auth.service.ts. Move to environment variables for production.
6. **Token expiration handling** — Frontend has no 401 interceptor. Expired tokens cause silent failures instead of redirect to login.
7. **Toast notifications** — Frontend uses `alert()` for user feedback in several admin pages. Replace with a proper toast notification system.
