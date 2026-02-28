import { Module } from '@nestjs/common';
import { ParcelController } from './parcel.controller';
import { ParcelService } from './parcel.service';
import { PrismaModule } from '../prisma.module';
import { DeliveryModule } from '../delivery/delivery.module';

@Module({
    imports: [PrismaModule, DeliveryModule],
    controllers: [ParcelController],
    providers: [ParcelService],
})
export class ParcelModule { }
