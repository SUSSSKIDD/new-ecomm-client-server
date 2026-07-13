# NEYOKART — Release Notes v1.0.0

**First Production Release** | **Date: 13 July 2026** | **Build: 8 (Android) / 1.0.0 (Server & Client)**

---

## 🎉 Overview

NEYOKART is a hyper-local grocery delivery platform connecting customers with nearby stores for instant delivery. This v1.0.0 release marks our initial launch on the Google Play Store for the **Customer App** (`com.neyokart.app`).

---

## ✨ Key Features

### 🛒 Customer Experience
- **Multi-Store Smart Cart** — Add items from different store types (Grocery, Pizza Town, Auto Service, Drop-in Factory) in a single cart
- **Intelligent Order Allocation** — Two-phase algorithm: single-store fulfillment when possible, automatic multi-store split when needed
- **Real-Time Order Tracking** — Live delivery status updates via SSE (Server-Sent Events)
- **Delivery PIN Security** — 4-digit PIN required for delivery completion (prevents fake deliveries)
- **Flexible Payment** — COD (Cash on Delivery) + Razorpay (UPI, Cards, NetBanking, Wallets)
- **Address Management** — Save multiple addresses (Home/Work/Other) with GPS coordinates
- **First-Order Free Delivery** — Automatic waiver for new customers
- **Order Grace Period** — Cancel/modify within 90 seconds of confirmation

### 🏪 Store Management (Admin Panel)
- **Multi-Store Dashboard** — Centralized view of orders, revenue, inventory health
- **Product CRUD** — Image upload (auto WebP conversion), variants, per-item GST rates
- **Inventory Control** — Bulk stock updates, low-stock alerts
- **Store Manager Roles** — Delegated access per store (ADMIN bypasses all)
- **Payment Ledger** — Auto-generated transaction IDs (TXN-YYYYMMDD-NNNN), CSV export

### 🚚 Delivery Operations
- **Competitive Claiming System** — Riders compete for orders via real-time SSE broadcast (no forced assignment)
- **3-Layer Atomic Claim Lock** — Race-condition free under high concurrency
- **Status Flow** — DUTY_OFF → FREE → BUSY → FREE (auto-managed)
- **Parcel Delivery** — Separate pickup/drop flow with admin approval & COD amount setting

### 📦 Parcel Service (Pickup & Drop)
- **Customer Booking** — Schedule pickup/drop, category, weight, dimensions
- **Admin Approval** — Set COD amount, mark Ready for Pickup
- **Rider Assignment** — Geosearch from pickup location (not store)
- **End-to-End Tracking** — PICKED_UP → IN_TRANSIT → DELIVERED with PIN verification

---

## 🏗 Technical Highlights

### Architecture
- **Frontend**: React 19 + Vite 7 + TailwindCSS + Konsta UI (iOS/Android native feel)
- **Backend**: NestJS 11 (Express) + Prisma ORM + PostgreSQL (via PgBouncer)
- **Cache/Locks**: Redis (ioredis) — cart sessions, rider pools, claim locks, SSE pub/sub
- **Auth**: JWT (60-day) + MSG91 SMS OTP + PIN-based roles (Store Manager, Parcel Manager, Delivery)
- **Payments**: Razorpay SDK with mock/test/live mode auto-detection
- **Storage**: Local filesystem + Sharp (auto WebP, 80% quality, 5MB limit)
- **Mobile**: Capacitor 8 — shared React codebase → native Android/iOS apps

### Database (PostgreSQL + Prisma)
- **Multi-tenant store model** — Auto-generated store codes (A1, A2...)
- **Parent/Child order hierarchy** — Atomic transactions for split orders
- **Product variants** — Independent pricing, stock, MRP per variant
- **Full audit trail** — Order status timestamps, delivery PIN, assignment logs

### Deployment & Infra
- **Blue/Green Zero-Downtime** — Docker Compose on Hostinger VPS, Nginx upstream swap
- **Self-hosted PostgreSQL 16** — PgBouncer (port 6432) for connection pooling
- **Media via Nginx** — Direct `/uploads/*` serving (bypasses Node)
- **CI/CD** — GitHub Actions → SCP → VPS build → health-check → Nginx reload
- **Observability** — `/health` endpoint, Firebase Crashlytics/Analytics/Performance

