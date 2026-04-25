# HOMDROP — Project Context

## Overview
NEYOKART is a hyper-local grocery delivery platform with a React frontend and NestJS backend. It supports multi-store inventory, auto-delivery assignment, store admin dashboards, and customer ordering with COD or Razorpay payment — all via OTP-based authentication.

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
| Cache | Redis (ioredis TCP, single instance via Docker `neyokart-redis` on port 6379) — app cache, rider pool/locks, presence/location |
| Auth | JWT (60-day expiry) + MSG91 SMS OTP + Store Manager PIN + Parcel Manager PIN + Delivery Person PIN |
| Payment | Razorpay SDK (test mode: `rzp_test_*`, mock mode when credentials absent) |
| Storage | Local Filesystem (Sharp WebP conversion, /opt/neyokart/uploads) |
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
│       │   │   ├── ParcelBookingForm.jsx         # Parcel booking form (addresses + details + schedule)
│       │   │   ├── Header.jsx, HeroSection, ProductGrid, etc.
│       │   │   └── profile/
│       │   │       ├── AddressManager.jsx       # Address CRUD controller
│       │   │       ├── AddressForm.jsx          # Address form (HOME/WORK/OTHER)
│       │   │       ├── AddressList.jsx          # Saved addresses display
│       │   │       └── ParcelOrderList.jsx     # User's parcel order history + cancel
│       │   ├── admin/                           # Admin Panel (SuperAdmin + StoreManager)
│       │   │   ├── AdminDashboard.jsx           # Main admin dashboard with stats
│       │   │   ├── AdminDelivery.jsx            # Delivery person management (ADMIN only) — create, toggle active, delete with confirmation
│       │   │   ├── AdminInventory.jsx           # Store inventory management
│       │   │   ├── AdminLayout.jsx              # Admin layout wrapper
│       │   │   ├── AdminLedger.jsx              # Payment ledger entries
│       │   │   ├── AdminLogin.jsx               # Admin login (SuperAdmin or StoreManager)
│       │   │   ├── AdminManagers.jsx            # Store manager management (ADMIN only)
│       │   │   ├── AdminOrders.jsx              # Order management with status updates
│       │   │   ├── AdminParcelOrders.jsx         # Parcel order management (ADMIN only)
│       │   │   ├── AdminPrintProducts.jsx        # Print product management (DROP_IN_FACTORY)
│       │   │   ├── AdminProducts.jsx            # Product management (CRUD + images)
│       │   │   ├── AdminSubcategories.jsx        # Subcategory + upload type config management
│       │   │   └── AdminStores.jsx              # Store management (ADMIN only)
│       │   ├── delivery/                        # Delivery Person App
│       │   │   ├── DeliveryDashboard.jsx        # Dashboard, online presence toggle, assigned & available orders
│       │   │   ├── DeliveryLogin.jsx            # Delivery person phone+PIN login
│       │   │   ├── DeliveryOrderCard.jsx        # Individual order card component (assigned)
│       │   │   ├── AvailableOrderCard.jsx       # Available order/parcel card (supports isParcel flag)
│       │   │   ├── DeliveryParcelCard.jsx       # Assigned parcel card (accept/reject/complete)
│       │   │   └── DeliveryStatusToggle.jsx     # DUTY_OFF/FREE/BUSY toggle
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
│       │   ├── ParcelBooking.jsx                # Pickup & Drop booking page
│       │   └── ProductDetails.jsx               # Product detail route
│       └── App.jsx, main.jsx
│
└── server/
│   ├── scripts/
│   │   └── deployment/
│   │       └── deploy.sh                    # Zero-downtime Blue/Green logic + Nginx swap
│   ├── .github/workflows/
│   │   └── deploy.yml                       # Direct SCP deployment + VPS build trigger
│   ├── CONTEXT.md                               # This file — project documentation
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
        │   ├── allocation.service.ts             # Two-phase allocation (single-store → multi-store split)
        │   ├── order-fulfillment.service.ts     # Delegates to AllocationService, backward-compat adapter
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
        ├── stores/                              # Store CRUD + inventory + subcategories
        │   ├── stores.module.ts
        │   ├── stores.controller.ts             # Store CRUD, inventory, subcategories, category config
        │   ├── stores.service.ts
        │   ├── subcategory.service.ts           # Custom subcategory + category config CRUD
        │   └── dto/
        ├── print/                               # Print Products (DROP_IN_FACTORY)
        │   ├── print.module.ts
        │   ├── print.controller.ts              # Print product CRUD + activate/deactivate
        │   ├── print.service.ts                 # Print product business logic
        │   └── dto/print-product.dto.ts         # Create/Update DTOs with size validation

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
        ├── parcel/                              # Pickup & Drop Parcel Service
        │   ├── parcel.module.ts
        │   ├── parcel.controller.ts             # Customer + Admin parcel endpoints
        │   ├── parcel.service.ts                # Parcel CRUD, approval, assignment trigger
        │   └── dto/
        │       ├── create-parcel-order.dto.ts   # Pickup/drop address, category, weight, schedule
        │       ├── approve-parcel.dto.ts        # COD amount
        │       ├── update-parcel-status.dto.ts  # Status transitions
        │       └── parcel-query.dto.ts          # Pagination + status filter
        ├── delivery/                            # Competitive Order Claiming System
        │   ├── delivery.module.ts
        │   ├── delivery.controller.ts           # Profile, active/available orders, claim endpoint
        │   ├── delivery.service.ts              # Delivery person CRUD, location tracking
        │   ├── delivery-auth.controller.ts      # Auth (phone + PIN)
        │   ├── rider-redis.service.ts           # Single Redis wrapper with key prefixes (avail:*/lock:*/idempotent:* — pool/locks, rider:* — presence/location)
        │   ├── order-pool.service.ts            # Manages available orders pool & timeouts
        │   ├── order-claim.service.ts           # 3-layer atomic race condition claiming logic
        │   ├── auto-assign.service.ts           # Now triggers order broadcast instead of direct assignment
        │   ├── delivery-sse.service.ts          # Real-time SSE streams for NEW_AVAILABLE_ORDER, ORDER_CLAIMED
        │   └── dto/
        ├── common/
        │   ├── common.module.ts                 # Global module (exports Redis + Local Storage)
        │   ├── services/
        │   │   ├── redis-cache.service.ts       # get/set/del/delPattern
        │   │   └── local-storage.service.ts     # Local filesystem storage with WebP conversion
        │   └── utils/
        │       └── geo.util.ts                  # Haversine distance, MAX_DELIVERY_RADIUS_KM = 10
        ├── prisma.service.ts, prisma.module.ts
        ├── app.module.ts, main.ts
        └── prisma/schema.prisma
```

## API Endpoints

### Auth
- `POST /auth/send-otp` — Send OTP to phone (`+91[6-9]XXXXXXXXX` format)
- `POST /auth/verify-otp` — Verify OTP, returns JWT + user
- `POST /auth/store-manager/login` — Store Manager login (phone + 4-digit PIN)
- `POST /auth/parcel-manager/login` — Parcel Manager login (phone + 4-digit PIN)
- `POST /auth/super-admin/login` — Super Admin login (hardcoded: +917785945524/5015)

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

### CSV Export (JWT + ADMIN/STORE_MANAGER)
- `GET /orders/admin/export/csv?startDate=&endDate=` — Download combined CSV of grocery orders + payment ledger entries for a date range. ADMIN gets all stores; STORE_MANAGER gets only their store's data. Response: `text/csv` attachment.


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
- `POST /orders/:id/cancel` — Cancel order (PENDING unconditionally; CONFIRMED within 90s grace period)
- `PATCH /orders/:id/modify` — Modify item quantities within 90s grace period (restore + re-decrement stock)

### Orders — Admin (JWT + ADMIN/STORE_MANAGER)
- `GET /orders/admin/store` — List orders for admin's store (ADMIN sees all)
- `PATCH /orders/admin/:id/status` — Update order status (validates state machine)
- `POST /orders/admin/:id/assign-delivery` — Manually trigger delivery assignment
- `POST /orders/admin/:id/manual-assign` — Manually assign specific rider to order
- `GET /orders/admin/export/csv` — Export orders + ledger as combined CSV (date range filter)

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
- `GET /products` — List/search products (query params: category, subCategory, search, page, limit, lat, lng). **Note:** Only returns products available in stores strictly within a 10km radius of provided lat/lng.
- `GET /products/:id` — Product detail (query params: lat, lng). Appends exact local store inventory sum based on the 10km radius.

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
- `POST /delivery/persons` — Create delivery person (admin provides PIN, stored as bcrypt hash)
- `GET /delivery/persons` — List all delivery persons
- `PATCH /delivery/persons/:id` — Update delivery person (name, isActive, pin)
- `DELETE /delivery/persons/:id` — Delete delivery person

### Delivery — Auth & Self-Service
- `POST /delivery/auth/login` — Delivery person login (phone + PIN)
- `GET /delivery/me` — Get own profile (DELIVERY_PERSON)
- `POST /delivery/location` — Update own GPS location (lat/lng, dual-written to Redis)
- `POST /delivery/status` — Set status (DUTY_OFF/FREE; BUSY is auto-managed)
- `GET /delivery/available-orders` — Poll for available orders to claim

### Delivery Person Status Flow
- **DUTY_OFF** → (manual toggle) → **FREE** (online, receives orders)
- **FREE** → (auto on accept/claim) → **BUSY** (delivering)
- **BUSY** → (auto on complete) → **FREE**
- **BUSY** → cannot go DUTY_OFF (must complete delivery first)
- `GET /delivery/orders` — Get your successfully assigned active orders
- `POST /delivery/orders/:id/claim` — Competitive claim attempt
- `POST /delivery/orders/:id/complete` — Mark delivery as DELIVERED/NOT_DELIVERED
- `GET /delivery/sse` — SSE stream (events: `NEW_AVAILABLE_ORDER`, `ORDER_CLAIMED`, `CLAIM_CONFIRMED`)

### SMS (JWT + ADMIN only)
- `POST /sms/templates` — Create SMS template (auto-extracts `##VAR##` variables)
- `GET /sms/templates` — List all templates
- `GET /sms/templates/:key` — Get template by key
- `PUT /sms/templates/:id` — Update template
- `POST /sms/send` — Send SMS using template (templateKey + recipients[{phone, variables}])
- `GET /sms/logs` — Get SMS logs (paginated, filters: templateId, recipientPhone, status, date range)
- `GET /sms/analytics` — Get SMS analytics for date range (totalSent, delivered, failed, deliveryRate)

### Parcels — Customer (JWT required)
- `POST /parcels` — Book a parcel (pickup/drop addresses, category, weight, schedule)
- `GET /parcels` — List user's parcels (paginated, status filter)
- `GET /parcels/:id` — Parcel detail (ownership verified)
- `POST /parcels/:id/cancel` — Cancel parcel (PENDING or APPROVED only)

### Parcels — Admin (JWT + ADMIN)
- `GET /admin/parcels` — List all parcels (paginated, status filter)
- `GET /admin/parcels/:id` — Parcel detail with assignment info
- `POST /admin/parcels/:id/approve` — Approve with COD amount
- `POST /admin/parcels/:id/ready` — Set Ready for Pickup
- `POST /admin/parcels/:id/assign-delivery` — Trigger rider assignment (geosearch from pickup location)
- `PATCH /admin/parcels/:id/status` — Update status (admin state transitions)

### Parcels — Delivery (JWT + DELIVERY_PERSON)
- `GET /delivery/parcel-orders` — Get assigned parcel orders
- `POST /delivery/parcels/:id/claim` — Claim parcel (3-layer race protection)
- `POST /delivery/parcels/:id/accept` — Accept parcel assignment
- `POST /delivery/parcels/:id/reject` — Reject assignment (parcel→READY_FOR_PICKUP, rider→FREE)
- `POST /delivery/parcels/:id/complete` — Complete delivery (DELIVERED/NOT_DELIVERED)

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

**Customer cancel:** `PENDING` orders can be cancelled unconditionally. `CONFIRMED` orders can only be cancelled within **90 seconds** of `confirmedAt` (grace period). Restores stock atomically.

**Customer modify:** `PATCH /orders/:id/modify` allows changing item quantities within the 90-second grace period. Atomically restores old stock and decrements new stock in a transaction. Recalculates subtotal, tax, delivery fee, and total.

**Grace period fields:** All order responses include `canCancel`, `canModify`, and `graceExpiresAt` computed from `order.status` and `order.confirmedAt`. No cron jobs — checked at request time.

**Admin cancel:** Via `PATCH /orders/admin/:id/status` with `CANCELLED`. Works from any non-terminal state.

## Parcel Order State Machine

```
PENDING → APPROVED → READY_FOR_PICKUP → ASSIGNED → PICKED_UP → IN_TRANSIT → DELIVERED
   ↓          ↓              ↓               ↓          ↓           ↓
CANCELLED  CANCELLED     CANCELLED       CANCELLED   CANCELLED   CANCELLED
```

| Transition | Triggered By |
|------------|-------------|
| PENDING → APPROVED | Admin approves with COD amount |
| APPROVED → READY_FOR_PICKUP | Admin sets ready |
| READY_FOR_PICKUP → ASSIGNED | Rider claims parcel (automatic) |
| ASSIGNED → PICKED_UP | Rider accepts assignment |
| PICKED_UP → IN_TRANSIT | *(reserved for tracking)* |
| IN_TRANSIT/PICKED_UP → DELIVERED | Rider completes delivery |
| Any non-terminal → CANCELLED | Customer (PENDING/APPROVED only) or Admin |

**Customer cancel:** Only `PENDING` or `APPROVED` parcels can be cancelled by the customer.

**Rider rejection:** Deletes ParcelAssignment, sets rider→FREE, reverts parcel→READY_FOR_PICKUP for re-assignment.

## Order Fulfillment Flow (Smart Order Allocation Engine)

### Two-Phase Allocation Algorithm (`AllocationService`)
- **Phase 1 — Single-Store Check:** Iterates nearby stores (nearest-first). If any single store has sufficient stock for ALL items, assigns entire order there. O(S × P).
- **Phase 2 — Multi-Store Split:** If no single store can fulfill everything, uses greedy biggest-contributor algorithm to minimize store fragmentation. Each round picks the store covering the most remaining item quantity, assigns those items, and repeats until all items are covered. Rejects order entirely if any item remains unfulfillable.

### Order Model for Multi-Store
- `Order.parentOrderId` (nullable self-ref FK) + `Order.isParent` (boolean) enable parent/child hierarchy.
- **Single-store order:** `parentOrderId=null`, `isParent=false` (unchanged from legacy).
- **Multi-store parent:** `parentOrderId=null`, `isParent=true`, holds aggregate totals, NO items.
- **Multi-store child:** `parentOrderId=<parent.id>`, `isParent=false`, holds items for ONE store and includes `storeTypeName`.
- All created atomically in one `$transaction` with batch stock decrement.
- **Cross-Category Carts**: Carts can contain items across any storeType (GROCERY, PIZZA_TOWN, etc.). The multi-store logic will automatically separate the order into multiple child orders based on each product's store.

### Flow
1. Customer places order with `addressId` (includes lat/lng)
2. `AllocationService.allocate()` runs two-phase algorithm against nearby stores' `StoreInventory`
3. `OrderFulfillmentService` delegates to `AllocationService`, returns backward-compatible `FulfillmentResult`
4. If single-store: one Order created with all items (legacy path)
5. If multi-store: parent Order + N child Orders created atomically, stock decremented per-store
6. Each child order gets independent delivery assignment via `OrderPoolService.broadcastOrder()`
7. Parent orders are skipped by `broadcastOrder()` and `AutoAssignService` — only children are deliverable
8. Riders claim individual child orders via the standard competitive claiming system
9. Parent order status is derived from children: `syncParentStatus()` called after every child status change

