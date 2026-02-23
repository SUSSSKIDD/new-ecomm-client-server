import { Injectable, ConflictException } from '@nestjs/common';

interface StockItem {
  productId: string;
  quantity: number;
  storeId?: string | null;
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
   * @param items  Items to adjust (productId, quantity, optional storeId)
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
    const storeItems = items.filter((i) => i.storeId);
    const globalItems = items.filter((i) => !i.storeId);

    if (storeItems.length > 0) {
      await this.adjustStoreInventory(tx, storeItems, direction, strict);
    }

    if (globalItems.length > 0) {
      await this.adjustProductStock(tx, globalItems, direction, strict);
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
}
