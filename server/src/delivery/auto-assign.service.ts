import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { DeliveryService } from './delivery.service';
import { DeliverySseService } from './delivery-sse.service';
import { RedisCacheService } from '../common/services/redis-cache.service';
import { haversineDistance } from '../common/utils/geo.util';
import { DeliveryPersonStatus } from '@prisma/client';

@Injectable()
export class AutoAssignService {
  private readonly logger = new Logger(AutoAssignService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly deliveryService: DeliveryService,
    private readonly sseService: DeliverySseService,
    private readonly cache: RedisCacheService,
  ) { }

  /**
   * Auto-assign an order to the nearest FREE delivery person.
   * Called after COD order confirmed or Razorpay payment verified.
   */
  async assignOrder(orderId: string): Promise<void> {
    // Parallel: fetch order + check existing assignment
    const [order, existing] = await Promise.all([
      this.prisma.order.findUnique({
        where: { id: orderId },
        include: { items: true },
      }),
      this.prisma.orderAssignment.findUnique({
        where: { orderId },
      }),
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
      this.logger.warn(
        `Order ${order.orderNumber} has no store assignments, cannot auto-assign`,
      );
      return;
    }

    // Get store with most items
    let primaryStoreId = '';
    let maxCount = 0;
    for (const [storeId, count] of storeCounts) {
      if (count > maxCount) {
        primaryStoreId = storeId;
        maxCount = count;
      }
    }

    // Parallel: fetch store + free delivery persons
    const [store, freePersons] = await Promise.all([
      this.prisma.store.findUnique({
        where: { id: primaryStoreId },
      }),
      this.prisma.deliveryPerson.findMany({
        where: { status: DeliveryPersonStatus.FREE, isActive: true },
        take: 50,
      }),
    ]);
    if (!store) return;

    if (freePersons.length === 0) {
      this.logger.warn(
        `No free delivery persons for order ${order.orderNumber}`,
      );
      return;
    }

    // Batch-fetch cached locations in a single mget call (instead of N individual GETs)
    const locationKeys = freePersons.map((p) => `dp:loc:${p.id}`);
    const cachedLocations = await this.cache.mget<{ lat: number; lng: number; updatedAt: string }>(
      ...locationKeys,
    );

    // Compute distances using cached or DB-stored coordinates
    const personsWithDistance = freePersons.map((p, i) => {
      const cached = cachedLocations[i];
      const lat = cached?.lat ?? p.lat;
      const lng = cached?.lng ?? p.lng;

      const distance =
        lat != null && lng != null && store.lat != null && store.lng != null
          ? haversineDistance(lat, lng, store.lat, store.lng)
          : Infinity;

      this.logger.debug(
        `DP ${p.name} (${p.id}): cached=${!!cached}, db=(${p.lat}, ${p.lng}), final=(${lat}, ${lng}), dist=${distance}`,
      );

      return { person: p, distance };
    });

    personsWithDistance.sort((a, b) => a.distance - b.distance);
    const closest = personsWithDistance[0];

    if (closest.distance === Infinity) {
      this.logger.warn(
        `No delivery persons with known location for order ${order.orderNumber}. Store: ${store.name} (${store.lat}, ${store.lng}).`,
      );
      return;
    }

    // Assign inside interactive transaction with re-verification
    try {
      await this.prisma.$transaction(async (tx) => {
        // Re-check no assignment exists (race-safe inside transaction)
        const existingAssignment = await tx.orderAssignment.findUnique({
          where: { orderId },
        });
        if (existingAssignment) return;

        // Re-check order is still in a valid state for assignment
        const currentOrder = await tx.order.findUnique({
          where: { id: orderId },
          select: { status: true },
        });
        if (!currentOrder || currentOrder.status === 'CANCELLED' || currentOrder.status === 'DELIVERED') return;

        // Re-check delivery person is still FREE
        const dp = await tx.deliveryPerson.findUnique({
          where: { id: closest.person.id },
        });
        if (!dp || dp.status !== DeliveryPersonStatus.FREE) return;

        await tx.orderAssignment.create({
          data: {
            orderId,
            deliveryPersonId: closest.person.id,
          },
        });
        await tx.deliveryPerson.update({
          where: { id: closest.person.id },
          data: { status: DeliveryPersonStatus.BUSY },
        });
      });
    } catch (err) {
      // Unique constraint violation means another process assigned first — safe to ignore
      if (err?.code === 'P2002') {
        this.logger.warn(`Order ${order.orderNumber} was already assigned (race resolved)`);
        return;
      }
      throw err;
    }

    // Verify assignment actually happened before notifying
    const assignment = await this.prisma.orderAssignment.findUnique({
      where: { orderId },
    });
    if (assignment?.deliveryPersonId === closest.person.id) {
      this.sseService.notifyNewOrder(closest.person.id, order);
      this.logger.log(
        `Order ${order.orderNumber} assigned to ${closest.person.name} (${closest.distance.toFixed(1)}km from store)`,
      );
    }
  }

  /**
   * Check for pending unassigned orders when a delivery person becomes FREE.
   */
  async checkPendingOrders(personId: string): Promise<void> {
    let assignedOrder: any = null;

    try {
      await this.prisma.$transaction(async (tx) => {
        // Re-verify person is still FREE inside transaction
        const person = await tx.deliveryPerson.findUnique({
          where: { id: personId },
        });
        if (!person || person.status !== DeliveryPersonStatus.FREE) return;

        // Find ORDER_PICKED orders without assignment
        const unassigned = await tx.order.findFirst({
          where: {
            status: 'ORDER_PICKED',
            assignment: null,
            items: { some: { storeId: { not: null } } },
          },
          orderBy: { createdAt: 'asc' },
          include: { items: true },
        });

        if (!unassigned) return;

        // Double-check no assignment was created between query and now
        const existingAssignment = await tx.orderAssignment.findUnique({
          where: { orderId: unassigned.id },
        });
        if (existingAssignment) return;

        await tx.orderAssignment.create({
          data: {
            orderId: unassigned.id,
            deliveryPersonId: personId,
          },
        });
        await tx.deliveryPerson.update({
          where: { id: personId },
          data: { status: DeliveryPersonStatus.BUSY },
        });

        assignedOrder = unassigned;
        this.logger.log(
          `Pending order ${unassigned.orderNumber} assigned to ${person.name}`,
        );
      });
    } catch (err) {
      // Unique constraint violation — another process assigned first
      if (err?.code === 'P2002') {
        this.logger.warn(`Race resolved in checkPendingOrders for person ${personId}`);
        return;
      }
      throw err;
    }

    // Notify outside the transaction to avoid holding it open
    if (assignedOrder) {
      this.sseService.notifyNewOrder(personId, assignedOrder);
    }
  }
}
