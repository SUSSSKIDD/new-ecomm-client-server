import { Client } from 'pg';
import * as fs from 'fs';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env from the server directory
dotenv.config({ path: path.join(__dirname, '.env') });

async function main() {
    const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;

    if (!connectionString) {
        console.error('ERROR: DATABASE_URL or DIRECT_URL not found in .env');
        process.exit(1);
    }

    const client = new Client({ connectionString });
    const urls = new Set<string>();

    try {
        await client.connect();
        console.log('Connected to Supabase. Extracting URLs...');

        // 1. Products
        const productsRes = await client.query('SELECT images FROM "Product" WHERE cardinality(images) > 0');
        productsRes.rows.forEach(row => row.images.forEach((u: string) => urls.add(u)));

        // 2. Variants
        const variantsRes = await client.query('SELECT images FROM "ProductVariant" WHERE cardinality(images) > 0');
        variantsRes.rows.forEach(row => row.images.forEach((u: string) => urls.add(u)));

        // 3. Category Configs
        const categoriesRes = await client.query('SELECT "bannerImage" FROM "CategoryConfig" WHERE "bannerImage" IS NOT NULL');
        categoriesRes.rows.forEach(row => urls.add(row.bannerImage));

        // 4. Print Products
        const printsRes = await client.query('SELECT image FROM "PrintProduct" WHERE image IS NOT NULL');
        printsRes.rows.forEach(row => urls.add(row.image));

        const list = Array.from(urls).filter(u => u && u.startsWith('http'));
        fs.writeFileSync('all_image_urls.txt', list.join('\n'));

        console.log(`✅ Success! Found ${list.length} unique image URLs.`);
        console.log('Saved to: all_image_urls.txt');
    } catch (err) {
        console.error('Execution error:', err);
    } finally {
        await client.end();
    }
}

main().catch(console.error);
