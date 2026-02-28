/**
 * Latency Benchmark — Measures per-endpoint latency (p50, p95, avg).
 *
 * Usage:  node test/latency-bench.mjs [BASE_URL]
 * Default BASE_URL: http://localhost:3000
 *
 * Requires the server to be running with MSG91_AUTH_KEY="" (dev mode, OTP 123456).
 */

import axios from 'axios';

const BASE = process.argv[2] || 'http://localhost:3000';
const ITERATIONS = 10;
const api = axios.create({ baseURL: BASE, validateStatus: () => true });

const uid = () => Math.random().toString(36).slice(2, 8);
const RUN_ID = uid();

function auth(token) {
  return { headers: { Authorization: `Bearer ${token}` } };
}

function stats(times) {
  const sorted = [...times].sort((a, b) => a - b);
  const avg = Math.round(sorted.reduce((s, v) => s + v, 0) / sorted.length);
  const p50 = sorted[Math.floor(sorted.length * 0.5)] || 0;
  const p95 = sorted[Math.floor(sorted.length * 0.95)] || 0;
  const min = sorted[0] || 0;
  const max = sorted[sorted.length - 1] || 0;
  return { avg, p50, p95, min, max };
}

async function measure(name, fn, iterations = ITERATIONS) {
  const times = [];
  for (let i = 0; i < iterations; i++) {
    const t0 = performance.now();
    await fn();
    times.push(Math.round(performance.now() - t0));
  }
  return { name, ...stats(times), times };
}

// ── Setup ─────────────────────────────────────────────────────────────
console.log(`\nLatency Benchmark — ${BASE} — ${ITERATIONS} iterations each\n`);
console.log('Setting up test data...');

const seq = String(Date.now()).slice(-6);
const USER_PHONE = `+9177${seq}99`;
const MANAGER_PHONE = `+9188${seq}99`;

// Admin login
let r = await api.post('/auth/super-admin/login', { phone: '+919999999999', pin: '0000' });
if (r.status !== 200 && r.status !== 201) {
  console.error('Super admin login failed:', r.status, r.data);
  process.exit(1);
}
const adminToken = r.data.access_token;

// Create store
r = await api.post('/stores', {
  name: `Bench Store ${RUN_ID}`,
  pincode: '560001',
  lat: 12.9716,
  lng: 77.5946,
  address: '123 Bench Rd',
  storeType: 'GROCERY',
}, auth(adminToken));
const storeId = r.data.id;

// Create manager
r = await api.post('/store-managers', {
  name: `Bench Manager ${RUN_ID}`,
  phone: MANAGER_PHONE,
  pin: '1234',
  storeId,
}, auth(adminToken));

// Manager login
r = await api.post('/auth/store-manager/login', { phone: MANAGER_PHONE, pin: '1234' });
const managerToken = r.data.access_token;

// Create products
const fd1 = new FormData();
fd1.append('name', `Bench Rice ${RUN_ID}`);
fd1.append('price', '350');
fd1.append('category', 'Atta, Rice & Dal');
fd1.append('stock', '100');
r = await api.post('/products', fd1, auth(managerToken));
const productId = r.data.id;

// User login
await api.post('/auth/send-otp', { phone: USER_PHONE });
r = await api.post('/auth/verify-otp', { phone: USER_PHONE, otp: '123456' });
const userToken = r.data.access_token;

// Create address
r = await api.post('/users/addresses', {
  type: 'HOME', houseNo: '1', street: 'Bench St', city: 'Bangalore',
  state: 'Karnataka', zipCode: '560001', lat: 12.972, lng: 77.595,
}, auth(userToken));
const addressId = r.data.id;

// Add to cart
await api.post('/cart/items', { productId, quantity: 2 }, auth(userToken));

console.log('Setup complete. Running benchmarks...\n');

// ── Benchmarks ────────────────────────────────────────────────────────
const results = [];

results.push(await measure('GET /health', () => api.get('/')));

results.push(await measure('GET /products (list)', () =>
  api.get('/products?page=1&limit=20'),
));

results.push(await measure('GET /search?q=rice', () =>
  api.get('/search/products?q=rice&limit=10'),
));

