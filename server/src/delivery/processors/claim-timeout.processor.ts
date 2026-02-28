import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { OrderPoolService } from '../order-pool.service';

@Processor('delivery')
export class ClaimTimeoutProcessor extends WorkerHost {
  private readonly logger = new Logger(ClaimTimeoutProcessor.name);

  constructor(private readonly orderPool: OrderPoolService) {
    super();
  }

  async process(job: Job<{ orderId: string }>): Promise<void> {
    if (job.name === 'claim-timeout') {
      this.logger.log(`Processing claim-timeout for order ${job.data.orderId}`);
      await this.orderPool.handleClaimTimeout(job.data.orderId);
    }
  }
}
