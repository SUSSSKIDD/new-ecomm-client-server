import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { PrismaModule } from './prisma.module';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { ProductsModule } from './products/products.module';
import { CommonModule } from './common/common.module';
import { SearchModule } from './search/search.module';
import { CartModule } from './cart/cart.module';
import { OrdersModule } from './orders/orders.module';
import { PaymentsModule } from './payments/payments.module';
import { StoresModule } from './stores/stores.module';
import { DeliveryModule } from './delivery/delivery.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { StoreManagerModule } from './store-manager/store-manager.module';
import { LedgerModule } from './ledger/ledger.module';
import { SmsModule } from './sms/sms.module';
import { ParcelModule } from './parcel/parcel.module';
import { PrintModule } from './print/print.module';
import { SseModule } from './sse/sse.module';


@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([
      { name: 'short', ttl: 1000, limit: 5 },
      { name: 'medium', ttl: 10000, limit: 30 },
      { name: 'long', ttl: 60000, limit: 100 },
    ]),
    CommonModule,
    AuthModule,
    UsersModule,
    PrismaModule,
    ProductsModule,
    SearchModule,
    CartModule,
    OrdersModule,
    PaymentsModule,
    StoresModule,
    DeliveryModule,

    DashboardModule,
    StoreManagerModule,
    LedgerModule,
    SmsModule,
    ParcelModule,
    PrintModule,
    SseModule,

  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }
