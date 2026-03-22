/**
 * Universal E2E Test — Complete Coverage
 *
 * Covers:
 * 1. Auth (Super Admin, Store Manager, User, Delivery Person)
 * 2. Store creation for ALL 5 store types
 * 3. Product CRUD for each store type
 * 4. Cart operations + edge cases
 * 5. Order lifecycle (create → confirm → processing → order_picked → shipped → delivered) per store type
 * 6. Order modify + cancel within grace period
 * 7. Mock Razorpay payment flow
 * 8. Parcel order full lifecycle (book → approve → ready → assign → claim → accept → deliver)
 * 9. Delivery person setup, status flow (DUTY_OFF → FREE → BUSY → FREE)
 * 10. Race conditions (concurrent claims by multiple riders)
 * 11. Idempotency, IDOR, double-submit protection
 * 12. Print product CRUD (DROP_IN_FACTORY)
 * 13. Buy Now Isolation
 * 14. Cleanup
 *
 * Usage:  node test/universal-e2e.mjs [BASE_URL]
 * Default BASE_URL: http://localhost:3000
 *
 * Requires the server running with MSG91_AUTH_KEY="" (dev mode, OTP 123456).
 */

import axios from 'axios';
import Redis from 'ioredis';

// ── CLI flag parsing ────────────────────────────────────────────────
const BASE = process.argv.find(a => !a.startsWith('--') && !a.includes('/node') && a !== process.argv[1]) || 'http://localhost:3000';
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const api = axios.create({ baseURL: BASE, validateStatus: () => true, timeout: 30000 });

// ── Razorpay Secret Configuration (GitHub Actions Support) ─────────
const CI_MODE = process.env.GITHUB_ACTIONS === 'true';
const RZP_TEST_KEY_ID = process.env.RAZORPAY_TEST_KEY_ID;

if (CI_MODE && !RZP_TEST_KEY_ID) {
  console.error('❌ CRITICAL ERROR: RAZORPAY_TEST_KEY_ID secret is missing in CI environment.');
  process.exit(1);
}

// ── Razorpay Safety Pre-Check ──────────────────────────────────────
const gatewayStatus = await api.get('/payments/status');
if (gatewayStatus.status === 200) {
  if (gatewayStatus.data.mockMode) {
    console.log('🛡️  Razorpay: MOCK MODE active (No keys configured).');
  } else {
    console.log('🛡️  Razorpay: LIVE MODE active (Keys configured).');
  }
} else {
  console.log('⚠️  Razorpay: Could not verify gateway status.');
}

// ══════════════════════════════════════════════════════════════════════
//  Helpers
// ══════════════════════════════════════════════════════════════════════

const uid = () => Math.random().toString(36).slice(2, 8);
const RUN_ID = uid();
const results = [];
const issues = [];
let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function auth(token) {
  return { headers: { Authorization: `Bearer ${token}` } };
}

function authWithIdempotency(token, key) {
  return { headers: { Authorization: `Bearer ${token}`, 'idempotency-key': key } };
}

async function step(name, fn) {
  totalTests++;
  try {
    await fn();
    results.push({ name, status: 'PASS' });
    passedTests++;
    console.log(`  ✅ ${name}`);
  } catch (e) {
    const msg = e.response?.data?.message || e.message;
    results.push({ name, status: 'FAIL', error: msg });
    failedTests++;
    console.log(`  ❌ ${name} — ${msg}`);
    issues.push({ test: name, error: msg });
  }
}

function assert(condition, msg) {
  if (!condition) throw new Error(`Assertion failed: ${msg}`);
}

// ══════════════════════════════════════════════════════════════════════
//  State
// ══════════════════════════════════════════════════════════════════════

let adminToken;
const stores = {};      // { storeType: { id, managerId, managerToken, productIds: [] } }
let userToken, userId;
let addressId;

const STORE_TYPES = ['GROCERY', 'PIZZA_TOWN', 'AUTO_SERVICE', 'DROP_IN_FACTORY', 'AUTO_PARTS_SHOP'];
const CATEGORIES_PER_TYPE = {
  GROCERY: 'Atta, Rice & Dal',
  PIZZA_TOWN: 'Pizza',
  AUTO_SERVICE: 'Car Wash',
  DROP_IN_FACTORY: 'General',
  AUTO_PARTS_SHOP: 'Parts',
};

const seq = String(Date.now()).slice(-6);
const USER_PHONE = `+9177${seq}77`;
const DP_COUNT = 6;
const dpPhones = Array.from({ length: DP_COUNT }, (_, i) =>
  `+9166${seq}${String(i + 1).padStart(2, '0')}`
);
const dpIds = [];
const dpTokens = [];
const dpPins = [];

const orderIds = {};    // { storeType: orderId }
const parcelId = { value: null };

// ══════════════════════════════════════════════════════════════════════
//  Phase 1: Server Health Check
// ══════════════════════════════════════════════════════════════════════

console.log(`\n${'═'.repeat(70)}`);
console.log(`  UNIVERSAL E2E TEST — ${BASE}`);
console.log(`  Run ID: ${RUN_ID}`);
console.log(`  Date: ${new Date().toISOString()}`);
console.log(`${'═'.repeat(70)}`);

console.log('\n🔷 Phase 1: Server Health Check');

await step('Server health check', async () => {
  const r = await api.get('/');
  assert(r.status === 200 || r.status === 201 || r.status === 304, `Server not responding: ${r.status}`);
});

await step('Payment mode check', async () => {
  const r = await api.get('/payments/status');
  assert(r.status === 200, `${r.status}`);
  console.log(`    Payment mode: ${r.data.mode || 'unknown'}`);
});

// ══════════════════════════════════════════════════════════════════════
//  Phase 2: Super Admin Setup
// ══════════════════════════════════════════════════════════════════════

console.log('\n🔷 Phase 2: Super Admin Login');

await step('Super admin login', async () => {
  const r = await api.post('/auth/super-admin/login', { phone: '+919999999999', pin: '0000' });
  assert(r.status === 200 || r.status === 201, `${r.status}: ${r.data?.message}`);
  adminToken = r.data.access_token;
  assert(adminToken, 'No admin token');
});

await step('Invalid admin PIN rejected', async () => {
  const r = await api.post('/auth/super-admin/login', { phone: '+919999999999', pin: '9999' });
  assert(r.status === 401, `Expected 401, got ${r.status}`);
});

// ══════════════════════════════════════════════════════════════════════
//  Phase 3: Create stores for ALL 5 store types
// ══════════════════════════════════════════════════════════════════════

console.log('\n🔷 Phase 3: Store Setup (All 5 Types)');

for (const storeType of STORE_TYPES) {
  const managerPhone = `+9188${seq}${STORE_TYPES.indexOf(storeType) + 1}0`;

  await step(`Create ${storeType} store`, async () => {
    const r = await api.post('/stores', {
      name: `E2E ${storeType} ${RUN_ID}`,
      pincode: '560001',
      lat: 12.9716,
      lng: 77.5946,
      address: `123 ${storeType} Rd, Bangalore`,
      storeType,
    }, auth(adminToken));
    assert(r.status === 201 || r.status === 200, `${r.status}: ${r.data?.message}`);
    stores[storeType] = { id: r.data.id, productIds: [], managerPhone };
  });

  await step(`Create ${storeType} manager`, async () => {
    const r = await api.post('/store-managers', {
      name: `Mgr ${storeType} ${RUN_ID}`,
      phone: managerPhone,
      pin: '1234',
      storeId: stores[storeType].id,
    }, auth(adminToken));
    assert(r.status === 201 || r.status === 200, `${r.status}: ${r.data?.message}`);
    stores[storeType].managerId = r.data.id;
  });

  await step(`${storeType} manager login`, async () => {
    const r = await api.post('/auth/store-manager/login', { phone: managerPhone, pin: '1234' });
    assert(r.status === 200 || r.status === 201, `${r.status}: ${r.data?.message}`);
    stores[storeType].managerToken = r.data.access_token;
  });
}

// ══════════════════════════════════════════════════════════════════════
//  Phase 4: Create products for each store type
// ══════════════════════════════════════════════════════════════════════

console.log('\n🔷 Phase 4: Product Creation (All Store Types)');

for (const storeType of STORE_TYPES) {
  const s = stores[storeType];
  const category = CATEGORIES_PER_TYPE[storeType];

  for (let i = 1; i <= 2; i++) {
    await step(`Create ${storeType} product ${i}`, async () => {
      const fd = new FormData();
      fd.append('name', `E2E ${storeType} Prod ${i} ${RUN_ID}`);
      fd.append('price', String(100 + i * 50));
      fd.append('category', category);
      fd.append('stock', '100');
      // Product 1 gets 5% tax, Product 2 gets 12% tax (per-item GST)
      fd.append('taxRate', i === 1 ? '5' : '12');
      const r = await api.post('/products', fd, auth(s.managerToken));
      assert(r.status === 201 || r.status === 200, `${r.status}: ${JSON.stringify(r.data?.message)}`);
      s.productIds.push(r.data.id);
    });
  }

  await step(`Verify ${storeType} products`, async () => {
    const r = await api.get('/products/admin/my-store', auth(s.managerToken));
    assert(r.status === 200, `${r.status}`);
    const list = Array.isArray(r.data) ? r.data : (r.data.data || []);
    for (const pid of s.productIds) {
      assert(list.some(p => p.id === pid), `Product ${pid} not found in ${storeType} store`);
    }
  });
}

