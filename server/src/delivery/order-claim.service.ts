import {
  Injectable,
  Logger,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { RiderRedisService } from './rider-redis.service';
import { OrderPoolService } from './order-pool.service';
import { DeliverySseService } from '../sse/delivery-sse.service';
import { DeliveryPersonStatus } from '@prisma/client';

export interface ClaimResult {
  success: boolean;
  orderId: string;
  orderNumber?: string;
  idempotent?: boolean;
}

/** Config object for the generic claim template. */
interface ClaimConfig {
  entityId: string;
  entityLabel: string;
  validStatuses: string[];
  findEntity: (tx: any) => Promise<{ id: string; number: string; status: string } | null>;
  findExistingAssignment: (tx: any) => Promise<unknown | null>;
  createAssignment: (tx: any, riderId: string) => Promise<void>;
  getOrderNumber: () => Promise<string | undefined>;
}

@Injectable()
export class OrderClaimService {
  private readonly logger = new Logger(OrderClaimService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly riderRedis: RiderRedisService,
    private readonly orderPool: OrderPoolService,
    private readonly sseService: DeliverySseService,
  ) { }

  /**
   * Generic claim template — 3-layer race condition protection:
   * 1. Redis SET NX — fail-fast distributed lock
   * 2. Prisma $transaction — DB-level verification
   * 3. DB unique constraint — ultimate safety net
   */
  private async genericClaim(riderId: string, config: ClaimConfig): Promise<ClaimResult> {
    const { entityId, entityLabel } = config;

    // Layer 0: Idempotency check
    const alreadyClaimed = await this.riderRedis.checkIdempotency(entityId, riderId);
    if (alreadyClaimed) {
      this.logger.log(`Idempotent retry: rider ${riderId} already claimed ${entityLabel} ${entityId}`);
      const orderNumber = await config.getOrderNumber();
      return { success: true, orderId: entityId, orderNumber, idempotent: true };
    }

    // Layer 1: Redis distributed lock (SET NX)
    const lockAcquired = await this.riderRedis.acquireLock(entityId, riderId);
    if (!lockAcquired) {
      throw new ConflictException(`${entityLabel} already being claimed by another rider`);
    }

    try {
      // Layer 2: Prisma interactive transaction
      const result = await this.prisma.$transaction(async (tx) => {
        const entity = await config.findEntity(tx);
        if (!entity) throw new NotFoundException(`${entityLabel} not found`);
        if (!config.validStatuses.includes(entity.status)) {
          throw new ConflictException(`${entityLabel} is no longer available for claiming`);
        }

        const existing = await config.findExistingAssignment(tx);
        if (existing) throw new ConflictException(`${entityLabel} already assigned`);

        const rider = await tx.deliveryPerson.findUnique({ where: { id: riderId } });
        if (!rider || rider.status !== DeliveryPersonStatus.FREE) {
          throw new ConflictException(`You must be in FREE status to claim ${entityLabel.toLowerCase()}s`);
        }

        // Layer 3: Create assignment (unique constraint is the final safety net)
        await config.createAssignment(tx, riderId);

        await tx.deliveryPerson.update({
          where: { id: riderId },
          data: { status: DeliveryPersonStatus.BUSY },
        });

        return { orderNumber: entity.number };
      });

      // Post-claim cleanup with retries
      await this.safeCleanup(`removeOrder(${entityId})`, () => this.orderPool.removeOrder(entityId));

      // Notify the winner
      this.sseService.notify(riderId, {
        type: 'CLAIM_CONFIRMED',
        data: { orderId: entityId, orderNumber: result.orderNumber },
      });

      // Notify ALL other connected riders to remove from their UI
      this.sseService.broadcastOrderClaimed(riderId, entityId);

      await this.safeCleanup(`setIdempotency(${entityId})`, () =>
        this.riderRedis.setIdempotency(entityId, riderId),
      );
      await this.safeCleanup(`deleteEligibleRiders(${entityId})`, () =>
        this.riderRedis.deleteEligibleRiders(entityId),
      );

      this.logger.log(`${entityLabel} ${result.orderNumber} claimed by rider ${riderId}`);
      return { success: true, orderId: entityId, orderNumber: result.orderNumber };
    } catch (err) {
      if (err?.code !== 'P2002') {
        await this.riderRedis.releaseLock(entityId, riderId);
      }
      // Layer 3 fallback: unique constraint violation
      if (err?.code === 'P2002') {
        this.logger.warn(`Race resolved via DB constraint: ${entityLabel} ${entityId}`);
        throw new ConflictException(`${entityLabel} already claimed by another rider`);
      }
      throw err;
    }
  }

  /** Claim a grocery order. */
  async claimOrder(riderId: string, orderId: string): Promise<ClaimResult> {
    return this.genericClaim(riderId, {
      entityId: orderId,
      entityLabel: 'Order',
      validStatuses: ['CONFIRMED', 'PROCESSING', 'ORDER_PICKED'],
      findEntity: async (tx) => {
        const order = await tx.order.findUnique({
          where: { id: orderId },
          select: { id: true, orderNumber: true, status: true },
        });
        return order ? { id: order.id, number: order.orderNumber, status: order.status } : null;
      },
      findExistingAssignment: (tx) => tx.orderAssignment.findUnique({ where: { orderId } }),
      createAssignment: (tx, rid) => tx.orderAssignment.create({
        data: { orderId, deliveryPersonId: rid, acceptedAt: new Date() },
      }),
      getOrderNumber: async () => {
        const order = await this.prisma.order.findUnique({
          where: { id: orderId },
          select: { orderNumber: true },
        });
        return order?.orderNumber;
      },
    });
  }

  /** Claim a parcel order. */
  async claimParcelOrder(riderId: string, parcelOrderId: string): Promise<ClaimResult> {
    return this.genericClaim(riderId, {
      entityId: parcelOrderId,
      entityLabel: 'Parcel',
      validStatuses: ['READY_FOR_PICKUP'],
      findEntity: async (tx) => {
        const parcel = await tx.parcelOrder.findUnique({
          where: { id: parcelOrderId },
          select: { id: true, parcelNumber: true, status: true },
        });
        return parcel ? { id: parcel.id, number: parcel.parcelNumber, status: parcel.status } : null;
      },
      findExistingAssignment: (tx) => tx.parcelAssignment.findUnique({ where: { parcelOrderId } }),
      createAssignment: async (tx, rid) => {
        await tx.parcelAssignment.create({
          data: { parcelOrderId, deliveryPersonId: rid, acceptedAt: new Date() },
        });
        await tx.parcelOrder.update({
          where: { id: parcelOrderId },
          data: { status: 'ASSIGNED' },
        });
      },
      getOrderNumber: async () => {
        const parcel = await this.prisma.parcelOrder.findUnique({
          where: { id: parcelOrderId },
          select: { parcelNumber: true },
        });
        return parcel?.parcelNumber;
      },
    });
  }

  /** Safely execute Redis cleanups with retries for transient network faults. */
  private async safeCleanup(description: string, fn: () => Promise<void>) {
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        await fn();
        return;
      } catch (err) {
        if (attempt >= 3) {
          this.logger.error(`REDIS CLEANUP FAILED (${description}) after 3 attempts: ${err.message}`);
        } else {
          await new Promise((r) => setTimeout(r, 1000));
        }
      }
    }
  }
}
