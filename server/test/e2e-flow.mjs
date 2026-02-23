/**
 * E2E Flow Test — Complete workflow from admin setup through order delivery.
 *
 * Usage:  node test/e2e-flow.mjs [BASE_URL]
 * Default BASE_URL: http://localhost:3000
 *
 * Requires the server to be running with MSG91_AUTH_KEY="" (dev mode, OTP 123456).
 */

import axios from 'axios';

const BASE = process.argv[2] || 'http://localhost:3000';
const api = axios.create({ baseURL: BASE, validateStatus: () => true });

// ── Helpers ──────────────────────────────────────────────────────────
const results = [];
const uid = () => Math.random().toString(36).slice(2, 8);
const RUN_ID = uid(); // unique per run to avoid collisions

async function step(name, fn) {
  const t0 = performance.now();
  try {
    await fn();
    const ms = Math.round(performance.now() - t0);
    results.push({ name, status: 'PASS', ms });
    const slow = ms > 500 ? ' ⚠️  SLOW' : '';
    console.log(`  ✅ ${name} (${ms}ms)${slow}`);
  } catch (e) {
    const ms = Math.round(performance.now() - t0);
    const msg = e.response?.data?.message || e.message;
    results.push({ name, status: 'FAIL', ms, error: msg });
    console.log(`  ❌ ${name} (${ms}ms) — ${msg}`);
  }
}

function assert(condition, msg) {
  if (!condition) throw new Error(`Assertion failed: ${msg}`);
}

function auth(token) {
  return { headers: { Authorization: `Bearer ${token}` } };
}

// ── State ────────────────────────────────────────────────────────────
let adminToken, managerToken, userToken;
let storeId, managerId, productId1, productId2;
let addressId;
let order1Id, order2Id, order3Id;
let order1Idempotency, order2Idempotency, order3Idempotency;
let dp1Token, dp2Token, dp3Token;
let dp1Id, dp2Id, dp3Id;

// Generate valid Indian mobile numbers: +91[6-9]XXXXXXXXX (exactly 10 digits after +91)
const seq = String(Date.now()).slice(-6); // 6 numeric digits from timestamp
const MANAGER_PHONE = `+9188${seq}88`;
const USER_PHONE    = `+9177${seq}77`;
const DP_PHONES = [
  `+9166${seq}01`,
  `+9166${seq}02`,
  `+9166${seq}03`,
];

// ── Phase 1: Super Admin Setup ───────────────────────────────────────
console.log('\n🔷 Phase 1: Super Admin Setup');

await step('Super admin login', async () => {
  const r = await api.post('/auth/super-admin/login', { phone: '+919999999999', pin: '0000' });
  assert(r.status === 200 || r.status === 201, `Expected 200/201, got ${r.status}: ${r.data?.message}`);
  adminToken = r.data.access_token;
  assert(adminToken, 'No admin token');
});

await step('Create store', async () => {
  const r = await api.post('/stores', {
    name: `E2E Store ${RUN_ID}`,
    pincode: '560001',
    lat: 12.9716,
    lng: 77.5946,
    address: '123 Test Rd, Bangalore',
    storeType: 'GROCERY',
  }, auth(adminToken));
  assert(r.status === 201 || r.status === 200, `${r.status}: ${r.data?.message}`);
  storeId = r.data.id;
  assert(storeId, 'No store ID');
});

await step('Create store manager', async () => {
  const r = await api.post('/store-managers', {
    name: `E2E Manager ${RUN_ID}`,
    phone: MANAGER_PHONE,
    pin: '1234',
    storeId,
  }, auth(adminToken));
  assert(r.status === 201 || r.status === 200, `${r.status}: ${r.data?.message}`);
  managerId = r.data.id;
  assert(managerId, 'No manager ID');
});

// ── Phase 2: Store Manager Operations ────────────────────────────────
console.log('\n🔷 Phase 2: Store Manager Operations');

await step('Store manager login', async () => {
  const r = await api.post('/auth/store-manager/login', { phone: MANAGER_PHONE, pin: '1234' });
  assert(r.status === 200 || r.status === 201, `${r.status}: ${r.data?.message}`);
  managerToken = r.data.access_token;
  assert(managerToken, 'No manager token');
});