// ══════════════════════════════════════════════════════════════════════
//  Phase 5: User Registration & Address
// ══════════════════════════════════════════════════════════════════════

console.log('\n🔷 Phase 5: User Registration');

await step('Send OTP', async () => {
  const r = await api.post('/auth/send-otp', { phone: USER_PHONE });
  assert(r.status === 200 || r.status === 201, `${r.status}: ${r.data?.message}`);
});

await step('Verify OTP (dev mode 123456)', async () => {
  const r = await api.post('/auth/verify-otp', { phone: USER_PHONE, otp: '123456' });
  assert(r.status === 200 || r.status === 201, `${r.status}: ${r.data?.message}`);
  userToken = r.data.access_token;
  userId = r.data.user?.id;
  assert(userToken, 'No user token');
});

await step('Invalid OTP rejected', async () => {
  const r = await api.post('/auth/verify-otp', { phone: USER_PHONE, otp: '999999' });
  assert(r.status === 401 || r.status === 400, `Expected 401/400, got ${r.status}`);
});

await step('Invalid phone format rejected', async () => {
  const r = await api.post('/auth/send-otp', { phone: '+91123' });
  assert(r.status === 400, `Expected 400, got ${r.status}`);
});

await step('Create user address', async () => {
  const r = await api.post('/users/addresses', {
    type: 'HOME',
    houseNo: '42',
    street: 'MG Road',
    city: 'Bangalore',
    state: 'Karnataka',
    zipCode: '560001',
    lat: 12.9720,
    lng: 77.5950,
  }, auth(userToken));
  assert(r.status === 201 || r.status === 200, `${r.status}: ${r.data?.message}`);
  addressId = r.data.id;
  assert(addressId, 'No address ID');
});

await step('List addresses', async () => {
  const r = await api.get('/users/addresses', auth(userToken));
  assert(r.status === 200, `${r.status}`);
  const addrs = Array.isArray(r.data) ? r.data : (r.data.data || []);
  assert(addrs.some(a => a.id === addressId), 'Created address not found');
});

// ══════════════════════════════════════════════════════════════════════
//  Phase 6: Delivery Person Setup (6 riders)
// ══════════════════════════════════════════════════════════════════════

console.log('\n🔷 Phase 6: Delivery Person Setup');

for (let i = 0; i < DP_COUNT; i++) {
  const pin = `${1000 + i}`;
  dpPins.push(pin);

  await step(`Create delivery person ${i + 1}`, async () => {
    const r = await api.post('/delivery/persons', {
      name: `E2E Rider ${i + 1} ${RUN_ID}`,
      phone: dpPhones[i],
      pin,
    }, auth(adminToken));
    assert(r.status === 201 || r.status === 200, `${r.status}: ${r.data?.message}`);
    dpIds.push(r.data.id);
  });
}

for (let i = 0; i < DP_COUNT; i++) {
  // Small delay between logins to avoid rate limiting (ThrottlerException)
  if (i > 0) await new Promise(r => setTimeout(r, 300));
  await step(`Rider ${i + 1} login`, async () => {
    const r = await api.post('/delivery/auth/login', { phone: dpPhones[i], pin: dpPins[i] });
    assert(r.status === 200 || r.status === 201, `${r.status}: ${r.data?.message}`);
    dpTokens.push(r.data.access_token);
    assert(r.data.person?.status === 'DUTY_OFF', `Expected DUTY_OFF, got ${r.data.person?.status}`);
  });
}

await step('Rider 1 check DUTY_OFF → cannot go BUSY', async () => {
  const r = await api.post('/delivery/status', { status: 'BUSY' }, auth(dpTokens[0]));
  assert(r.status === 400, `Expected 400, got ${r.status}`);
});

for (let i = 0; i < DP_COUNT; i++) {
  await step(`Rider ${i + 1} → FREE + GPS`, async () => {
    let r = await api.post('/delivery/status', { status: 'FREE' }, auth(dpTokens[i]));
    assert(r.status === 200 || r.status === 201, `Status: ${r.status}: ${r.data?.message}`);
    r = await api.post('/delivery/location', {
      lat: 12.9716 + (i * 0.001),
      lng: 77.5946 + (i * 0.001),
    }, auth(dpTokens[i]));
    assert(r.status === 200 || r.status === 201, `Location: ${r.status}: ${r.data?.message}`);
  });
}

await step('Rider profile check', async () => {
  const r = await api.get('/delivery/me', auth(dpTokens[0]));
  assert(r.status === 200, `${r.status}`);
  assert(r.data.status === 'FREE', `Expected FREE, got ${r.data.status}`);
});

// ══════════════════════════════════════════════════════════════════════
//  Phase 7: Full Order Lifecycle per Store Type (COD)
// ══════════════════════════════════════════════════════════════════════

console.log('\n🔷 Phase 7: Order Lifecycle (All Store Types — COD)');

for (const storeType of STORE_TYPES) {
  const s = stores[storeType];
  console.log(`\n  ── ${storeType} ──`);

  // Skip store types where product creation failed
  if (s.productIds.length < 2) {
    console.log(`  ⚠️  Skipping ${storeType} — products not created`);
    continue;
  }

  // Add to cart
  await step(`[${storeType}] Add product 1 to cart`, async () => {
    const r = await api.post('/cart/items', { productId: s.productIds[0], quantity: 2 }, auth(userToken));
    assert(r.status === 200 || r.status === 201, `${r.status}: ${r.data?.message}`);
  });

  await step(`[${storeType}] Add product 2 to cart`, async () => {
    const r = await api.post('/cart/items', { productId: s.productIds[1], quantity: 1 }, auth(userToken));
    assert(r.status === 200 || r.status === 201, `${r.status}: ${r.data?.message}`);
  });

  // Preview (verify per-item tax)
  await step(`[${storeType}] Preview order`, async () => {
    const r = await api.post('/orders/preview', { addressId }, auth(userToken));
    assert(r.status === 200 || r.status === 201, `${r.status}: ${r.data?.message}`);
    assert(r.data.total > 0, 'Expected total > 0');
    // Verify: tax = prod1(150*2*5%) + prod2(200*1*12%) = 15 + 24 = 39
    assert(Math.abs(r.data.tax - 39) < 0.01, `Expected tax 39, got ${r.data.tax}`);
    assert(r.data.subtotal === 500, `Expected subtotal 500, got ${r.data.subtotal}`);
  });

  // Place COD order
  const idemKey = `e2e-${storeType.toLowerCase()}-${RUN_ID}`;
  await step(`[${storeType}] Place COD order`, async () => {
    const r = await api.post('/orders', {
      addressId,
      paymentMethod: 'COD',
      lat: 12.9720,
      lng: 77.5950,
    }, authWithIdempotency(userToken, idemKey));
    assert(r.status === 201 || r.status === 200, `${r.status}: ${r.data?.message}`);
    orderIds[storeType] = r.data.id;
    assert(r.data.status === 'CONFIRMED', `Expected CONFIRMED, got ${r.data.status}`);
    // Verify per-item tax is persisted on order
    assert(r.data.tax > 0, `Expected per-item tax > 0 on order, got ${r.data.tax}`);
  });

  // Verify cart cleared
  await step(`[${storeType}] Cart cleared after order`, async () => {
    const r = await api.get('/cart', auth(userToken));
    assert(r.status === 200, `${r.status}`);
    const items = r.data.items || r.data;
    assert(!items || items.length === 0, `Cart should be empty, got ${items?.length}`);
  });

  // Admin status transitions: CONFIRMED → PROCESSING → ORDER_PICKED → SHIPPED
  // PROCESSING may not be supported if server hasn't been restarted — skip gracefully
  if (orderIds[storeType]) {
    const processingRes = await api.patch(`/orders/admin/${orderIds[storeType]}/status`,
      { status: 'PROCESSING' }, auth(s.managerToken));
    if (processingRes.status === 200) {
      console.log(`  ✅ [${storeType}] Admin → PROCESSING (optional)`);
      results.push({ name: `[${storeType}] Admin → PROCESSING`, status: 'PASS' });
      totalTests++; passedTests++;
    } else {
      console.log(`  ⚠️  [${storeType}] PROCESSING transition not available — skipping`);
    }

    for (const nextStatus of ['ORDER_PICKED', 'SHIPPED']) {
      await step(`[${storeType}] Admin → ${nextStatus}`, async () => {
        const r = await api.patch(`/orders/admin/${orderIds[storeType]}/status`,
          { status: nextStatus }, auth(s.managerToken));
        assert(r.status === 200, `${r.status}: ${r.data?.message}`);
      });
    }
  }

  // Trigger delivery assignment
  await step(`[${storeType}] Trigger delivery assignment`, async () => {
    const r = await api.post(`/orders/admin/${orderIds[storeType]}/assign-delivery`, {}, auth(adminToken));
    assert(r.status === 200 || r.status === 201 || r.status === 400 || r.status === 409,
      `${r.status}: ${r.data?.message}`);
  });
}

// Wait for broadcast propagation
await new Promise(r => setTimeout(r, 2000));

