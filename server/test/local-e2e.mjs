/**
 * Local E2E Test Runner — Complete Containerized Coverage
 *
 * This script is a wrapper around 'universal-e2e.mjs'.
 * It automates the infrastructure setup for a local, isolated, and non-conflicting test run.
 */

import axios from 'axios';
import { execSync, spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const COMPOSE_FILE = path.join(__dirname, 'docker-compose.local-test.yml');
const SERVER_ROOT = path.join(__dirname, '..');
const ENV_FILE = path.join(SERVER_ROOT, '.env');
const ENV_BAK = path.join(SERVER_ROOT, '.env.e2e_bak');

// ── Isolated Ports & URLs ──────────────────────────────────────────
const LOCAL_PORT = 3032;
const LOCAL_DB_URL = "postgresql://postgres:password123@localhost:5433/local_test_db?schema=public";
const LOCAL_REDIS_URL = "redis://localhost:6380";
const BASE_URL = `http://localhost:${LOCAL_PORT}`;

// Force env for current process (Prisma + Scripts)
process.env.DATABASE_URL = LOCAL_DB_URL;
process.env.DIRECT_URL = LOCAL_DB_URL;
process.env.REDIS_URL = LOCAL_REDIS_URL;

let serverProcess;

async function setup() {
  console.log('\n' + '═'.repeat(80));
  console.log('  🚀 INITIALIZING LOCAL ISOLATED E2E ENVIRONMENT');
  console.log('═'.repeat(80));

  try {
    // 0. Hide .env to prevent leakage
    if (fs.existsSync(ENV_FILE)) {
      console.log('🛡️  Hiding .env file...');
      if (fs.existsSync(ENV_BAK)) fs.unlinkSync(ENV_BAK);
      fs.renameSync(ENV_FILE, ENV_BAK);
    }

    // 1. Ensure build exists
    if (!fs.existsSync(path.join(SERVER_ROOT, 'dist'))) {
      console.log('🔨 Building server...');
      execSync('npm run build', { cwd: SERVER_ROOT, stdio: 'inherit' });
    }

    // 2. Start Containers
    console.log('🏗️  Starting isolated containers...');
    execSync(`docker-compose -f "${COMPOSE_FILE}" up -d --remove-orphans`, { stdio: 'inherit' });

    console.log('⏳ Waiting for PostgreSQL to be ready...');
    for (let i = 0; i < 20; i++) {
      try {
        const out = execSync(`docker-compose -f "${COMPOSE_FILE}" exec -T test-db pg_isready -U postgres`, { stdio: 'pipe' }).toString();
        if (out.includes('accepting connections')) break;
      } catch (e) {}
      execSync('sleep 1');
    }
    // Give it a tiny bit more time purely for socket init
    execSync('sleep 2');

    // 3. Synchronize Schema
    console.log('🚀 Synchronizing database schema (prisma db push)...');
    execSync('npx prisma db push --accept-data-loss', { 
        cwd: SERVER_ROOT, 
        stdio: 'inherit',
        env: { ...process.env, DATABASE_URL: LOCAL_DB_URL, DIRECT_URL: LOCAL_DB_URL }
    });

    // 4. Seed Minimal Data (OTP template via direct SQL)
    console.log('🌱 Seeding required metadata (via psql)...');
    try {
        const seedSql = `
            INSERT INTO "SmsTemplate" (id, name, key, content, variables, type, "isActive", "msg91FlowId", "createdAt", "updatedAt")
            VALUES ('e2e-otp-template-id', 'OTP Verification', 'otp_verification', 'Your OTP is ##OTP##', '{OTP}', 'TRANSACTIONAL', true, 'dummy_flow_id', NOW(), NOW())
            ON CONFLICT (key) DO UPDATE SET "msg91FlowId" = 'dummy_flow_id', "isActive" = true;
        `;
        const containerId = execSync(`docker-compose -f "${COMPOSE_FILE}" ps -q test-db`).toString().trim();
        if (!containerId) throw new Error('DB container not found');
        
        execSync(`docker exec -i ${containerId} psql -U postgres -d local_test_db`, {
            input: seedSql,
            stdio: ['pipe', 'inherit', 'inherit']
        });
        console.log('✅ OTP template seeded.');
    } catch (e) {
        console.error('⚠️  Seeding failed:', e.message);
    }

    // 5. Start Server
    console.log(`📡 Starting local test server on port ${LOCAL_PORT}...`);
    const serverEnv = {
        ...process.env,
        NODE_ENV: 'test',
        DATABASE_URL: LOCAL_DB_URL,
        DIRECT_URL: LOCAL_DB_URL,
        REDIS_URL: LOCAL_REDIS_URL,
        RIDER_REDIS_URL: LOCAL_REDIS_URL,
        BULL_REDIS_HOST: "localhost",
        BULL_REDIS_PORT: "6380",
        PORT: String(LOCAL_PORT),
        JWT_SECRET: "local-e2e-secret-key",
        THROTTLE_DISABLED: "true",
        SUPER_ADMIN_PHONE: "+917785945524",
        SUPER_ADMIN_PIN: "5015",
        MSG91_AUTH_KEY: "dummy_msg91_key",
        MSG91_SENDER_ID: "NEYOKT",
        FREE_DELIVERY_THRESHOLD: "199",
    };

    serverProcess = spawn('node', ['dist/src/main.js'], {
        cwd: SERVER_ROOT,
        env: serverEnv,
        stdio: 'pipe'
    });

    serverProcess.stdout.pipe(process.stdout);
    serverProcess.stderr.pipe(process.stderr);

    let serverReady = false;
    for (let i = 0; i < 45; i++) {
        try {
            const res = await axios.get(`${BASE_URL}/api`, { timeout: 1000 }).catch(() => null);
            if (res && (res.status === 200 || res.status === 201)) {
                serverReady = true;
                break;
            }
        } catch (e) {}
        await new Promise(r => setTimeout(r, 1000));
    }
    if (!serverReady) throw new Error('Test server failed to start heartbeat.');

    console.log('\n✅ Environment ready. Running tests...\n');
  } catch (error) {
    console.error('\n❌ Setup failed:', error.message);
    await teardown();
    process.exit(1);
  }
}

async function teardown() {
  console.log('\n' + '═'.repeat(80));
  console.log('  🧹 CLEANING UP LOCAL E2E ENVIRONMENT');
  console.log('═'.repeat(80));

  if (serverProcess) {
    console.log('🛑 Stopping test server...');
    serverProcess.kill();
  }

  try {
    console.log('📉 Destroying isolated containers...');
    execSync(`docker-compose -f "${COMPOSE_FILE}" down`, { stdio: 'inherit' });
  } catch (e) { }

  if (fs.existsSync(ENV_BAK)) {
    console.log('🛡️  Restoring .env file...');
    fs.renameSync(ENV_BAK, ENV_FILE);
  }
}

process.on('SIGINT', async () => {
    await teardown();
    process.exit(0);
});

// ── MAIN EXECUTION ──────────────────────────────────────────────────
await setup();

try {
  execSync(`node test/universal-e2e.mjs ${BASE_URL}`, { 
      cwd: SERVER_ROOT, 
      stdio: 'inherit',
      env: { 
          ...process.env, 
          NODE_ENV: 'test',
          REDIS_URL: LOCAL_REDIS_URL
      }
  });
} catch (testError) {
  process.exitCode = 1;
} finally {
  await teardown();
}