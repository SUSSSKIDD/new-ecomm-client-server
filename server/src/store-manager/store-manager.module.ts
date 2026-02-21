import { Module } from '@nestjs/common';
import { StoreManagerService } from './store-manager.service';
import { StoreManagerController } from './store-manager.controller';
import { PrismaModule } from '../prisma.module';

@Module({
    imports: [PrismaModule],
    controllers: [StoreManagerController],
    providers: [StoreManagerService],
    exports: [StoreManagerService],
})
export class StoreManagerModule { }