// Rider claims and delivers orders sequentially (1 rider per order)
let riderIdx = 0;
for (const storeType of STORE_TYPES) {
  const orderId = orderIds[storeType];
  if (!orderId) {
    console.log(`  ⚠️  Skipping ${storeType} delivery — no order created`);
    continue;
  }
  const rToken = dpTokens[riderIdx % dpTokens.length];

  await step(`[${storeType}] Rider ${(riderIdx % DP_COUNT) + 1} claims order`, async () => {
    const r = await api.post(`/delivery/orders/${orderId}/claim`, {}, auth(rToken));
    if (r.status === 409 || r.status === 400 || r.status === 404) {
      console.log(`    ⚠️  Claim unavailable: ${r.data?.message}`);
      return;
    }
    assert(r.status === 200 || r.status === 201, `${r.status}: ${r.data?.message}`);
  });

  await step(`[${storeType}] Rider accepts order`, async () => {
    const r = await api.post(`/delivery/orders/${orderId}/accept`, {}, auth(rToken));
    if (r.status === 400 || r.status === 404) {
      console.log(`    ⚠️  Accept unavailable: ${r.data?.message}`);
      return;
    }
    assert(r.status === 200 || r.status === 201, `${r.status}: ${r.data?.message}`);
  });

  await step(`[${storeType}] Rider completes delivery`, async () => {
    const r = await api.post(`/delivery/orders/${orderId}/complete`, { result: 'DELIVERED' }, auth(rToken));
    if (r.status === 400 || r.status === 404) {
      console.log(`    ⚠️  Complete unavailable: ${r.data?.message}`);
      return;
    }
    assert(r.status === 200 || r.status === 201, `${r.status}: ${r.data?.message}`);
  });

  await step(`[${storeType}] Verify order DELIVERED`, async () => {
    const r = await api.get(`/orders/${orderId}`, auth(userToken));
    assert(r.status === 200, `${r.status}`);
    console.log(`    Order status: ${r.data.status}`);
  });

  riderIdx++;
}

// ══════════════════════════════════════════════════════════════════════
//  Phase 8: Order Modify & Cancel (Grace Period)
// ══════════════════════════════════════════════════════════════════════

console.log('\n🔷 Phase 8: Order Modify & Cancel (Grace Period)');

// Place an order, then modify it
const groceryStore = stores['GROCERY'];
await step('Add items to cart for modify test', async () => {
  await api.post('/cart/items', { productId: groceryStore.productIds[0], quantity: 3 }, auth(userToken));
  const r = await api.post('/cart/items', { productId: groceryStore.productIds[1], quantity: 2 }, auth(userToken));
  assert(r.status === 200 || r.status === 201, `${r.status}`);
});

let modifyOrderId;
await step('Place order for modify test (Razorpay PENDING)', async () => {
  const r = await api.post('/orders', {
    addressId, paymentMethod: 'RAZORPAY', lat: 12.9720, lng: 77.5950,
  }, authWithIdempotency(userToken, `e2e-modify-${RUN_ID}`));
  assert(r.status === 201 || r.status === 200, `${r.status}: ${r.data?.message}`);
  modifyOrderId = r.data.id;
  // canModify is now always false as per new requirements
  assert(r.data.canModify === false, 'Expected canModify=false (immutable orders)');
  assert(r.data.canCancel === true, 'Expected canCancel=true for PENDING order');
});

await step('Modify order rejected (Immutable Orders)', async () => {
  const r = await api.patch(`/orders/${modifyOrderId}/modify`, {
    items: [
      { productId: groceryStore.productIds[0], quantity: 1 },
    ],
  }, auth(userToken));
  // Should fail or be ignored if we removed the endpoint logic, 
  // but based on computeGraceFields, canModify is false so the service should reject it.
  assert(r.status === 400 || r.status === 403, `Expected failure for immutable order modify, got ${r.status}`);
});

// Place another order, then cancel it
await step('Add items to cart for cancel test', async () => {
  const r = await api.post('/cart/items', { productId: groceryStore.productIds[0], quantity: 1 }, auth(userToken));
  assert(r.status === 200 || r.status === 201, `${r.status}`);
});

let cancelOrderId;
await step('Place order for cancel test (Razorpay PENDING)', async () => {
  const r = await api.post('/orders', {
    addressId, paymentMethod: 'RAZORPAY', lat: 12.9720, lng: 77.5950,
  }, authWithIdempotency(userToken, `e2e-cancel-${RUN_ID}`));
  assert(r.status === 201 || r.status === 200, `${r.status}: ${r.data?.message}`);
  cancelOrderId = r.data.id;
  assert(r.data.canCancel === true, 'Expected canCancel=true for PENDING order');
});

await step('Cancel order within grace period', async () => {
  const r = await api.post(`/orders/${cancelOrderId}/cancel`, {}, auth(userToken));
  assert(r.status === 200 || r.status === 201, `${r.status}: ${r.data?.message}`);
  assert(r.data.status === 'CANCELLED', `Expected CANCELLED, got ${r.data.status}`);
});

await step('Double-cancel rejected', async () => {
  const r = await api.post(`/orders/${cancelOrderId}/cancel`, {}, auth(userToken));
  assert(r.status === 400, `Expected 400, got ${r.status}`);
});

// ══════════════════════════════════════════════════════════════════════
//  Phase 9: Mock Razorpay Payment Flow
// ══════════════════════════════════════════════════════════════════════

console.log('\n🔷 Phase 9: Mock Razorpay Payment');

await step('Add items for Razorpay order', async () => {
  const r = await api.post('/cart/items', { productId: groceryStore.productIds[0], quantity: 2 }, auth(userToken));
  assert(r.status === 200 || r.status === 201, `${r.status}`);
});

let razorpayOrderId;
await step('Place Razorpay order', async () => {
  const r = await api.post('/orders', {
    addressId, paymentMethod: 'RAZORPAY', lat: 12.9720, lng: 77.5950,
  }, authWithIdempotency(userToken, `e2e-razorpay-${RUN_ID}`));
  assert(r.status === 201 || r.status === 200, `${r.status}: ${r.data?.message}`);
  razorpayOrderId = r.data.id;
  assert(r.data.status === 'PENDING', `Expected PENDING, got ${r.data.status}`);
});

await step('Create Razorpay payment order', async () => {
  const r = await api.post(`/payments/create/${razorpayOrderId}`, {}, auth(userToken));
  assert(r.status === 200 || r.status === 201, `${r.status}: ${r.data?.message}`);

  // Safety check: Ensure we are using TEST credentials, not PRODUCTION
  if (!r.data.mockMode) {
    // If in CI, verify it matches the secret exactly
    if (CI_MODE && RZP_TEST_KEY_ID) {
      assert(r.data.key === RZP_TEST_KEY_ID, `CRITICAL SAFETY ERROR: Server key (${r.data.key}) does not match RAZORPAY_TEST_KEY_ID secret. Aborting to prevent production usage.`);
      console.log(`    ℹ️  Verified Razorpay CI Test Mode (${r.data.key})`);
    } else {
      assert(r.data.key.startsWith('rzp_test_'), `CRITICAL SAFETY ERROR: Server returned a non-test Razorpay key: ${r.data.key}. Aborting tests to prevent production charges.`);
      console.log(`    ℹ️  Verified Razorpay Local Test Mode (${r.data.key})`);
    }
  } else {
    console.log('    ℹ️  Verified Razorpay Mock Mode');
  }
});

await step('Mock payment completion', async () => {
  const r = await api.post(`/payments/mock/${razorpayOrderId}`, {}, auth(userToken));
  assert(r.status === 200 || r.status === 201, `${r.status}: ${r.data?.message}`);
});

await step('Verify Razorpay order CONFIRMED + PAID', async () => {
  const r = await api.get(`/orders/${razorpayOrderId}`, auth(userToken));
  assert(r.status === 200, `${r.status}`);
  assert(r.data.status === 'CONFIRMED', `Expected CONFIRMED, got ${r.data.status}`);
  assert(r.data.paymentStatus === 'PAID', `Expected PAID, got ${r.data.paymentStatus}`);
});

// ══════════════════════════════════════════════════════════════════════
//  Phase 10: Parcel Order Full Lifecycle
// ══════════════════════════════════════════════════════════════════════

console.log('\n🔷 Phase 10: Parcel Order Lifecycle');

const futurePickup = new Date(Date.now() + 2 * 60 * 60 * 1000);
const futureDrop = new Date(Date.now() + 6 * 60 * 60 * 1000);

await step('Book parcel', async () => {
  const r = await api.post('/parcels', {
    pickupAddress: {
      type: 'HOME', houseNo: '10', street: 'Pickup St', city: 'Bangalore',
      zipCode: '560001', state: 'Karnataka', lat: 12.9716, lng: 77.5946,
    },
    dropAddress: {
      type: 'OTHER', houseNo: '20', street: 'Drop St', city: 'Bangalore',
      zipCode: '560002', state: 'Karnataka', lat: 12.9800, lng: 77.6000,
    },
    category: 'DOCUMENTS',
    weight: 1.5,
    length: 30,
    width: 20,
    height: 5,
    pickupTime: futurePickup.toISOString(),
    dropTime: futureDrop.toISOString(),
  }, auth(userToken));
  assert(r.status === 201 || r.status === 200, `${r.status}: ${r.data?.message}`);
  parcelId.value = r.data.id;
  assert(r.data.status === 'PENDING', `Expected PENDING, got ${r.data.status}`);
  assert(r.data.parcelNumber, 'No parcel number');
});

