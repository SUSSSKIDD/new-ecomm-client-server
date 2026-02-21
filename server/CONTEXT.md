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
| Auth | JWT (60-day expiry) + Twilio OTP + Store Admin PIN + Delivery Person PIN |
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
│       │   ├── admin/                           # Store Admin Dashboard
│       │   │   ├── AdminDashboard.jsx           # Main admin dashboard with stats
│       │   │   ├── AdminInventory.jsx           # Store inventory management
│       │   │   ├── AdminLayout.jsx              # Admin layout wrapper
│       │   │   ├── AdminLogin.jsx               # Store admin PIN login
│       │   │   ├── AdminOrders.jsx              # Order management with status updates
│       │   │   └── AdminProducts.jsx            # Product management (CRUD + images)
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
        │   ├── auth.controller.ts               # User OTP + Store Admin PIN endpoints
        │   ├── auth.service.ts                  # Auth logic, hardcoded admin phone +919999999999
        │   ├── jwt.strategy.ts                  # JWT → { sub, phone, role, storeId? }
        │   ├── twilio.service.ts                # DEV MODE: skips SMS, accepts OTP 123456
        │   ├── decorators/roles.decorator.ts    # @Roles('ADMIN', 'STORE_ADMIN')
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
        ├── store-admin/                         # Store Admin management
        │   ├── store-admin.module.ts
        │   ├── store-admin.controller.ts        # Store admin CRUD
        │   ├── store-admin.service.ts
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
- `POST /auth/store-admin/login` — Store admin login (phone + PIN)

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

### Orders — Admin (JWT + ADMIN/STORE_ADMIN)
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

### Products — Admin (JWT + ADMIN/STORE_MANAGER/STORE_ADMIN)
- `POST /products` — Create product with image uploads (`multipart/form-data`, max 3 images)
- `PATCH /products/:id` — Update product fields (JSON body)
- `DELETE /products/:id` — Delete product + cleanup images from storage
- `POST /products/:id/images` — Add images to existing product (max 3 total)
- `DELETE /products/:id/images` — Remove specific image by URL in body

### Stores (JWT + ADMIN/STORE_ADMIN)
- `GET /stores` — List all stores
- `POST /stores` — Create store
- `PATCH /stores/:id` — Update store
- `POST /stores/:storeId/inventory/bulk` — Bulk update store inventory

### Store Admin (JWT + ADMIN)
- `GET /store-admin` — List store admins
- `POST /store-admin` — Create store admin (phone + PIN + storeId)
- `PATCH /store-admin/:id` — Update store admin
- `DELETE /store-admin/:id` — Delete store admin

### Dashboard (JWT + ADMIN/STORE_ADMIN)
- `GET /dashboard/stats` — Dashboard analytics (orders, revenue, etc.)

### Delivery
- `POST /delivery/auth/login` — Delivery person login (phone + PIN)
- `GET /delivery/persons` — List delivery persons (Admin)
- `POST /delivery/persons` — Create delivery person (Admin)
- `PATCH /delivery/persons/:id` — Update delivery person (Admin)
- `GET /delivery/profile` — Get own profile (Delivery Person)
- `POST /delivery/location` — Update own location (lat/lng)
- `POST /delivery/status` — Toggle status (FREE/BUSY/OFFLINE)
- `GET /delivery/orders` — Get assigned orders
- `POST /delivery/orders/:id/complete` — Mark delivery as completed
- `GET /delivery/events` — SSE stream for real-time delivery updates

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
- **Role**: `USER`, `STORE_MANAGER`, `STORE_ADMIN`, `DELIVERY_PERSON`, `ADMIN`
- **OrderStatus**: `PENDING`, `CONFIRMED`, `PROCESSING`, `ORDER_PICKED`, `SHIPPED`, `DELIVERED`, `CANCELLED`
- **PaymentMethod**: `COD`, `RAZORPAY`
- **PaymentStatus**: `PENDING`, `COD_PENDING`, `PAID`, `FAILED`, `REFUNDED`
- **DeliveryPersonStatus**: `FREE`, `BUSY`, `OFFLINE`

### Models
- **User** — id, phone (unique), name, role, orders[], addresses[]
- **Address** — id, userId, type (HOME/WORK/OTHER), houseNo, street, city, state, zipCode, landmark, mapsLink, recipientName, recipientPhone, lat, lng
- **Product** — id, name, price, mrp, category, subCategory, stock, storeLocation, isGrocery, images[], storeInventory[]
  - Indexes: name, category, subCategory, storeLocation, isGrocery, createdAt, [category+createdAt], [isGrocery+category]
- **Store** — id, name, address, lat, lng, phone, isActive, inventory[], storeAdmins[]
- **StoreAdmin** — id, userId, storeId, pin (hashed), store (relation)
- **StoreInventory** — id, storeId, productId, stock, price (unique: [storeId, productId])
- **DeliveryPerson** — id, userId, phone, name, pin (hashed), status (FREE/BUSY/OFFLINE), lat, lng, isActive, assignments[]
- **OrderAssignment** — id, orderId, deliveryPersonId, assignedAt, completedAt, result
- **Order** — id, userId, orderNumber (UD-YYYYMMDD-XXXX), status, paymentMethod, paymentStatus, deliveryAddress (JSON snapshot), subtotal, deliveryFee, tax, total, idempotencyKey (unique), razorpayOrderId (unique), razorpayPaymentId, razorpaySignature, paidAt, deliveredAt, items[], assignments[], fulfillingStoreId?
  - Indexes: [userId+createdAt], orderNumber, razorpayOrderId, status
