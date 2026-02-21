import { Module } from '@nestjs/common';
import { StoreAdminService } from './store-admin.service';
import { StoreAdminController } from './store-admin.controller';
import { PrismaService } from '../prisma.service';

@Module({
    controllers: [StoreAdminController],
    providers: [StoreAdminService, PrismaService],
})
export class StoreAdminModule { }