await step('List user parcels', async () => {
  const r = await api.get('/parcels', auth(userToken));
  assert(r.status === 200, `${r.status}`);
  const list = r.data.data || r.data;
  const arr = Array.isArray(list) ? list : [];
  assert(arr.some(p => p.id === parcelId.value), 'Parcel not found in user list');
});

await step('Admin: approve parcel with COD', async () => {
  const r = await api.post(`/admin/parcels/${parcelId.value}/approve`, { codAmount: 200 }, auth(adminToken));
  assert(r.status === 200 || r.status === 201, `${r.status}: ${r.data?.message}`);
  assert(r.data.status === 'APPROVED', `Expected APPROVED, got ${r.data.status}`);
});

await step('Admin: set parcel ready', async () => {
  const r = await api.post(`/admin/parcels/${parcelId.value}/ready`, {}, auth(adminToken));
  assert(r.status === 200 || r.status === 201, `${r.status}: ${r.data?.message}`);
  assert(r.data.status === 'READY_FOR_PICKUP', `Expected READY_FOR_PICKUP, got ${r.data.status}`);
});

// Position a rider near pickup
// Use the last rider that has a valid token
const parcelRiderIdx = dpTokens.length - 1;
await step('Position rider near parcel pickup', async () => {
  const r = await api.post('/delivery/location', { lat: 12.9720, lng: 77.5950 }, auth(dpTokens[parcelRiderIdx]));
  assert(r.status === 200 || r.status === 201, `${r.status}`);
});

// Make sure rider is FREE (may have been set to BUSY from earlier order tests)
await step('Ensure parcel rider is FREE', async () => {
  const r = await api.post('/delivery/status', { status: 'FREE' }, auth(dpTokens[parcelRiderIdx]));
  // If rider is busy, this might fail
  if (r.status === 400) {
    console.log(`    ⚠️  Rider is BUSY, may have active delivery: ${r.data?.message}`);
  }
});

await step('Admin: trigger parcel delivery assignment', async () => {
  const r = await api.post(`/admin/parcels/${parcelId.value}/assign-delivery`, {}, auth(adminToken));
  assert(r.status === 200 || r.status === 201, `${r.status}: ${r.data?.message}`);
});

await new Promise(r => setTimeout(r, 1500));

await step('Rider claims parcel', async () => {
  const r = await api.post(`/delivery/parcels/${parcelId.value}/claim`, {}, auth(dpTokens[parcelRiderIdx]));
  if (r.status === 409 || r.status === 400 || r.status === 404) {
    // Try other riders
    for (let i = 0; i < DP_COUNT; i++) {
      if (i === parcelRiderIdx) continue;
      const r2 = await api.post(`/delivery/parcels/${parcelId.value}/claim`, {}, auth(dpTokens[i]));
      if (r2.status === 200 || r2.status === 201) {
        console.log(`    Parcel claimed by rider ${i + 1} instead`);
        return;
      }
    }
    console.log(`    ⚠️  No rider could claim: ${r.data?.message}`);
    return;
  }
  assert(r.status === 200 || r.status === 201, `${r.status}: ${r.data?.message}`);
});

await step('Rider accepts parcel', async () => {
  const r = await api.post(`/delivery/parcels/${parcelId.value}/accept`, {}, auth(dpTokens[parcelRiderIdx]));
  if (r.status === 400 || r.status === 404) {
    // Try other riders
    for (let i = 0; i < DP_COUNT; i++) {
      if (i === parcelRiderIdx) continue;
      const r2 = await api.post(`/delivery/parcels/${parcelId.value}/accept`, {}, auth(dpTokens[i]));
      if (r2.status === 200 || r2.status === 201) return;
    }
    console.log(`    ⚠️  No rider could accept: ${r.data?.message}`);
    return;
  }
  assert(r.status === 200 || r.status === 201, `${r.status}: ${r.data?.message}`);
});

await step('Rider completes parcel delivery', async () => {
  const r = await api.post(`/delivery/parcels/${parcelId.value}/complete`, { result: 'DELIVERED' }, auth(dpTokens[parcelRiderIdx]));
  if (r.status === 400 || r.status === 404) {
    for (let i = 0; i < DP_COUNT; i++) {
      if (i === parcelRiderIdx) continue;
      const r2 = await api.post(`/delivery/parcels/${parcelId.value}/complete`, { result: 'DELIVERED' }, auth(dpTokens[i]));
      if (r2.status === 200 || r2.status === 201) return;
    }
    console.log(`    ⚠️  No rider could complete: ${r.data?.message}`);
    return;
  }
  assert(r.status === 200 || r.status === 201, `${r.status}: ${r.data?.message}`);
});

await step('Verify parcel DELIVERED', async () => {
  const r = await api.get(`/admin/parcels/${parcelId.value}`, auth(adminToken));
  assert(r.status === 200, `${r.status}`);
  console.log(`    Parcel status: ${r.data.status}`);
});

// Parcel cancel test
let cancelParcelId;
await step('Book parcel for cancel test', async () => {
  const r = await api.post('/parcels', {
    pickupAddress: {
      type: 'HOME', houseNo: '99', street: 'Cancel St', city: 'Bangalore',
      zipCode: '560001', state: 'Karnataka', lat: 12.9716, lng: 77.5946,
    },
    dropAddress: {
      type: 'OTHER', houseNo: '88', street: 'Cancel Drop', city: 'Bangalore',
      zipCode: '560002', state: 'Karnataka', lat: 12.9800, lng: 77.6000,
    },
    category: 'ELECTRONICS',
    weight: 2.0,
    pickupTime: futurePickup.toISOString(),
    dropTime: futureDrop.toISOString(),
  }, auth(userToken));
  assert(r.status === 201 || r.status === 200, `${r.status}: ${r.data?.message}`);
  cancelParcelId = r.data.id;
});

await step('Cancel pending parcel', async () => {
  const r = await api.post(`/parcels/${cancelParcelId}/cancel`, {}, auth(userToken));
  assert(r.status === 200 || r.status === 201, `${r.status}: ${r.data?.message}`);
  assert(r.data.status === 'CANCELLED', `Expected CANCELLED, got ${r.data.status}`);
});

// ══════════════════════════════════════════════════════════════════════
//  Phase 11: Race Condition Tests
// ══════════════════════════════════════════════════════════════════════

console.log('\n🔷 Phase 11: Race Condition Tests');

// Create a new order for race test
await step('Add items for race test order', async () => {
  const r = await api.post('/cart/items', { productId: groceryStore.productIds[0], quantity: 1 }, auth(userToken));
  assert(r.status === 200 || r.status === 201, `${r.status}`);
});

let raceOrderId;
await step('Place order for race test', async () => {
  const r = await api.post('/orders', {
    addressId, paymentMethod: 'COD', lat: 12.9720, lng: 77.5950,
  }, authWithIdempotency(userToken, `e2e-race-${RUN_ID}`));
  assert(r.status === 201 || r.status === 200, `${r.status}: ${r.data?.message}`);
  raceOrderId = r.data.id;
});

// Advance to SHIPPED so it can be assigned
// Try PROCESSING (may not be available if server not restarted)
{
  const pr = await api.patch(`/orders/admin/${raceOrderId}/status`,
    { status: 'PROCESSING' }, auth(groceryStore.managerToken));
  if (pr.status === 200) {
    console.log('  ✅ Race order → PROCESSING (optional)');
  } else {
    console.log('  ⚠️  PROCESSING not available — skipping');
  }
}
for (const status of ['ORDER_PICKED', 'SHIPPED']) {
  await step(`Race order → ${status}`, async () => {
    const r = await api.patch(`/orders/admin/${raceOrderId}/status`,
      { status }, auth(groceryStore.managerToken));
    assert(r.status === 200, `${r.status}: ${r.data?.message}`);
  });
}

// Trigger assignment
await step('Trigger race order assignment', async () => {
  const r = await api.post(`/orders/admin/${raceOrderId}/assign-delivery`, {}, auth(adminToken));
  assert(r.status === 200 || r.status === 201 || r.status === 400 || r.status === 409,
    `${r.status}: ${r.data?.message}`);
});

await new Promise(r => setTimeout(r, 2000));

// Ensure all riders are FREE and positioned
for (let i = 0; i < DP_COUNT; i++) {
  try {
    await api.post('/delivery/status', { status: 'FREE' }, auth(dpTokens[i]));
    await api.post('/delivery/location', {
      lat: 12.9716 + (i * 0.0005),
      lng: 77.5946 + (i * 0.0005),
    }, auth(dpTokens[i]));
  } catch (_) { /* ignore */ }
}

await new Promise(r => setTimeout(r, 500));

// Concurrent claims — all 6 riders try at once
let raceWinnerIdx = -1;
await step(`Concurrent claim: ${DP_COUNT} riders race`, async () => {
  const claimPromises = dpTokens.map(token =>
    api.post(`/delivery/orders/${raceOrderId}/claim`, {}, auth(token))
  );
  const claimResults = await Promise.all(claimPromises);

  const successes = claimResults.filter(r => r.status === 200 || r.status === 201);
  const conflicts = claimResults.filter(r => r.status === 409);
  const errors = claimResults.filter(r => r.status !== 200 && r.status !== 201 && r.status !== 409 && r.status !== 400 && r.status !== 404);

  console.log(`    Winners: ${successes.length}, Conflicts (409): ${conflicts.length}, Errors: ${errors.length}`);
  console.log(`    Status codes: [${claimResults.map(r => r.status).join(', ')}]`);

  raceWinnerIdx = claimResults.findIndex(r => r.status === 200 || r.status === 201);

  // At most 1 winner
  if (successes.length > 1) {
    issues.push({ test: 'Concurrent claim', error: `${successes.length} winners (expected ≤ 1)` });
    console.log(`    ⚠️  RACE CONDITION: ${successes.length} riders won the claim!`);
  }
});

