import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { OrderPoolService } from './order-pool.service';

@Injectable()
export class AutoAssignService {
  private readonly logger = new Logger(AutoAssignService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly orderPool: OrderPoolService,
  ) { }

  async assignOrder(orderId: string): Promise<number> {
    return this.orderPool.broadcastOrder(orderId);
  }

  /**
   * When a rider becomes FREE, broadcast all unassigned ORDER_PICKED orders to them.
   */
  async checkPendingOrders(personId: string): Promise<void> {
    // Find unassigned pending/processing/picked orders
    const unassigned = await this.prisma.order.findMany({
      where: {
        status: { in: ['CONFIRMED', 'PROCESSING', 'ORDER_PICKED'] },
        assignment: null,
        isParent: false, // Exclude parent orders — children get their own assignments
        items: { some: { storeId: { not: null } } },
      },
      orderBy: { createdAt: 'asc' },
      take: 10,
    });

    if (unassigned.length === 0) return;

    this.logger.log(
      `Rider ${personId} went FREE — broadcasting ${unassigned.length} pending orders`,
    );

    // Broadcast each unassigned order (broadcastOrder is idempotent — skips if already in pool)
    for (const order of unassigned) {
      await this.orderPool.broadcastOrder(order.id).catch((err) =>
        this.logger.error(`broadcastOrder error for ${order.id}: ${err.message}`),
      );
    }
  }

  /**
   * When a rider becomes FREE, broadcast all unassigned READY_FOR_PICKUP parcels.
   */
  async checkPendingParcelOrders(personId: string): Promise<void> {
    const unassignedParcels = await this.prisma.parcelOrder.findMany({
      where: {
        status: 'READY_FOR_PICKUP',
        assignment: null,
      },
      orderBy: { createdAt: 'asc' },
      take: 10,
    });

    if (unassignedParcels.length === 0) return;

    this.logger.log(
      `Rider ${personId} went FREE — broadcasting ${unassignedParcels.length} pending parcels`,
    );

    for (const parcel of unassignedParcels) {
      await this.orderPool.broadcastParcelOrder(parcel.id).catch((err) =>
        this.logger.error(`broadcastParcelOrder error for ${parcel.id}: ${err.message}`),
      );
    }
  }
}