### Parent Status Derivation
- All children DELIVERED → parent DELIVERED
- All children CANCELLED → parent CANCELLED
- Any child SHIPPED → parent SHIPPED
- Any child ORDER_PICKED → parent ORDER_PICKED
- Otherwise → parent CONFIRMED

### Cancel/Modify Rules
- Cancel parent → cascades to all non-terminal children (atomic, restores all stock)
- Cancel child → cancels just that child, syncs parent status
- Modify only allowed on single-store or individual child orders (not parent directly)
- Grace period uses parent's `confirmedAt` for child orders

### Store Manager Visibility
- `findStoreOrders()` filters by `items: { some: { storeId } }` — naturally returns only relevant child orders
- Parent orders have no items, so they never appear for store managers

### User Order List
- `findAll()` excludes child orders (`parentOrderId: null`) so users see one entry per logical order
- Parent orders include `childOrders` relation with items and assignments
- Frontend shows sub-order cards with independent status tracking for each store

### Preview Endpoint
- Returns `allocation` object: `{ type: 'SINGLE_STORE' | 'MULTI_STORE', storeCount, stores: [{storeName, itemCount, subtotal}] }`
- Frontend shows multi-store info box when `allocation.type === 'MULTI_STORE'`

## Parcel Delivery Flow

1. Customer books parcel at `/pickup-drop` with pickup/drop addresses, category, weight, and schedule
2. Admin sees parcel in `/admin/parcels`, approves with COD amount → status=APPROVED
3. Admin sets "Ready for Pickup" → status=READY_FOR_PICKUP
4. Admin clicks "Find Delivery Partner" → triggers `broadcastParcelOrder()`
5. System GEOSEARCHes riders near **pickup location** (not a store), filters FREE+active, takes closest 10
6. SSE `NEW_AVAILABLE_ORDER` with `isParcel: true` flag pushes to riders
7. Rider claims parcel → 3-layer atomic lock (same as order claiming) → status=ASSIGNED, rider→BUSY
8. Rider accepts → ParcelAssignment.acceptedAt set
9. Rider completes → status=DELIVERED, rider→FREE, ParcelAssignment.completedAt + result set

**Key difference from grocery orders:** Geosearch uses **pickup lat/lng** instead of store location. No cart/products/items involved. Admin manually sets COD amount.

### Competitive Claiming System vs Auto-Assignment
- **Old System:** Searched for a single nearest FREE person and forced an assignment (`auto-assign.service.ts`).
- **New System (Competitive Claiming):** 
  - Single Redis instance (Docker `neyokart-redis`, ioredis TCP) — handles pool, locks, presence, and location cache.
  - High concurrency support (e.g. 5+ riders clicking under 10ms variance).
  - Uses idempotency keys on Redis layer for network retries.
  - Automatically times out unclaimed orders (e.g. 120 seconds via Env) and re-broadcasts.

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
- **Role**: `USER`, `STORE_MANAGER`, `PARCEL_MANAGER`, `DELIVERY_PERSON`, `ADMIN`
- **OrderStatus**: `PENDING`, `CONFIRMED`, `PROCESSING`, `ORDER_PICKED`, `SHIPPED`, `DELIVERED`, `CANCELLED`
- **PaymentMethod**: `COD`, `RAZORPAY`
- **PaymentStatus**: `PENDING`, `COD_PENDING`, `PAID`, `FAILED`, `REFUNDED`
- **DeliveryPersonStatus**: `DUTY_OFF`, `FREE`, `BUSY`
- **ParcelStatus**: `PENDING`, `APPROVED`, `READY_FOR_PICKUP`, `ASSIGNED`, `PICKED_UP`, `IN_TRANSIT`, `DELIVERED`, `CANCELLED`
- **ParcelCategory**: `DOCUMENTS`, `ELECTRONICS`, `CLOTHING_ACCESSORIES`, `FOOD_BEVERAGES`, `MEDICINE_HEALTH`, `BOOKS_STATIONERY`, `HOME_KITCHEN`, `TOYS_GAMES`, `SPORTS_FITNESS`, `PET_SUPPLIES`, `COSMETICS_PERSONAL_CARE`, `JEWELRY_VALUABLES`, `AUTO_PARTS`, `AGRICULTURAL_PRODUCTS`, `INDUSTRIAL_SUPPLIES`, `FRAGILE_ITEMS`, `OTHERS`
- **SmsStatus**: `PENDING`, `SENT`, `DELIVERED`, `FAILED`, `REJECTED`
- **SmsType**: `OTP`, `TRANSACTIONAL`, `PROMOTIONAL`

### Models
- **User** — id, phone (unique), name, role, orders[], addresses[]
- **Address** — id, userId, type (HOME/WORK/OTHER), houseNo, street, city, state, zipCode, landmark, mapsLink, recipientName, recipientPhone, lat, lng
- **Product** — id, name, price, mrp, category, subCategory, stock, storeLocation, isGrocery, images[], storeId?, taxRate (GST %, default 0), isActive, storeInventory[]
  - Indexes: name, category, subCategory, storeLocation, isGrocery, createdAt, [category+createdAt], [isGrocery+category]