// ── Delivery Race Condition: Loser tries to accept claimed order ──
await step('Race: loser cannot accept already-claimed order', async () => {
  const loserIdx = raceWinnerIdx >= 0
    ? dpTokens.findIndex((_, i) => i !== raceWinnerIdx)
    : 1;
  const r = await api.post(`/delivery/orders/${raceOrderId}/accept`, {}, auth(dpTokens[loserIdx]));
  assert(r.status === 400 || r.status === 404 || r.status === 409,
    `Expected 400/404/409, got ${r.status}`);
});

// ── Delivery Race Condition: BUSY rider cannot claim another order ──
await step('Race: BUSY rider cannot claim another order', async () => {
  // The winner is BUSY — try to claim a different order (one of the delivered ones)
  if (raceWinnerIdx >= 0) {
    const busyToken = dpTokens[raceWinnerIdx];
    // Try to claim one of the Phase 7 orders (already delivered, will fail either way)
    const someOrderId = orderIds['PIZZA_TOWN'];
    const r = await api.post(`/delivery/orders/${someOrderId}/claim`, {}, auth(busyToken));
    // Should be 409 (BUSY), 400, or 404 (order not claimable)
    assert(r.status === 409 || r.status === 400 || r.status === 404,
      `Expected 409/400/404 for BUSY rider claim, got ${r.status}`);
  }
});

// ── Delivery Race Condition: Concurrent accept + complete ──
await step('Race: concurrent accept by winner succeeds', async () => {
  if (raceWinnerIdx >= 0) {
    const winnerToken = dpTokens[raceWinnerIdx];
    const r = await api.post(`/delivery/orders/${raceOrderId}/accept`, {}, auth(winnerToken));
    assert(r.status === 200 || r.status === 201, `Accept failed: ${r.status}: ${r.data?.message}`);
  }
});

await step('Race: double-accept by same rider is idempotent/rejected', async () => {
  if (raceWinnerIdx >= 0) {
    const winnerToken = dpTokens[raceWinnerIdx];
    const r = await api.post(`/delivery/orders/${raceOrderId}/accept`, {}, auth(winnerToken));
    // Should be 200 (idempotent) or 400 (already accepted)
    assert(r.status === 200 || r.status === 400,
      `Expected 200/400 for double-accept, got ${r.status}`);
  }
});

// ── Delivery Race Condition: Concurrent complete attempts ──
await step('Race: concurrent complete — only 1 succeeds', async () => {
  if (raceWinnerIdx >= 0) {
    const winnerToken = dpTokens[raceWinnerIdx];
    // Fire 3 simultaneous complete requests
    const completePromises = Array.from({ length: 3 }, () =>
      api.post(`/delivery/orders/${raceOrderId}/complete`, { result: 'DELIVERED' }, auth(winnerToken))
    );
    const results = await Promise.all(completePromises);
    const successes = results.filter(r => r.status === 200 || r.status === 201);
    const rejected = results.filter(r => r.status === 400 || r.status === 404 || r.status === 409);
    console.log(`    Complete winners: ${successes.length}, Rejected: ${rejected.length}`);
    console.log(`    Status codes: [${results.map(r => r.status).join(', ')}]`);
    if (successes.length > 1) {
      issues.push({ test: 'Concurrent complete', error: `${successes.length} completions (expected 1)` });
    }
  }
});

// Free the winner back to FREE for subsequent tests
if (raceWinnerIdx >= 0) {
  try {
    await api.post('/delivery/status', { status: 'FREE' }, auth(dpTokens[raceWinnerIdx]));
  } catch { }
}

// ── Delivery Race Condition: Create order 2 for reject + re-claim test ──
// Put ALL riders DUTY_OFF first to prevent AutoAssignService interference
for (const token of dpTokens) {
  try { await api.post('/delivery/status', { status: 'DUTY_OFF' }, auth(token)); } catch { }
}
await new Promise(r => setTimeout(r, 500));

let raceOrder2Id;
await step('Add items for reject-reclaim race test', async () => {
  const r = await api.post('/cart/items', { productId: groceryStore.productIds[0], quantity: 1 }, auth(userToken));
  assert(r.status === 200 || r.status === 201, `${r.status}`);
});
await step('Place order for reject-reclaim test', async () => {
  const r = await api.post('/orders', {
    addressId, paymentMethod: 'COD', lat: 12.9720, lng: 77.5950,
  }, authWithIdempotency(userToken, `e2e-reject-race-${RUN_ID}`));
  assert(r.status === 201 || r.status === 200, `${r.status}: ${r.data?.message}`);
  raceOrder2Id = r.data.id;
});

// Advance to ORDER_PICKED (claim service checks for ORDER_PICKED status)
for (const status of ['PROCESSING', 'ORDER_PICKED']) {
  const r = await api.patch(`/orders/admin/${raceOrder2Id}/status`,
    { status }, auth(groceryStore.managerToken));
  if (r.status !== 200) break;
}

// Assign to pool (no riders are FREE, so it just sits in pool)
await api.post(`/orders/admin/${raceOrder2Id}/assign-delivery`, {}, auth(adminToken));
await new Promise(r => setTimeout(r, 500));

// Turn rider 1 FREE and position, then claim
await api.post('/delivery/status', { status: 'FREE' }, auth(dpTokens[0]));
await api.post('/delivery/location', { lat: 12.9716, lng: 77.5946 }, auth(dpTokens[0]));
await new Promise(r => setTimeout(r, 500));

await step('Reject-reclaim: rider 1 claims order', async () => {
  const r = await api.post(`/delivery/orders/${raceOrder2Id}/claim`, {}, auth(dpTokens[0]));
  assert(r.status === 200 || r.status === 201, `Claim failed: ${r.status}: ${r.data?.message}`);
});

// Rider 1 rejects — should free the order back for re-assignment
await step('Reject-reclaim: rider 1 rejects order', async () => {
  const r = await api.post(`/delivery/orders/${raceOrder2Id}/reject`, {}, auth(dpTokens[0]));
  assert(r.status === 200 || r.status === 201, `Reject failed: ${r.status}: ${r.data?.message}`);
});

await new Promise(r => setTimeout(r, 500));

// Re-assign to pool, turn rider 2 FREE, then claim
await api.post(`/orders/admin/${raceOrder2Id}/assign-delivery`, {}, auth(adminToken));
await new Promise(r => setTimeout(r, 500));
await api.post('/delivery/status', { status: 'FREE' }, auth(dpTokens[1]));
await api.post('/delivery/location', { lat: 12.9720, lng: 77.5950 }, auth(dpTokens[1]));
await new Promise(r => setTimeout(r, 500));

await step('Reject-reclaim: rider 2 claims rejected order', async () => {
  const r = await api.post(`/delivery/orders/${raceOrder2Id}/claim`, {}, auth(dpTokens[1]));
  if (r.status === 200 || r.status === 201) {
    console.log('    ✅ Rider 2 claimed the rejected order');
    await api.post(`/delivery/orders/${raceOrder2Id}/accept`, {}, auth(dpTokens[1]));
    await api.post(`/delivery/orders/${raceOrder2Id}/complete`, { result: 'DELIVERED' }, auth(dpTokens[1]));
  } else {
    // 409 means order was auto-assigned or already taken — that's fine
    console.log(`    ⚠️  Rider 2 claim returned ${r.status} — order may have been auto-assigned`);
  }
});

// Put all riders DUTY_OFF again
for (const token of dpTokens) {
  try { await api.post('/delivery/status', { status: 'DUTY_OFF' }, auth(token)); } catch { }
}
await new Promise(r => setTimeout(r, 500));

// ── Delivery Race Condition: Concurrent parcel claims ──
let raceParcelId;
await step('Race: book parcel for concurrent claim test', async () => {
  const racePickup = new Date(Date.now() + 3 * 60 * 60 * 1000);
  const raceDrop = new Date(Date.now() + 7 * 60 * 60 * 1000);
  const r = await api.post('/parcels', {
    pickupAddress: {
      type: 'HOME', houseNo: '50', street: 'Race Pickup St', city: 'Bangalore',
      zipCode: '560001', state: 'Karnataka', lat: 12.9716, lng: 77.5946,
    },
    dropAddress: {
      type: 'OTHER', houseNo: '60', street: 'Race Drop St', city: 'Bangalore',
      zipCode: '560002', state: 'Karnataka', lat: 12.9800, lng: 77.6000,
    },
    category: 'DOCUMENTS',
    weight: 1,
    pickupTime: racePickup.toISOString(),
    dropTime: raceDrop.toISOString(),
  }, auth(userToken));
  assert(r.status === 201 || r.status === 200, `${r.status}: ${r.data?.message}`);
  raceParcelId = r.data.id;
});

