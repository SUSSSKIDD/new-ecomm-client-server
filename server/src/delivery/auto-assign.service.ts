import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { OrderPoolService } from './order-pool.service';

@Injectable()
export class AutoAssignService {
  private readonly logger = new Logger(AutoAssignService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly orderPool: OrderPoolService,
  ) {}

  /**
   * Broadcast an order to all nearby FREE riders for competitive claiming.
   * Called after COD order confirmed or Razorpay payment verified.
   */
  async assignOrder(orderId: string): Promise<void> {
    await this.orderPool.broadcastOrder(orderId);
  }

  /**
   * When a rider becomes FREE, broadcast all unassigned ORDER_PICKED orders to them.
   */
  async checkPendingOrders(personId: string): Promise<void> {
    // Find unassigned ORDER_PICKED orders
    const unassigned = await this.prisma.order.findMany({
      where: {
        status: 'ORDER_PICKED',
        assignment: null,
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
}