- **Store** — id, name, pincode, lat, lng, address?, storeType, storeCode (unique, auto-generated A1/A2...), isActive, managers[], inventory[], deliveryPersons[], products[], ledgerEntries[]
- **StoreManager** — id, name, phone (unique), pinHash, storeId, isActive, store (relation, onDelete: Cascade)
- **PaymentLedger** — id, storeId, transactionId (unique, TXN-YYYYMMDD-NNNN), date, amount, paymentMethod, referenceNotes?, store (relation, onDelete: Cascade)
- **StoreInventory** — id, storeId, productId, stock (unique: [storeId, productId])
- **DeliveryPerson** — id, name, phone (unique), pinHash, status (DUTY_OFF/FREE/BUSY), lat?, lng?, isActive, lastLocationAt?, assignments[], parcelAssignments[]
- **OrderAssignment** — id, orderId, deliveryPersonId, assignedAt, completedAt, result
- **Order** — id, userId, orderNumber, status, paymentMethod, paymentStatus, deliveryAddress (JSON snapshot), subtotal, deliveryFee, tax, total, deliveryPin (4-digit string), idempotencyKey (unique), razorpayOrderId, razorpayPaymentId, razorpaySignature, paidAt, deliveredAt, items[], assignments[], fulfillingStoreId?
  - Indexes: [userId+createdAt], orderNumber, razorpayOrderId, status
- **OrderItem** — id, orderId, productId, name (snapshot), price (snapshot), quantity, total, taxRate (snapshot, default 0), selectedSize?, userUploadUrls[], printProductId?
  - Cascade delete when order is deleted
- **CategoryConfig** — id, storeType, subcategory, uploadType (NONE/PHOTO_UPLOAD/DESIGN_UPLOAD), @@unique([storeType, subcategory])
- **PrintProduct** — id, name, productType, sizes (JSON), basePrice, image?, isActive, createdAt, updatedAt
- **CustomSubcategory** — id, storeType, name, @@unique([storeType, name])
- **SmsTemplate** — id, name, key (unique), content, variables[], type (SmsType), isActive, msg91TemplateId?, msg91FlowId?, logs[]
- **ParcelOrder** — id, userId, parcelNumber (unique), status, pickupAddress (JSON), pickupLat, pickupLng, dropAddress (JSON), dropLat, dropLng, category, categoryOther?, weight, length?, width?, height?, pickupTime, dropTime, codAmount?, paymentMethod ("COD"), paymentStatus, deliveryPin (4-digit string), adminNotes?, createdAt, updatedAt, approvedAt?, pickedUpAt?, deliveredAt?, assignment?
- **ParcelAssignment** — id, parcelOrderId (unique), deliveryPersonId, assignedAt, acceptedAt?, completedAt?, result?
- **SmsLog** — id, templateId?, recipientPhone, variables (JSON), status (SmsStatus), msg91RequestId?, sentAt, deliveredAt?, failureReason?, metadata (JSON)

## Dev Accounts (DEV MODE)

| Role | Phone | PIN | Login Endpoint |
|------|-------|-----|----------------|
| Super Admin | `SUPER_ADMIN_PHONE` env var | `SUPER_ADMIN_PIN` env var | `POST /auth/super-admin/login` |
| Delivery Person | `+917777777777` | *(auto-generated)* | `POST /delivery/auth/login` |
| Any Customer | `+91[6-9]XXXXXXXXX` | — | `POST /auth/verify-otp` (OTP: `123456`) |

**Note**: STORE_ADMIN role has been removed. Only two admin-panel roles exist: ADMIN (SuperAdmin) and STORE_MANAGER.

**DEV MODE**: When `MSG91_AUTH_KEY` is empty, the SMS service skips actual SMS delivery and accepts OTP `123456` for any phone number.

## Key Configuration (`.env`)

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | — | PostgreSQL connection (pooled via PgBouncer on port 6432) |
| `DIRECT_URL` | — | PostgreSQL connection (direct to port 5432 for migrations) |
| `UPLOAD_PATH` | `/app/uploads` | Path for image uploads (mounted to host /opt/neyokart/uploads) |
| `MEDIA_BASE_URL` | `https://neyokart.com` | Base URL for serving uploaded media |
| `JWT_SECRET` | — | Secret for JWT signing |
| `MSG91_AUTH_KEY` | (empty) | MSG91 auth key (empty = DEV MODE, OTP 123456 accepted) |
| `MSG91_BASE_URL` | `https://control.msg91.com/api/v5` | MSG91 API base URL |
| `REDIS_URL` | `redis://neyokart-redis:6379` | ioredis TCP connection for app cache |
| `RIDER_REDIS_URL` | `redis://neyokart-redis:6379` | ioredis TCP connection for rider pool/locks/presence |
| `BULL_REDIS_HOST` | `neyokart-redis` | BullMQ Redis host |
| `BULL_REDIS_PORT` | `6379` | BullMQ Redis port |
| `PORT` | 3000 | Server port |
| `SUPER_ADMIN_PHONE` | — | Super admin phone number (e.g. `+917785945524`) |
| `SUPER_ADMIN_PIN` | — | Super admin 4-digit PIN (hashed at startup with bcrypt) |
| `DELIVERY_FEE` | 30 | Delivery fee in INR (waived for first-time orders) |
| `TAX_RATE` | *(removed)* | Replaced by per-item `taxRate` on Product model (GST %) |
| `FREE_DELIVERY_THRESHOLD` | 299 | Free delivery above this subtotal |
| `RAZORPAY_KEY_ID` | (empty) | Empty = mock mode, `rzp_test_*` = test mode |
| `RAZORPAY_KEY_SECRET` | (empty) | Empty = mock mode |
| `RAZORPAY_WEBHOOK_SECRET` | (empty) | For webhook signature verification |
| `ORDER_CLAIM_TIMEOUT_SECONDS` | 120 | Unclaimed order pool timeout before retry/re-broadcast |
| `MAX_DELIVERY_RADIUS_KM` | 10 | Maximum delivery radius in km (configurable) |

