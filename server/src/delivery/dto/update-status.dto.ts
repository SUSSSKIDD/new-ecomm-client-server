import { IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { DeliveryPersonStatus } from '@prisma/client';

export class UpdateStatusDto {
  @ApiProperty({ enum: DeliveryPersonStatus })
  @IsEnum(DeliveryPersonStatus)
  status: DeliveryPersonStatus;
}
