/**
 * Parcel Service — Latency Benchmark
 *
 * Measures response times for all parcel endpoints under normal load.
 * Also tests race conditions: 3 riders simultaneously claim same parcel.
 *
 * Prerequisites:
 *  - Server running at BASE_URL
 *  - Tokens: USER_TOKEN, ADMIN_TOKEN, DELIVERY_TOKEN (primary rider)
 *  - Optional: DELIVERY_TOKEN_2, DELIVERY_TOKEN_3 for race condition test
 *
 * Usage:
 *   USER_TOKEN=xxx ADMIN_TOKEN=xxx DELIVERY_TOKEN=xxx node test/parcel-latency.mjs
 */

import axios from 'axios';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const USER_TOKEN = process.env.USER_TOKEN;
const ADMIN_TOKEN = process.env.ADMIN_TOKEN;
const DELIVERY_TOKEN = process.env.DELIVERY_TOKEN;
const DELIVERY_TOKEN_2 = process.env.DELIVERY_TOKEN_2;
const DELIVERY_TOKEN_3 = process.env.DELIVERY_TOKEN_3;

if (!USER_TOKEN || !ADMIN_TOKEN || !DELIVERY_TOKEN) {
  console.error('Missing tokens. Set USER_TOKEN, ADMIN_TOKEN, DELIVERY_TOKEN env vars.');
  process.exit(1);
}

const mkApi = (token) => axios.create({
  baseURL: BASE_URL,
  headers: { Authorization: `Bearer ${token}` },
  validateStatus: () => true, // don't throw on non-2xx
});

const userApi = mkApi(USER_TOKEN);
const adminApi = mkApi(ADMIN_TOKEN);
const riderApis = [mkApi(DELIVERY_TOKEN)];
if (DELIVERY_TOKEN_2) riderApis.push(mkApi(DELIVERY_TOKEN_2));
if (DELIVERY_TOKEN_3) riderApis.push(mkApi(DELIVERY_TOKEN_3));

const results = [];

async function bench(label, fn, expected2xx = true) {
  const start = Date.now();
  const res = await fn();
  const ms = Date.now() - start;
  const status = res?.status || (res?.data ? 200 : 0);
  const pass = expected2xx ? (status >= 200 && status < 300) : true;
  results.push({ label, ms, status, pass });
  const icon = pass ? '✅' : '⚠️ ';
  console.log(`  ${icon} ${label.padEnd(40)} ${String(ms).padStart(5)}ms  [${status}]`);
  return res;
}

async function createParcel() {
  const futurePickup = new Date(Date.now() + 2 * 60 * 60 * 1000);
  const futureDrop = new Date(Date.now() + 6 * 60 * 60 * 1000);

  return bench('POST /parcels (create)', () =>
    userApi.post('/parcels', {
      pickupAddress: {
        type: 'HOME', houseNo: 'B1', street: 'Test Street',
        city: 'Delhi', zipCode: '110001', state: 'Delhi',
        lat: 28.6139, lng: 77.2090,
      },
      dropAddress: {
        type: 'OTHER', houseNo: 'D2', street: 'Drop Street',
        city: 'Delhi', zipCode: '110002', state: 'Delhi',
        lat: 28.6315, lng: 77.2167,
      },
      category: 'ELECTRONICS',
      weight: 2.0,
      pickupTime: futurePickup.toISOString(),
      dropTime: futureDrop.toISOString(),
    })
  );
}

