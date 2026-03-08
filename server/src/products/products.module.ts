import { Module } from '@nestjs/common';
import { ProductsController } from './products.controller';
import { UploadsController } from './uploads.controller';
import { ProductsService } from './products.service';
import { PrismaModule } from '../prisma.module';
import { StoresModule } from '../stores/stores.module';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [PrismaModule, StoresModule, CommonModule],
  controllers: [ProductsController, UploadsController],
  providers: [ProductsService],
})
export class ProductsModule {}