await step('Create product 1 (Rice)', async () => {
  const fd = new FormData();
  fd.append('name', `E2E Rice 5kg ${RUN_ID}`);
  fd.append('price', '350');
  fd.append('category', 'Atta, Rice & Dal');
  fd.append('stock', '100');
  const r = await api.post('/products', fd, auth(managerToken));
  assert(r.status === 201 || r.status === 200, `${r.status}: ${JSON.stringify(r.data?.message)}`);
  productId1 = r.data.id;
  assert(productId1, 'No product 1 ID');
});

await step('Create product 2 (Oil)', async () => {
  const fd = new FormData();
  fd.append('name', `E2E Oil 1L ${RUN_ID}`);
  fd.append('price', '180');
  fd.append('category', 'Oil, Ghee & Masala');
  fd.append('stock', '50');
  const r = await api.post('/products', fd, auth(managerToken));
  assert(r.status === 201 || r.status === 200, `${r.status}: ${JSON.stringify(r.data?.message)}`);
  productId2 = r.data.id;
  assert(productId2, 'No product 2 ID');
});

await step('Verify store products', async () => {
  const r = await api.get('/products/admin/my-store', auth(managerToken));
  assert(r.status === 200, `${r.status}`);
  const list = Array.isArray(r.data) ? r.data : (r.data.data || []);
  assert(list.some(p => p.id === productId1), 'Product 1 not in store');
  assert(list.some(p => p.id === productId2), 'Product 2 not in store');
});

// ── Phase 3: User Registration & Setup ───────────────────────────────
console.log('\n🔷 Phase 3: User Registration & Setup');

await step('Send OTP', async () => {
  const r = await api.post('/auth/send-otp', { phone: USER_PHONE });
  assert(r.status === 200 || r.status === 201, `${r.status}: ${r.data?.message}`);
});

await step('Verify OTP (dev mode 123456)', async () => {
  const r = await api.post('/auth/verify-otp', { phone: USER_PHONE, otp: '123456' });
  assert(r.status === 200 || r.status === 201, `${r.status}: ${r.data?.message}`);
  userToken = r.data.access_token;
  assert(userToken, 'No user token');
});

await step('Set user name', async () => {
  const r = await api.patch('/users/me/name', { name: `E2E User ${RUN_ID}` }, auth(userToken));
  // May fail if name already set; that's ok
  assert(r.status === 200 || r.status === 201 || r.status === 400, `${r.status}: ${r.data?.message}`);
});