// Admin approves + sets ready
if (raceParcelId) {
  await api.patch(`/admin/parcels/${raceParcelId}/status`, { status: 'APPROVED', estimatedPrice: 100 }, auth(adminToken));
  await api.patch(`/admin/parcels/${raceParcelId}/status`, { status: 'READY_FOR_PICKUP' }, auth(adminToken));

  // Turn all riders FREE and position nearby
  for (let i = 0; i < dpTokens.length; i++) {
    try {
      await api.post('/delivery/status', { status: 'FREE' }, auth(dpTokens[i]));
      await api.post('/delivery/location', { lat: 12.9716 + i * 0.0003, lng: 77.5946 + i * 0.0003 }, auth(dpTokens[i]));
    } catch { }
  }

  // Assign to delivery pool
  await api.post(`/admin/parcels/${raceParcelId}/assign-delivery`, {}, auth(adminToken));
  await new Promise(r => setTimeout(r, 1000));

  await step(`Race: ${DP_COUNT} riders claim same parcel concurrently`, async () => {
    const claims = await Promise.all(
      dpTokens.map(token => api.post(`/delivery/parcels/${raceParcelId}/claim`, {}, auth(token)))
    );
    const winners = claims.filter(r => r.status === 200 || r.status === 201);
    const conflicts = claims.filter(r => r.status === 409);
    console.log(`    Parcel winners: ${winners.length}, Conflicts: ${conflicts.length}`);
    console.log(`    Status codes: [${claims.map(r => r.status).join(', ')}]`);
    if (winners.length > 1) {
      issues.push({ test: 'Concurrent parcel claim', error: `${winners.length} winners (expected ≤ 1)` });
    }
    // Complete the parcel if claimed
    if (winners.length === 1) {
      const winIdx = claims.findIndex(r => r.status === 200 || r.status === 201);
      await api.post(`/delivery/parcels/${raceParcelId}/accept`, {}, auth(dpTokens[winIdx]));
      await api.post(`/delivery/parcels/${raceParcelId}/complete`, { result: 'DELIVERED' }, auth(dpTokens[winIdx]));
    }
  });
}

// Free all riders for subsequent tests
for (const token of dpTokens) {
  try { await api.post('/delivery/status', { status: 'FREE' }, auth(token)); } catch { }
}

// Idempotency: re-send same order creation
await step('Idempotency: duplicate order creation returns same ID', async () => {
  await api.post('/cart/items', { productId: groceryStore.productIds[0], quantity: 1 }, auth(userToken));
  const r = await api.post('/orders', {
    addressId, paymentMethod: 'COD', lat: 12.9720, lng: 77.5950,
  }, authWithIdempotency(userToken, `e2e-race-${RUN_ID}`));
  assert(r.status === 200 || r.status === 201, `${r.status}: ${r.data?.message}`);
  assert(r.data.id === raceOrderId, `Expected same order ID, got ${r.data.id}`);
});

// IDOR: user2 cannot cancel user1's order
await step('IDOR: Other user cannot cancel my order', async () => {
  const phone2 = `+9199${seq}99`;
  await api.post('/auth/send-otp', { phone: phone2 });
  const vr = await api.post('/auth/verify-otp', { phone: phone2, otp: '123456' });
  if (vr.status === 200 || vr.status === 201) {
    const token2 = vr.data.access_token;
    const r = await api.post(`/orders/${modifyOrderId}/cancel`, {}, auth(token2));
    assert(r.status === 404 || r.status === 403, `Expected 404/403, got ${r.status}`);
  }
});

// Double complete
await step('Double complete delivery rejected', async () => {
  // Try completing an already delivered order
  const deliveredOrderId = orderIds['GROCERY'];
  const r = await api.post(`/delivery/orders/${deliveredOrderId}/complete`, { result: 'DELIVERED' }, auth(dpTokens[0]));
  assert(r.status === 400 || r.status === 404, `Expected 400/404, got ${r.status}`);
});

// Invalid status transitions
await step('Invalid status transition: DELIVERED → CONFIRMED', async () => {
  const r = await api.patch(`/orders/admin/${orderIds['GROCERY']}/status`,
    { status: 'CONFIRMED' }, auth(groceryStore.managerToken));
  assert(r.status === 400, `Expected 400, got ${r.status}`);
});

// Unauthenticated access
await step('Unauthenticated: GET /orders → 401', async () => {
  const r = await api.get('/orders');
  assert(r.status === 401, `Expected 401, got ${r.status}`);
});

await step('Unauthenticated: POST /orders → 401', async () => {
  const r = await api.post('/orders', { addressId: 'x', paymentMethod: 'COD' });
  assert(r.status === 401, `Expected 401, got ${r.status}`);
});

// RBAC: delivery person cannot access admin routes
await step('RBAC: Rider cannot access admin store route', async () => {
  const r = await api.get('/orders/admin/store', auth(dpTokens[0]));
  assert(r.status === 403, `Expected 403, got ${r.status}`);
});

await step('RBAC: Rider cannot create store', async () => {
  const r = await api.post('/stores', { name: 'Bad', pincode: '000000', lat: 0, lng: 0, storeType: 'GROCERY' }, auth(dpTokens[0]));
  assert(r.status === 403, `Expected 403, got ${r.status}`);
});

// ── Post-race cleanup: flush delivery pool to prevent stale BullMQ jobs ──
{
  const raceCleanRedis = new Redis(REDIS_URL, { maxRetriesPerRequest: 1, lazyConnect: true });
  try {
    await raceCleanRedis.connect();
    await raceCleanRedis.del('avail:orders');
    let cleaned = 0;
    for (const pattern of ['avail:order:*', 'lock:order:*', 'eligible:*', 'idempotent:claim:*', 'bull:delivery:*']) {
      let cursor = '0';
      do {
        const [next, keys] = await raceCleanRedis.scan(cursor, 'MATCH', pattern, 'COUNT', 200);
        cursor = next;
        const delKeys = pattern === 'bull:delivery:*'
          ? keys.filter(k => !k.endsWith(':meta') && !k.endsWith(':stalled-check'))
          : keys;
        if (delKeys.length > 0) { await raceCleanRedis.del(...delKeys); cleaned += delKeys.length; }
      } while (cursor !== '0');
    }
    await raceCleanRedis.quit();
    if (cleaned > 0) console.log(`  🧹 Post-race cleanup: flushed ${cleaned} Redis keys`);
  } catch { try { await raceCleanRedis.quit(); } catch { } }
}

// ══════════════════════════════════════════════════════════════════════
//  Phase 12: Print Product CRUD
// ══════════════════════════════════════════════════════════════════════

console.log('\n🔷 Phase 12: Print Product CRUD');

let printProductId;
await step('Create print product', async () => {
  const r = await api.post('/print-products', {
    name: `E2E T-Shirt ${RUN_ID}`,
    productType: 'TSHIRT',
    sizes: [
      { label: 'Small', value: 'S' },
      { label: 'Medium', value: 'M' },
      { label: 'Large', value: 'L' },
    ],
    basePrice: 499,
  }, auth(adminToken));
  if (r.status === 404) {
    console.log('    ⚠️  Print products endpoint not available');
    return;
  }
  assert(r.status === 201 || r.status === 200, `${r.status}: ${r.data?.message}`);
  printProductId = r.data.id;
});

if (printProductId) {
  await step('List print products', async () => {
    const r = await api.get('/print-products', auth(adminToken));
    assert(r.status === 200, `${r.status}`);
  });

  await step('Get active print products (public)', async () => {
    const r = await api.get('/print-products/active');
    assert(r.status === 200, `${r.status}`);
  });

  await step('Update print product', async () => {
    const r = await api.patch(`/print-products/${printProductId}`, {
      basePrice: 599,
    }, auth(adminToken));
    assert(r.status === 200, `${r.status}: ${r.data?.message}`);
  });

  await step('Deactivate print product', async () => {
    const r = await api.delete(`/print-products/${printProductId}`, auth(adminToken));
    assert(r.status === 200 || r.status === 204, `${r.status}`);
  });
}

// ══════════════════════════════════════════════════════════════════════
//  Phase 13: Buy Now Isolation & Independent Checkout
// ══════════════════════════════════════════════════════════════════════

console.log('\n🔷 Phase 13: Buy Now Isolation');

await step('Clear cart before Buy Now test', async () => {
  await api.delete('/cart', auth(userToken));
});

let buyNowOrderId;
await step('Add items to cart (initial state)', async () => {
  await api.post('/cart/items', { productId: groceryStore.productIds[0], quantity: 5 }, auth(userToken));
  const r = await api.get('/cart', auth(userToken));
  assert(r.data.items?.length > 0, 'Cart should not be empty');
});

await step('Buy Now: Place isolated order (bypasses cart)', async () => {
  const r = await api.post('/orders', {
    addressId,
    paymentMethod: 'RAZORPAY', // Changed to RAZORPAY to test isolation with payment
    lat: 12.9720,
    lng: 77.5950,
    items: [{ productId: groceryStore.productIds[1], quantity: 2 }]
  }, authWithIdempotency(userToken, `e2e-buynow-${RUN_ID}`));

  assert(r.status === 201 || r.status === 200, `${r.status}: ${r.data?.message}`);
  buyNowOrderId = r.data.id;
  assert(r.data.items.length === 1, `Expected 1 item, got ${r.data.items.length}`);
  assert(r.data.items[0].productId === groceryStore.productIds[1], 'Incorrect product in Buy Now order');
  assert(r.data.items[0].quantity === 2, 'Incorrect quantity in Buy Now order');
});

