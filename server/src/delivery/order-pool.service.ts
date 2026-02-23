import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma.service';
import { RiderRedisService } from './rider-redis.service';
import { DeliverySseService } from './delivery-sse.service';
import { RedisCacheService } from '../common/services/redis-cache.service';
import { haversineDistance, MAX_DELIVERY_RADIUS_KM } from '../common/utils/geo.util';
import { DeliveryPersonStatus } from '@prisma/client';

@Injectable()
export class OrderPoolService {
  private readonly logger = new Logger(OrderPoolService.name);
  private readonly claimTimeoutMs: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly riderRedis: RiderRedisService,
    private readonly sseService: DeliverySseService,
    private readonly cache: RedisCacheService,
    config: ConfigService,
  ) {
    this.claimTimeoutMs =
      (config.get<number>('ORDER_CLAIM_TIMEOUT_SECONDS') ?? 120) * 1000;
  }

  /**
   * Broadcast an order to all nearby FREE riders.
   * Called when an order reaches ORDER_PICKED status.
   */
  async broadcastOrder(orderId: string): Promise<void> {
    // Fetch order with items
    const [order, existing] = await Promise.all([
      this.prisma.order.findUnique({
        where: { id: orderId },
        include: { items: true },
      }),
      this.prisma.orderAssignment.findUnique({ where: { orderId } }),
    ]);

    if (!order || existing) return;

    // Determine primary store (store with most items)
    const storeCounts = new Map<string, number>();
    for (const item of order.items) {
      if (item.storeId) {
        storeCounts.set(item.storeId, (storeCounts.get(item.storeId) ?? 0) + 1);
      }
    }
    if (storeCounts.size === 0) {
      this.logger.warn(`Order ${order.orderNumber} has no store assignments`);
      return;
    }

    let primaryStoreId = '';
    let maxCount = 0;
    for (const [storeId, count] of storeCounts) {
      if (count > maxCount) {
        primaryStoreId = storeId;
        maxCount = count;
      }
    }

    const store = await this.prisma.store.findUnique({
      where: { id: primaryStoreId },
    });
    if (!store || store.lat == null || store.lng == null) return;

    // Get all FREE active riders
    const freePersons = await this.prisma.deliveryPerson.findMany({
      where: { status: DeliveryPersonStatus.FREE, isActive: true },
      take: 100,
    });

    if (freePersons.length === 0) {
      this.logger.warn(`No free riders for order ${order.orderNumber}`);
      // Still add to pool so it can be claimed later
      await this.addToPoolWithSnapshot(orderId, order, store);
      return;
    }

    // Batch-fetch cached locations from main Redis
    const locationKeys = freePersons.map((p) => `dp:loc:${p.id}`);
    const cachedLocations = await this.cache.mget<{ lat: number; lng: number }>(
      ...locationKeys,
    );

    // Fallback: batch-fetch from riderdb2 for any that missed main cache
    const missingCacheIds: string[] = [];
    const missingIndices: number[] = [];
    for (let i = 0; i < freePersons.length; i++) {
      if (!cachedLocations[i]) {
        missingCacheIds.push(freePersons[i].id);
        missingIndices.push(i);
      }
    }

    if (missingCacheIds.length > 0) {
      const fallbackLocations = await this.riderRedis.getRiderLocations(
        missingCacheIds,
      );
      for (let j = 0; j < fallbackLocations.length; j++) {
        const fallbackLoc = fallbackLocations[j];
        if (fallbackLoc) {
          cachedLocations[missingIndices[j]] = fallbackLoc;
        }
      }
    }

    // Filter riders within delivery radius
    const eligibleRiderIds: string[] = [];
    for (let i = 0; i < freePersons.length; i++) {
      const p = freePersons[i];
      const cached = cachedLocations[i];
      const lat = cached?.lat ?? p.lat;
      const lng = cached?.lng ?? p.lng;

      if (lat == null || lng == null) continue;

      const distance = haversineDistance(lat, lng, store.lat, store.lng);
      if (distance <= MAX_DELIVERY_RADIUS_KM) {
        eligibleRiderIds.push(p.id);
      }
    }

    // Store order snapshot + add to pool
    await this.addToPoolWithSnapshot(orderId, order, store);

    if (eligibleRiderIds.length === 0) {
      this.logger.warn(`No riders within ${MAX_DELIVERY_RADIUS_KM}km for order ${order.orderNumber}`);
      return;
    }

    // Track eligible riders in riderdb2
    await this.riderRedis.addEligibleRiders(orderId, eligibleRiderIds);

    // Build snapshot for SSE broadcast
    const snapshot = this.buildSnapshot(order, store);

    // Broadcast to all eligible riders via SSE
    this.sseService.broadcastAvailableOrder(eligibleRiderIds, snapshot);

    this.logger.log(
      `Order ${order.orderNumber} broadcast to ${eligibleRiderIds.length} riders`,
    );

    // Schedule claim timeout
    setTimeout(() => {
      this.handleClaimTimeout(orderId).catch((err) =>
        this.logger.error(`Claim timeout handler error: ${err.message}`),
      );
    }, this.claimTimeoutMs);
  }

  /**
   * Re-broadcast order if unclaimed after timeout.
   */
  async handleClaimTimeout(orderId: string): Promise<void> {
    // Check if order is still in pool (not yet claimed)
    const poolIds = await this.riderRedis.getPoolOrderIds();
    if (!poolIds.includes(orderId)) return; // already claimed

    // Verify order is still unassigned in DB
    const assignment = await this.prisma.orderAssignment.findUnique({
      where: { orderId },
    });
    if (assignment) {
      await this.removeOrder(orderId);
      return;
    }

    this.logger.log(`Order ${orderId} unclaimed after timeout, re-broadcasting`);

    // Clean up old eligible set and re-broadcast
    await this.riderRedis.deleteEligibleRiders(orderId);
    await this.broadcastOrder(orderId);
  }

  /**
   * Remove order from pool and clean up all related Redis keys.
   */
  async removeOrder(orderId: string): Promise<void> {
    await Promise.all([
      this.riderRedis.removeFromPool(orderId),
      this.riderRedis.deleteOrderSnapshot(orderId),
      this.riderRedis.deleteEligibleRiders(orderId),
    ]);
  }

  /**
   * Get available orders for a rider (REST fallback for SSE reconnection).
   */
  async getAvailableOrdersForRider(riderId: string): Promise<any[]> {
    const orderIds = await this.riderRedis.getPoolOrderIds();
    if (orderIds.length === 0) return [];

    // Fetch snapshots for all pool orders
    const snapshots: any[] = [];
    for (const id of orderIds) {
      const snapshot = await this.riderRedis.getOrderSnapshot(id);
      if (snapshot) {
        snapshots.push(snapshot);
      }
    }

    return snapshots;
  }

  // ── Private helpers ──

  private async addToPoolWithSnapshot(
    orderId: string,
    order: any,
    store: any,
  ): Promise<void> {
    const snapshot = this.buildSnapshot(order, store);
    await Promise.all([
      this.riderRedis.addToPool(orderId),
      this.riderRedis.setOrderSnapshot(orderId, snapshot),
    ]);
  }

  private buildSnapshot(order: any, store: any): any {
    return {
      orderId: order.id,
      orderNumber: order.orderNumber,
      total: order.total,
      paymentMethod: order.paymentMethod,
      itemCount: order.items?.length ?? 0,
      items: order.items?.map((i: any) => ({
        name: i.name,
        quantity: i.quantity,
        total: i.total,
      })),
      deliveryAddress: order.deliveryAddress,
      storeName: store.name,
      storeLat: store.lat,
      storeLng: store.lng,
      createdAt: order.createdAt,
    };
  }
}
