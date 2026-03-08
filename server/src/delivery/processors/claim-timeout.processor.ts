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

  async process(job: Job<{ orderId: string; isParcel?: boolean }>): Promise<void> {
    if (job.name === 'claim-timeout') {
      const { orderId, isParcel } = job.data;
      this.logger.log(`Processing claim-timeout for ${isParcel ? 'parcel' : 'order'} ${orderId}`);
      if (isParcel) {
        await this.orderPool.handleParcelClaimTimeout(orderId);
      } else {
        await this.orderPool.handleClaimTimeout(orderId);
      }
    }
  }
}
