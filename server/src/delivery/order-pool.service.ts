import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma.service';
import { RiderRedisService } from './rider-redis.service';
import { DeliverySseService } from './delivery-sse.service';
import { RedisCacheService } from '../common/services/redis-cache.service';
import { MAX_DELIVERY_RADIUS_KM } from '../common/utils/geo.util';
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
    @InjectQueue('delivery') private readonly deliveryQueue: Queue,
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

    // Use Redis Native GEOSEARCH to find nearest riders instantaneously
    const nearestRiderIds = await this.cache.geoSearchRadius(
      'riders_location',
      store.lng,
      store.lat,
      MAX_DELIVERY_RADIUS_KM,
      50,
      'km',
    );

    if (nearestRiderIds.length === 0) {
      this.logger.warn(`No riders within ${MAX_DELIVERY_RADIUS_KM}km for order ${order.orderNumber}`);
      await this.addToPoolWithSnapshot(orderId, order, store);
      return;
    }

    // Verify which of these nearest riders are actually FREE and active
    const freePersons = await this.prisma.deliveryPerson.findMany({
      where: {
        id: { in: nearestRiderIds },
        status: DeliveryPersonStatus.FREE,
        isActive: true,
      },
      select: { id: true },
    });

    const freeSet = new Set(freePersons.map((p) => p.id));

    // Filter and slice the closest 10 free riders
    const eligibleRiderIds = nearestRiderIds
      .filter((id) => freeSet.has(id))
      .slice(0, 10);

    // Store order snapshot + add to pool
    await this.addToPoolWithSnapshot(orderId, order, store);

    if (eligibleRiderIds.length === 0) {
      this.logger.warn(`No FREE riders within ${MAX_DELIVERY_RADIUS_KM}km for order ${order.orderNumber}`);
      return;
    }

    // Track eligible riders
    await this.riderRedis.addEligibleRiders(orderId, eligibleRiderIds);

    // Build snapshot for SSE broadcast
    const snapshot = this.buildSnapshot(order, store);

    // Broadcast to all eligible riders via SSE
    this.sseService.broadcastAvailableOrder(eligibleRiderIds, snapshot);

    this.logger.log(
      `Order ${order.orderNumber} broadcast to ${eligibleRiderIds.length} riders`,
    );

    // Schedule claim timeout via BullMQ (survives restarts)
    await this.deliveryQueue.add(
      'claim-timeout',
      { orderId },
      {
        delay: this.claimTimeoutMs,
        removeOnComplete: true,
        removeOnFail: 100,
      },
    );
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
   * Uses MGET for single round-trip instead of N sequential calls.
   */
  async getAvailableOrdersForRider(_riderId: string): Promise<any[]> {
    const orderIds = await this.riderRedis.getPoolOrderIds();
    if (orderIds.length === 0) return [];

    const snapshots = await this.riderRedis.getOrderSnapshots(orderIds);
    return snapshots.filter(Boolean);
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

  /**
   * Broadcast a PARCEL order to all nearby FREE riders.
   */
  async broadcastParcelOrder(parcelOrderId: string): Promise<void> {
    const [parcel, existing] = await Promise.all([
      this.prisma.parcelOrder.findUnique({
        where: { id: parcelOrderId },
      }),
      this.prisma.parcelAssignment.findUnique({ where: { parcelOrderId: parcelOrderId } }),
    ]);

    if (!parcel || existing) return;

    const lat = parcel.pickupLat;
    const lng = parcel.pickupLng;

    if (lat == null || lng == null) return;

    // Use Redis Native GEOSEARCH to find nearest riders instantaneously
    const nearestRiderIds = await this.cache.geoSearchRadius(
      'riders_location',
      lng,
      lat,
      MAX_DELIVERY_RADIUS_KM,
      50,
      'km',
    );

    let eligibleRiderIds: string[] = [];

    if (nearestRiderIds.length > 0) {
      // Verify which of these nearest riders are actually FREE and active
      const freePersons = await this.prisma.deliveryPerson.findMany({
        where: {
          id: { in: nearestRiderIds },
          status: DeliveryPersonStatus.FREE,
          isActive: true,
        },
        select: { id: true },
      });

      const freeSet = new Set(freePersons.map((p) => p.id));
      eligibleRiderIds = nearestRiderIds.filter((id) => freeSet.has(id)).slice(0, 10);
    }

    if (eligibleRiderIds.length === 0) {
      this.logger.warn(`No riders within ${MAX_DELIVERY_RADIUS_KM}km for parcel ${parcel.parcelNumber}`);
    }

    // Build parcel snapshot with isParcel: true discriminator flag
    const snapshot = this.buildParcelSnapshot(parcel);

    await this.riderRedis.addToPool(parcelOrderId);
    await this.riderRedis.setOrderSnapshot(parcelOrderId, snapshot);

    if (eligibleRiderIds && eligibleRiderIds.length > 0) {
      this.sseService.broadcastAvailableOrder(eligibleRiderIds, snapshot);
      await this.riderRedis.addEligibleRiders(parcelOrderId, eligibleRiderIds);
    }

    // Queue claim timeout to handle unclaimed parcels
    await this.deliveryQueue.add(
      'claim-timeout',
      { orderId: parcelOrderId, isParcel: true },
      { delay: this.claimTimeoutMs },
    );

    this.logger.log(
      `Parcel ${parcel.parcelNumber} stored in pool. Alerting ${eligibleRiderIds.length} riders.`,
    );
  }

  /**
   * Helper to build a parcel snapshot compatible with rider UI.
   */
  private buildParcelSnapshot(parcel: any) {
    return {
      orderId: parcel.id,
      orderNumber: parcel.parcelNumber,
      isParcel: true,

      // Rider UI backwards compatibility mapping
      total: parcel.codAmount ?? 0,
      paymentMethod: parcel.paymentMethod,
      storeName: 'Pickup Location',
      storeLat: parcel.pickupLat,
      storeLng: parcel.pickupLng,

      // Parcel specific details
      pickupAddress: parcel.pickupAddress,
      deliveryAddress: parcel.dropAddress, // map drop to delivery for UI
      dropLat: parcel.dropLat,
      dropLng: parcel.dropLng,
      category: parcel.category,
      weight: parcel.weight,
      scheduledTime: parcel.pickupTime,
    };
  }
}
