import { IsIn, IsNotEmpty, IsString, ValidateIf, MinLength, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CompleteDeliveryDto {
  @ApiProperty({ enum: ['DELIVERED', 'NOT_DELIVERED'] })
  @IsString()
  @IsIn(['DELIVERED', 'NOT_DELIVERED'])
  result: 'DELIVERED' | 'NOT_DELIVERED';

  @ApiProperty({ description: 'Mandatory reason when result is NOT_DELIVERED', required: false })
  @ValidateIf((o) => o.result === 'NOT_DELIVERED')
  @IsString()
  @IsNotEmpty({ message: 'Reason is required when result is NOT_DELIVERED' })
  @MinLength(5, { message: 'Reason must be at least 5 characters' })
  @MaxLength(500)
  reason?: string;

  @ApiProperty({ description: '4-digit delivery PIN provided by the customer', required: false })
  @ValidateIf((o) => o.result === 'DELIVERED')
  @IsString()
  @IsNotEmpty({ message: 'Delivery PIN is required' })
  @MaxLength(4)
  @MinLength(4)
  deliveryPin?: string;
}
