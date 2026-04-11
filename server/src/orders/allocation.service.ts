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
    const productIds = cartItems.map((i) => i.productId);

    // Single batch query for all inventory
    const inventoryRows = await this.prisma.storeInventory.findMany({
      where: {
        storeId: { in: storeIds },
        productId: { in: productIds },
      },
      select: { storeId: true, productId: true, stock: true },
    });

    // Build lookup: Map<storeId, Map<productId, stock>>
    const inventoryMap = new Map<string, Map<string, number>>();
    for (const row of inventoryRows) {
      if (!inventoryMap.has(row.storeId)) {
        inventoryMap.set(row.storeId, new Map());
      }
      inventoryMap.get(row.storeId)!.set(row.productId, row.stock);
    }

    const storeNameMap = new Map<string, string>(
      nearbyStores.map((s) => [s.id, s.name]),
    );
    const storeDistMap = new Map<string, number>(
      nearbyStores.map((s) => [s.id, s.distance]),
    );

    // ── Phase 1: Single-store check (nearest-first) ──
    for (const store of nearbyStores) {
      const storeInv = inventoryMap.get(store.id);
      if (!storeInv) continue;

      let canFulfill = true;
      for (const item of cartItems) {
        if ((storeInv.get(item.productId) ?? 0) < item.quantity) {
          canFulfill = false;
          break;
        }
      }

      if (canFulfill) {
        this.logger.log(
          `Single-store fulfillment: ${store.name} (${store.distance}km)`,
        );
        return {
          type: 'SINGLE_STORE',
          storeAllocations: [
            {
              storeId: store.id,
              storeName: store.name,
              distance: store.distance,
              items: cartItems.map((item) => ({
                productId: item.productId,
                name: item.name,
                price: item.price,
                quantity: item.quantity,
                image: item.image,
                variantId: item.variantId,
                variantLabel: item.variantLabel,
              })),
            },
          ],
          unfulfillableItems: [],
        };
      }
    }

    // ── Phase 2: Greedy biggest-contributor multi-store ──
    this.logger.log('No single store can fulfill — attempting multi-store split');

    // Deep copy remaining quantities
    const remaining = new Map<string, number>(
      cartItems.map((item) => [item.productId, item.quantity]),
    );
    const cartItemMap = new Map(cartItems.map((item) => [item.productId, item]));
    const allocations = new Map<string, AllocatedItem[]>();
    const exhaustedStores = new Set<string>();

    while (remaining.size > 0) {
      let bestStoreId: string | null = null;
      let bestCoverScore = 0;
      let bestItems: { productId: string; quantity: number }[] = [];

      for (const store of nearbyStores) {
        if (exhaustedStores.has(store.id)) continue;

        const storeInv = inventoryMap.get(store.id);
        if (!storeInv) {
          exhaustedStores.add(store.id);
          continue;
        }

        const coveredItems: { productId: string; quantity: number }[] = [];
        let coverScore = 0;

        for (const [productId, neededQty] of remaining) {
          const available = Math.min(
            storeInv.get(productId) ?? 0,
            neededQty,
          );
          if (available > 0) {
            coveredItems.push({ productId, quantity: available });
            coverScore += available;
          }
        }

        if (coverScore > bestCoverScore) {
          bestStoreId = store.id;
          bestCoverScore = coverScore;
          bestItems = coveredItems;
        }
      }

      if (!bestStoreId || bestCoverScore === 0) {
        // No store can cover any remaining items — unfulfillable
        const unfulfillable: CartItemInput[] = [];
        for (const [productId, qty] of remaining) {
          const item = cartItemMap.get(productId)!;
          unfulfillable.push({ ...item, quantity: qty });
        }
        return {
          type: 'MULTI_STORE',
          storeAllocations: this.buildStoreAllocations(
            allocations,
            cartItemMap,
            storeNameMap,
            storeDistMap,
          ),
          unfulfillableItems: unfulfillable,
        };
      }

      // Assign items from best store
      const storeItems = allocations.get(bestStoreId) || [];
      for (const assigned of bestItems) {
        const item = cartItemMap.get(assigned.productId)!;
        storeItems.push({
          productId: assigned.productId,
          name: item.name,
          price: item.price,
          quantity: assigned.quantity,
          image: item.image,
          variantId: item.variantId,
          variantLabel: item.variantLabel,
        });

        // Reduce remaining
        const newRemaining = remaining.get(assigned.productId)! - assigned.quantity;
        if (newRemaining <= 0) {
          remaining.delete(assigned.productId);
        } else {
          remaining.set(assigned.productId, newRemaining);
        }

        // Reduce virtual inventory so this store isn't over-counted in next round
        const storeInv = inventoryMap.get(bestStoreId)!;
        const currentStock = storeInv.get(assigned.productId) ?? 0;
        storeInv.set(assigned.productId, currentStock - assigned.quantity);
      }
      allocations.set(bestStoreId, storeItems);
    }

    const storeAllocations = this.buildStoreAllocations(
      allocations,
      cartItemMap,
      storeNameMap,
      storeDistMap,
    );

    this.logger.log(
      `Multi-store allocation: ${storeAllocations.length} stores — [${storeAllocations.map((s) => s.storeName).join(', ')}]`,
    );

    return {
      type: 'MULTI_STORE',
      storeAllocations,
      unfulfillableItems: [],
    };
  }

  private buildStoreAllocations(
    allocations: Map<string, AllocatedItem[]>,
    _cartItemMap: Map<string, CartItemInput>,
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
