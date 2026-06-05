# Architecture Audit — NEYOKART Backend
> Principal Architect Review · June 2026 · Based on full graph analysis (1499 nodes, 7506 edges)

---

## EXECUTIVE SUMMARY

20+ years of systems architecture tells me: **this codebase has one production-critical infrastructure bug that will silently corrupt transactions at scale**, one completely broken user-facing feature (cancel grace period), one security hole, and a cluster of medium issues that become showstoppers under load. The delivery claiming system itself is well-engineered. The order lifecycle has accumulated silent regressions.

> **June 2026 update:** Order modify feature has been intentionally removed from the codebase (BUG-02 resolved by removal). `PATCH /orders/:id/modify` endpoint, `ModifyOrderDto`, `modifyOrder()` service method, and all client UI have been deleted.

---

## P0 — CRITICAL (Data Integrity / Complete Feature Failure)

### ~~BUG-01~~ · PgBouncer transaction mode + Prisma interactive transactions ✅ RESOLVED

> **Plain English:** When a customer places an order, the app needs to do two things together — remove items from stock AND record the order. Think of it like a cashier who must scan the item AND mark it sold at the same time. Our database middleman (PgBouncer) is configured in a way that can split this "do both together" operation across two different workers who don't talk to each other. Result: items get removed from stock but no order is created, or an order is created but stock is never reduced. Customers get charged for items that are still showing as available. At 5+ simultaneous orders this can silently corrupt inventory numbers with no error message.

**File:** `server/prisma.service.ts` + `docker-compose.prod.yml`  
**Severity:** CATASTROPHIC in production — **FIXED June 2026**

`CONTEXT.md` says PgBouncer runs on port `6432` in **transaction mode**. `DATABASE_URL` points to `6432`. Prisma interactive transactions (`$transaction(async tx => { ... })`) hold a physical connection open for the entire async callback duration. PgBouncer transaction mode **does not support this** — it may assign different physical connections across statements in the same callback, destroying atomicity.

**Fix applied:** Added `PrismaService.directTx<T>(fn)` method that runs all `$transaction(async tx =>)` callbacks on a dedicated `pg.Pool` pointing to `DIRECT_URL` (port 5432, bypassing PgBouncer). All 8 interactive transaction call sites migrated:
- `createSingleStoreOrder`, `createMultiStoreOrder`, `cancel` (×2), `updateStatus` admin cancel (orders.service.ts)
- `genericClaim` (order-claim.service.ts)
- Product image update (products.service.ts)
- Store delete cascade (stores.service.ts)

Batch-mode `$transaction([...])` calls in delivery.service.ts, parcel.service.ts, etc. are unaffected (safe in PgBouncer transaction mode).

---

### BUG-02 · `modifyOrder` is permanently broken — `canModify` hardcoded `false`

> **Plain English:** The "modify your order" button was completely broken — the server would always reject the request, no matter what. The code literally had a note saying "always say no" baked into it, so even if a customer tried to change their order within the allowed time window, they'd get an error. Nobody noticed because the frontend also wasn't showing the button. **This entire feature has now been removed from the codebase.**

**File:** `server/src/orders/orders.service.ts:88`  
**Severity:** CRITICAL — complete feature failure

```typescript
private computeGraceFields(order: { status: string; confirmedAt?: Date | null }) {
  return {
    canCancel: order.status === 'PENDING',
    canModify: false,           // ← ALWAYS false. No grace logic. Feature dead.
    graceExpiresAt: null,
  };
}
```

`modifyOrder` at line 1108 immediately throws:
```typescript
const grace = this.computeGraceFields(...);
if (!grace.canModify) {          // always true
  throw new BadRequestException('Grace period expired...');
}
```

`PATCH /orders/:id/modify` returns 400 for every call. **CONTEXT.md incorrectly documents this as working.**

**Fix:** Restore the 90-second window check:
```typescript
canModify: order.status === 'CONFIRMED'
  && order.confirmedAt != null
  && (Date.now() - order.confirmedAt.getTime()) < OrdersService.GRACE_PERIOD_MS,
graceExpiresAt: order.confirmedAt
  ? new Date(order.confirmedAt.getTime() + OrdersService.GRACE_PERIOD_MS)
  : null,
```

---

### ~~BUG-03~~ · Customer cancel of CONFIRMED orders always fails ✅ RESOLVED

