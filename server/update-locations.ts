import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import * as dotenv from 'dotenv';

dotenv.config();

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const btmLocations = [
    { pincode: '560076', lat: 12.9165, lng: 77.6101, address: 'BTM Layout 2nd Stage, Bengaluru' },
    { pincode: '560029', lat: 12.9213, lng: 77.6095, address: 'BTM Layout 1st Stage, Bengaluru' },
    { pincode: '560076', lat: 12.9130, lng: 77.6140, address: 'Madiwala Lake Road, BTM Layout, Bengaluru' },
    { pincode: '560029', lat: 12.9230, lng: 77.6105, address: 'Tavarekere Main Rd, BTM 1st Stage, Bengaluru' },
    { pincode: '560068', lat: 12.9050, lng: 77.6201, address: 'Bommanahalli, Near BTM 4th Stage, Bengaluru' },
    { pincode: '560076', lat: 12.9100, lng: 77.6110, address: 'Bannerghatta Main Rd, BTM Layout, Bengaluru' },
];

async function main() {
    console.log('Fetching stores...');
    const stores = await prisma.store.findMany();

    if (stores.length === 0) {
        console.log('No stores found to update.');
        return;
    }

    console.log(`Updating ${stores.length} stores to BTM Layout areas...`);

    for (let i = 0; i < stores.length; i++) {
        const store = stores[i];
        const loc = btmLocations[i % btmLocations.length]; // cycle through locations if more stores

        await prisma.store.update({
            where: { id: store.id },
            data: {
                address: loc.address,
                pincode: loc.pincode,
                lat: loc.lat,
                lng: loc.lng,
            }
        });
        console.log(`Updated Store [${store.storeCode} - ${store.name}] to ${loc.address}`);
    }

    console.log('Location update complete!');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
        await pool.end();
    });
