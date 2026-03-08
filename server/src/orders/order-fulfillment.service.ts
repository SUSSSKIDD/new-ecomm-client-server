import { Injectable, Logger } from '@nestjs/common';
import { AllocationService, AllocationResult } from './allocation.service';

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

export interface CartItemInput {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  image: string | null;
}

@Injectable()
export class OrderFulfillmentService {
  private readonly logger = new Logger(OrderFulfillmentService.name);

  constructor(private readonly allocationService: AllocationService) {}

  /**
   * Resolve store assignments for cart items based on user location.
   * Delegates to AllocationService's two-phase algorithm.
   * Returns backward-compatible FulfillmentResult.
   */
  async resolveStoreAssignment(
    lat: number,
    lng: number,
    cartItems: CartItemInput[],
  ): Promise<FulfillmentResult> {
    const allocation = await this.allocationService.allocate(lat, lng, cartItems);

    const availableItems: FulfillmentItem[] = [];
    for (const storeAlloc of allocation.storeAllocations) {
      for (const item of storeAlloc.items) {
        availableItems.push({
          productId: item.productId,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
          total: item.price * item.quantity,
          image: item.image,
          available: true,
          storeId: storeAlloc.storeId,
          storeName: storeAlloc.storeName,
        });
      }
    }

    const unavailableItems: FulfillmentItem[] = allocation.unfulfillableItems.map(
      (item) => ({
        productId: item.productId,
        name: item.name,
        price: item.price,
        quantity: item.quantity,
        total: item.price * item.quantity,
        image: item.image,
        available: false,
        reason: 'out_of_stock',
      }),
    );

    return {
      availableItems,
      unavailableItems,
      allAvailable: unavailableItems.length === 0,
    };
  }

  /**
   * Resolve allocation with full detail (single vs multi-store).
   * Used by OrdersService.create() for multi-store order creation.
   */
  async resolveAllocation(
    lat: number,
    lng: number,
    cartItems: CartItemInput[],
  ): Promise<AllocationResult> {
    return this.allocationService.allocate(lat, lng, cartItems);
  }

  /**
   * Convert AllocationResult to FulfillmentResult (synchronous).
   * Used when we already have the allocation and need the legacy format.
   */
  allocationToFulfillment(allocation: AllocationResult): FulfillmentResult {
    const availableItems: FulfillmentItem[] = [];
    for (const storeAlloc of allocation.storeAllocations) {
      for (const item of storeAlloc.items) {
        availableItems.push({
          productId: item.productId,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
          total: item.price * item.quantity,
          image: item.image,
          available: true,
          storeId: storeAlloc.storeId,
          storeName: storeAlloc.storeName,
        });
      }
    }

    const unavailableItems: FulfillmentItem[] = allocation.unfulfillableItems.map(
      (item) => ({
        productId: item.productId,
        name: item.name,
        price: item.price,
        quantity: item.quantity,
        total: item.price * item.quantity,
        image: item.image,
        available: false,
        reason: 'out_of_stock',
      }),
    );

    return {
      availableItems,
      unavailableItems,
      allAvailable: unavailableItems.length === 0,
    };
  }
}