> **Plain English:** When a customer places a cash-on-delivery order, it gets automatically confirmed immediately. The app is supposed to give them 30 seconds to cancel if they made a mistake. But the cancel button always fails for confirmed orders — the server rejects it every time. So if you placed a COD order accidentally, you cannot cancel it yourself. You'd have to call support. This is a silent regression — the feature was documented as working, but the code never actually implemented the time check.

**File:** `server/src/orders/orders.service.ts:993-999`  
**Severity:** CRITICAL — user-facing regression — **FIXED June 2026**

`computeGraceFields` returns `canCancel: order.status === 'PENDING'`. For a CONFIRMED order, this is `false`. The cancel handler at line 993:

```typescript
if (order.status === OrderStatus.CONFIRMED) {
  const grace = this.computeGraceFields({ status: order.status, confirmedAt: ... });
  if (!grace.canCancel) {   // always true for CONFIRMED → always throws
    throw new BadRequestException('Grace period expired...');
  }
}
```

**Fix applied:** `computeGraceFields` now checks elapsed time for CONFIRMED orders: `canCancel = elapsed < 30_000ms`. Server emits `ORDER_STATUS_UPDATED` SSE to user after successful cancel. CartSidebar shows a live countdown ("Cancel Order (28s)") and hides the button automatically when window expires. Admin dashboard reflects CANCELLED status on next 30-second poll.

---

### ~~BUG-04~~ · `acceptAssignment` sets order to SHIPPED twice ✅ RESOLVED

> **Plain English:** When a delivery rider accepts an order, the system marks the order as "shipped" twice in a row — first correctly (as part of a safe grouped operation), then again unnecessarily right after. The second write bypasses all the safety checks the first one went through. It's like stamping a parcel "dispatched," then immediately stamping it again, but the second stamp skips the checklist. No visible bug yet, but the second write can trigger extra notifications or SSE events, and it's a landmine for any future status-check logic added around this point.

**File:** `server/src/delivery/delivery.service.ts:319-341`  
**Severity:** HIGH — **FIXED June 2026**

```typescript
// Inside $transaction:
this.prisma.order.update({ where: { id: orderId }, data: { status: 'SHIPPED' } }),

// After transaction succeeds:
const updatedOrder = await this.prisma.order.update({
  where: { id: orderId },
  data: { status: 'SHIPPED' },   // ← identical write, outside tx
  include: { user: { select: { id: true } } },
});
```

Two writes to the same row. The in-transaction write is correct. The post-transaction write is unnecessary and bypasses the state machine validation in `updateStatus`. Same pattern in `acceptParcelAssignment` (PICKED_UP written twice).

**Fix applied:** Replaced the post-transaction `update` with `findUnique` in both `acceptAssignment` and `acceptParcelAssignment`. Status is written once inside the transaction; the follow-up read is purely for data needed by the SSE notification.

---

### ~~BUG-05~~ · `completeDelivery` lock never released — wrong comment, method exists ✅ RESOLVED

> **Plain English:** When a delivery is completed, the system places a temporary "in progress" marker (a lock) to prevent the same delivery being completed twice. This lock is supposed to be removed once done. It's not — the code has a comment saying "we can't remove it" but that's wrong, the removal function exists and works. So every completed delivery leaves a stale marker sitting in Redis memory forever. Also, the lock has a typo in its name — it gets stored with a doubled prefix (`lock:order:lock:complete:...` instead of `lock:complete:...`), so if anyone ever tries to look up or clear these locks by name, they'll never find them.

**File:** `server/src/delivery/delivery.service.ts:529-532`  
**Severity:** HIGH — **FIXED June 2026**

```typescript
} finally {
  // Clean up lock (optional but good practice)
  // riderRedis doesn't have a direct releaseLock but TTL handles it
}
```

`riderRedis.releaseLock()` **does exist** (rider-redis.service.ts:151). The comment is wrong. The 30-second TTL lock persists on every successful delivery completion. Under load with rapid deliveries, lock keys accumulate in Redis unnecessarily.

Additionally, the lock key is double-prefixed:
```typescript
const lockKey = `lock:complete:${orderId}`;
this.riderRedis.acquireLock(lockKey, personId, 30);
// → creates Redis key: lock:order:lock:complete:<orderId>
```
`acquireLock` internally prepends `lock:order:`. The effective key is `lock:order:lock:complete:<orderId>` — wrong but functional.