## Client-Side Constants (CartSidebar.jsx)

Client-side constants used for display estimates (final totals always come from server preview):
- `DELIVERY_FEE = 30` (Waived for first-time orders)
- `FREE_DELIVERY_THRESHOLD = 299`
- `TAX_RATE = 0.05` (legacy estimate only — server uses per-item `taxRate` from Product)

**Note:** Checkout uses server `POST /orders/preview` response exclusively for pricing. Client constants are only for the pre-checkout estimate display. Tax is now calculated per-item using each product's `taxRate` field (GST percentage 0-100).

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
| `PARCEL_MANAGER` | Parcel dashboard, manage parcels, drivers, and view stores — isolated from grocery system |
| `DELIVERY_PERSON` | View assigned orders, update location/status, complete deliveries |
| `ADMIN` | Full access — create/manage stores, store managers, delivery persons. Bypasses store ownership checks |

### Guards
- **RolesGuard**: Reads `@Roles()` metadata → if no decorator, passes through (auth-only). If roles specified, checks `req.user.role`.
- **StoreGuard**: ADMIN bypasses. STORE_MANAGER must match storeId from route params or use their `req.user.storeId` for scoped queries. PARCEL_MANAGER has read-only access (GET only). USER and DELIVERY_PERSON are explicitly denied with ForbiddenException.

## Image Upload

- **Storage**: Local Filesystem at `/opt/neyokart/uploads` (host) / `/app/uploads` (container)
- **Optimization**: All images are automatically converted to **WebP** with `sharp` (quality: 80).
- **Subdirectories**: `products/`, `user-designs/`, `print-product-images/`, `subcategories/`.
- **Naming**: `{timestamp}-{uuid8}.webp`
- **Max**: 3 images per product (combined URL + file count enforced), 5MB each.
- **Nginx Serving**: Nginx on the host serves `/uploads/*` directly via `alias /opt/neyokart/uploads/;`.
- **Cleanup**: DB record deleted first, then files removed from filesystem (best-effort).

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
- **Delivery PIN Security**:
  - Orders and parcels now include a 4-digit `deliveryPin` generated at creation.
  - Delivery completion via riders requires the correct `deliveryPin` in the body payload (e.g., `POST /delivery/orders/:id/complete`).
  - Correct PIN is mandatory for `result=DELIVERED` status updates.
- **Real-time Status & SSE Notifications**:
  - `UserSseService` pushes real-time `ORDER_STATUS_UPDATED` and `PARCEL_STATUS_UPDATED` events to the customer.
  - Parent order status is automatically synchronized with children via `syncParentOrderStatus()` triggered by child order status changes.
- Raw body enabled (`rawBody: true` in NestFactory) for webhook signature verification
- `ValidationPipe` with whitelist + transform on all inputs
- File upload validation: MIME type, file size (5MB max)
- Phone validation regex: `^\+91[6-9]\d{9}$` (Indian mobile numbers)


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

## Docker Deployment

### Prerequisites
- Docker 24+ and Docker Compose v2+
- `server/.env` file with all required environment variables (copy from `.env.example`)

### Building Images
```bash
# Build both images
docker compose build

# Build individually
docker compose build server   # NestJS API (node:20-alpine, ~149MB)
docker compose build client   # React + nginx (~22MB)
```

### Running Containers
```bash
# Start all services (detached)
docker compose up -d

# View logs
docker compose logs -f
docker compose logs -f server   # Server logs only

# Check health
docker ps                       # Shows health status
curl http://localhost:3000/      # Server health → "Hello World!"
curl http://localhost:80/        # Client → HTML page

# Stop all
docker compose down

# Rebuild and restart (after code changes)
docker compose up -d --build
```

### Environment Variables for Docker
```bash
# Override ports (default: server=3000, client=80)
PORT=3001 CLIENT_PORT=8080 docker compose up -d

# Set client API URL (baked into build)
VITE_API_URL=https://api.example.com docker compose build client
```

### Docker Architecture
- **Server**: 3-stage build (deps → build → production). Uses `dumb-init` for proper signal handling, runs as non-root `app` user (UID 1001). Healthcheck via wget.
- **Client**: 2-stage build (node build → nginx:1.27-alpine). Nginx serves SPA with: `try_files` fallback, aggressive caching for `/assets/`, security headers (X-Frame-Options, X-Content-Type-Options, Referrer-Policy), and hidden file denial.
- **Compose**: Client `depends_on` server with `service_healthy` condition. Both have `restart: unless-stopped`.

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

## Zero-Downtime Blue/Green Deployment Architecture (2026-03-15)

### CI/CD Pipeline (`.github/workflows/deploy.yml`)
- Fully automated deployment pipeline triggered on pushes to the `main` branch.
- **Docker Build & Push**: Compiles `neyokart-server` (NestJS) and `neyokart-client` (Vite SPA wrapped in Nginx) into lightweight alpine images, directly deploying them to Docker Hub.
- **Vite Variable Injection**: The workflow forcibly injects `VITE_API_URL=/api` explicitly during the Docker client build via `build-args`. This hardcodes the SPA to statically query `/api/` in production rather than defaulting to `localhost:3000`.
- **VPS SCP & SSH Execution**: The pipeline autonomously securely copies updated `docker-compose.prod.yml` and `deploy.sh` files to the Hostinger VPS over SCP using GitHub Secrets, then invokes the deployment script. 

### Blue/Green Docker Compositing
- A static `redis` container instance remains isolated and persistent on port `6379`.
- **Blue Environment**: `client-blue` (port `8001`) + `server-blue` (port `3001`). 
- **Green Environment**: `client-green` (port `8002`) + `server-green` (port `3002`).
- The system reads `/opt/neyokart/active_color.txt` to seamlessly alternate deploying the fresh images onto the dormant color stack.

### Zero-Downtime Swap (`deploy.sh` + Nginx)
1. **Pull & Start**: Fresh containers are pulled and spun up in parallel to the aggressively live traffic.
2. **Health Check Gateway**: The script enters a polling loop (20 retries) checking `curl -s http://localhost:$NEW_PORT/` to physically verify the newly deployed NestJS server is healthy before continuing.
3. **Nginx Upstream Swap**: The script utilizes `sed` to intelligently parse the live `/etc/nginx/sites-available/neyokart` configuration and swap both the `127.0.0.1:CURRENT_SERVER` and `127.0.0.1:CURRENT_CLIENT` `proxy_pass` variables seamlessly over to the newly energized ports.
4. **Graceful Drain**: `sudo nginx -s reload` handles the traffic switch instantaneously without ever dropping an active connection.
5. **Teardown**: The stale obsolete containers are finally unceremoniously stopped and destroyed via `docker compose rm -f`.

### Security & Let's Encrypt / Certbot Integration
To properly route custom domains (`neyokart.com`, `neyokart.in`) into the isolated ecosystem, standard Nginx proxy setups exist:
- Traffic originating on standard ports (`80/443`) are intercepted by Nginx natively. Let's Encrypt handles SSL verification and actively redirects standard HTTP traffic implicitly to secure HTTPS strings.
- Internal frontend static React routing handles client-side displays. All incoming proxy `http://neyokart.com/api/*` intercepts are physically stripped and forwarded secretly to `http://127.0.0.1:3001` or `3002`. This sidesteps CORS entirely, resulting in robust security routing.  
- Important VPS execution note: `sudo visudo` was strictly modified to empower the non-root `pratyush` user with `NOPASSWD: ALL` over Nginx restart actions to enable the robot pipeline to operate frictionlessly without terminal password prompts.

## Store & Product Lifecycle Consistency (2026-03-27)

### Strategy
- **Propagation**: Deactivating a store (`isActive: false`) now automatically deactivates all its associated products via `StoresService.update()`. Inactive products are hidden from customers.
- **Cascade Deletion**: Deleting a store triggers an atomic Prisma transaction that deletes all associated `Product` records and `StoreInventory` entries, ensuring no orphaned inventory data.
- **Frontend Filtering**: Public listing endpoints (`GET /products`) and searches automatically exclude inactive products. Direct product detail access (`GET /products/:id`) returns a `404 Not Found` for inactive items.

## Bulletproof "Build-on-VPS" Deployment (2026-03-27)

### Shift to Local Building
- **Registry Privacy**: The deployment pipeline now bypasses Docker Hub entirely for proprietary images. Source code folders (`server/`, `client/`, `scripts/`) are transferred directly to the VPS via SCP.
- **Local VPS Build**: Docker images are built locally on the Hostinger VPS (`docker compose build`), ensuring alignment with the host environment and improving deployment speed by avoiding large image transfers.

## Deployment & Infrastructure Optimisations (2026-04-15)

### CI/CD Parallelism (`.github/workflows/deploy.yml`)
- `build_client` job runs **in parallel** with `test` job — Vite build no longer blocks e2e tests.
- Server + client `npm ci` cached separately with correct `cache-dependency-path`.
- Path filter extended to `client/**` — client build job skipped when only server changed.
- Node version pinned to `20` (matches Dockerfile; was incorrectly `24`).

### VPS Build Speed (`scripts/deployment/deploy.sh`)
- `--no-cache` removed from `docker compose build` — BuildKit layer cache used instead. On code-only changes (no dep changes), `npm ci` layer is cached, saving ~60–90s per build.
- `DOCKER_BUILDKIT=1` + `--parallel` flag — server + client build simultaneously on VPS (independent base images, no shared layers).
- Health check URL fixed: was checking `/` (no route), now checks `/health`.

### Health Endpoint (`app.controller.ts`)
- Added `GET /health` → `{ status: "ok" }`. No auth, no DB query. Used by Docker healthcheck and deploy script polling loop.

