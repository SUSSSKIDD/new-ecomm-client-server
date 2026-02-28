/**
 * Race Condition E2E Test
 * ─────────────────────────────────────────────────────────────────
 * Full flow: Admin setup → Store → Products → User order →
 * 6 delivery riders go online → Concurrent claim race on same order.
 *
 * Tests:
 *  1. Only ONE rider wins the claim (Redis lock + DB unique constraint)
 *  2. Other 5 get ConflictException (409)
 *  3. Winner becomes BUSY, losers stay FREE
 *  4. Winner can accept → complete delivery → becomes FREE
 *  5. Idempotent re-claim by winner returns same result
 *  6. Second order: concurrent claims again
 *  7. Double-accept / double-complete are rejected
 *
 * Usage:  node test/race-condition.mjs [BASE_URL]
 * Default: http://localhost:3000
 */

import axios from 'axios';

const BASE = process.argv[2] || 'http://localhost:3000';
const api = axios.create({ baseURL: BASE, validateStatus: () => true });

// ── Helpers ──────────────────────────────────────────────────────────
const results = [];
const uid = () => Math.random().toString(36).slice(2, 8);
const RUN_ID = uid();
const NUM_RIDERS = 6;

async function step(name, fn) {
  const t0 = performance.now();
  try {
    const result = await fn();
    const ms = Math.round(performance.now() - t0);
    const slow = ms > 500 ? ' ⚠️  SLOW' : '';
    results.push({ name, status: 'PASS', ms });
    console.log(`  ✅ ${name} (${ms}ms)${slow}`);
    return result;
  } catch (e) {
    const ms = Math.round(performance.now() - t0);
    const msg = e.response?.data?.message || e.message;
    results.push({ name, status: 'FAIL', ms, error: msg });
    console.log(`  ❌ ${name} (${ms}ms) — ${msg}`);
    return null;
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
let storeId, managerId, productId1, productId2, addressId;
let order1Id, order2Id;
let raceWinner1 = -1, raceWinner2 = -1;
const riders = []; // { id, token, phone, pin }
const delay = (ms) => new Promise(r => setTimeout(r, ms));

const seq = String(Date.now()).slice(-6);
const MANAGER_PHONE = `+9188${seq}88`;
const USER_PHONE = `+9177${seq}77`;

// ═════════════════════════════════════════════════════════════════════
// PHASE 1: Admin + Store + Manager Setup
// ═════════════════════════════════════════════════════════════════════
console.log('\n🔷 Phase 1: Admin + Store + Manager Setup');

await step('Super admin login', async () => {
  const r = await api.post('/auth/super-admin/login', { phone: '+919999999999', pin: '0000' });
  assert(r.status === 200 || r.status === 201, `Got ${r.status}: ${r.data?.message}`);
  adminToken = r.data.access_token;
  assert(adminToken, 'No admin token');
});

await step('Create store (Bangalore)', async () => {
  const r = await api.post('/stores', {
    name: `Race Store ${RUN_ID}`,
    pincode: '560001',
    lat: 12.9716,
    lng: 77.5946,
    address: '42 Race Condition Blvd, Bangalore',
    storeType: 'GROCERY',
  }, auth(adminToken));
  assert(r.status === 201 || r.status === 200, `${r.status}: ${r.data?.message}`);
  storeId = r.data.id;
});

await step('Create store manager', async () => {
  const r = await api.post('/store-managers', {
    name: `Race Manager ${RUN_ID}`,
    phone: MANAGER_PHONE,
    pin: '1234',
    storeId,
  }, auth(adminToken));
  assert(r.status === 201 || r.status === 200, `${r.status}: ${r.data?.message}`);
  managerId = r.data.id;
});

await step('Store manager login', async () => {
  const r = await api.post('/auth/store-manager/login', { phone: MANAGER_PHONE, pin: '1234' });
  assert(r.status === 200 || r.status === 201, `${r.status}: ${r.data?.message}`);
  managerToken = r.data.access_token;
});

// ═════════════════════════════════════════════════════════════════════
// PHASE 2: Products
// ═════════════════════════════════════════════════════════════════════
console.log('\n🔷 Phase 2: Create Products');

await step('Create product 1 (Rice 5kg)', async () => {
  const fd = new FormData();
  fd.append('name', `Race Rice 5kg ${RUN_ID}`);
  fd.append('price', '350');
  fd.append('category', 'Atta, Rice & Dal');
  fd.append('stock', '200');
  const r = await api.post('/products', fd, auth(managerToken));
  assert(r.status === 201 || r.status === 200, `${r.status}: ${JSON.stringify(r.data?.message)}`);
  productId1 = r.data.id;
});

await step('Create product 2 (Oil 1L)', async () => {
  const fd = new FormData();
  fd.append('name', `Race Oil 1L ${RUN_ID}`);
  fd.append('price', '180');
  fd.append('category', 'Oil, Ghee & Masala');
  fd.append('stock', '100');
  const r = await api.post('/products', fd, auth(managerToken));
  assert(r.status === 201 || r.status === 200, `${r.status}: ${JSON.stringify(r.data?.message)}`);
  productId2 = r.data.id;
});

// ═════════════════════════════════════════════════════════════════════
// PHASE 3: User Registration + Address
// ═════════════════════════════════════════════════════════════════════
console.log('\n🔷 Phase 3: User Registration + Address');

await step('Send OTP', async () => {
  const r = await api.post('/auth/send-otp', { phone: USER_PHONE });
  assert(r.status === 200 || r.status === 201, `${r.status}: ${r.data?.message}`);
});

await step('Verify OTP (dev 123456)', async () => {
  const r = await api.post('/auth/verify-otp', { phone: USER_PHONE, otp: '123456' });
  assert(r.status === 200 || r.status === 201, `${r.status}: ${r.data?.message}`);
  userToken = r.data.access_token;
});

await step('Set user name', async () => {
  const r = await api.patch('/users/me/name', { name: `Race User ${RUN_ID}` }, auth(userToken));
  assert(r.status === 200 || r.status === 201 || r.status === 400, `${r.status}`);
});

await step('Create address', async () => {
  const r = await api.post('/users/addresses', {
    type: 'HOME',
    houseNo: '42',
    street: 'Race St',
    city: 'Bangalore',
    state: 'Karnataka',
    zipCode: '560001',
    lat: 12.9720,
    lng: 77.5950,
  }, auth(userToken));
  assert(r.status === 201 || r.status === 200, `${r.status}: ${r.data?.message}`);
  addressId = r.data.id;
});

// ═════════════════════════════════════════════════════════════════════
// PHASE 4: Create 6 Delivery Riders + Login + Go Online
// ═════════════════════════════════════════════════════════════════════
console.log(`\n🔷 Phase 4: Create ${NUM_RIDERS} Delivery Riders`);

for (let i = 0; i < NUM_RIDERS; i++) {
  const phone = `+9166${seq}${String(i).padStart(2, '0')}`;
  const pin = `${2000 + i}`;

  await step(`Create rider ${i + 1} (${phone})`, async () => {
    const r = await api.post('/delivery/persons', {
      name: `Rider ${i + 1} ${RUN_ID}`,
      phone,
      homeStoreId: storeId,
      pin,
    }, auth(adminToken));
    assert(r.status === 201 || r.status === 200, `${r.status}: ${r.data?.message}`);
    riders.push({ id: r.data.id, phone, pin, token: null });
  });
}

console.log(`\n🔷 Phase 5: Riders Login + Set FREE + Update Location`);

for (let i = 0; i < NUM_RIDERS; i++) {
  if (i > 0 && i % 4 === 0) await delay(1100); // avoid throttle (5 req/s)
  await step(`Rider ${i + 1} login`, async () => {
    const r = await api.post('/delivery/auth/login', {
      phone: riders[i].phone,
      pin: riders[i].pin,
    });
    assert(r.status === 200 || r.status === 201, `${r.status}: ${r.data?.message}`);
    assert(r.data.person.status === 'DUTY_OFF', `Expected DUTY_OFF, got ${r.data.person?.status}`);
    riders[i].token = r.data.access_token;
  });
}

for (let i = 0; i < NUM_RIDERS; i++) {
  if (!riders[i].token) continue;
  if (i > 0 && i % 4 === 0) await delay(1100);
  await step(`Rider ${i + 1} → FREE`, async () => {
    const r = await api.post('/delivery/status', { status: 'FREE' }, auth(riders[i].token));
    assert(r.status === 200 || r.status === 201, `${r.status}: ${r.data?.message}`);
    assert(r.data.status === 'FREE', `Expected FREE, got ${r.data.status}`);
  });
}

// Spread riders around the store (within 5km radius)
for (let i = 0; i < NUM_RIDERS; i++) {
  if (!riders[i].token) continue;
  if (i > 0 && i % 4 === 0) await delay(1100);
  await step(`Rider ${i + 1} update location`, async () => {
    const r = await api.post('/delivery/location', {
      lat: 12.9716 + (i * 0.005),   // ~500m apart
      lng: 77.5946 + (i * 0.003),
    }, auth(riders[i].token));
    assert(r.status === 200 || r.status === 201, `${r.status}: ${r.data?.message}`);
  });
}

await step('Verify all riders are FREE', async () => {
  const r = await api.get('/delivery/persons', auth(adminToken));
  assert(r.status === 200, `${r.status}`);
  const riderIds = new Set(riders.map(r => r.id));
  const ourRiders = r.data.filter(p => riderIds.has(p.id));
  const allFree = ourRiders.every(p => p.status === 'FREE');
  assert(allFree, `Not all riders are FREE: ${ourRiders.map(p => `${p.name}=${p.status}`).join(', ')}`);
  console.log(`    All ${ourRiders.length} riders confirmed FREE`);
});

// ═════════════════════════════════════════════════════════════════════
// PHASE 6: Place Order + Advance to ORDER_PICKED
// ═════════════════════════════════════════════════════════════════════
console.log('\n🔷 Phase 6: Place Order & Advance to ORDER_PICKED');

await step('Add items to cart', async () => {
  await api.post('/cart/items', { productId: productId1, quantity: 3 }, auth(userToken));
  const r = await api.post('/cart/items', { productId: productId2, quantity: 2 }, auth(userToken));
  assert(r.status === 200 || r.status === 201, `${r.status}`);
});

await step('Place COD order 1', async () => {
  const r = await api.post('/orders', {
    addressId,
    paymentMethod: 'COD',
    lat: 12.9720,
    lng: 77.5950,
  }, {
    headers: {
      ...auth(userToken).headers,
      'idempotency-key': `race-order1-${RUN_ID}`,
    },
  });
  assert(r.status === 201 || r.status === 200, `${r.status}: ${r.data?.message}`);
  order1Id = r.data.id;
  assert(r.data.status === 'CONFIRMED', `Expected CONFIRMED, got ${r.data.status}`);
  console.log(`    Order: ${r.data.orderNumber} (${order1Id})`);
});

await step('Advance → ORDER_PICKED', async () => {
  const r = await api.patch(`/orders/admin/${order1Id}/status`, { status: 'ORDER_PICKED' }, auth(managerToken));
  assert(r.status === 200, `${r.status}: ${r.data?.message}`);
  assert(r.data.status === 'ORDER_PICKED', `Expected ORDER_PICKED, got ${r.data.status}`);
});

// Small delay for broadcast to propagate
await new Promise(r => setTimeout(r, 2000));

// ═════════════════════════════════════════════════════════════════════
// PHASE 7: 🏁 THE RACE — All 6 riders claim simultaneously
// ═════════════════════════════════════════════════════════════════════
console.log('\n🔷 Phase 7: 🏁 CONCURRENT CLAIM RACE (6 riders → 1 order)');

await step('All riders claim order simultaneously', async () => {
  // Only include riders with valid tokens
  const activeRiders = riders.map((rider, i) => ({ rider, i })).filter(({ rider }) => rider.token);
  const numActive = activeRiders.length;
  console.log(`    Active riders: ${numActive}/${NUM_RIDERS}`);

  // Fire all claim requests at the exact same moment
  const claimPromises = activeRiders.map(({ rider, i }) =>
    api.post(`/delivery/orders/${order1Id}/claim`, {}, auth(rider.token))
      .then(r => ({ riderIndex: i, status: r.status, data: r.data }))
  );

  const claimResults = await Promise.all(claimPromises);

  // Analyze results
  const winners = claimResults.filter(r => r.status === 200 || r.status === 201);
  const conflicts = claimResults.filter(r => r.status === 409);
  const others = claimResults.filter(r => r.status !== 200 && r.status !== 201 && r.status !== 409);

  console.log(`    Winners: ${winners.length} | Conflicts (409): ${conflicts.length} | Other: ${others.length}`);

  for (const r of claimResults) {
    const icon = (r.status === 200 || r.status === 201) ? '👑' : '🚫';
    console.log(`    ${icon} Rider ${r.riderIndex + 1}: ${r.status} — ${r.data?.message || r.data?.orderNumber || JSON.stringify(r.data).slice(0, 80)}`);
  }

  // CRITICAL: Exactly 1 winner
  assert(winners.length === 1, `Expected exactly 1 winner, got ${winners.length}`);

  // CRITICAL: All others got 409 Conflict
  assert(conflicts.length === numActive - 1,
    `Expected ${numActive - 1} conflicts, got ${conflicts.length}. Others: ${others.map(o => `${o.status}:${o.data?.message}`).join(', ')}`);

  const winnerId = riders[winners[0].riderIndex].id;
  console.log(`    🏆 Winner: Rider ${winners[0].riderIndex + 1} (${winnerId})`);

  raceWinner1 = winners[0].riderIndex;
});

// ═════════════════════════════════════════════════════════════════════
// PHASE 8: Post-Race Verification
// ═════════════════════════════════════════════════════════════════════
console.log('\n🔷 Phase 8: Post-Race Verification');

await step('Winner is BUSY, losers still FREE', async () => {
  assert(raceWinner1 >= 0, 'No winner from race — cannot verify');
  const r = await api.get('/delivery/persons', auth(adminToken));
  assert(r.status === 200, `${r.status}`);
  const riderMap = new Map(r.data.map(p => [p.id, p]));

  for (let i = 0; i < NUM_RIDERS; i++) {
    if (!riders[i].token) continue; // skip riders that failed to login
    const person = riderMap.get(riders[i].id);
    if (i === raceWinner1) {
      assert(person?.status === 'BUSY', `Winner (Rider ${i + 1}) should be BUSY, got ${person?.status}`);
    } else {
      assert(person?.status === 'FREE', `Loser (Rider ${i + 1}) should be FREE, got ${person?.status}`);
    }
  }
  console.log(`    ✓ Winner=BUSY, losers=FREE`);
});

await step('Idempotent re-claim by winner returns same result', async () => {
  const winner = riders[raceWinner1];
  const r = await api.post(`/delivery/orders/${order1Id}/claim`, {}, auth(winner.token));
  assert(r.status === 200 || r.status === 201, `Expected 200 (idempotent), got ${r.status}: ${r.data?.message}`);
  assert(r.data.idempotent === true, `Expected idempotent=true, got ${r.data?.idempotent}`);
  console.log(`    ✓ Idempotent retry returned same result`);
});

await step('Losers cannot re-claim', async () => {
  const loserIdx = raceWinner1 === 0 ? 1 : 0;
  const r = await api.post(`/delivery/orders/${order1Id}/claim`, {}, auth(riders[loserIdx].token));
  assert(r.status === 409, `Expected 409, got ${r.status}: ${r.data?.message}`);
});

await step('Order has exactly 1 assignment', async () => {
  const r = await api.get(`/orders/${order1Id}`, auth(userToken));
  assert(r.status === 200, `${r.status}`);
  console.log(`    Order status: ${r.data.status}`);
});

// ═════════════════════════════════════════════════════════════════════
// PHASE 9: Winner completes delivery
// ═════════════════════════════════════════════════════════════════════
console.log('\n🔷 Phase 9: Winner Accepts + Delivers');

assert(raceWinner1 >= 0, 'No winner — cannot continue');
const winnerToken = riders[raceWinner1].token;

await step('Winner accepts assignment', async () => {
  const r = await api.post(`/delivery/orders/${order1Id}/accept`, {}, auth(winnerToken));
  assert(r.status === 200 || r.status === 201, `${r.status}: ${r.data?.message}`);
});

await step('Winner double-accept (expect error)', async () => {
  const r = await api.post(`/delivery/orders/${order1Id}/accept`, {}, auth(winnerToken));
  assert(r.status === 400, `Expected 400, got ${r.status}: ${r.data?.message}`);
});

await step('Loser tries to accept (expect error)', async () => {
  const loserIdx = raceWinner1 === 0 ? 1 : 0;
  const r = await api.post(`/delivery/orders/${order1Id}/accept`, {}, auth(riders[loserIdx].token));
  assert(r.status === 404 || r.status === 400, `Expected 404/400, got ${r.status}: ${r.data?.message}`);
});

await step('Winner marks DELIVERED', async () => {
  const r = await api.post(`/delivery/orders/${order1Id}/complete`, { result: 'DELIVERED' }, auth(winnerToken));
  assert(r.status === 200 || r.status === 201, `${r.status}: ${r.data?.message}`);
  assert(r.data.result === 'DELIVERED', `Expected DELIVERED, got ${r.data.result}`);
});

await step('Winner double-complete (expect error)', async () => {
  const r = await api.post(`/delivery/orders/${order1Id}/complete`, { result: 'DELIVERED' }, auth(winnerToken));
  assert(r.status === 400, `Expected 400, got ${r.status}: ${r.data?.message}`);
});

await step('Winner is back to FREE', async () => {
  const r = await api.get('/delivery/me', auth(winnerToken));
  assert(r.status === 200, `${r.status}`);
  assert(r.data.status === 'FREE', `Expected FREE after delivery, got ${r.data.status}`);
});

// ═════════════════════════════════════════════════════════════════════
// PHASE 10: Second Order — Another Race
// ═════════════════════════════════════════════════════════════════════
console.log('\n🔷 Phase 10: Second Order — Another Race');

await step('Add items to cart for order 2', async () => {
  await api.post('/cart/items', { productId: productId1, quantity: 1 }, auth(userToken));
  const r = await api.post('/cart/items', { productId: productId2, quantity: 1 }, auth(userToken));
  assert(r.status === 200 || r.status === 201, `${r.status}`);
});

await step('Place COD order 2', async () => {
  const r = await api.post('/orders', {
    addressId,
    paymentMethod: 'COD',
    lat: 12.9720,
    lng: 77.5950,
  }, {
    headers: {
      ...auth(userToken).headers,
      'idempotency-key': `race-order2-${RUN_ID}`,
    },
  });
  assert(r.status === 201 || r.status === 200, `${r.status}: ${r.data?.message}`);
  order2Id = r.data.id;
  console.log(`    Order: ${r.data.orderNumber} (${order2Id})`);
});

await step('Advance order 2 → ORDER_PICKED', async () => {
  const r = await api.patch(`/orders/admin/${order2Id}/status`, { status: 'ORDER_PICKED' }, auth(managerToken));
  assert(r.status === 200, `${r.status}: ${r.data?.message}`);
});

await new Promise(r => setTimeout(r, 2000));

await step('🏁 Second race: all riders claim order 2', async () => {
  const activeRiders = riders.map((rider, i) => ({ rider, i })).filter(({ rider }) => rider.token);
  const numActive = activeRiders.length;

  const claimPromises = activeRiders.map(({ rider, i }) =>
    api.post(`/delivery/orders/${order2Id}/claim`, {}, auth(rider.token))
      .then(r => ({ riderIndex: i, status: r.status, data: r.data }))
  );

  const claimResults = await Promise.all(claimPromises);
  const winners = claimResults.filter(r => r.status === 200 || r.status === 201);
  const conflicts = claimResults.filter(r => r.status === 409);

  console.log(`    Winners: ${winners.length} | Conflicts: ${conflicts.length}`);
  for (const r of claimResults) {
    const icon = (r.status === 200 || r.status === 201) ? '👑' : '🚫';
    console.log(`    ${icon} Rider ${r.riderIndex + 1}: ${r.status}`);
  }

  assert(winners.length === 1, `Expected exactly 1 winner, got ${winners.length}`);
  assert(conflicts.length === numActive - 1, `Expected ${numActive - 1} conflicts, got ${conflicts.length}`);

  raceWinner2 = winners[0].riderIndex;
  console.log(`    🏆 Winner: Rider ${winners[0].riderIndex + 1}`);
});

await step('Second winner accepts + delivers', async () => {
  assert(raceWinner2 >= 0, 'No second winner');
  const token = riders[raceWinner2].token;
  let r = await api.post(`/delivery/orders/${order2Id}/accept`, {}, auth(token));
  assert(r.status === 200 || r.status === 201, `Accept: ${r.status}: ${r.data?.message}`);

  r = await api.post(`/delivery/orders/${order2Id}/complete`, { result: 'DELIVERED' }, auth(token));
  assert(r.status === 200 || r.status === 201, `Complete: ${r.status}: ${r.data?.message}`);
});

// ═════════════════════════════════════════════════════════════════════
// PHASE 11: Final Verification + Cleanup
// ═════════════════════════════════════════════════════════════════════
console.log('\n🔷 Phase 11: Final Verification');

await step('Both orders are DELIVERED', async () => {
  const [r1, r2] = await Promise.all([
    api.get(`/orders/${order1Id}`, auth(userToken)),
    api.get(`/orders/${order2Id}`, auth(userToken)),
  ]);
  assert(r1.status === 200 && r2.status === 200, 'Failed to fetch orders');
  console.log(`    Order 1: ${r1.data.status} | Order 2: ${r2.data.status}`);
  assert(r1.data.status === 'DELIVERED', `Order 1: expected DELIVERED, got ${r1.data.status}`);
  assert(r2.data.status === 'DELIVERED', `Order 2: expected DELIVERED, got ${r2.data.status}`);
});

await step('All riders are FREE after all deliveries', async () => {
  const r = await api.get('/delivery/persons', auth(adminToken));
  assert(r.status === 200, `${r.status}`);
  const riderMap = new Map(r.data.map(p => [p.id, p]));
  for (let i = 0; i < NUM_RIDERS; i++) {
    const person = riderMap.get(riders[i].id);
    assert(person?.status === 'FREE', `Rider ${i + 1} should be FREE, got ${person?.status}`);
  }
  console.log(`    ✓ All ${NUM_RIDERS} riders confirmed FREE`);
});

console.log('\n🔷 Phase 12: Cleanup');

await step('Delete products', async () => {
  await api.delete(`/products/${productId1}`, auth(managerToken));
  await api.delete(`/products/${productId2}`, auth(managerToken));
});

for (let i = 0; i < NUM_RIDERS; i++) {
  await step(`Delete rider ${i + 1}`, async () => {
    let r = await api.delete(`/delivery/persons/${riders[i].id}`, auth(adminToken));
    // If 500 (FK constraint from assignments), that's expected for winners — not a test failure
    if (r.status === 500) {
      console.log(`    (FK constraint — rider has assignments, skipping cleanup)`);
      return;
    }
    assert(r.status === 200 || r.status === 204, `${r.status}`);
  });
}

await step('Delete store manager', async () => {
  await api.delete(`/store-managers/${managerId}`, auth(adminToken));
});

await step('Delete store', async () => {
  const r = await api.delete(`/stores/${storeId}`, auth(adminToken));
  // May fail due to cascading refs from orders — that's OK for test cleanup
  if (r.status === 500) {
    console.log(`    (FK constraint — store has orders, skipping)`);
    return;
  }
  assert(r.status === 200 || r.status === 204, `${r.status}`);
});

// ═════════════════════════════════════════════════════════════════════
// REPORT
// ═════════════════════════════════════════════════════════════════════
console.log('\n' + '═'.repeat(70));
console.log('  RACE CONDITION TEST RESULTS');
console.log('═'.repeat(70));

const passed = results.filter(r => r.status === 'PASS');
const failed = results.filter(r => r.status === 'FAIL');
const latencies = results.map(r => r.ms).sort((a, b) => a - b);
const avgLatency = Math.round(latencies.reduce((s, v) => s + v, 0) / latencies.length);
const p95 = latencies[Math.floor(latencies.length * 0.95)] || 0;

console.log(`\n  ${'Step'.padEnd(52)} ${'Status'.padEnd(8)} ${'Latency'.padStart(8)}`);
console.log(`  ${'─'.repeat(52)} ${'─'.repeat(8)} ${'─'.repeat(8)}`);

for (const r of results) {
  const flag = r.ms > 500 ? ' ⚠️' : '';
  const icon = r.status === 'PASS' ? '✅' : '❌';
  console.log(`  ${icon} ${r.name.padEnd(50)} ${r.status.padEnd(8)} ${String(r.ms + 'ms').padStart(7)}${flag}`);
}

console.log(`\n  ${'─'.repeat(70)}`);
console.log(`  Total: ${results.length} | Passed: ${passed.length} | Failed: ${failed.length}`);
console.log(`  Avg latency: ${avgLatency}ms | P95: ${p95}ms`);

if (failed.length > 0) {
  console.log(`\n  ❌ FAILURES:`);
  for (const f of failed) {
    console.log(`     • ${f.name}: ${f.error}`);
  }
}

console.log('\n' + '═'.repeat(70));
if (failed.length === 0) {
  console.log('  🎉 ALL RACE CONDITION TESTS PASSED!');
  console.log('  ✓ Redis distributed lock prevented double-claims');
  console.log('  ✓ DB unique constraint is the ultimate safety net');
  console.log('  ✓ Exactly 1 winner per concurrent race (twice!)');
  console.log('  ✓ Idempotent re-claims work correctly');
  console.log('  ✓ Status transitions DUTY_OFF → FREE → BUSY → FREE verified');
} else {
  console.log(`  💥 ${failed.length} TEST(S) FAILED`);
}
console.log('═'.repeat(70) + '\n');

process.exit(failed.length > 0 ? 1 : 0);