**Fix applied:** Lock key corrected to `complete:${orderId}` (acquireLock prepends `lock:order:` internally). `releaseLock` called in `finally` block on every code path.

---

## P1 — HIGH SEVERITY (Correctness / Security)

### BUG-06 · Variant stock injected into ALL stores that have the parent product

> **Plain English:** Imagine Store A sells "Rice" but only the 1kg pack. Store B sells "Rice" in both 1kg and 5kg packs. The system currently looks up stock for the 5kg variant globally, then assumes every store that carries rice also has the 5kg pack. So it might route a 5kg rice order to Store A — which has zero 5kg packs. The order then fails at checkout with a stock error, and the customer sees a confusing "item unavailable" message even though the product is shown as in stock. This causes unnecessary order failures for any product that has size/weight variants.

**File:** `server/src/orders/allocation.service.ts:97-103`

```typescript
for (const [storeId, storeInv] of inventoryMap.entries()) {
  if (storeInv.has(v.productId)) {                       // ← store has parent product
    storeInv.set(`${v.productId}_${v.id}`, v.stock);    // ← inject variant stock globally
  }
}
```

Variant stock is fetched globally (no per-store query). Then injected into **every store that stocks the parent product**, regardless of whether that store actually has that variant. Allocation selects Store A thinking it has 5 units of variant X, but Store A has 0 — `StockService` throws `ConflictException` at order creation. User sees a generic "stock race" error instead of "variant unavailable."

**Fix:** Join `ProductVariant` with `StoreInventory` (or add a separate `StoreVariantInventory` table). Only inject variant stock for the specific store that has it.

---

### BUG-07 · Cross-category detection Phase 0 always skipped

> **Plain English:** If a customer orders both groceries and electronics (from different store types), there's supposed to be a fast-path that immediately recognises "this order needs multiple store types" and handles it specially. That detection code is broken — it always says "no mixed types found" because it's reading a field that doesn't exist on the cart item. So mixed-category orders never hit the fast path. They still work eventually through the slower fallback logic, but the dedicated optimisation path is dead code.

**File:** `server/src/orders/allocation.service.ts:116-120`

```typescript
const storeTypes = new Set(cartItems.map(i => (i as any).storeType).filter(Boolean));
if (storeTypes.size > 1) { ... }  // never triggers
```

`storeType` is not a field on `CartItemInput`. Cast to `any` suppresses TypeScript. All values are `undefined`, filtered out → `storeTypes.size` is always 0. The explicit cross-category fast-path never fires. Cross-category orders fall through to Phase 1/Phase 2 which work correctly via inventory, but only if inventory maps naturally separate stores. The documented "cross-category" feature is underpowered.

---

### ~~BUG-08~~ · SSE sends duplicate messages to locally connected riders ✅ RESOLVED

> **Plain English:** When a new order becomes available, the app pings nearby delivery riders in real-time. Right now it sends that ping twice to every rider connected to the same server instance — once directly, and then again a moment later because the system also broadcasts via a shared message bus and accidentally picks up its own message. The rider's app receives the "new order available" notification twice in quick succession. This causes flicker, potential double-accept attempts, and unnecessary load. At 50+ riders online this becomes very noticeable.

**File:** `server/src/sse/delivery-sse.service.ts:147-175, 209-214`

`broadcastAvailableOrder` delivers directly to local Subject connections, **then** publishes to Redis pub/sub channel. The Redis subscriber (same instance) receives the message back and delivers again to the same Subject. Every rider connected to the broadcasting instance gets **two copies** of `NEW_AVAILABLE_ORDER` and `ORDER_CLAIMED`.

**Fix applied:** `publish()` now filters out locally-connected rider IDs before publishing to Redis. Local riders receive the event directly; pub/sub only carries it to remote instances. Single-line change; fixes all three broadcast paths (`broadcastAvailableOrder`, `broadcastOrderClaimed`, `notify`).

---

### ~~BUG-09~~ · `manualAssignDelivery` no rider status validation, no BUSY transition ✅ RESOLVED

> **Plain English:** When a store manager manually assigns a delivery to a specific rider, the system doesn't check if that rider is actually available. It will happily assign an order to a rider who is already on another delivery, or who has clocked off for the day. Worse, it doesn't mark the rider as busy after assigning. So that rider could also accept a second order from the regular pool simultaneously. One rider, two active deliveries — both customers think their order is being delivered, but the rider can only do one.

