import { Module } from '@nestjs/common';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { OrderFulfillmentService } from './order-fulfillment.service';
import { AllocationService } from './allocation.service';
import { PrismaModule } from '../prisma.module';
import { CartModule } from '../cart/cart.module';
import { StoresModule } from '../stores/stores.module';
import { DeliveryModule } from '../delivery/delivery.module';
import { LedgerModule } from '../ledger/ledger.module';

@Module({
  imports: [PrismaModule, CartModule, StoresModule, DeliveryModule, LedgerModule],
  controllers: [OrdersController],
  providers: [OrdersService, OrderFulfillmentService, AllocationService],
  exports: [OrdersService],
})
export class OrdersModule {}
