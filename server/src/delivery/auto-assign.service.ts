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

}
