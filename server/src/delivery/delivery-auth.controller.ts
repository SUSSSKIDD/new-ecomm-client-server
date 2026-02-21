import { Controller, Post, Body } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { DeliveryAuthService } from './delivery-auth.service';
import { DeliveryLoginDto } from './dto/delivery-login.dto';

@ApiTags('delivery')
@Controller('delivery/auth')
export class DeliveryAuthController {
  constructor(private readonly authService: DeliveryAuthService) {}

  @Post('login')
  @ApiOperation({ summary: 'Delivery person login (phone + PIN)' })
  login(@Body() dto: DeliveryLoginDto) {
    return this.authService.login(dto);
  }
}
