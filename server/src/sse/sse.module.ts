import { Global, Module } from '@nestjs/common';
import { UserSseService } from './user-sse.service';
import { DeliverySseService } from './delivery-sse.service';

@Global()
@Module({
  providers: [UserSseService, DeliverySseService],
  exports: [UserSseService, DeliverySseService],
})
export class SseModule {}
