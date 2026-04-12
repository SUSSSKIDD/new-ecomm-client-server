import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { StoresService, NearbyStore } from '../stores/stores.service';

export interface AllocatedItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  image: string | null;
  variantId?: string;
  variantLabel?: string;
}

export interface StoreAllocation {
  storeId: string;
  storeName: string;
  distance: number;
  items: AllocatedItem[];
}

export interface AllocationResult {
  type: 'SINGLE_STORE' | 'MULTI_STORE';
  storeAllocations: StoreAllocation[];
  unfulfillableItems: CartItemInput[];
}

export interface CartItemInput {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  image: string | null;
  variantId?: string;
  variantLabel?: string;
}

@Injectable()
export class AllocationService {
  private readonly logger = new Logger(AllocationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storesService: StoresService,
  ) {}

  /**
   * Two-phase allocation algorithm: O(S x P) complexity.
   *
   * Phase 1: Try single-store fulfillment (nearest store that has everything).
   * Phase 2: Greedy biggest-contributor multi-store splitting (minimize fragmentation).
   */
  async allocate(
    lat: number,
    lng: number,
    cartItems: CartItemInput[],
  ): Promise<AllocationResult> {
    const nearbyStores = await this.storesService.findNearbyStores(lat, lng);

    if (nearbyStores.length === 0) {
      return {
        type: 'SINGLE_STORE',
        storeAllocations: [],
        unfulfillableItems: cartItems,
      };
    }

    const storeIds = nearbyStores.map((s) => s.id);
    const productIds = Array.from(new Set(cartItems.map((i) => i.productId)));

    // Single batch query for all inventory
    const inventoryRows = await this.prisma.storeInventory.findMany({
      where: {
        storeId: { in: storeIds },
        productId: { in: productIds },
      },
      select: { storeId: true, productId: true, stock: true },
    });

    // Build lookup: Map<storeId, Map<compositeKey, stock>>
    const inventoryMap = new Map<string, Map<string, number>>();
    for (const row of inventoryRows) {
      if (!inventoryMap.has(row.storeId)) {
        inventoryMap.set(row.storeId, new Map());
      }
      inventoryMap.get(row.storeId)!.set(row.productId, row.stock);
    }

    // ── Variant Stock Logic ──
    const variantIds = cartItems.map(i => i.variantId).filter(Boolean) as string[];
    if (variantIds.length > 0) {
        const variants = await this.prisma.productVariant.findMany({
            where: { id: { in: variantIds } },
            select: { id: true, productId: true, stock: true }
        });
        
        for (const v of variants) {
            for (const [storeId, storeInv] of inventoryMap.entries()) {
                if (storeInv.has(v.productId)) {
                    storeInv.set(`${v.productId}_${v.id}`, v.stock);
                }
            }
        }
    }

    const storeNameMap = new Map<string, string>(
      nearbyStores.map((s) => [s.id, s.name]),
    );
    const storeDistMap = new Map<string, number>(
      nearbyStores.map((s) => [s.id, s.distance]),
    );

    // Helper to get composite key for an item
    const getCKey = (item: CartItemInput) => item.variantId ? `${item.productId}_${item.variantId}` : item.productId;

    // ── Phase 0: Explicit Cross-Category Check ──
    const storeTypes = new Set(cartItems.map(i => (i as any).storeType).filter(Boolean));
    if (storeTypes.size > 1) {
      return this.resolveMultiStoreAllocation(cartItems, nearbyStores, inventoryMap, storeNameMap, storeDistMap);
    }

    // ── Phase 1: Single-store check ──
    for (const store of nearbyStores) {
      const storeInv = inventoryMap.get(store.id);
      if (!storeInv) continue;

      let canFulfill = true;
      for (const item of cartItems) {
        if ((storeInv.get(getCKey(item)) ?? 0) < item.quantity) {
          canFulfill = false;
          break;
        }
      }

      if (canFulfill) {
        return {
          type: 'SINGLE_STORE',
          storeAllocations: [
            {
              storeId: store.id,
              storeName: store.name,
              distance: store.distance,
              items: cartItems.map((item) => ({ ...item, total: item.price * item.quantity })),
            },
          ],
          unfulfillableItems: [],
        };
      }
    }

    return this.resolveMultiStoreAllocation(cartItems, nearbyStores, inventoryMap, storeNameMap, storeDistMap);
  }

