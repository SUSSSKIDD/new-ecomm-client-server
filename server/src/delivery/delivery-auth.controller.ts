import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { ThrottlerGuard, Throttle } from '@nestjs/throttler';
import { DeliveryAuthService } from './delivery-auth.service';
import { DeliveryLoginDto } from './dto/delivery-login.dto';

@ApiTags('delivery')
@Controller('delivery/auth')
@UseGuards(ThrottlerGuard)
export class DeliveryAuthController {
  constructor(private readonly authService: DeliveryAuthService) {}

  @Post('login')
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  @ApiOperation({ summary: 'Delivery person login (phone + PIN)' })
  login(@Body() dto: DeliveryLoginDto) {
    return this.authService.login(dto);
  }
}
