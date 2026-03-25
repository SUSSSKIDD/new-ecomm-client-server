import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma.service';
import { RiderRedisService } from './rider-redis.service';
import { DeliverySseService } from '../sse/delivery-sse.service';
import { RedisCacheService } from '../common/services/redis-cache.service';
import { DEFAULT_MAX_DELIVERY_RADIUS_KM } from '../common/utils/geo.util';
import { DeliveryPersonStatus } from '@prisma/client';

@Injectable()
export class OrderPoolService {
  private readonly logger = new Logger(OrderPoolService.name);
  private readonly claimTimeoutMs: number;
  private readonly maxDeliveryRadiusKm: number;

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
    this.maxDeliveryRadiusKm =
      config.get<number>('MAX_DELIVERY_RADIUS_KM') ?? DEFAULT_MAX_DELIVERY_RADIUS_KM;
  }

  /**
   * Broadcast an order to all nearby FREE riders.
   * Called when an order reaches ORDER_PICKED status.
   */
  async broadcastOrder(orderId: string): Promise<void> {
    const [order, existing] = await Promise.all([
      this.prisma.order.findUnique({
        where: { id: orderId },
        include: { items: true },
      }),
      this.prisma.orderAssignment.findUnique({ where: { orderId } }),
    ]);

    if (!order || existing) return;
    if (OrderPoolService.ORDER_TERMINAL.has(order.status)) return;

    // Skip parent orders — each child order gets its own delivery assignment
    if (order.isParent) {
      this.logger.log(`Skipping parent order ${order.orderNumber} — children have their own assignments`);
      return;
    }

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

    const eligibleRiderIds = await this.getNearbyFreeRiders(store.lng, store.lat);
    const snapshot = this.buildOrderSnapshot(order, store);

    await this.storeAndBroadcast(orderId, snapshot, eligibleRiderIds, { orderId });

    if (eligibleRiderIds.length === 0) {
      this.logger.warn(`No FREE riders within ${this.maxDeliveryRadiusKm}km for order ${order.orderNumber}`);
    } else {
      this.logger.log(`Order ${order.orderNumber} broadcast to ${eligibleRiderIds.length} riders`);
    }
  }

  /** Terminal statuses — orders in these states must NOT be re-broadcast. */
  private static readonly ORDER_TERMINAL = new Set(['CANCELLED', 'DELIVERED']);
  private static readonly PARCEL_TERMINAL = new Set(['CANCELLED', 'DELIVERED']);

  /**
   * Re-broadcast order if unclaimed after timeout.
   */
  async handleClaimTimeout(orderId: string): Promise<void> {
    // Check if order is still in pool (not yet claimed)
    const isInPool = await this.riderRedis.isOrderInPool(orderId);
    if (!isInPool) return; // already claimed

    // Verify order still exists and is in a broadcastable state
    const [order, assignment] = await Promise.all([
      this.prisma.order.findUnique({ where: { id: orderId }, select: { status: true } }),
      this.prisma.orderAssignment.findUnique({ where: { orderId } }),
    ]);

    // Order deleted, in terminal state, or already assigned — remove from pool
    if (!order || OrderPoolService.ORDER_TERMINAL.has(order.status) || assignment) {
      this.logger.log(`Order ${orderId} is ${order?.status ?? 'deleted'} — removing from pool`);
      await this.removeOrder(orderId);
      return;
    }

    this.logger.log(`Order ${orderId} unclaimed after timeout, re-broadcasting`);

    // Clean up old eligible set and re-broadcast
    await this.riderRedis.deleteEligibleRiders(orderId);
    await this.broadcastOrder(orderId);
  }

  /**
   * Re-broadcast PARCEL order if unclaimed after timeout.
   */
  async handleParcelClaimTimeout(parcelOrderId: string): Promise<void> {
    const isInPool = await this.riderRedis.isOrderInPool(parcelOrderId);
    if (!isInPool) return;

    // Verify parcel still exists and is in a broadcastable state
    const [parcel, assignment] = await Promise.all([
      this.prisma.parcelOrder.findUnique({ where: { id: parcelOrderId }, select: { status: true } }),
      this.prisma.parcelAssignment.findUnique({ where: { parcelOrderId } }),
    ]);

    // Parcel deleted, in terminal state, or already assigned — remove from pool
    if (!parcel || OrderPoolService.PARCEL_TERMINAL.has(parcel.status) || assignment) {
      this.logger.log(`Parcel ${parcelOrderId} is ${parcel?.status ?? 'deleted'} — removing from pool`);
      await this.removeOrder(parcelOrderId);
      return;
    }

    this.logger.log(`Parcel ${parcelOrderId} unclaimed after timeout, re-broadcasting`);

    await this.riderRedis.deleteEligibleRiders(parcelOrderId);
    await this.broadcastParcelOrder(parcelOrderId);
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

  /**
   * Find nearby FREE riders using Redis GEOSEARCH + Prisma verification.
   * Shared by both order and parcel broadcast flows.
   */
  private async getNearbyFreeRiders(
    lng: number,
    lat: number,
    options?: { fallbackToGlobal?: boolean },
  ): Promise<string[]> {
    const nearestRiderIds = await this.cache.geoSearchRadius(
      'riders_location',
      lng,
      lat,
      this.maxDeliveryRadiusKm,
      50,
      'km',
    );

    if (nearestRiderIds.length > 0) {
      const freePersons = await this.prisma.deliveryPerson.findMany({
        where: {
          id: { in: nearestRiderIds },
          status: DeliveryPersonStatus.FREE,
          isActive: true,
        },
        select: { id: true },
      });

      const freeSet = new Set(freePersons.map((p) => p.id));
      const eligible = nearestRiderIds.filter((id) => freeSet.has(id)).slice(0, 10);
      if (eligible.length > 0) return eligible;
    }

    // Fallback to global FREE riders if enabled (used by parcels)
    if (options?.fallbackToGlobal) {
      this.logger.warn(`No riders within ${this.maxDeliveryRadiusKm}km — falling back to global FREE riders`);
      const freePersons = await this.prisma.deliveryPerson.findMany({
        where: { status: DeliveryPersonStatus.FREE, isActive: true },
        select: { id: true },
        take: 10,
      });
      return freePersons.map((p) => p.id);
    }

    return [];
  }

  /**
   * Store snapshot in pool + notify eligible riders + schedule claim timeout.
   */
  private async storeAndBroadcast(
    orderId: string,
    snapshot: Record<string, unknown>,
    eligibleRiderIds: string[],
    jobData: Record<string, unknown>,
  ): Promise<void> {
    await Promise.all([
      this.riderRedis.addToPool(orderId),
      this.riderRedis.setOrderSnapshot(orderId, snapshot),
    ]);

    if (eligibleRiderIds.length > 0) {
      await this.riderRedis.addEligibleRiders(orderId, eligibleRiderIds);
      this.sseService.broadcastAvailableOrder(eligibleRiderIds, snapshot);
    }

    await this.deliveryQueue.add(
      'claim-timeout',
      jobData,
      { delay: this.claimTimeoutMs, removeOnComplete: true, removeOnFail: 100 },
    );
  }

  private buildOrderSnapshot(order: any, store: any): Record<string, unknown> {
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
      storeAddress: store.address ?? store.name,
      storeLat: store.lat,
      storeLng: store.lng,
      createdAt: order.createdAt,
    };
  }

  private buildParcelSnapshot(parcel: any): Record<string, unknown> {
    return {
      orderId: parcel.id,
      orderNumber: parcel.parcelNumber,
      isParcel: true,
      total: parcel.codAmount ?? 0,
      paymentMethod: parcel.paymentMethod,
      storeName: 'Pickup Location',
      storeLat: parcel.pickupLat,
      storeLng: parcel.pickupLng,
      pickupAddress: parcel.pickupAddress,
      deliveryAddress: parcel.dropAddress,
      dropLat: parcel.dropLat,
      dropLng: parcel.dropLng,
      category: parcel.category,
      weight: parcel.weight,
      scheduledTime: parcel.pickupTime,
    };
  }

  /**
   * Broadcast a PARCEL order to all nearby FREE riders.
   */
  async broadcastParcelOrder(parcelOrderId: string): Promise<void> {
    const [parcel, existing] = await Promise.all([
      this.prisma.parcelOrder.findUnique({ where: { id: parcelOrderId } }),
      this.prisma.parcelAssignment.findUnique({ where: { parcelOrderId } }),
    ]);

    if (!parcel || existing) return;
    if (OrderPoolService.PARCEL_TERMINAL.has(parcel.status)) return;
    if (parcel.pickupLat == null || parcel.pickupLng == null) return;

    const eligibleRiderIds = await this.getNearbyFreeRiders(
      parcel.pickupLng,
      parcel.pickupLat,
      { fallbackToGlobal: true },
    );

    const snapshot = this.buildParcelSnapshot(parcel);

    await this.storeAndBroadcast(
      parcelOrderId,
      snapshot,
      eligibleRiderIds,
      { orderId: parcelOrderId, isParcel: true },
    );

    this.logger.log(
      `Parcel ${parcel.parcelNumber} stored in pool. Alerting ${eligibleRiderIds.length} riders.`,
    );
  }
}