- **OrderItem** — id, orderId, productId, name (snapshot), price (snapshot), quantity, total
  - Cascade delete when order is deleted

## Dev Accounts (DEV MODE)

| Role | Phone | PIN | Notes |
|------|-------|-----|-------|
| Super Admin | `+919999999999` | — | Hardcoded in auth.service.ts, OTP: `123456` |
| Store Admin | `+918888888888` | `8888` | Created via seed/setup |
| Delivery Person | `+917777777777` | `7777` | Created via seed/setup |
| Any Customer | `+91[6-9]XXXXXXXXX` | — | OTP: `123456` (DEV MODE) |

**DEV MODE**: Twilio service skips SMS and accepts OTP `123456` for any phone number.

## Key Configuration (`.env`)

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | — | PostgreSQL connection (pooled, pgbouncer) |
| `DIRECT_URL` | — | PostgreSQL connection (direct, for migrations) |
| `JWT_SECRET` | — | Secret for JWT signing |
| `TWILIO_ACCOUNT_SID` | — | Twilio account SID for OTP |
| `TWILIO_AUTH_TOKEN` | — | Twilio auth token |
| `TWILIO_SERVICE_SID` | — | Twilio Verify service SID |
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
`storeId` is included for STORE_ADMIN role users.

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
| `STORE_MANAGER` | All USER permissions + product CRUD + image upload |
| `STORE_ADMIN` | Store-scoped: orders, inventory, dashboard for their assigned store |
| `DELIVERY_PERSON` | View assigned orders, update location/status, complete deliveries |
| `ADMIN` | Full access — bypasses store ownership checks |

### Guards
- **RolesGuard**: Reads `@Roles()` metadata → if no decorator, passes through (auth-only). If roles specified, checks `req.user.role`.
- **StoreGuard**: ADMIN bypasses. STORE_ADMIN must match storeId from route params or use their `req.user.storeId` for scoped queries.

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

## E2E Test Results

**Result: 19/19 PASSED** (comprehensive flow test)

### Tests Executed
| # | Test | Result |
|---|------|--------|
| 1 | Store Admin Login (phone + PIN) | PASS |
| 2 | Customer Auth (send OTP + verify) | PASS |
| 3 | Add to Cart (`POST /cart/items`) | PASS |
| 4 | Address Ready (list user addresses) | PASS |
| 5 | Order Preview (`POST /orders/preview`) | PASS |
| 6 | Place Order — COD | PASS |
| 7 | Idempotency Check (same key → same order) | PASS |
| 8a | Status: CONFIRMED → PROCESSING | PASS |
| 8b | Status: PROCESSING → ORDER_PICKED | PASS |
| 8c | Invalid Transition Rejected (400) | PASS |
| 9 | Assign Delivery Person | PASS |
| 10 | Delivery Person Login (phone + PIN) | PASS |
| 11 | Delivery Get Assigned Orders | PASS |
| 12 | Mark as Delivered | PASS |
| 13 | Verify Final State = DELIVERED | PASS |
| 14 | Cancel Order + Stock Restore | PASS |
| 15 | Empty Cart Order Rejected (400) | PASS |
| 16 | Invalid Address Rejected (403) | PASS |
| 17 | PROCESSING → CANCELLED (bugfix verification) | PASS |

### Edge Cases Tested
- **Idempotency**: Same idempotency key returns same order without creating duplicate
- **Empty cart**: `POST /orders` with empty cart returns 400 Bad Request
- **Invalid address**: Order with non-existent addressId returns 403 Forbidden
- **Invalid status transition**: E.g., PENDING → DELIVERED returns 400 Bad Request
- **Cancel + stock restore**: Order cancellation atomically restores product stock
- **PROCESSING → CANCELLED**: Admin can cancel orders in PROCESSING state (bugfix verified)
- **SHIPPED → CANCELLED**: Admin can cancel shipped orders for edge cases (wrong address, refusal)
- **Auto-assign race condition**: Transaction re-checks both order and delivery person status
- **Idempotency IDOR**: User A cannot retrieve User B's order via idempotency key reuse

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

## Remaining Recommendations

1. **Rate limiting on OTP endpoints** — No rate limiting on `POST /auth/send-otp`. Add throttling (e.g., 3 attempts per minute per phone).
2. **Razorpay live integration** — CartSidebar currently uses mock endpoint. For production, integrate the Razorpay checkout SDK widget.
3. **Customer cancellation scope** — `POST /orders/:id/cancel` only allows PENDING/CONFIRMED. Consider whether customers should request cancellation for PROCESSING/SHIPPED.
4. **Duplicate products in DB** — Multiple copies of same products from repeated test seeding. Consider deduplication.
5. **Stock restoration on admin cancel** — When admin cancels via `PATCH /orders/admin/:id/status`, stock is NOT restored (only customer `cancel()` restores stock). The `updateStatus` method should handle stock restoration when transitioning to CANCELLED.