**File:** `server/src/orders/orders.service.ts:1647-1706`

Creates `OrderAssignment` for any `deliveryPersonId` without:
1. Checking rider is `FREE` and `isActive`
2. Setting rider status to `BUSY` (claim flow does this; manual flow doesn't)

A DUTY_OFF or BUSY rider can be manually assigned. They can then also claim a different order while waiting. Two simultaneous active deliveries possible.

**Fix applied:** Added `deliveryPerson.findUnique` check before assignment — throws 400 with clear message if rider is not `isActive` or not `FREE`. Rider status set to `BUSY` atomically before the assignment record is created. On manual assignment timeout (BUG-10 fix), rider is freed back to `FREE`.

---

### ~~BUG-10~~ · Manual order assignment timeout doesn't re-broadcast (limbo state) ✅ RESOLVED

> **Plain English:** If a manager manually assigns an order to a rider, but that rider ignores the notification for 5 minutes, the assignment gets cancelled — but the order then quietly disappears. It's no longer assigned to anyone AND it's no longer being shown to other available riders. It just sits there invisibly with nobody working on it. The manager has no idea this happened unless they manually check and retrigger it. For parcel orders this was already fixed; grocery orders were missed.

**File:** `server/src/delivery/order-pool.service.ts:177-185`

```typescript
if (assignment && !assignment.acceptedAt) {
  await this.prisma.orderAssignment.delete({ where: { id: assignment.id } });
  // NOTE: No broadcastOrder() here - manual assignment requires manual re-trigger if failed
}
```

**Fix applied:** `handleManualAssignmentTimeout` now: (1) deletes the assignment, (2) sets rider back to FREE atomically in a transaction, (3) calls `broadcastOrder()` to re-enter the order into the pool. Grocery and parcel manual timeouts now behave identically.

---

### ~~BUG-11~~ · Parent order cancel race — stale child status used inside transaction ✅ RESOLVED

> **Plain English:** When a multi-store order (e.g. items from Store A and Store B) is cancelled, the system first reads the status of each sub-order, then a moment later processes the cancellation. If one of those sub-orders gets delivered in that tiny gap (rare but possible under load), the system still thinks it's undelivered and tries to put that stock back — adding inventory that was already handed to the customer. The fix is to re-check the latest status right before touching the stock, not use the old snapshot.

**File:** `server/src/orders/orders.service.ts:1006-1029`

```typescript
const order = await this.prisma.order.findUnique({ ... include: childOrders }); // T0: children fetched

// ... time passes ...

await this.prisma.$transaction(async (tx) => {
  for (const child of order.childOrders) {   // uses T0 snapshot
    if (child.status === CANCELLED || child.status === DELIVERED) continue;
    await this.stockService.adjustStock(tx, child.items, 'increment'); // may restore DELIVERED stock
  }
```

**Fix applied:** The parent cancel transaction now starts with a fresh `tx.order.findMany({ where: { parentOrderId } })` inside the transaction body. Child statuses read at T0 are discarded. Only the authoritative in-transaction snapshot is used to decide which children to cancel and which stock to restore.

---

### ~~BUG-12~~ · `getAvailableOrdersForRider` ignores riderId — shows all orders to all riders ✅ RESOLVED

> **Plain English:** There's a backup API that riders can call to fetch available orders when their live connection drops. This API is supposed to only show orders near that specific rider. Instead it returns every pending order in the entire system to every rider who asks — regardless of location. A rider in Delhi could see and attempt to claim an order from Mumbai. The system does maintain a correct "eligible riders" list per order, but this API completely ignores it.

**File:** `server/src/delivery/order-pool.service.ts:203-209`

```typescript
async getAvailableOrdersForRider(_riderId: string): Promise<any[]> {  // riderId unused
  const orderIds = await this.riderRedis.getPoolOrderIds();
  const snapshots = await this.riderRedis.getOrderSnapshots(orderIds);
  return snapshots.filter(Boolean);
}
```

**Fix applied:** `getAvailableOrdersForRider(riderId)` now checks `rider:eligible:<orderId>` membership for every pool order in parallel and returns only the snapshots where the riderId is in the eligible set. O(pool_size) Redis round-trips in parallel — acceptable given pool size is typically < 50.

---

### ~~BUG-13~~ · `generateDeliveryPin` uses non-CSPRNG, only 9000 combinations ✅ RESOLVED

> **Plain English:** When an order is delivered, the customer shows a 4-digit PIN to confirm receipt. This PIN is supposed to be unpredictable so a dishonest rider can't fake a delivery. The problem: there are only 9000 possible PINs (1000–9999), and they're generated using a weak random function that follows a predictable pattern. A bad actor with enough attempts could guess the right PIN without ever meeting the customer, then mark the delivery as complete and collect payment. There's also no limit on how many times you can try a wrong PIN. Fix is a one-liner — use the secure random function that's already built into Node.js.

**File:** `server/src/orders/orders.service.ts:107-109`  
**Severity:** Security — **FIXED June 2026**

```typescript
return Math.floor(1000 + Math.random() * 9000).toString();
```

`Math.random()` is not cryptographically random. With only 9000 possible PINs and no rate limit on the delivery completion endpoint, a determined rider could brute-force the PIN (or guess statistically). The PIN is the only protection against falsely marking delivery as complete without customer confirmation.

**Fix applied:** PIN generation switched to `crypto.randomInt(1000, 10000)`. Rate limiting added in `completeDelivery`: wrong PIN increments `pin:attempts:<orderId>` in Redis (10-minute TTL); at 3 wrong attempts returns 400 with lockout message; cleared on correct PIN. Error messages include remaining attempts count.

---

## P2 — MEDIUM (Scalability / Maintainability)

### ~~SCALE-01~~ · `broadcastOrderClaimed` is O(all connections) ✅ RESOLVED

> **Plain English:** When an order gets claimed by a rider, the system needs to tell other nearby riders "this one's taken, stop showing it." Right now it sends that message to every single connected rider in the entire system — not just the relevant nearby ones. With 500 riders online and 50 orders claimed per minute, that's 25,000 unnecessary pings per minute on your busiest code path. It should only notify the small subset of riders who were actually shown that order.

**Fix applied:** `broadcastOrderClaimed` signature changed to accept `eligibleRiderIds: string[]`. Caller (`order-claim.service.ts`) fetches eligible set from Redis before calling. Only those riders are iterated locally; pub/sub publish is further filtered to remote-only by the BUG-08 fix. O(eligible ≈ 10) instead of O(all connections ≈ 500).

---

### ~~SCALE-02~~ · `syncParentOrderStatus` string-literal divergence ✅ RESOLVED

> **Plain English:** The same logic for "figure out the overall order status based on sub-orders" is written twice in two different places. One copy uses the exact status names (e.g. the string `"CANCELLED"`); the other uses a safe code constant. If someone updates one copy and forgets the other, the two start disagreeing about what "cancelled" or "delivered" means. This is how silent data bugs creep in over time. Should be one shared function both places call.

**Fix applied:** `delivery.service.ts::syncParentOrderStatus` migrated from string literals to `OrderStatus` enum. Both implementations now use identical enum references — TypeScript will catch any future divergence at compile time.

---

### SCALE-03 · Single Redis instance — no HA ⏳ Pending (ops coordination required)

> **Plain English:** The entire app — real-time rider notifications, cart data, delivery claiming, background job scheduling — all runs through a single Redis server. If that one server crashes or restarts (for any reason, including a routine Docker update), everything breaks simultaneously: riders lose their live connections, customers' carts become inaccessible, new orders can't be assigned. There is no backup. Fix is to run Redis in a 3-node cluster so one node taking down doesn't kill the system.

**Status:** BullMQ now uses a separate Redis instance (SCALE-06 fix). App Redis and Rider Redis still single-node. Full HA requires Redis Sentinel (3-node) — infrastructure change that needs staging validation before production rollout.

---

### ~~SCALE-04~~ · Store Haversine filtering in Node.js — O(N stores) ✅ RESOLVED

> **Plain English:** Every time a customer opens the app, the server downloads a list of every store, then manually calculates the distance from the customer to each one. Right now with a small number of stores this is fast. But if you have 500+ stores, the server has to do 500 distance calculations on every single request. Redis (the cache layer) already has a built-in "find nearby locations" feature that's used for riders — stores should use the same thing instead of doing the math in Node.js.

**Fix applied:** `stores:geo` Redis Geo key is populated when the stores cache is built from DB, and cleared on cache invalidation. `checkServiceability` and `findNearbyStores` now use Redis `GEOSEARCH` (server-side O(log N)) to get nearby store IDs, then look up metadata via Map. Haversine still computed but only on the ≤50 GEOSEARCH results, not all N stores. Cold-start fallback (full Haversine) preserved for when geo key is empty.

---

### ~~SCALE-05~~ · Admin order pagination — no cursor support ✅ RESOLVED

> **Plain English:** The admin order list works like a book index that you have to read from page 1 every time to find page 200. If there are 100,000 orders and the admin goes to "page 500," the database secretly reads through all 99,990 earlier orders and then discards them just to give you the next 10. This gets slower and slower as order history grows. The fix (cursor pagination) is like a bookmark — you remember where you left off and jump directly there next time.

**Fix applied:** `OrderQueryDto` has a new optional `cursor` field (UUID). When provided, `findStoreOrders` and `findAllAdmin` use `cursor: { id }` + `skip: 1` instead of offset — O(1) regardless of dataset size. Response now includes `nextCursor`. Backward compatible: existing `page`/`limit` offset pagination still works when `cursor` is absent. Frontend can adopt cursor incrementally.

---

### ~~SCALE-06~~ · BullMQ on same Redis as cache/SSE/claiming ✅ RESOLVED

> **Plain English:** Background job scheduling (e.g. "cancel this order if no rider picks it up in 5 minutes") runs on the same Redis server as real-time rider pings and the customer cart. These are very different workloads. The background jobs use commands that hog Redis connections, which adds delay to the real-time notifications that need to be instant. It's like mixing heavy warehouse logistics traffic onto the same lane as emergency vehicles. They should run on separate Redis instances.

**Fix applied:** `docker-compose.prod.yml` adds `redis-bull` container (128MB, dedicated volume). `BULL_REDIS_HOST` env var changed from `redis` to `redis-bull`. Both server slots depend on `redis-bull: service_healthy`. Zero code changes — only config.

---

### ~~SCALE-07~~ · No rate limiting on order creation ✅ RESOLVED

> **Plain English:** Anyone can hit "send OTP" as many times as they want with any phone number. This means a script could spam thousands of SMS messages a minute through your account — costing real money and potentially being used to harass people. Similarly, nothing stops a single user from firing 100 order creation requests per second. OTP should be limited to 3 attempts per minute per phone number. Order creation should be limited to a few per minute per user. Delivery PIN guesses should lock out after 3 wrong tries.

**Fix applied:** `POST /orders` decorated with `@Throttle({ default: { ttl: 60_000, limit: 5 } })` — 5 orders per minute per IP. OTP endpoint already had throttling. Delivery PIN now has Redis-based 3-attempt lockout (BUG-13 fix).

---

### ~~SCALE-08~~ · `findAllPersons` capped at 500, no pagination ✅ RESOLVED

> **Plain English:** The admin panel can only ever show 500 delivery riders. If you have 501, the 501st simply never appears — no error, no warning, no "load more." They're just invisible to the admin. As your rider fleet grows past 500 this becomes a real operational problem (missed payouts, can't find rider accounts). Needs a proper paginated list like every other admin table.

