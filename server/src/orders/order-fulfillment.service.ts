import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { StoresService, NearbyStore } from '../stores/stores.service';

export interface FulfillmentItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  total: number;
  image: string | null;
  available: boolean;
  storeId?: string;
  storeName?: string;
  reason?: string; // 'out_of_range' | 'out_of_stock'
}

export interface FulfillmentResult {
  availableItems: FulfillmentItem[];
  unavailableItems: FulfillmentItem[];
  allAvailable: boolean;
}

interface CartItemInput {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  image: string | null;
}

@Injectable()
export class OrderFulfillmentService {
  private readonly logger = new Logger(OrderFulfillmentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storesService: StoresService,
  ) {}

  /**
   * Resolve store assignments for cart items based on user location.
   *
   * Algorithm (target: <100ms):
   * 1. Find nearby stores from Redis cache (~5ms)
   * 2. Batch-query inventory for all combinations
   * 3. Greedy nearest-first assignment per item
   */
  async resolveStoreAssignment(
    lat: number,
    lng: number,
    cartItems: CartItemInput[],
  ): Promise<FulfillmentResult> {
    // 1. Get nearby stores (from Redis cache)
    const nearbyStores = await this.storesService.findNearbyStores(lat, lng);

    if (nearbyStores.length === 0) {
      // No stores in range — all items unavailable
      const unavailableItems: FulfillmentItem[] = cartItems.map((item) => ({
        ...item,
        total: item.price * item.quantity,
        available: false,
        reason: 'out_of_range',
      }));
      return { availableItems: [], unavailableItems, allAvailable: false };
    }

    const storeIds = nearbyStores.map((s) => s.id);
    const productIds = cartItems.map((i) => i.productId);

    // 2. Single batch query for all inventory
    const inventoryRows = await this.prisma.storeInventory.findMany({
      where: {
        storeId: { in: storeIds },
        productId: { in: productIds },
      },
      select: { storeId: true, productId: true, stock: true },
    });

    // 3. Build lookup: Map<storeId, Map<productId, stock>>
    const inventoryMap = new Map<string, Map<string, number>>();
    for (const row of inventoryRows) {
      if (!inventoryMap.has(row.storeId)) {
        inventoryMap.set(row.storeId, new Map());
      }
      inventoryMap.get(row.storeId)!.set(row.productId, row.stock);
    }

    // 4. Greedy nearest-first assignment
    const storeNameMap = new Map<string, string>(
      nearbyStores.map((s) => [s.id, s.name]),
    );

    const availableItems: FulfillmentItem[] = [];
    const unavailableItems: FulfillmentItem[] = [];

    for (const item of cartItems) {
      let assigned = false;

      // Iterate stores from nearest to farthest
      for (const store of nearbyStores) {
        const storeStock = inventoryMap.get(store.id)?.get(item.productId) ?? 0;
        if (storeStock >= item.quantity) {
          availableItems.push({
            ...item,
            total: item.price * item.quantity,
            available: true,
            storeId: store.id,
            storeName: storeNameMap.get(store.id),
          });
          assigned = true;
          break;
        }
      }

      if (!assigned) {
        unavailableItems.push({
          ...item,
          total: item.price * item.quantity,
          available: false,
          reason: 'out_of_stock',
        });
      }
    }

    return {
      availableItems,
      unavailableItems,
      allAvailable: unavailableItems.length === 0,
    };
  }
}
