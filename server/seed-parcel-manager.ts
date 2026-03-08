import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcryptjs';

const connectionString = process.env.DATABASE_URL || "postgresql://postgres.qszmkyexngdrcjchksla:MvD405y4S%40j9J0eX@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1";
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
    const pinHash = await bcrypt.hash('1234', 10);

    await prisma.parcelManager.upsert({
        where: { phone: '+919999999998' },
        update: { pinHash },
        create: {
            name: 'John Parcel',
            phone: '+919999999998',
            pinHash,
        },
    });

    console.log('Successfully seeded mock Parcel Manager with phone: +919999999998, pin: 1234');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