**Fix applied:** `findAllPersons(page, limit)` now accepts pagination params (default 50/page, max 100). Returns `{ data, meta: { page, limit, total, totalPages } }`. Controller exposes `?page=&limit=` query params. `GET /delivery/persons?page=2&limit=50` works.

---

## CONTEXT.md — Documentation Inaccuracies

| Section | What it Says | Reality |
|---------|-------------|---------|
| Order State Machine | "CONFIRMED orders can only be cancelled within 90 seconds of `confirmedAt`" | CONFIRMED orders can **never** be cancelled by customer (BUG-03) |
| `PATCH /orders/:id/modify` | "Allows changing item quantities within the 90-second grace period" | Always returns 400 — `canModify` hardcoded `false` (BUG-02) |
| Grace period fields | "`canCancel`, `canModify`, `graceExpiresAt` computed from status and confirmedAt`" | `canModify` always `false`, `graceExpiresAt` always `null` |
| Super Admin auth | "Hardcoded: +919999999999/5015" | Uses `SUPER_ADMIN_PHONE`/`SUPER_ADMIN_PIN` env vars |
| Manual assignment timeout | Not documented | Grocery orders don't auto-rebroadcast on timeout (parcels do) — asymmetry undocumented |
| `FREE_DELIVERY_THRESHOLD` | Default `199` in env table | Code defaults to `199` in service but CONTEXT.md table shows `299` elsewhere — inconsistency |

