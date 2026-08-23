/**
 * One-time backfill: assigns a storeId to OrderItems that were created with
 * storeId=null (see orders.service.ts create() — historically, an order placed
 * against an address with no lat/lng skipped store allocation entirely). Those
 * orders are invisible to every store manager's Orders tab even though the
 * sale went through, because findStoreOrders filters on items.storeId.
 *
 * For each affected order: resolve the delivery address to lat/lng (reusing
 * the saved coordinates if present, else geocoding the address snapshot),
 * pick the nearest active store that stocks every affected item, then in one
 * transaction: set OrderItem.storeId, decrement that store's StoreInventory,
 * and increment back Product.stock (undoing the original incorrect global
 * decrement that occurred because no store was known at order time).
 *
 * Run: npx ts-node backfill-order-store-ids.ts
 */
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import * as dotenv from 'dotenv';
import { GeocodingService } from './src/common/services/geocoding.service';

dotenv.config();

// Uses DIRECT_URL (bypasses PgBouncer, port 5432) rather than the pooled
// DATABASE_URL — this script runs interactive $transaction(async tx => ...)
// calls, which PgBouncer's transaction-pooling mode doesn't reliably support
// (see prisma.service.ts's directTx for the same reasoning).
const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });
const geocodingService = new GeocodingService();

const MAX_DELIVERY_RADIUS_KM = Number(process.env.MAX_DELIVERY_RADIUS_KM ?? 10);
const NOMINATIM_DELAY_MS = 1100; // respect Nominatim's ~1 req/sec usage policy

function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function resolveOrderCoordinates(deliveryAddress: any): Promise<{ lat: number; lng: number } | null> {
  if (deliveryAddress?.lat != null && deliveryAddress?.lng != null) {
    return { lat: deliveryAddress.lat, lng: deliveryAddress.lng };
  }
  if (!deliveryAddress?.street || !deliveryAddress?.city || !deliveryAddress?.zipCode) {
    return null;
  }
  await sleep(NOMINATIM_DELAY_MS);
  return geocodingService.geocode({
    street: deliveryAddress.street,
    city: deliveryAddress.city,
    state: deliveryAddress.state,
    zipCode: deliveryAddress.zipCode,
  });
}

async function main() {
  console.log('Finding orders with orphaned (storeId=null) items...');

  const orphanedOrders = await prisma.order.findMany({
    where: { items: { some: { storeId: null } } },
    include: { items: true },
  });

  console.log(`Found ${orphanedOrders.length} orphaned order(s).`);
  if (orphanedOrders.length === 0) return;

  // Store.lat/lng are required (non-nullable) fields, unlike Address — every
  // active store row always has coordinates, so no not-null filter is needed.
  const activeStores = await prisma.store.findMany({
    where: { isActive: true },
  });

  let fixed = 0;
  const needsReview: string[] = [];

  for (const order of orphanedOrders) {
    const orphanedItems = order.items.filter((i) => i.storeId == null);
    if (orphanedItems.length === 0) continue;

    const coords = await resolveOrderCoordinates(order.deliveryAddress);
    if (!coords) {
      console.warn(`[SKIP] ${order.orderNumber}: could not resolve delivery coordinates`);
      needsReview.push(order.orderNumber);
      continue;
    }

    const candidates = activeStores
      .map((s) => ({ store: s, distance: haversineDistance(coords.lat, coords.lng, s.lat!, s.lng!) }))
      .filter((c) => c.distance <= MAX_DELIVERY_RADIUS_KM)
      .sort((a, b) => a.distance - b.distance);

    const productIds = Array.from(new Set(orphanedItems.map((i) => i.productId)));
    let chosenStoreId: string | null = null;

    for (const candidate of candidates) {
      const inventory = await prisma.storeInventory.findMany({
        where: { storeId: candidate.store.id, productId: { in: productIds } },
      });
      const stockMap = new Map<string, number>(
        inventory.map((row): [string, number] => [row.productId, row.stock]),
      );
      const requiredMap = new Map<string, number>();
      for (const item of orphanedItems) {
        requiredMap.set(item.productId, (requiredMap.get(item.productId) ?? 0) + item.quantity);
      }
      const satisfiesAll = Array.from(requiredMap.entries()).every(
        ([productId, qty]) => (stockMap.get(productId) ?? 0) >= qty,
      );
      if (satisfiesAll) {
        chosenStoreId = candidate.store.id;
        break;
      }
    }

    if (!chosenStoreId) {
      console.warn(
        `[SKIP] ${order.orderNumber}: no single nearby store (within ${MAX_DELIVERY_RADIUS_KM}km) currently stocks all items — needs manual review`,
      );
      needsReview.push(order.orderNumber);
      continue;
    }

    try {
      await prisma.$transaction(async (tx) => {
        for (const item of orphanedItems) {
          await tx.orderItem.update({
            where: { id: item.id },
            data: { storeId: chosenStoreId },
          });

          // Best-effort ledger correction: move the decrement from the global
          // Product.stock counter (where it wrongly landed at order time)
          // onto this store's StoreInventory. Guarded so it never goes negative.
          const decremented = await tx.storeInventory.updateMany({
            where: { storeId: chosenStoreId!, productId: item.productId, stock: { gte: item.quantity } },
            data: { stock: { decrement: item.quantity } },
          });
          if (decremented.count > 0) {
            await tx.product.update({
              where: { id: item.productId },
              data: { stock: { increment: item.quantity } },
            });
          } else {
            console.warn(
              `  [INVENTORY] ${order.orderNumber}/${item.productId}: store stock insufficient to correct ledger — storeId assigned anyway, inventory left as-is`,
            );
          }
        }
      });
      console.log(`[FIXED] ${order.orderNumber} -> store ${chosenStoreId}`);
      fixed++;
    } catch (err) {
      console.error(`[ERROR] ${order.orderNumber}: ${(err as Error).message}`);
      needsReview.push(order.orderNumber);
    }
  }

  console.log('\n── Summary ──');
  console.log(`Fixed: ${fixed}/${orphanedOrders.length}`);
  if (needsReview.length > 0) {
    console.log(`Needs manual review (${needsReview.length}): ${needsReview.join(', ')}`);
  }
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
