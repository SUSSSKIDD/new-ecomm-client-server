import { Injectable, ConflictException } from '@nestjs/common';

interface StockItem {
  productId: string;
  quantity: number;
  storeId?: string | null;
  variantId?: string | null;
}

/**
 * Centralised batch stock operations using raw SQL for atomicity.
 * Replaces 8+ duplicate SQL blocks across orders.service.ts.
 */
@Injectable()
export class StockService {
  /**
   * Batch adjust stock for a list of items.
   * @param tx  Prisma transaction client ($transaction callback arg)
   * @param items  Items to adjust (productId, quantity, optional storeId, optional variantId)
   * @param direction  'increment' to restore stock, 'decrement' to consume stock
   * @param strict  If true (default for decrement), throws ConflictException when
   *                any row doesn't match (stock < qty). Ignored for increments.
   */
  async adjustStock(
    tx: any,
    items: StockItem[],
    direction: 'increment' | 'decrement',
    strict = direction === 'decrement',
  ): Promise<void> {
    // 1. Aggregate quantities for items with the same identity
    const variantMap = new Map<string, StockItem>();
    const storeMap = new Map<string, StockItem>();
    const globalMap = new Map<string, StockItem>();

    for (const item of items) {
      if (item.variantId) {
        const existing = variantMap.get(item.variantId);
        if (existing) existing.quantity += item.quantity;
        else variantMap.set(item.variantId, { ...item });
      } else if (item.storeId) {
        const key = `${item.storeId}_${item.productId}`;
        const existing = storeMap.get(key);
        if (existing) existing.quantity += item.quantity;
        else storeMap.set(key, { ...item });
      } else {
        const existing = globalMap.get(item.productId);
        if (existing) existing.quantity += item.quantity;
        else globalMap.set(item.productId, { ...item });
      }
    }

    const aggregatedVariantItems = Array.from(variantMap.values());
    const aggregatedStoreItems = Array.from(storeMap.values());
    const aggregatedGlobalItems = Array.from(globalMap.values());

    if (aggregatedVariantItems.length > 0) {
      await this.adjustVariantStock(tx, aggregatedVariantItems, direction, strict);
    }

    if (aggregatedStoreItems.length > 0) {
      await this.adjustStoreInventory(tx, aggregatedStoreItems, direction, strict);
    }

    if (aggregatedGlobalItems.length > 0) {
      await this.adjustProductStock(tx, aggregatedGlobalItems, direction, strict);
    }
  }

  // ── StoreInventory (3-param: storeId + productId + qty) ──────────

  private async adjustStoreInventory(
    tx: any,
    items: StockItem[],
    direction: 'increment' | 'decrement',
    strict: boolean,
  ): Promise<void> {
    const values: string[] = [];
    const params: any[] = [];

    items.forEach((item, idx) => {
      const i = idx * 3;
      values.push(`($${i + 1}, $${i + 2}, $${i + 3}::int)`);
      params.push(item.storeId, item.productId, item.quantity);
    });

    const op = direction === 'decrement' ? '-' : '+';
    const guard =
      direction === 'decrement' ? ' AND si."stock" >= v.qty' : '';

    const updatedCount = await tx.$executeRawUnsafe(
      `UPDATE "StoreInventory" AS si
       SET "stock" = "stock" ${op} v.qty
       FROM (VALUES ${values.join(',')}) AS v("storeId", "productId", "qty")
       WHERE si."storeId" = v."storeId"
         AND si."productId" = v."productId"${guard}`,
      ...params,
    );

    if (strict && updatedCount !== items.length) {
      throw new ConflictException(
        'Stock race detected for one or more items at assigned store. Please retry.',
      );
    }
  }

  // ── Global Product stock (2-param: productId + qty) ──────────────

  private async adjustProductStock(
    tx: any,
    items: StockItem[],
    direction: 'increment' | 'decrement',
    strict: boolean,
  ): Promise<void> {
    const values: string[] = [];
    const params: any[] = [];

    items.forEach((item, idx) => {
      const i = idx * 2;
      values.push(`($${i + 1}, $${i + 2}::int)`);
      params.push(item.productId, item.quantity);
    });

    const op = direction === 'decrement' ? '-' : '+';
    const guard =
      direction === 'decrement' ? ' AND p."stock" >= v.qty' : '';

    const updatedCount = await tx.$executeRawUnsafe(
      `UPDATE "Product" AS p
       SET "stock" = "stock" ${op} v.qty
       FROM (VALUES ${values.join(',')}) AS v("id", "qty")
       WHERE p."id" = v."id"${guard}`,
      ...params,
    );

    if (strict && updatedCount !== items.length) {
      throw new ConflictException(
        'Stock race detected for one or more items. Please retry.',
      );
    }
  }

  // ── ProductVariant stock (variantId + qty) ──────────────────────

  private async adjustVariantStock(
    tx: any,
    items: StockItem[],
    direction: 'increment' | 'decrement',
    strict: boolean,
  ): Promise<void> {
    const values: string[] = [];
    const params: any[] = [];

    items.forEach((item, idx) => {
      const i = idx * 2;
      values.push(`($${i + 1}, $${i + 2}::int)`);
      params.push(item.variantId, item.quantity);
    });

    const op = direction === 'decrement' ? '-' : '+';
    const guard =
      direction === 'decrement' ? ' AND pv."stock" >= v.qty' : '';

    const updatedCount = await tx.$executeRawUnsafe(
      `UPDATE "ProductVariant" AS pv
       SET "stock" = "stock" ${op} v.qty
       FROM (VALUES ${values.join(',')}) AS v("id", "qty")
       WHERE pv."id" = v."id"${guard}`,
      ...params,
    );

    if (strict && updatedCount !== items.length) {
      throw new ConflictException(
        'Stock race detected for one or more variants. Please retry.',
      );
    }
  }
}