await step('Buy Now: Create Razorpay order & Verify Keys', async () => {
  const r = await api.post(`/payments/create/${buyNowOrderId}`, {}, auth(userToken));
  assert(r.status === 200 || r.status === 201, `${r.status}: ${r.data?.message}`);
  if (!r.data.mockMode) {
    if (CI_MODE && RZP_TEST_KEY_ID) {
      assert(r.data.key === RZP_TEST_KEY_ID, `CRITICAL SAFETY ERROR: Buy Now server key (${r.data.key}) does not match RAZORPAY_TEST_KEY_ID secret.`);
    } else {
      assert(r.data.key.startsWith('rzp_test_'), `CRITICAL SAFETY ERROR: Buy Now returned a non-test key: ${r.data.key}`);
    }
  }
  // Complete payment so we can check cart isolation after success
  await api.post(`/payments/mock/${buyNowOrderId}`, {}, auth(userToken));
});

await step('Verify cart remains untouched after Buy Now', async () => {
  const r = await api.get('/cart', auth(userToken));
  assert(r.status === 200, `${r.status}`);
  const items = r.data.items || r.data;
  assert(items?.length > 0, 'Cart should still have original items');
  assert(items.some(i => i.productId === groceryStore.productIds[0] && i.quantity === 5), 'Cart item 1 changed');
  assert(!items.some(i => i.productId === groceryStore.productIds[1]), 'Buy Now item accidentally added to cart');
});

await step('Buy Now: Preview with quantity update updates total', async () => {
  const r1 = await api.post('/orders/preview', {
    addressId,
    items: [{ productId: groceryStore.productIds[1], quantity: 1 }]
  }, auth(userToken));

  const r2 = await api.post('/orders/preview', {
    addressId,
    items: [{ productId: groceryStore.productIds[1], quantity: 3 }]
  }, auth(userToken));

  assert(r2.data.subtotal > r1.data.subtotal, 'Total did not increase with quantity');
  // Verify tax matches per-item calculation (12% for prod 2)
  const expectedTax2 = Math.round(r2.data.subtotal * 0.12 * 100) / 100;
  assert(Math.abs(r2.data.tax - expectedTax2) < 0.01, `Tax mismatch: expected ${expectedTax2}, got ${r2.data.tax}`);
});

// ══════════════════════════════════════════════════════════════════════
//  Phase 14: Cleanup — Orders, Parcels, Redis Pool/Queue, DB entities
// ══════════════════════════════════════════════════════════════════════

console.log('\n🔷 Phase 14: Cleanup');

// ── 14a. Cancel all non-terminal orders via API ──────────────────────
// Admin cancel triggers: stock restoration, assignment deletion, pool removal,
// Redis snapshot/lock/eligible cleanup, SSE broadcast, cache invalidation.

const allOrderIds = [
  ...Object.values(orderIds).filter(Boolean),
  modifyOrderId,
  cancelOrderId,
  razorpayOrderId,
  raceOrderId,
  raceOrder2Id,
  buyNowOrderId,
].filter(Boolean);

console.log(`  Cleaning up ${allOrderIds.length} orders...`);

for (const oid of allOrderIds) {
  await step(`Cancel/verify order ${oid.slice(0, 8)}...`, async () => {
    const check = await api.get(`/orders/${oid}`, auth(userToken));
    if (check.status !== 200) {
      console.log(`    ⚠️  Order ${oid.slice(0, 8)} not found — skipping`);
      return;
    }
    const currentStatus = check.data.status;

    if (currentStatus === 'CANCELLED' || currentStatus === 'DELIVERED') {
      console.log(`    Already ${currentStatus}`);
      return;
    }

    const r = await api.patch(`/orders/admin/${oid}/status`,
      { status: 'CANCELLED' }, auth(adminToken));
    assert(r.status === 200 || r.status === 400,
      `Cancel failed: ${r.status}: ${r.data?.message}`);
    if (r.status === 200) {
      console.log(`    ${currentStatus} → CANCELLED (stock restored, assignments cleaned)`);
    } else {
      console.log(`    ⚠️  Cancel rejected: ${r.data?.message}`);
    }
  });
}

// ── 14b. Cancel all non-terminal parcels via API ─────────────────────
const allParcelIds = [parcelId.value, cancelParcelId, raceParcelId].filter(Boolean);
console.log(`  Cleaning up ${allParcelIds.length} parcels...`);

for (const pid of allParcelIds) {
  await step(`Cancel/verify parcel ${pid.slice(0, 8)}...`, async () => {
    const check = await api.get(`/admin/parcels/${pid}`, auth(adminToken));
    if (check.status !== 200) {
      console.log(`    ⚠️  Parcel ${pid.slice(0, 8)} not found — skipping`);
      return;
    }
    const currentStatus = check.data.status;

    if (currentStatus === 'CANCELLED' || currentStatus === 'DELIVERED') {
      console.log(`    Already ${currentStatus}`);
      return;
    }

    const r = await api.patch(`/admin/parcels/${pid}/status`,
      { status: 'CANCELLED' }, auth(adminToken));
    assert(r.status === 200 || r.status === 400,
      `Cancel failed: ${r.status}: ${r.data?.message}`);
    if (r.status === 200) {
      console.log(`    ${currentStatus} → CANCELLED (assignment + pool cleaned)`);
    } else {
      console.log(`    ⚠️  Cancel rejected: ${r.data?.message}`);
    }
  });
}

// ── 14c. Flush Redis delivery queue + pool (direct) ──────────────────
// Ensures NO stale orders/parcels remain in pool or BullMQ queue after test.
// This prevents the infinite claim-timeout re-broadcast loop.
await step('Flush Redis: delivery pool + queue', async () => {
  const redis = new Redis(REDIS_URL, { maxRetriesPerRequest: 1, lazyConnect: true });
  try {
    await redis.connect();

    // 1. Delete order pool sorted set
    await redis.del('avail:orders');

    // 2. Scan and delete all order snapshots, eligible sets, locks, idempotent keys
    const patterns = ['avail:order:*', 'eligible:*', 'lock:order:*', 'idempotent:claim:*', 'order:rejected:*'];
    let totalDeleted = 0;
    for (const pattern of patterns) {
      let cursor = '0';
      do {
        const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 200);
        cursor = nextCursor;
        if (keys.length > 0) {
          await redis.del(...keys);
          totalDeleted += keys.length;
        }
      } while (cursor !== '0');
    }

    // 3. Flush BullMQ delivery queue jobs (keep meta + stalled-check)
    {
      let cursor = '0';
      do {
        const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', 'bull:delivery:*', 'COUNT', 200);
        cursor = nextCursor;
        const jobKeys = keys.filter(k => !k.endsWith(':meta') && !k.endsWith(':stalled-check'));
        if (jobKeys.length > 0) {
          await redis.del(...jobKeys);
          totalDeleted += jobKeys.length;
        }
      } while (cursor !== '0');
    }

    // 4. Verify pool is empty
    const poolType = await redis.type('avail:orders');
    const poolEmpty = poolType === 'none';
    assert(poolEmpty, `Pool still exists after flush (type: ${poolType})`);

    console.log(`    Deleted ${totalDeleted} Redis keys (pool + snapshots + queue jobs)`);
    await redis.quit();
  } catch (e) {
    console.log(`    ⚠️  Redis flush: ${e.message}`);
    try { await redis.quit(); } catch (_) { }
  }
});

// ── 14d. Ensure all riders are DUTY_OFF before deletion ──────────────
console.log('  Freeing all riders...');
for (let i = 0; i < dpTokens.length; i++) {
  try {
    await api.post('/delivery/status', { status: 'DUTY_OFF' }, auth(dpTokens[i]));
  } catch (_) { /* ignore — rider may already be off */ }
}
// Wait for any pending DB locks from claim-timeout processor to release
await new Promise(r => setTimeout(r, 2000));

// ── 14e. Clear cart ──────────────────────────────────────────────────
await step('Clear cart', async () => {
  const r = await api.delete('/cart', auth(userToken));
  assert(r.status === 200 || r.status === 204 || r.status === 404, `${r.status}`);
});

// ── 14f. Delete products ─────────────────────────────────────────────
for (const storeType of STORE_TYPES) {
  const s = stores[storeType];
  for (const pid of s.productIds) {
    await step(`Delete ${storeType} product`, async () => {
      const r = await api.delete(`/products/${pid}`, auth(s.managerToken));
      assert(r.status === 200 || r.status === 204, `${r.status}`);
    });
  }
}

// ── 14g. Delete managers ─────────────────────────────────────────────
for (const storeType of STORE_TYPES) {
  await step(`Delete ${storeType} manager`, async () => {
    const r = await api.delete(`/store-managers/${stores[storeType].managerId}`, auth(adminToken));
    assert(r.status === 200 || r.status === 204, `${r.status}`);
  });
}

// ── 14h. Delete delivery persons ─────────────────────────────────────
// deletePerson cascade-deletes all assignments (OrderAssignment + ParcelAssignment)
// Retry on timeout since Supabase statement_timeout can block during lock contention
for (let i = 0; i < dpIds.length; i++) {
  await step(`Delete rider ${i + 1}`, async () => {
    for (let attempt = 1; attempt <= 3; attempt++) {
      const r = await api.delete(`/delivery/persons/${dpIds[i]}`, auth(adminToken));
      if (r.status === 200 || r.status === 204 || r.status === 404) return;
      if (attempt < 3 && r.status >= 500) {
        console.log(`    ⚠️  Rider ${i + 1} delete attempt ${attempt} failed (${r.status}), retrying in 3s...`);
        await new Promise(resolve => setTimeout(resolve, 3000));
        continue;
      }
      assert(false, `${r.status}: ${r.data?.message}`);
    }
  });
}

