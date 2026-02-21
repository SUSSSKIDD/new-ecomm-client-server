
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import * as dotenv from 'dotenv';

dotenv.config();

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
    console.log('Seeding products...');

    // Print & Gift Studio Items
    const giftItems = [
        {
            name: 'Custom Coffee Mug',
            description: 'Personalized ceramic coffee mug with your photo or text.',
            price: 299,
            mrp: 499,
            category: 'Print & Gift Studio',
            subCategory: 'Mugs',
            stock: 50,
            isGrocery: false,
            images: ['https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?auto=format&fit=crop&q=80&w=3000&ixlib=rb-4.0.3'],
        },
        {
            name: 'Custom T-Shirt',
            description: 'High-quality cotton t-shirt with custom printing.',
            price: 599,
            mrp: 999,
            category: 'Print & Gift Studio',
            subCategory: 'Apparel',
            stock: 100,
            isGrocery: false,
            images: ['https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&q=80&w=3000&ixlib=rb-4.0.3'],
        },
    ];

    // Grocery Items (with Store Location)
    const groceryItems = [
        {
            name: 'Fresh Red Apples',
            description: 'Crisp and sweet red apples, fresh from the farm.',
            price: 120,
            mrp: 150,
            category: 'Grocery',
            subCategory: 'Fruits',
            stock: 200,
            storeLocation: 'A1',
            isGrocery: true,
            images: ['https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?auto=format&fit=crop&q=80&w=3000&ixlib=rb-4.0.3'],
        },
        {
            name: 'Whole Wheat Bread',
            description: 'Freshly baked whole wheat bread, high in fiber.',
            price: 45,
            mrp: 50,
            category: 'Grocery',
            subCategory: 'Bakery',
            stock: 50,
            storeLocation: 'A2',
            isGrocery: true,
            images: ['https://images.unsplash.com/photo-1598373182133-52452f7691ef?auto=format&fit=crop&q=80&w=3000&ixlib=rb-4.0.3'],
        },
        {
            name: 'Organic Milk',
            description: 'Pure organic milk, 1 liter pack.',
            price: 65,
            mrp: 70,
            category: 'Grocery',
            subCategory: 'Dairy',
            stock: 100,
            storeLocation: 'A3',
            isGrocery: true,
            images: ['https://images.unsplash.com/photo-1563636619-e9143da7973b?auto=format&fit=crop&q=80&w=3000&ixlib=rb-4.0.3'],
        },
    ];

    const allProducts = [...giftItems, ...groceryItems];

    for (const product of allProducts) {
        const exists = await prisma.product.findFirst({
            where: { name: product.name }
        });

        if (!exists) {
            await prisma.product.create({
                data: product,
            });
            console.log(`Created product: ${product.name}`);
        } else {
            console.log(`Product already exists: ${product.name}`);
        }
    }

    console.log('Seeding completed.');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
