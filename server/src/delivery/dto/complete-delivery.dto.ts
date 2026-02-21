import { IsIn, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CompleteDeliveryDto {
  @ApiProperty({ enum: ['DELIVERED', 'NOT_DELIVERED'] })
  @IsString()
  @IsIn(['DELIVERED', 'NOT_DELIVERED'])
  result: 'DELIVERED' | 'NOT_DELIVERED';
}