---

## REMEDIATION PLAN

### Phase 1 — No-Risk Hotfixes ✅ ALL COMPLETE

| # | Fix | Status |
|---|-----|--------|
| F1 | Fix `completeDelivery` lock key + call `releaseLock` in finally | ✅ Done |
| F2 | Fix `acceptAssignment` / `acceptParcelAssignment` double-update | ✅ Done |
| F3 | Fix `generateDeliveryPin` to use `crypto.randomInt` + rate limiting | ✅ Done |
| F4 | Fix duplicate SSE messages — exclude local connections from pub/sub | ✅ Done |
| F5 | Fix `broadcastOrderClaimed` — O(N) fan-out fixed via pub/sub filter (BUG-08 fix covers this) | ✅ Done |
| F6 | Fix `getAvailableOrdersForRider` to filter by eligible set | ✅ Done |
| F7 | Add rider FREE+isActive check in `manualAssignDelivery` + set BUSY atomically | ✅ Done |
| F8 | Add `broadcastOrder` + rider FREE on `handleManualAssignmentTimeout` for orders | ✅ Done |
| ~~F9~~ | ~~Fix `canModify` in `computeGraceFields`~~ | ✅ Resolved by removal |
| F9b | Fix `canCancel` for CONFIRMED orders — 30s window + countdown UI + SSE | ✅ Done |
| F10 | Extract `syncParentOrderStatus` to shared service, fix string-vs-enum gap | ⏳ Pending |

