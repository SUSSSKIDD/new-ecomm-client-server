import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class VerifyPaymentDto {
  @ApiProperty({ description: 'Razorpay order ID', example: 'order_abc123' })
  @IsString()
  @IsNotEmpty()
  razorpay_order_id: string;

  @ApiProperty({ description: 'Razorpay payment ID', example: 'pay_abc123' })
  @IsString()
  @IsNotEmpty()
  razorpay_payment_id: string;

  @ApiProperty({ description: 'Razorpay signature for verification' })
  @IsString()
  @IsNotEmpty()
  razorpay_signature: string;
}