results.push(await measure('GET /search/suggestions?q=ri', () =>
  api.get('/search/suggestions?q=ri&limit=6'),
));

results.push(await measure('GET /search/categories', () =>
  api.get('/search/categories'),
));

results.push(await measure('GET /cart', () =>
  api.get('/cart', auth(userToken)),
));

results.push(await measure('POST /cart/items (add)', async () => {
  await api.post('/cart/items', { productId, quantity: 1 }, auth(userToken));
}));

results.push(await measure('POST /orders/preview', () =>
  api.post('/orders/preview', { addressId }, auth(userToken)),
));

results.push(await measure('GET /orders (list)', () =>
  api.get('/orders?limit=5', auth(userToken)),
));

results.push(await measure('GET /stores', () =>
  api.get('/stores'),
));

results.push(await measure('GET /products/:id', () =>
  api.get(`/products/${productId}`),
));

results.push(await measure('POST /auth/send-otp', async () => {
  // Use different phone each time to avoid rate limiting
  const phone = `+9166${String(Date.now()).slice(-6)}${String(Math.floor(Math.random() * 100)).padStart(2, '0')}`;
  await api.post('/auth/send-otp', { phone });
}));

// Cache stats (if endpoint exists)
const cacheStats = await api.get('/health/cache-stats', auth(adminToken));
const cacheInfo = cacheStats.status === 200 ? cacheStats.data : null;

// ── Report ────────────────────────────────────────────────────────────
console.log('═'.repeat(80));
console.log('  LATENCY BENCHMARK REPORT');
console.log('═'.repeat(80));
console.log(`  Server: ${BASE}`);
console.log(`  Iterations per endpoint: ${ITERATIONS}`);
console.log(`  Date: ${new Date().toISOString()}`);
console.log('─'.repeat(80));
console.log(
  `  ${'Endpoint'.padEnd(35)} ${'Avg'.padStart(6)} ${'P50'.padStart(6)} ${'P95'.padStart(6)} ${'Min'.padStart(6)} ${'Max'.padStart(6)}`
);
console.log(
  `  ${'─'.repeat(35)} ${'─'.repeat(6)} ${'─'.repeat(6)} ${'─'.repeat(6)} ${'─'.repeat(6)} ${'─'.repeat(6)}`
);

for (const r of results) {
  const flag = r.p95 > 500 ? ' ⚠️' : r.p95 > 200 ? ' ⚡' : '';
  console.log(
    `  ${r.name.padEnd(35)} ${(r.avg + 'ms').padStart(6)} ${(r.p50 + 'ms').padStart(6)} ${(r.p95 + 'ms').padStart(6)} ${(r.min + 'ms').padStart(6)} ${(r.max + 'ms').padStart(6)}${flag}`
  );
}

console.log('─'.repeat(80));

// Overall stats
const allAvgs = results.map(r => r.avg);
const overallAvg = Math.round(allAvgs.reduce((s, v) => s + v, 0) / allAvgs.length);
const slowest = results.reduce((a, b) => (a.p95 > b.p95 ? a : b), results[0]);
const fastest = results.reduce((a, b) => (a.p50 < b.p50 ? a : b), results[0]);

console.log(`  Overall avg: ${overallAvg}ms`);
console.log(`  Fastest (p50): ${fastest.name} — ${fastest.p50}ms`);
console.log(`  Slowest (p95): ${slowest.name} — ${slowest.p95}ms`);

if (cacheInfo) {
  console.log(`\n  Cache Stats: ${JSON.stringify(cacheInfo)}`);
}

const slow = results.filter(r => r.p95 > 500);
if (slow.length > 0) {
  console.log(`\n  ⚠️  Endpoints with P95 > 500ms:`);
  for (const s of slow) {
    console.log(`     • ${s.name}: p95=${s.p95}ms avg=${s.avg}ms`);
  }
}

console.log('\n' + '═'.repeat(80));

// ── Cleanup ───────────────────────────────────────────────────────────
console.log('\nCleaning up test data...');
await api.delete(`/products/${productId}`, auth(managerToken));
await api.delete(`/stores/${storeId}`, auth(adminToken));
console.log('Done.\n');