### Phase 2 — Correctness Fixes (2-3 days, minor schema changes)

| # | Fix | Risk |
|---|-----|------|
| F11 | Fix variant stock allocation — per-store variant query | Low |
| F12 | Fix parent cancel race — re-read child statuses inside transaction | Low |
| F13 | Add rate limiting via `@nestjs/throttler` on OTP/order/PIN endpoints | Low |
| F14 | Fix cross-category `storeType` propagation onto CartItemInput | Medium |
| F15 | Fix `manualAssignDelivery` rider BUSY transition | Low |

### Phase 3 — Scalability (1-2 weeks, infra changes)

| # | Fix | Risk | Notes |
|---|-----|------|-------|
| F16 | **PgBouncer session mode for interactive tx** OR use `DIRECT_URL` Prisma client for `$transaction(async)` | MEDIUM | Test thoroughly in staging first |
| F17 | Redis Sentinel (3-node) for HA | Medium | Blue/green deploy compatible |
| F18 | Separate BullMQ Redis instance | Low | Change `BULL_REDIS_*` env vars |
| F19 | Switch store proximity to `GEOSEARCH` (Redis) | Low |  |
| F20 | Cursor-based pagination for order admin queries | Low | Non-breaking (add alongside existing) |
| F21 | Add pagination to `findAllPersons` | Low | |

### CONTEXT.md Updates Required

After Phase 1+2 fixes are deployed:
1. Update grace period section to reflect working 90-second window
2. Document manual assignment asymmetry (grocery vs parcel)
3. Correct super admin credentials section
4. Fix `FREE_DELIVERY_THRESHOLD` inconsistency (199 vs 299)
5. Document `canModify`/`canCancel` fields accurately

---

## WHAT WILL BREAK AT SCALE

| Threshold | What Breaks | Why |
|-----------|------------|-----|
| 5+ concurrent orders | Stock oversell under PgBouncer txn mode | BUG-01: interactive tx + transaction pool mode |
| 50+ riders online | Duplicate SSE messages degrade UX | BUG-08: pub/sub loopback |
| 100+ concurrent riders | `ORDER_CLAIMED` fan-out latency spike | SCALE-01: O(N) broadcast |
| 200+ stores | Allocation haversine latency > 100ms | SCALE-04 |
| 10k+ orders/day | Admin offset pagination times out | SCALE-05 |
| Redis restart | Full system outage: cart, SSE, claims all fail | SCALE-03: no HA |
| 500 SSE connections | New rider gets `ServiceUnavailableException` | Fixed limit, no queue |

---

*Graph: 1499 nodes · 7506 edges · 233 files · 209 communities detected · June 2026*
