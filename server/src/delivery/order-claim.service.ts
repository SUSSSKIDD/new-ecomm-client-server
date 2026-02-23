import {
  Injectable,
  Logger,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { RiderRedisService } from './rider-redis.service';
import { OrderPoolService } from './order-pool.service';
import { DeliverySseService } from './delivery-sse.service';
import { DeliveryPersonStatus } from '@prisma/client';

export interface ClaimResult {
  success: boolean;
  orderId: string;
  orderNumber?: string;
  idempotent?: boolean;
}

@Injectable()
export class OrderClaimService {
  private readonly logger = new Logger(OrderClaimService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly riderRedis: RiderRedisService,
    private readonly orderPool: OrderPoolService,
    private readonly sseService: DeliverySseService,
  ) {}

  /**
   * Atomic order claiming with 3-layer race condition protection:
   * 1. Redis SET NX — fail-fast distributed lock (~5ms)
   * 2. Prisma $transaction — DB-level verification (~15ms)
   * 3. DB unique constraint on orderId — ultimate safety net (~1ms)
   */
  async claimOrder(riderId: string, orderId: string): Promise<ClaimResult> {
    // ── Layer 0: Idempotency check ──
    const alreadyClaimed = await this.riderRedis.checkIdempotency(orderId, riderId);
    if (alreadyClaimed) {
      this.logger.log(`Idempotent retry: rider ${riderId} already claimed order ${orderId}`);
      const order = await this.prisma.order.findUnique({
        where: { id: orderId },
        select: { orderNumber: true },
      });
      return {
        success: true,
        orderId,
        orderNumber: order?.orderNumber,
        idempotent: true,
      };
    }

    // ── Layer 1: Redis distributed lock (SET NX) ──
    const lockAcquired = await this.riderRedis.acquireLock(orderId, riderId);
    if (!lockAcquired) {
      throw new ConflictException('Order already being claimed by another rider');
    }

    try {
      // ── Layer 2: Prisma interactive transaction ──
      const result = await this.prisma.$transaction(async (tx) => {
        // Verify order exists and is in valid state
        const order = await tx.order.findUnique({
          where: { id: orderId },
          select: { id: true, orderNumber: true, status: true },
        });

        if (!order) {
          throw new NotFoundException('Order not found');
        }

        if (order.status !== 'ORDER_PICKED') {
          throw new ConflictException('Order is no longer available for claiming');
        }

        // Check no existing assignment
        const existingAssignment = await tx.orderAssignment.findUnique({
          where: { orderId },
        });
        if (existingAssignment) {
          throw new ConflictException('Order already assigned');
        }

        // Verify rider is FREE
        const rider = await tx.deliveryPerson.findUnique({
          where: { id: riderId },
        });
        if (!rider || rider.status !== DeliveryPersonStatus.FREE) {
          throw new ConflictException('You must be in FREE status to claim orders');
        }

        // ── Layer 3: Create assignment (unique constraint on orderId is the final safety net) ──
        await tx.orderAssignment.create({
          data: {
            orderId,
            deliveryPersonId: riderId,
          },
        });

        await tx.deliveryPerson.update({
          where: { id: riderId },
          data: { status: DeliveryPersonStatus.BUSY },
        });

        return { orderNumber: order.orderNumber };
      });

      // ── Post-claim cleanup (Redis failures must not break the claim) ──

      let eligibleRiders: string[] = [];
      try {
        await this.orderPool.removeOrder(orderId);
      } catch (err) {
        this.logger.error(`REDIS CLEANUP FAILED: removeOrder(${orderId}): ${err.message}`);
      }

      try {
        eligibleRiders = await this.riderRedis.getEligibleRiders(orderId);
      } catch (err) {
        this.logger.error(`REDIS CLEANUP FAILED: getEligibleRiders(${orderId}): ${err.message}`);
      }

      const otherRiders = eligibleRiders.filter((id) => id !== riderId);

      // SSE: notify winner
      this.sseService.notify(riderId, {
        type: 'CLAIM_CONFIRMED',
        data: { orderId, orderNumber: result.orderNumber },
      });

      // SSE: notify other riders to remove the order
      if (otherRiders.length > 0) {
        this.sseService.broadcastOrderClaimed(otherRiders, orderId);
      }

      try {
        await this.riderRedis.setIdempotency(orderId, riderId);
      } catch (err) {
        this.logger.error(`REDIS CLEANUP FAILED: setIdempotency(${orderId}): ${err.message}`);
      }

      try {
        await this.riderRedis.deleteEligibleRiders(orderId);
      } catch (err) {
        this.logger.error(`REDIS CLEANUP FAILED: deleteEligibleRiders(${orderId}): ${err.message}`);
      }

      this.logger.log(
        `Order ${result.orderNumber} claimed by rider ${riderId}`,
      );

      return {
        success: true,
        orderId,
        orderNumber: result.orderNumber,
      };
    } catch (err) {
      // Release lock on failure (unless it's a P2002 which means someone else won)
      if (err?.code !== 'P2002') {
        await this.riderRedis.releaseLock(orderId, riderId);
      }

      // ── Layer 3 fallback: unique constraint violation ──
      if (err?.code === 'P2002') {
        this.logger.warn(`Race resolved via DB constraint: order ${orderId}`);
        throw new ConflictException('Order already claimed by another rider');
      }

      throw err;
    }
  }
}