---

## 📱 Apps in This Release

| App | Package / Bundle ID | Version | Platform | Status |
|-----|---------------------|---------|----------|--------|
| **Customer App** | `com.neyokart.app` | **1.0.0 (code 7)** | Android | **Launching on Play Store** |
| Delivery Rider App | `com.neyokart.delivery` | 1.0.0 (code 1) | Android | Internal / Staged rollout |
| Customer App (iOS) | `com.neyokart.user` | 1.0.0 (build 1) | iOS | Not launching yet |
| Delivery App (iOS) | `com.neyokart.delivery` | 1.0.0 (build 1) | iOS | Not launching yet |

> **Note**: Only the Customer Android app (`com.neyokart.app`) is being published to the Play Store in this release. Delivery app and iOS builds are prepared for future staged rollouts.

---

## 🔐 Security Baseline

- Helmet.js + CORS (restricted to production domains via `CORS_ORIGINS`)
- Global input validation (whitelist + transform + forbid non-whitelisted)
- Constant-time HMAC verification for Razorpay signatures
- bcrypt (10 rounds) for all PINs (Store Manager, Delivery, Parcel Manager, Super Admin)
- JWT with DB-backed revocation checks (STORE_MANAGER, DELIVERY_PERSON, PARCEL_MANAGER)
- Idempotency keys on all order creation (prevents double-charge)
- Atomic stock decrement with `stock >= qty` guard (race-condition free)
- Role-based guards: `RolesGuard` + `StoreGuard` (ownership validation)
- Delivery PIN mandatory for `DELIVERED` status
- Raw body parsing for webhook signature verification
- File upload: MIME whitelist + 5MB limit + path sanitization

---

## 🧪 Testing & Quality

- **Unit/Integration**: Jest 30 + ts-jest + supertest
- **E2E**: Custom test suite (`test/run-e2e.sh`) covering full order → delivery flow
- **Lint/Format**: ESLint 9 + Prettier + TypeScript strict mode
- **Type Safety**: TypeScript 5.9 strict + Prisma generated types

---

## 📋 Known Limitations (v1.0.0)

| Area | Limitation | Planned Fix |
|------|------------|-------------|
| **Push Notifications** | Firebase config requires `google-services.json` on device | Add to build pipeline for production |
| **SMS OTP** | DEV mode accepts `123456` if `MSG91_AUTH_KEY` unset | Ensure production env has live MSG91 key |
| **Super Admin** | Phone/PIN from env vars — no UI to rotate | Add admin rotation endpoint |
| **Search** | Full-text via Prisma (basic) — no semantic/vector | Upgrade to Meilisearch/Typesense |
| **Analytics** | Firebase only — no custom events yet | Add Amplitude/Mixpanel integration |
| **iOS** | Not submitted to App Store | Prepare for TestFlight → App Store |

---

## 🚀 Rollout Plan

1. **Internal Testing** (Week 1) — QA team + internal staff on Play Console Internal track
2. **Closed Beta** (Week 2) — 50-100 invited users, collect feedback
3. **Open Beta** (Week 3) — Public opt-in, monitor crashlytics + metrics
4. **Production** (Week 4) — Gradual rollout 10% → 50% → 100%

**Rollback**: Blue/Green allows instant traffic swap back to previous version via `deploy.sh`.

---

## 📞 Support & Monitoring

- **Crashlytics**: Real-time crash reports in Firebase Console
- **Performance**: App start time, network latency, screen render traces
- **Analytics**: User flows, retention, funnel drops (checkout → payment → delivery)
- **Server Health**: `/health` endpoint + Docker healthchecks + Nginx access logs

---

## 🙏 Acknowledgments

Built by the NEYOKART team. Special thanks to the open-source ecosystem:
NestJS, React, Prisma, Redis, Capacitor, TailwindCSS, Konsta UI, Firebase, Razorpay, MSG91, Sharp, Vite, PostgreSQL, Nginx, Docker.

---

**Next Release (v1.1.0)**: Push notifications, order scheduling, loyalty points, ratings/reviews, store onboarding flow.