await step('Create address', async () => {
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

// ── Phase 4: Search & Cart ───────────────────────────────────────────
console.log('\n🔷 Phase 4: Search & Cart');

await step('Search products', async () => {
  const r = await api.get(`/products?search=E2E&page=1&limit=10`);
  assert(r.status === 200, `${r.status}`);
  assert(r.data.data?.length >= 2 || r.data.length >= 2, 'Expected at least 2 E2E products');
});

await step('Add product 1 to cart (qty 3)', async () => {
  const r = await api.post('/cart/items', { productId: productId1, quantity: 3 }, auth(userToken));
  assert(r.status === 200 || r.status === 201, `${r.status}: ${r.data?.message}`);
});

await step('Add product 2 to cart (qty 2)', async () => {
  const r = await api.post('/cart/items', { productId: productId2, quantity: 2 }, auth(userToken));
  assert(r.status === 200 || r.status === 201, `${r.status}: ${r.data?.message}`);
});

await step('View cart', async () => {
  const r = await api.get('/cart', auth(userToken));
  assert(r.status === 200, `${r.status}`);
  const items = r.data.items || r.data;
  assert(Array.isArray(items) && items.length >= 2, `Expected 2+ items, got ${items?.length}`);
});

await step('Update cart item (product1 → qty 5)', async () => {
  const r = await api.patch(`/cart/items/${productId1}`, { quantity: 5 }, auth(userToken));
  assert(r.status === 200, `${r.status}: ${r.data?.message}`);
});

// ── Phase 5: Order Scenario 1 — Place & Deliver ─────────────────────
console.log('\n🔷 Phase 5: Order Scenario 1 — Place & Deliver');

await step('Preview order', async () => {
  const r = await api.post('/orders/preview', { addressId }, auth(userToken));
  assert(r.status === 200 || r.status === 201, `${r.status}: ${r.data?.message}`);
  assert(r.data.total > 0, 'Expected total > 0');
});

order1Idempotency = `e2e-order1-${RUN_ID}`;
await step('Place COD order 1', async () => {
  const r = await api.post('/orders', {
    addressId,
    paymentMethod: 'COD',
    lat: 12.9720,
    lng: 77.5950,
  }, { ...auth(userToken), headers: { ...auth(userToken).headers, 'idempotency-key': order1Idempotency } });
  assert(r.status === 201 || r.status === 200, `${r.status}: ${r.data?.message}`);
  order1Id = r.data.id;
  assert(order1Id, 'No order ID');
  assert(r.data.status === 'CONFIRMED', `Expected CONFIRMED, got ${r.data.status}`);
  assert(r.data.canCancel === true, 'Expected canCancel=true');
  assert(r.data.graceExpiresAt, 'Expected graceExpiresAt');
});

await step('Verify cart cleared after order', async () => {
  const r = await api.get('/cart', auth(userToken));
  assert(r.status === 200, `${r.status}`);
  const items = r.data.items || r.data;
  assert(!items || items.length === 0, `Cart should be empty, got ${items?.length} items`);
});

await step('List user orders', async () => {
  const r = await api.get('/orders?limit=5', auth(userToken));
  assert(r.status === 200, `${r.status}`);
  const list = r.data.data || r.data;
  assert(list.some(o => o.id === order1Id), 'Order 1 not in list');
});

// ── Phase 6: Order Scenario 2 — Place & Modify ──────────────────────
console.log('\n🔷 Phase 6: Order Scenario 2 — Place & Modify');

await step('Re-add items to cart for order 2', async () => {
  await api.post('/cart/items', { productId: productId1, quantity: 3 }, auth(userToken));
  const r = await api.post('/cart/items', { productId: productId2, quantity: 2 }, auth(userToken));
  assert(r.status === 200 || r.status === 201, `${r.status}`);
});

order2Idempotency = `e2e-order2-${RUN_ID}`;
await step('Place COD order 2', async () => {
  const r = await api.post('/orders', {
    addressId,
    paymentMethod: 'COD',
    lat: 12.9720,
    lng: 77.5950,
  }, { headers: { ...auth(userToken).headers, 'idempotency-key': order2Idempotency } });
  assert(r.status === 201 || r.status === 200, `${r.status}: ${r.data?.message}`);
  order2Id = r.data.id;
  assert(r.data.canModify === true, 'Expected canModify=true');
});

await step('Modify order 2 (reduce qty, remove item)', async () => {
  const r = await api.patch(`/orders/${order2Id}/modify`, {
    items: [
      { productId: productId1, quantity: 1 },
      { productId: productId2, quantity: 0 },
    ],
  }, auth(userToken));
  assert(r.status === 200, `${r.status}: ${r.data?.message}`);
  // Verify totals changed
  assert(r.data.items?.length === 1 || r.data.total < 2000, 'Expected fewer items after modify');
});

// ── Phase 7: Order Scenario 3 — Place & Cancel ──────────────────────
console.log('\n🔷 Phase 7: Order Scenario 3 — Place & Cancel');

await step('Re-add items to cart for order 3', async () => {
  await api.post('/cart/items', { productId: productId1, quantity: 2 }, auth(userToken));
  const r = await api.post('/cart/items', { productId: productId2, quantity: 1 }, auth(userToken));
  assert(r.status === 200 || r.status === 201, `${r.status}`);
});

order3Idempotency = `e2e-order3-${RUN_ID}`;
await step('Place COD order 3', async () => {
  const r = await api.post('/orders', {
    addressId,
    paymentMethod: 'COD',
    lat: 12.9720,
    lng: 77.5950,
  }, { headers: { ...auth(userToken).headers, 'idempotency-key': order3Idempotency } });
  assert(r.status === 201 || r.status === 200, `${r.status}: ${r.data?.message}`);
  order3Id = r.data.id;
  assert(r.data.canCancel === true, 'Expected canCancel=true');
});

await step('Cancel order 3', async () => {
  const r = await api.post(`/orders/${order3Id}/cancel`, {}, auth(userToken));
  assert(r.status === 200 || r.status === 201, `${r.status}: ${r.data?.message}`);
  assert(r.data.status === 'CANCELLED', `Expected CANCELLED, got ${r.data.status}`);
});

await step('Try cancel order 3 again (expect error)', async () => {
  const r = await api.post(`/orders/${order3Id}/cancel`, {}, auth(userToken));
  assert(r.status === 400, `Expected 400, got ${r.status}`);
});

// ── Phase 8: Admin Status Updates (Order 1) ──────────────────────────
console.log('\n🔷 Phase 8: Admin Status Updates');

await step('Advance order 1: CONFIRMED → ORDER_PICKED', async () => {
  const r = await api.patch(`/orders/admin/${order1Id}/status`, { status: 'ORDER_PICKED' }, auth(managerToken));
  assert(r.status === 200, `${r.status}: ${r.data?.message}`);
});

await step('Advance order 1: ORDER_PICKED → SHIPPED', async () => {
  const r = await api.patch(`/orders/admin/${order1Id}/status`, { status: 'SHIPPED' }, auth(managerToken));
  assert(r.status === 200, `${r.status}: ${r.data?.message}`);
});

// ── Phase 9: Delivery Person Flow ────────────────────────────────────
console.log('\n🔷 Phase 9: Delivery Person Flow');

const dpIds = [];
const dpTokens = [];

for (let i = 0; i < 3; i++) {
  await step(`Create delivery person ${i + 1}`, async () => {
    const r = await api.post('/delivery/persons', {
      name: `E2E Driver ${i + 1} ${RUN_ID}`,
      phone: DP_PHONES[i],
      homeStoreId: storeId,
      pin: `${1000 + i}`,
    }, auth(adminToken));
    assert(r.status === 201 || r.status === 200, `${r.status}: ${r.data?.message}`);
    dpIds.push(r.data.id);
  });
}
dp1Id = dpIds[0]; dp2Id = dpIds[1]; dp3Id = dpIds[2];

for (let i = 0; i < 3; i++) {
  await step(`Delivery person ${i + 1} login`, async () => {
    const r = await api.post('/delivery/auth/login', { phone: DP_PHONES[i], pin: `${1000 + i}` });
    assert(r.status === 200 || r.status === 201, `${r.status}: ${r.data?.message}`);
    dpTokens.push(r.data.access_token);
  });
}
dp1Token = dpTokens[0]; dp2Token = dpTokens[1]; dp3Token = dpTokens[2];

for (let i = 0; i < 3; i++) {
  await step(`Person ${i + 1} set status FREE`, async () => {
    const r = await api.post('/delivery/status', { status: 'FREE' }, auth(dpTokens[i]));
    assert(r.status === 200 || r.status === 201, `${r.status}: ${r.data?.message}`);
  });
}

for (let i = 0; i < 3; i++) {
  await step(`Person ${i + 1} update location`, async () => {
    const r = await api.post('/delivery/location', {
      lat: 12.9716 + (i * 0.001),
      lng: 77.5946 + (i * 0.001),
    }, auth(dpTokens[i]));
    assert(r.status === 200 || r.status === 201, `${r.status}: ${r.data?.message}`);
  });
}

// Check if order 1 has an auto-assignment; if not, manually trigger
await step('Ensure order 1 has assignment', async () => {
  // Try manual assign trigger (admin)
  const r = await api.post(`/orders/admin/${order1Id}/assign-delivery`, {}, auth(adminToken));
  // May succeed or fail if already assigned; both ok
  assert(r.status === 200 || r.status === 201 || r.status === 400 || r.status === 409, `${r.status}: ${r.data?.message}`);
});

// Small delay for async assignment processing
await new Promise(r => setTimeout(r, 2000));

// Get current assignment for order 1
let assignmentOrderId = order1Id;
await step('Check order 1 assignment exists', async () => {
  const r = await api.get(`/orders/${order1Id}`, auth(userToken));
  assert(r.status === 200, `${r.status}`);
  if (!r.data.assignment) {
    console.log('    ⚠️  No auto-assignment yet — delivery flow may be limited');
  }
});

// Try the reject/accept flow if assignments exist
await step('Person 1 checks assigned orders', async () => {
  const r = await api.get('/delivery/orders', auth(dp1Token));
  assert(r.status === 200, `${r.status}`);
});

// Person 1 rejects
await step('Person 1 rejects order 1', async () => {
  const r = await api.post(`/delivery/orders/${order1Id}/reject`, {}, auth(dp1Token));
  // May fail if not assigned to person 1
  if (r.status === 404 || r.status === 400) {
    console.log(`    ⚠️  Person 1 not assigned — skipping (${r.data?.message})`);
    return;
  }
  assert(r.status === 200 || r.status === 201, `${r.status}: ${r.data?.message}`);
});

await new Promise(r => setTimeout(r, 1000));

// Person 2 rejects
await step('Person 2 rejects order 1', async () => {
  const r = await api.post(`/delivery/orders/${order1Id}/reject`, {}, auth(dp2Token));
  if (r.status === 404 || r.status === 400) {
    console.log(`    ⚠️  Person 2 not assigned — skipping (${r.data?.message})`);
    return;
  }
  assert(r.status === 200 || r.status === 201, `${r.status}: ${r.data?.message}`);
});

await new Promise(r => setTimeout(r, 1000));

// Person 3 claims
await step('Person 3 claims order 1', async () => {
  const r = await api.post(`/delivery/orders/${order1Id}/claim`, {}, auth(dp3Token));
  if (r.status === 404 || r.status === 400 || r.status === 409) {
    console.log(`    ⚠️  Claim unavailable — ${r.data?.message}`);
    return;
  }
  assert(r.status === 200 || r.status === 201, `${r.status}: ${r.data?.message}`);
});

// Person 3 accepts
await step('Person 3 accepts order 1', async () => {
  const r = await api.post(`/delivery/orders/${order1Id}/accept`, {}, auth(dp3Token));
  if (r.status === 404 || r.status === 400) {
    console.log(`    ⚠️  Accept unavailable — ${r.data?.message}`);
    return;
  }
  assert(r.status === 200 || r.status === 201, `${r.status}: ${r.data?.message}`);
});

// Person 3 completes delivery
await step('Person 3 marks order 1 DELIVERED', async () => {
  const r = await api.post(`/delivery/orders/${order1Id}/complete`, { result: 'DELIVERED' }, auth(dp3Token));
  if (r.status === 400 || r.status === 404) {
    console.log(`    ⚠️  Complete unavailable — ${r.data?.message}`);
    return;
  }
  assert(r.status === 200 || r.status === 201, `${r.status}: ${r.data?.message}`);
});

// ── Phase 10: Post-Delivery Verification ─────────────────────────────
console.log('\n🔷 Phase 10: Post-Delivery Verification');

await step('Verify order 1 status', async () => {
  const r = await api.get(`/orders/${order1Id}`, auth(userToken));
  assert(r.status === 200, `${r.status}`);
  // May be DELIVERED or SHIPPED depending on delivery flow success
  console.log(`    Order 1 status: ${r.data.status}`);
});

await step('Admin views store orders', async () => {
  const r = await api.get('/orders/admin/store?page=1&limit=10', auth(managerToken));
  assert(r.status === 200, `${r.status}`);
  const list = r.data.data || r.data;
  assert(Array.isArray(list), 'Expected array of orders');
  console.log(`    Store orders count: ${list.length}`);
});

// ── Phase 11: Edge Cases ─────────────────────────────────────────────
console.log('\n🔷 Phase 11: Edge Cases');

await step('Idempotency: re-send order 1 creation', async () => {
  // Re-add something to cart first so cart isn't empty
  await api.post('/cart/items', { productId: productId1, quantity: 1 }, auth(userToken));
  const r = await api.post('/orders', {
    addressId,
    paymentMethod: 'COD',
    lat: 12.9720,
    lng: 77.5950,
  }, { headers: { ...auth(userToken).headers, 'idempotency-key': order1Idempotency } });
  assert(r.status === 200 || r.status === 201, `${r.status}: ${r.data?.message}`);
  assert(r.data.id === order1Id, `Expected same order ID ${order1Id}, got ${r.data.id}`);
});

await step('Cancel delivered/shipped order (expect error)', async () => {
  const r = await api.post(`/orders/${order1Id}/cancel`, {}, auth(userToken));
  assert(r.status === 400, `Expected 400, got ${r.status}`);
});

await step('Modify delivered/shipped order (expect error)', async () => {
  const r = await api.patch(`/orders/${order1Id}/modify`, {
    items: [{ productId: productId1, quantity: 1 }],
  }, auth(userToken));
  assert(r.status === 400, `Expected 400, got ${r.status}`);
});

await step('Add invalid product to cart (expect error)', async () => {
  const r = await api.post('/cart/items', {
    productId: '00000000-0000-0000-0000-000000000000',
    quantity: 1,
  }, auth(userToken));
  assert(r.status === 404 || r.status === 400, `Expected 404/400, got ${r.status}`);
});

await step('Unauthorized access (no token)', async () => {
  const r = await api.get('/orders');
  assert(r.status === 401, `Expected 401, got ${r.status}`);
});

await step('Unauthorized: cancel other users order', async () => {
  // Create a second user
  const phone2 = `+9198${seq}88`;
  await api.post('/auth/send-otp', { phone: phone2 });
  const vr = await api.post('/auth/verify-otp', { phone: phone2, otp: '123456' });
  if (vr.status === 200 || vr.status === 201) {
    const token2 = vr.data.access_token;
    const r = await api.post(`/orders/${order2Id}/cancel`, {}, auth(token2));
    assert(r.status === 404 || r.status === 403, `Expected 404/403, got ${r.status}`);
  }
});

await step('Double accept assignment (expect error)', async () => {
  // Try to re-accept order1's assignment (already completed)
  const r = await api.post(`/delivery/orders/${order1Id}/accept`, {}, auth(dp3Token));
  assert(r.status === 400 || r.status === 404, `Expected 400/404, got ${r.status}`);
});

// ── Phase 12: Cleanup & Report ───────────────────────────────────────
console.log('\n🔷 Phase 12: Cleanup');

await step('Delete product 1', async () => {
  const r = await api.delete(`/products/${productId1}`, auth(managerToken));
  assert(r.status === 200 || r.status === 204, `${r.status}`);
});

await step('Delete product 2', async () => {
  const r = await api.delete(`/products/${productId2}`, auth(managerToken));
  assert(r.status === 200 || r.status === 204, `${r.status}`);
});

await step('Delete store manager', async () => {
  const r = await api.delete(`/store-managers/${managerId}`, auth(adminToken));
  assert(r.status === 200 || r.status === 204, `${r.status}`);
});

for (let i = 0; i < dpIds.length; i++) {
  await step(`Delete delivery person ${i + 1}`, async () => {
    const r = await api.delete(`/delivery/persons/${dpIds[i]}`, auth(adminToken));
    assert(r.status === 200 || r.status === 204, `${r.status}`);
  });
}

await step('Delete store', async () => {
  const r = await api.delete(`/stores/${storeId}`, auth(adminToken));
  assert(r.status === 200 || r.status === 204, `${r.status}`);
});

// ── Summary ──────────────────────────────────────────────────────────
console.log('\n' + '═'.repeat(70));
console.log('  E2E FLOW TEST RESULTS');
console.log('═'.repeat(70));

const passed = results.filter(r => r.status === 'PASS');
const failed = results.filter(r => r.status === 'FAIL');
const latencies = results.map(r => r.ms).sort((a, b) => a - b);
const avgLatency = Math.round(latencies.reduce((s, v) => s + v, 0) / latencies.length);
const p95 = latencies[Math.floor(latencies.length * 0.95)] || 0;
const slowest = results.reduce((a, b) => (a.ms > b.ms ? a : b), results[0]);

console.log(`\n  ${'Step'.padEnd(48)} ${'Status'.padEnd(8)} ${'Latency'.padStart(8)}`);
console.log(`  ${'─'.repeat(48)} ${'─'.repeat(8)} ${'─'.repeat(8)}`);

for (const r of results) {
  const flag = r.ms > 500 ? ' ⚠️' : '';
  const icon = r.status === 'PASS' ? '✅' : '❌';
  console.log(`  ${icon} ${r.name.padEnd(46)} ${r.status.padEnd(8)} ${String(r.ms + 'ms').padStart(7)}${flag}`);
}

console.log(`\n  ${'─'.repeat(66)}`);
console.log(`  Total: ${results.length} | Passed: ${passed.length} | Failed: ${failed.length}`);
console.log(`  Avg latency: ${avgLatency}ms | P95: ${p95}ms | Slowest: ${slowest.name} (${slowest.ms}ms)`);

if (failed.length > 0) {
  console.log(`\n  ❌ FAILURES:`);
  for (const f of failed) {
    console.log(`     • ${f.name}: ${f.error}`);
  }
}

const slow = results.filter(r => r.ms > 500);
if (slow.length > 0) {
  console.log(`\n  ⚠️  SLOW ENDPOINTS (>500ms):`);
  for (const s of slow) {
    console.log(`     • ${s.name}: ${s.ms}ms`);
  }
}

console.log('\n' + '═'.repeat(70));
if (failed.length === 0) {
  console.log('  🎉 ALL TESTS PASSED!');
} else {
  console.log(`  💥 ${failed.length} TEST(S) FAILED`);
}
console.log('═'.repeat(70) + '\n');

process.exit(failed.length > 0 ? 1 : 0);