  private resolveMultiStoreAllocation(
    cartItems: CartItemInput[],
    nearbyStores: NearbyStore[],
    inventoryMap: Map<string, Map<string, number>>,
    storeNameMap: Map<string, string>,
    storeDistMap: Map<string, number>,
  ): AllocationResult {
    const getCKey = (item: CartItemInput) => item.variantId ? `${item.productId}_${item.variantId}` : item.productId;

    // Use a unique index for each individual cart item to avoid product ID collisions
    // CartItemID -> RemainingQuantity
    const remaining = new Map<number, number>(
      cartItems.map((item, idx) => [idx, item.quantity]),
    );
    
    const allocations = new Map<string, AllocatedItem[]>();
    const exhaustedStores = new Set<string>();

    while (remaining.size > 0) {
      let bestStoreId: string | null = null;
      let bestCoverScore = 0;
      let bestItemAssignments: { cartItemIdx: number; quantity: number }[] = [];

      for (const store of nearbyStores) {
        if (exhaustedStores.has(store.id)) continue;
        const storeInv = inventoryMap.get(store.id);
        if (!storeInv) { exhaustedStores.add(store.id); continue; }

        const assignments: { cartItemIdx: number; quantity: number }[] = [];
        let score = 0;

        for (const [idx, neededQty] of remaining) {
          const item = cartItems[idx];
          const key = getCKey(item);
          const available = Math.min(storeInv.get(key) ?? 0, neededQty);
          if (available > 0) {
            assignments.push({ cartItemIdx: idx, quantity: available });
            score += available;
          }
        }

        if (score > bestCoverScore) {
          bestStoreId = store.id;
          bestCoverScore = score;
          bestItemAssignments = assignments;
        }
      }

      if (!bestStoreId || bestCoverScore === 0) {
         const unfulfillable: CartItemInput[] = [];
         for (const [idx, qty] of remaining) {
           unfulfillable.push({ ...cartItems[idx], quantity: qty });
         }
         return {
           type: 'MULTI_STORE',
           storeAllocations: this.buildStoreAllocations(allocations, storeNameMap, storeDistMap),
           unfulfillableItems: unfulfillable,
         };
      }

      // Assign items
      const storeItems = allocations.get(bestStoreId) || [];
      for (const assignment of bestItemAssignments) {
        const item = cartItems[assignment.cartItemIdx];
        const key = getCKey(item);
        
        storeItems.push({
          productId: item.productId,
          name: item.name,
          price: item.price,
          quantity: assignment.quantity,
          image: item.image,
          variantId: item.variantId,
          variantLabel: item.variantLabel,
        });

        // Update remaining
        const newRem = remaining.get(assignment.cartItemIdx)! - assignment.quantity;
        if (newRem <= 0) remaining.delete(assignment.cartItemIdx);
        else remaining.set(assignment.cartItemIdx, newRem);

        // Update virtual inventory
        const storeInv = inventoryMap.get(bestStoreId)!;
        storeInv.set(key, (storeInv.get(key) ?? 0) - assignment.quantity);
      }
      allocations.set(bestStoreId, storeItems);
    }

    return {
      type: 'MULTI_STORE',
      storeAllocations: this.buildStoreAllocations(allocations, storeNameMap, storeDistMap),
      unfulfillableItems: [],
    };
  }

  private buildStoreAllocations(
    allocations: Map<string, AllocatedItem[]>,
    storeNameMap: Map<string, string>,
    storeDistMap: Map<string, number>,
  ): StoreAllocation[] {
    const result: StoreAllocation[] = [];
    for (const [storeId, items] of allocations) {
      result.push({
        storeId,
        storeName: storeNameMap.get(storeId) ?? 'Unknown',
        distance: storeDistMap.get(storeId) ?? 0,
        items,
      });
    }
    // Sort by distance (nearest first)
    return result.sort((a, b) => a.distance - b.distance);
  }
}
