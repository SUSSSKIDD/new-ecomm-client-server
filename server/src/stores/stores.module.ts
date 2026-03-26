import { Module } from '@nestjs/common';
import { StoresController } from './stores.controller';
import { StoresService } from './stores.service';
import { SubcategoryService } from './subcategory.service';
import { PrismaModule } from '../prisma.module';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [PrismaModule, CommonModule],
  controllers: [StoresController],
  providers: [StoresService, SubcategoryService],
  exports: [StoresService, SubcategoryService],
})
export class StoresModule {}