async function run() {
  console.log('='.repeat(60));
  console.log('PARCEL SERVICE — LATENCY BENCHMARK');
  console.log('='.repeat(60));
  console.log(`Server: ${BASE_URL}`);
  console.log(`Riders: ${riderApis.length}`);
  console.log();

  // ── Customer Endpoints ──
  console.log('── Customer Endpoints ──');

  const createRes = await createParcel();
  const parcelId = createRes.data?.id;
  if (!parcelId) {
    console.error('Failed to create parcel:', createRes.data);
    process.exit(1);
  }

  await bench('GET /parcels (list)', () => userApi.get('/parcels'));
  await bench('GET /parcels/:id (detail)', () => userApi.get(`/parcels/${parcelId}`));

  // ── Admin Endpoints ──
  console.log('\n── Admin Endpoints ──');

  await bench('GET /admin/parcels (list all)', () => adminApi.get('/admin/parcels'));
  await bench('GET /admin/parcels/:id (detail)', () => adminApi.get(`/admin/parcels/${parcelId}`));
  await bench('POST /admin/parcels/:id/approve', () =>
    adminApi.post(`/admin/parcels/${parcelId}/approve`, { codAmount: 200 })
  );
  await bench('POST /admin/parcels/:id/ready', () =>
    adminApi.post(`/admin/parcels/${parcelId}/ready`)
  );

  // Set riders FREE + GPS near pickup
  console.log('\n── Preparing Riders ──');
  for (let i = 0; i < riderApis.length; i++) {
    try {
      await riderApis[i].post('/delivery/status', { status: 'FREE' });
      await riderApis[i].post('/delivery/location', {
        lat: 28.6139 + (i * 0.001),
        lng: 77.2090 + (i * 0.001),
      });
      console.log(`  Rider ${i + 1}: FREE + GPS set`);
    } catch (e) {
      console.log(`  Rider ${i + 1}: ${e.response?.data?.message || e.message}`);
    }
  }

  // Trigger assignment
  await bench('POST /admin/parcels/:id/assign-delivery', () =>
    adminApi.post(`/admin/parcels/${parcelId}/assign-delivery`)
  );

  await new Promise(r => setTimeout(r, 500));

  // ── Delivery Endpoints ──
  console.log('\n── Delivery Endpoints ──');

  await bench('GET /delivery/available-orders', () =>
    riderApis[0].get('/delivery/available-orders')
  );
  await bench('GET /delivery/parcel-orders', () =>
    riderApis[0].get('/delivery/parcel-orders')
  );

  // ── Race Condition Test ──
  if (riderApis.length >= 2) {
    console.log('\n── Race Condition: Simultaneous Claim ──');

    // Create a fresh parcel for the race test
    const raceCreate = await createParcel();
    const raceParcelId = raceCreate.data?.id;
    if (!raceParcelId) {
      console.error('Failed to create race parcel');
    } else {
      await adminApi.post(`/admin/parcels/${raceParcelId}/approve`, { codAmount: 100 });
      await adminApi.post(`/admin/parcels/${raceParcelId}/ready`);

      // Set all riders free
      for (const r of riderApis) {
        try {
          await r.post('/delivery/status', { status: 'FREE' });
        } catch { }
      }

      await adminApi.post(`/admin/parcels/${raceParcelId}/assign-delivery`);
      await new Promise(r => setTimeout(r, 500));

      // Simultaneous claims
      const claimStart = Date.now();
      const claimResults = await Promise.allSettled(
        riderApis.map((api, i) =>
          api.post(`/delivery/parcels/${raceParcelId}/claim`)
        )
      );
      const claimMs = Date.now() - claimStart;

      let winners = 0;
      let losers = 0;
      for (let i = 0; i < claimResults.length; i++) {
        const r = claimResults[i];
        const status = r.status === 'fulfilled' ? r.value.status : 500;
        const data = r.status === 'fulfilled' ? r.value.data : r.reason?.response?.data;
        if (status >= 200 && status < 300 && data?.success) {
          winners++;
          console.log(`  Rider ${i + 1}: ✅ WON (${status})`);
        } else {
          losers++;
          console.log(`  Rider ${i + 1}: ❌ LOST (${status}) ${data?.message || ''}`);
        }
      }

      console.log(`  Total: ${claimMs}ms | Winners: ${winners} | Losers: ${losers}`);
      if (winners === 1) {
        console.log('  ✅ Race condition: EXACTLY 1 winner — PASS');
      } else {
        console.log(`  ⚠️  Race condition: ${winners} winners — FAIL (expected exactly 1)`);
      }

      // Cleanup: complete the won delivery
      const winnerIdx = claimResults.findIndex(r =>
        r.status === 'fulfilled' && r.value.status >= 200 && r.value.status < 300 && r.value.data?.success
      );
      if (winnerIdx >= 0) {
        await riderApis[winnerIdx].post(`/delivery/parcels/${raceParcelId}/accept`);
        await riderApis[winnerIdx].post(`/delivery/parcels/${raceParcelId}/complete`, { result: 'DELIVERED' });
      }
    }
  }

  // ── Single rider claim flow ──
  console.log('\n── Single Rider Claim + Complete ──');

  // Claim the first parcel
  await bench('POST /delivery/parcels/:id/claim', () =>
    riderApis[0].post(`/delivery/parcels/${parcelId}/claim`)
  );
  await bench('POST /delivery/parcels/:id/accept', () =>
    riderApis[0].post(`/delivery/parcels/${parcelId}/accept`)
  );
  await bench('POST /delivery/parcels/:id/complete', () =>
    riderApis[0].post(`/delivery/parcels/${parcelId}/complete`, { result: 'DELIVERED' })
  );

  // ── Cancel test ──
  console.log('\n── Cancel Flow ──');
  const cancelCreate = await createParcel();
  const cancelId = cancelCreate.data?.id;
  if (cancelId) {
    await bench('POST /parcels/:id/cancel (customer)', () =>
      userApi.post(`/parcels/${cancelId}/cancel`)
    );
  }

  // ── Summary ──
  console.log('\n' + '='.repeat(60));
  console.log('LATENCY SUMMARY');
  console.log('='.repeat(60));

  const passing = results.filter(r => r.pass);
  const failing = results.filter(r => !r.pass);
  const allMs = results.map(r => r.ms);

  console.log(`\nEndpoints tested: ${results.length}`);
  console.log(`Passing: ${passing.length} | Warnings: ${failing.length}`);
  console.log(`\nLatency stats:`);
  console.log(`  Min:    ${Math.min(...allMs)}ms`);
  console.log(`  Max:    ${Math.max(...allMs)}ms`);
  console.log(`  Avg:    ${Math.round(allMs.reduce((a, b) => a + b, 0) / allMs.length)}ms`);
  console.log(`  P95:    ${allMs.sort((a, b) => a - b)[Math.floor(allMs.length * 0.95)]}ms`);
  console.log(`  Total:  ${allMs.reduce((a, b) => a + b, 0)}ms`);

  console.log('\nDetailed breakdown:');
  for (const r of results) {
    const bar = '█'.repeat(Math.ceil(r.ms / 20));
    const icon = r.pass ? '✅' : '⚠️ ';
    console.log(`  ${icon} ${r.label.padEnd(45)} ${String(r.ms).padStart(5)}ms ${bar}`);
  }

  if (failing.length > 0) {
    console.log('\n⚠️  Some requests returned non-2xx — check server logs for details.');
  }
}

run().catch(err => {
  console.error('\n❌ BENCHMARK FAILED:', err.message);
  process.exit(1);
});
