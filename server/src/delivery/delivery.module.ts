import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PrismaModule } from '../prisma.module';
import { BullConfigModule } from '../common/bull/bull.module';
import { DeliveryController } from './delivery.controller';
import { DeliveryAuthController } from './delivery-auth.controller';
import { DeliveryService } from './delivery.service';
import { DeliveryAuthService } from './delivery-auth.service';
import { DeliverySseService } from './delivery-sse.service';
import { AutoAssignService } from './auto-assign.service';
import { RiderRedisService } from './rider-redis.service';
import { OrderPoolService } from './order-pool.service';
import { OrderClaimService } from './order-claim.service';
import { ClaimTimeoutProcessor } from './processors/claim-timeout.processor';

@Module({
  imports: [
    PrismaModule,
    ConfigModule,
    BullConfigModule.forRoot(),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: '7d' },
      }),
    }),
  ],
  controllers: [DeliveryController, DeliveryAuthController],
  providers: [
    DeliveryService,
    DeliveryAuthService,
    DeliverySseService,
    AutoAssignService,
    RiderRedisService,
    OrderPoolService,
    OrderClaimService,
    ClaimTimeoutProcessor,
  ],
  exports: [AutoAssignService, DeliverySseService, OrderPoolService],
})
export class DeliveryModule {}
