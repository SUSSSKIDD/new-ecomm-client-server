import { IsEnum } from 'class-validator';
import { ParcelStatus } from '@prisma/client';

export class UpdateParcelStatusDto {
    @IsEnum(ParcelStatus)
    status: ParcelStatus;
}
