import { IsString, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class DeliveryLoginDto {
  @ApiProperty({ example: '+919876543210' })
  @IsString()
  @Matches(/^\+91[6-9]\d{9}$/, { message: 'Phone must be a valid Indian mobile number (+91XXXXXXXXXX)' })
  phone: string;

  @ApiProperty({ example: '1234', description: '4-digit PIN' })
  @IsString()
  @Matches(/^\d{4}$/, { message: 'PIN must be exactly 4 digits' })
  pin: string;
}
