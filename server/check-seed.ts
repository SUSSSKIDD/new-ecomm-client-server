import 'dotenv/config';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
const pool = new Pool({ connectionString: url, ssl: { rejectUnauthorized: false } });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const template = await prisma.smsTemplate.findFirst({
    where: { key: 'otp_verification' },
  });
  console.log('--- SMS Template ---');
  console.log(JSON.stringify(template, null, 2));

  const count = await prisma.smsTemplate.count();
  console.log(`\nTotal Templates: ${count}`);
}

main().catch(console.error).finally(async () => {
    await prisma.$disconnect();
    await pool.end();
});
