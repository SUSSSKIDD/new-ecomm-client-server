import { IsString, IsNotEmpty, IsUUID, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateDeliveryPersonDto {
  @ApiProperty({ example: 'Ravi Kumar' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: '+919876543210' })
  @IsString()
  @Matches(/^\+91[6-9]\d{9}$/, { message: 'Phone must be a valid Indian mobile number (+91XXXXXXXXXX)' })
  phone: string;

  @ApiProperty({ description: 'Home store ID for this delivery person' })
  @IsUUID()
  homeStoreId: string;
}