### Docker Compose Hardening
- Explicit `app` bridge network added to both `docker-compose.yml` and `docker-compose.prod.yml` — containers isolated from host default bridge.
- `ulimits.nofile: 65536` added on Redis + server — Node hits default OS limit of 1024 under load.
- YAML anchors (`x-server-common`, `x-client-common`, `x-redis-env`) in `docker-compose.prod.yml` eliminate ~60 lines of duplication.
- Redis `--maxmemory-policy noeviction` — required for BullMQ (job queue must never evict keys). Was incorrectly set to `allkeys-lru`.
- `restart: always` → `unless-stopped` on prod — allows `docker stop` during manual deploys without auto-restart.
- `--enable-source-maps` added to server Dockerfile CMD — stack traces show original TypeScript line numbers in prod logs.
- Dev compose: `client` no longer waits for server health (`service_healthy` → simple `depends_on`) — client is static nginx, blocking on server health was unnecessary.

### Deployment Safety Checks (`deploy.sh`)
- **Nginx Integrity**: The script runs `sudo nginx -t` (configuration test) immediately after upstream substitution. If the syntax check fails, it automatically rolls back the `sed` changes before they are reloaded, preventing site-wide downtime.
- **Strict HTTP Health Check**: Uses `curl -sf` to verify that the new container is returning a valid `200 OK` (not just "running") before swapping traffic.
- **Zero-Downtime Swap**: Maintains the Blue/Green strategy using dormant port swapping (3001/3002 and 8001/8002) with graceful Nginx reloads.

## User-Centric Location & Product Variants (2026-04-11)
- **Product Variants**: Support for multiple variants per product (e.g. "Gift Wrapped", "Pack of 2") with per-variant stock, price, and labels. Variants are persisted in `OrderItem` to maintain historical accuracy.
- **Admin UI**: Granular inventory control with low-stock warnings and variant-specific management.

## Multi-Category Ordering & Order Splitting (2026-04-12)
- **Cross-Category Cart**: Users can now add items from different store types (e.g. Grocery + Pizza) to a single cart without restriction.
- **Order Splitting**: Multi-category orders are automatically detected at checkout. The system creates a `parent` order (holding totals) and multiple `child` orders (one per store).
- **Atomic Fulfillment**: Parent and children are created in a single transaction. Each child order is independently broadcasted to nearby riders based on its store location.
- **Store-Specific UI**: Cart items are grouped by `storeTypeName` in the sidebar. Order history displays sub-orders with their respective store names and delivery status.
- **Unified Status**: Parent order status is dynamically derived from all its children (e.g., Parent is DELIVERED only when all children are DELIVERED).
- **Grace Period**: Cancellation and modification work across the entire order hierarchy within the 90s grace period.

### Product Variants
- **Nested Variants:** Support for multiple variants per product (e.g. 500g, 1kg) with independent pricing, MRP, and stock management.
- **Data Integrity:** Cart and Order items natively snapshot both `variantId` and `variantLabel` upon checkout to guarantee transaction accuracy over time.
- **Admin UI:** Fully integrated variant management modal for store managers with inline updates without refreshing.

### Dynamic User-Centric Location System
- **Location Context:** Application shifted from evaluating delivery viability purely on strict "store-centric" basis to "user-centric" location detection.
- **Search Integration:** Complete Nominatim API integration allowing manual text search to dynamically reset global coordinates natively via `LocationPickerModal`.
- **Location-Aware Filtering:** Passing `lat` and `lng` filters product grid catalogs based directly on 10km radius proximity to user's custom pin, persisting across state reliably.
- **Back-Button Patch:** Popstate history listeners injected natively directly into context routes so closing modals naturally pops context state via back buttons accurately.

## VPS Infrastructure & Database Migration (2026-04-24)
- **Database Architecture**: Migrated from Supabase Managed Postgres to a self-hosted PostgreSQL 16 instance on the VPS host.
  - **PgBouncer**: Implemented as a transaction-mode pooler on port `6432`. This allows the NestJS backend to maintain a high number of virtual connections while using a small number of physical Postgres connections.
  - **Direct Access**: Port `5432` is reserved for administrative tasks and Prisma migrations.
  - **Security**: Database is bound to `127.0.0.1` and `172.17.0.1` (Docker bridge) to prevent external access.
  - **User**: Dedicated `neyokart_app` user with ownership of the `neyokart` database.

- **Postgres Optimization**:
  - **Prisma Connection Pooling**: Configured in `prisma.service.ts` with `connection_limit=10` and `pool_timeout=20` to stay within the VPS resource limits.
  - **Idle Timeout**: Set to 20 seconds to aggressively recycle unused connections.

- **Media Persistence**: 
  - **Storage**: Entirely self-hosted at `/opt/neyokart/uploads/` on the VPS.
  - **Nginx Serving**: Optimized Nginx configuration serves media files directly from the host filesystem, bypassing the Node.js application for high-performance delivery.
  - **Image Processing**: `sharp` library used for auto-conversion to WebP (80% quality) to minimize storage footprint and bandwidth.

- **Docker Networking**:
  - `host.docker.internal` (via `extra_hosts: ["host.docker.internal:host-gateway"]` in `docker-compose.prod.yml`) allows containers to reach host services (Postgres, PgBouncer) securely via the Docker gateway (`172.17.0.1`).

- **Zero-Downtime Deployment**: 
  - Maintains the Blue/Green strategy with Nginx port swapping.
  - Docker healthchecks on `/health` ensure the new container is ready before the traffic swap.