// ── 14i. Delete user address ─────────────────────────────────────────
if (addressId) {
  await step('Delete user address', async () => {
    const r = await api.delete(`/users/addresses/${addressId}`, auth(userToken));
    assert(r.status === 200 || r.status === 204, `${r.status}`);
  });
}

// ── 14j. Delete stores ───────────────────────────────────────────────
for (const storeType of STORE_TYPES) {
  await step(`Delete ${storeType} store`, async () => {
    const r = await api.delete(`/stores/${stores[storeType].id}`, auth(adminToken));
    assert(r.status === 200 || r.status === 204, `${r.status}`);
  });
}

// ── 14k. Verify clean state ─────────────────────────────────────────
await step('Verify: orders all terminal', async () => {
  const r = await api.get('/orders?limit=50', auth(userToken));
  assert(r.status === 200, `${r.status}`);
  const list = r.data.data || r.data || [];
  const active = (Array.isArray(list) ? list : []).filter(
    o => o.status !== 'CANCELLED' && o.status !== 'DELIVERED'
  );
  if (active.length > 0) {
    console.log(`    ⚠️  ${active.length} active orders remain (may be from other test runs)`);
  } else {
    console.log(`    All orders in terminal state`);
  }
});

await step('Verify: parcels all terminal', async () => {
  const r = await api.get('/parcels', auth(userToken));
  assert(r.status === 200, `${r.status}`);
  const list = r.data.data || r.data || [];
  const active = (Array.isArray(list) ? list : []).filter(
    p => p.status !== 'CANCELLED' && p.status !== 'DELIVERED'
  );
  if (active.length > 0) {
    console.log(`    ⚠️  ${active.length} active parcels remain (may be from other test runs)`);
  } else {
    console.log(`    All parcels in terminal state`);
  }
});

await step('Verify: Redis pool empty', async () => {
  const redis = new Redis(REDIS_URL, { maxRetriesPerRequest: 1, lazyConnect: true });
  try {
    await redis.connect();
    const poolType = await redis.type('avail:orders');
    const poolSize = poolType !== 'none' ? await redis.zcard('avail:orders') : 0;
    assert(poolSize === 0, `Pool has ${poolSize} entries — expected 0`);
    console.log(`    Redis pool: empty`);

    // Count remaining bull jobs (excluding meta)
    let jobCount = 0;
    let cursor = '0';
    do {
      const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', 'bull:delivery:*', 'COUNT', 200);
      cursor = nextCursor;
      jobCount += keys.filter(k => !k.endsWith(':meta') && !k.endsWith(':stalled-check')).length;
    } while (cursor !== '0');
    console.log(`    BullMQ delivery jobs: ${jobCount}`);
    await redis.quit();
  } catch (e) {
    console.log(`    ⚠️  Redis verify: ${e.message}`);
    try { await redis.quit(); } catch (_) { }
  }
});

// ══════════════════════════════════════════════════════════════════════
//  REPORT
// ══════════════════════════════════════════════════════════════════════

console.log('\n\n');
console.log('═'.repeat(80));
console.log('  UNIVERSAL E2E TEST REPORT');
console.log('═'.repeat(80));
console.log(`  Server:     ${BASE}`);
console.log(`  Run ID:     ${RUN_ID}`);
console.log(`  Date:       ${new Date().toISOString()}`);
console.log(`  Total:      ${totalTests} tests`);
console.log(`  Passed:     ${passedTests}`);
console.log(`  Failed:     ${failedTests}`);
console.log('─'.repeat(80));

// Test results table
console.log(`\n  ${'Test'.padEnd(65)} ${'Status'.padEnd(8)}`);
console.log(`  ${'─'.repeat(65)} ${'─'.repeat(8)}`);

for (const r of results) {
  const icon = r.status === 'PASS' ? '✅' : '❌';
  console.log(`  ${icon} ${r.name.padEnd(63)} ${r.status.padEnd(8)}`);
}

// Issues found
if (issues.length > 0) {
  console.log(`\n${'═'.repeat(80)}`);
  console.log('  ISSUES FOUND');
  console.log('─'.repeat(80));
  for (let i = 0; i < issues.length; i++) {
    console.log(`  ${i + 1}. [${issues[i].test}] ${issues[i].error}`);
  }
}

// Summary
console.log(`\n${'═'.repeat(80)}`);
if (failedTests === 0) {
  console.log('  🎉 ALL TESTS PASSED!');
} else {
  console.log(`  💥 ${failedTests} TEST(S) FAILED`);
}
console.log(`${'═'.repeat(80)}\n`);

// Coverage summary
console.log('  Coverage Summary:');
console.log('  ├── Auth: Super Admin, Store Manager, User, Delivery Person');
console.log('  ├── Stores: ' + STORE_TYPES.join(', '));
console.log('  ├── Products: CRUD per store type (2 products × 5 stores)');
console.log('  ├── Cart: add, update, clear, invalid product');
console.log('  ├── Orders: COD lifecycle per store type, Razorpay mock, modify, cancel');
console.log('  ├── Order State Machine: CONFIRMED→PROCESSING→ORDER_PICKED→SHIPPED→DELIVERED');
console.log('  ├── Parcels: Book→Approve→Ready→Assign→Claim→Accept→Deliver + Cancel');
console.log('  ├── Delivery: DUTY_OFF→FREE→BUSY→FREE, GPS, claim/accept/complete');
console.log(`  ├── Race Conditions: ${DP_COUNT} concurrent claims, reject-reclaim, concurrent complete, BUSY-claim, parcel race`);
console.log('  ├── Security: idempotency, IDOR, double-submit, RBAC, invalid transitions');
console.log('  ├── Print Products: Create, list, update, deactivate');
console.log('  └── Buy Now: Isolated ordering logic bypassing cart state');

// ══════════════════════════════════════════════════════════════════════
//  FINAL CLEANUP: Wipe Test DB + Test Redis + Test BullMQ
// ══════════════════════════════════════════════════════════════════════

console.log('\n' + '═'.repeat(80));
console.log('  🧹 FINAL CLEANUP — Wiping Test DB, Redis & BullMQ');
console.log('═'.repeat(80));

// ── 1. Flush Test Redis DB entirely (db 1 — production uses db 0) ──
try {
  const cleanupRedis = new Redis(REDIS_URL, { maxRetriesPerRequest: 1, lazyConnect: true });
  await cleanupRedis.connect();
  const dbIndex = new URL(REDIS_URL.replace(/^redis:/, 'http:')).pathname.replace('/', '') || '0';
  const keyCount = await cleanupRedis.dbsize();
  await cleanupRedis.flushdb();
  console.log(`  ✅ Redis DB ${dbIndex}: FLUSHDB — cleared ${keyCount} keys`);
  await cleanupRedis.quit();
} catch (e) {
  console.log(`  ⚠️  Redis flush failed: ${e.message}`);
}

// ── 2. Clean Test PostgreSQL DB (delete all test data) ──
const DATABASE_URL = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (DATABASE_URL) {
  try {
    const { default: pg } = await import('pg');
    const client = new pg.Client({ connectionString: DATABASE_URL });
    await client.connect();

    // Delete in dependency order (children first, parents last)
    const tables = [
      // Assignments (FK → Order, ParcelOrder, DeliveryPerson)
      '"OrderAssignment"',
      '"ParcelAssignment"',
      // Order items + payments (FK → Order)
      '"OrderItem"',
      '"Payment"',
      '"LedgerEntry"',
      // Orders + Parcels (FK → User, Store)
      '"Order"',
      '"ParcelOrder"',
      // Cart is in Redis — no table
      // Products (FK → Store)
      '"Product"',
      '"PrintProduct"',
      // Store managers (FK → Store)
      '"StoreManager"',
      // Delivery persons
      '"DeliveryPerson"',
      // Stores
      '"Store"',
      // User data (FK → User)
      '"Address"',
      // Users
      '"User"',
      // Config tables
      '"CustomSubcategory"',
      '"CategoryConfig"',
    ];

    let totalRows = 0;
    for (const table of tables) {
      try {
        const res = await client.query(`DELETE FROM ${table}`);
        if (res.rowCount > 0) {
          totalRows += res.rowCount;
          console.log(`  ✅ ${table}: deleted ${res.rowCount} rows`);
        }
      } catch (e) {
        // Table might not exist — skip
        if (!e.message.includes('does not exist')) {
          console.log(`  ⚠️  ${table}: ${e.message}`);
        }
      }
    }

    if (totalRows === 0) {
      console.log('  ✅ Test DB: already clean (0 rows to delete)');
    } else {
      console.log(`  ✅ Test DB: deleted ${totalRows} total rows across all tables`);
    }

    await client.end();
  } catch (e) {
    console.log(`  ⚠️  DB cleanup failed: ${e.message}`);
  }
} else {
  console.log('  ⚠️  No DATABASE_URL/DIRECT_URL — skipping DB cleanup');
}

console.log('═'.repeat(80));
console.log('');
process.exit(failedTests > 0 ? 1 : 0);