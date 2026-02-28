/**
 * Parcel Pickup & Drop — Complete Checkout Flow Test
 *
 * Tests the full lifecycle:
 *  1. Customer books a parcel
 *  2. Admin approves with COD amount
 *  3. Admin sets "Ready for Pickup"
 *  4. Admin triggers delivery assignment
 *  5. Rider claims the parcel
 *  6. Rider accepts the assignment
 *  7. Rider completes delivery (DELIVERED)
 *
 * Prerequisites:
 *  - Server running at BASE_URL
 *  - A user token (USER_TOKEN env)
 *  - An admin token (ADMIN_TOKEN env)
 *  - A delivery person logged in (DELIVERY_TOKEN env) and status=FREE with GPS
 *
 * Usage:
 *   USER_TOKEN=xxx ADMIN_TOKEN=xxx DELIVERY_TOKEN=xxx node test/parcel-checkout-flow.mjs
 */

import axios from 'axios';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const USER_TOKEN = process.env.USER_TOKEN;
const ADMIN_TOKEN = process.env.ADMIN_TOKEN;
const DELIVERY_TOKEN = process.env.DELIVERY_TOKEN;

if (!USER_TOKEN || !ADMIN_TOKEN || !DELIVERY_TOKEN) {
  console.error('Missing tokens. Set USER_TOKEN, ADMIN_TOKEN, DELIVERY_TOKEN env vars.');
  process.exit(1);
}

const userApi = axios.create({
  baseURL: BASE_URL,
  headers: { Authorization: `Bearer ${USER_TOKEN}` },
});

const adminApi = axios.create({
  baseURL: BASE_URL,
  headers: { Authorization: `Bearer ${ADMIN_TOKEN}` },
});

const deliveryApi = axios.create({
  baseURL: BASE_URL,
  headers: { Authorization: `Bearer ${DELIVERY_TOKEN}` },
});

const step = (n, desc) => console.log(`\n${'='.repeat(60)}\nSTEP ${n}: ${desc}\n${'='.repeat(60)}`);
const ok = (msg) => console.log(`  ✅ ${msg}`);
const fail = (msg) => { console.error(`  ❌ ${msg}`); process.exit(1); };
const info = (msg) => console.log(`  ℹ️  ${msg}`);

async function run() {
  const times = {};
  const measure = async (label, fn) => {
    const start = Date.now();
    const result = await fn();
    times[label] = Date.now() - start;
    info(`${label}: ${times[label]}ms`);
    return result;
  };

  // ── Step 1: Customer books a parcel ──
  step(1, 'Customer books a parcel');
  const futurePickup = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 hours from now
  const futureDrop = new Date(Date.now() + 6 * 60 * 60 * 1000);   // 6 hours from now

  const parcelData = {
    pickupAddress: {
      type: 'HOME',
      houseNo: '123',
      street: 'MG Road',
      city: 'Delhi',
      zipCode: '110001',
      state: 'Delhi',
      landmark: 'Near Metro Station',
      lat: 28.6139,
      lng: 77.2090,
    },
    dropAddress: {
      type: 'OTHER',
      houseNo: '456',
      street: 'Connaught Place',
      city: 'Delhi',
      zipCode: '110002',
      state: 'Delhi',
      landmark: 'Near Janpath',
      lat: 28.6315,
      lng: 77.2167,
    },
    category: 'DOCUMENTS',
    weight: 1.5,
    length: 30,
    width: 20,
    height: 5,
    pickupTime: futurePickup.toISOString(),
    dropTime: futureDrop.toISOString(),
  };

  const createRes = await measure('Create parcel', async () => {
    const res = await userApi.post('/parcels', parcelData);
    return res.data;
  });

  if (!createRes.id || !createRes.parcelNumber) fail('Missing id or parcelNumber in response');
  if (createRes.status !== 'PENDING') fail(`Expected PENDING, got ${createRes.status}`);
  ok(`Parcel created: ${createRes.parcelNumber} (status: ${createRes.status})`);

  const parcelId = createRes.id;

  // ── Step 2: Customer can see their parcel ──
  step(2, 'Customer fetches parcel list');
  const listRes = await measure('List parcels', async () => {
    const res = await userApi.get('/parcels');
    return res.data;
  });

  const parcels = listRes.data || listRes;
  const found = (Array.isArray(parcels) ? parcels : []).find(p => p.id === parcelId);
  if (!found) fail('Parcel not found in user list');
  ok(`Found parcel ${found.parcelNumber} in user's list`);

  // ── Step 3: Admin approves with COD ──
  step(3, 'Admin approves parcel with COD amount');
  const approveRes = await measure('Approve parcel', async () => {
    const res = await adminApi.post(`/admin/parcels/${parcelId}/approve`, { codAmount: 150 });
    return res.data;
  });

  if (approveRes.status !== 'APPROVED') fail(`Expected APPROVED, got ${approveRes.status}`);
  if (approveRes.codAmount !== 150) fail(`Expected COD 150, got ${approveRes.codAmount}`);
  ok(`Parcel approved: COD ₹${approveRes.codAmount} (status: ${approveRes.status})`);

  // ── Step 4: Admin sets Ready for Pickup ──
  step(4, 'Admin sets Ready for Pickup');
  const readyRes = await measure('Set ready', async () => {
    const res = await adminApi.post(`/admin/parcels/${parcelId}/ready`);
    return res.data;
  });

  if (readyRes.status !== 'READY_FOR_PICKUP') fail(`Expected READY_FOR_PICKUP, got ${readyRes.status}`);
  ok(`Status: ${readyRes.status}`);

  // ── Step 5: Ensure delivery person is FREE and has GPS location ──
  step(5, 'Set rider FREE + update GPS near pickup');
  try {
    await deliveryApi.post('/delivery/status', { status: 'FREE' });
    ok('Rider status set to FREE');
  } catch (e) {
    if (e.response?.data?.message?.includes('Complete current delivery')) {
      info('Rider is BUSY — this is expected if they have an active delivery');
      fail('Rider must be FREE to continue test');
    }
    // Rider might already be free
    info(`Status update: ${e.response?.data?.message || 'already FREE'}`);
  }

  // Update rider location near the pickup point
  await deliveryApi.post('/delivery/location', { lat: 28.6145, lng: 77.2095 });
  ok('Rider GPS updated near pickup location');

  // ── Step 6: Admin triggers delivery assignment ──
  step(6, 'Admin triggers delivery assignment');
  const assignRes = await measure('Trigger assignment', async () => {
    const res = await adminApi.post(`/admin/parcels/${parcelId}/assign-delivery`);
    return res.data;
  });

  ok(`Assignment response: ${assignRes.message}`);

  // Small delay for broadcast to propagate
  await new Promise(r => setTimeout(r, 1000));

  // ── Step 7: Rider checks available orders and claims ──
  step(7, 'Rider claims parcel');
  const availableRes = await measure('Get available orders', async () => {
    const res = await deliveryApi.get('/delivery/available-orders');
    return res.data;
  });

  const availableParcel = availableRes.find(o => o.orderId === parcelId);
  if (!availableParcel) {
    info(`Available orders: ${JSON.stringify(availableRes.map(o => ({ id: o.orderId, isParcel: o.isParcel })))}`);
    fail('Parcel not found in available orders');
  }
  if (!availableParcel.isParcel) fail('isParcel flag missing');
  ok(`Found parcel in available orders (isParcel: true)`);

  const claimRes = await measure('Claim parcel', async () => {
    const res = await deliveryApi.post(`/delivery/parcels/${parcelId}/claim`);
    return res.data;
  });

  if (!claimRes.success) fail('Claim failed');
  ok(`Claimed: ${claimRes.orderNumber}`);

  // ── Step 8: Rider accepts assignment ──
  step(8, 'Rider accepts parcel assignment');
  const acceptRes = await measure('Accept assignment', async () => {
    const res = await deliveryApi.post(`/delivery/parcels/${parcelId}/accept`);
    return res.data;
  });

  if (!acceptRes.accepted) fail('Accept failed');
  ok(`Accepted parcel ${acceptRes.parcelOrderId}`);

  // ── Step 9: Rider completes delivery ──
  step(9, 'Rider completes delivery (DELIVERED)');
  const completeRes = await measure('Complete delivery', async () => {
    const res = await deliveryApi.post(`/delivery/parcels/${parcelId}/complete`, { result: 'DELIVERED' });
    return res.data;
  });

  if (completeRes.result !== 'DELIVERED') fail(`Expected DELIVERED, got ${completeRes.result}`);
  ok(`Delivery complete: ${completeRes.result}`);

  // ── Step 10: Verify final state ──
  step(10, 'Verify final state');
  const finalRes = await measure('Get final parcel state', async () => {
    const res = await adminApi.get(`/admin/parcels/${parcelId}`);
    return res.data;
  });

  if (finalRes.status !== 'DELIVERED') fail(`Expected final DELIVERED, got ${finalRes.status}`);
  if (!finalRes.deliveredAt) fail('deliveredAt not set');
  if (!finalRes.assignment) fail('No assignment record');
  ok(`Final status: ${finalRes.status}, deliveredAt: ${finalRes.deliveredAt}`);
  ok(`Assignment: rider ${finalRes.assignment.deliveryPerson?.name}, completed: ${finalRes.assignment.completedAt}`);

  // ── Summary ──
  console.log('\n' + '='.repeat(60));
  console.log('🎉 COMPLETE CHECKOUT FLOW: ALL STEPS PASSED');
  console.log('='.repeat(60));
  console.log('\nLatency breakdown:');
  for (const [label, ms] of Object.entries(times)) {
    const bar = '█'.repeat(Math.ceil(ms / 10));
    console.log(`  ${label.padEnd(25)} ${String(ms).padStart(5)}ms ${bar}`);
  }
  const totalMs = Object.values(times).reduce((a, b) => a + b, 0);
  console.log(`  ${'─'.repeat(40)}`);
  console.log(`  ${'Total'.padEnd(25)} ${String(totalMs).padStart(5)}ms`);
}

run().catch(err => {
  console.error('\n❌ TEST FAILED:', err.response?.data || err.message);
  process.exit(1);
});
