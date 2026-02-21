import { Module } from '@nestjs/common';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { OrderFulfillmentService } from './order-fulfillment.service';
import { PrismaModule } from '../prisma.module';
import { CartModule } from '../cart/cart.module';
import { StoresModule } from '../stores/stores.module';
import { DeliveryModule } from '../delivery/delivery.module';

@Module({
  imports: [PrismaModule, CartModule, StoresModule, DeliveryModule],
  controllers: [OrdersController],
  providers: [OrdersService, OrderFulfillmentService],
  exports: [OrdersService],
})
export class OrdersModule {}
