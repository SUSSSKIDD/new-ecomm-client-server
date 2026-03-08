import { Controller, Post, Body, HttpCode, HttpStatus, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { SendOtpDto, VerifyOtpDto, StoreManagerLoginDto } from './dto/auth.dto';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ConfigurableThrottlerGuard } from './guards/configurable-throttler.guard';

@ApiTags('auth')
@Controller('auth')
@UseGuards(ConfigurableThrottlerGuard)
export class AuthController {
  constructor(private readonly authService: AuthService) { }

  @Post('send-otp')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @ApiOperation({ summary: 'Send OTP to phone number' })
  @ApiResponse({ status: 200, description: 'OTP sent successfully.' })
  @ApiResponse({ status: 400, description: 'Invalid phone number.' })
  sendOtp(@Body() sendOtpDto: SendOtpDto) {
    return this.authService.sendOtp(sendOtpDto);
  }

  @Post('verify-otp')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  @ApiOperation({ summary: 'Verify OTP and login/register' })
  @ApiResponse({ status: 200, description: 'User verified and token issued.' })
  @ApiResponse({ status: 401, description: 'Invalid OTP.' })
  verifyOtp(@Body() verifyOtpDto: VerifyOtpDto) {
    return this.authService.verifyOtp(verifyOtpDto);
  }

  @Post('store-manager/login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  @ApiOperation({ summary: 'Store Manager Login (Phone + PIN)' })
  @ApiResponse({ status: 200, description: 'Token issued.' })
  @ApiResponse({ status: 401, description: 'Invalid credentials.' })
  storeManagerLogin(@Body() dto: StoreManagerLoginDto) {
    return this.authService.storeManagerLogin(dto);
  }

  @Post('super-admin/login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @ApiOperation({ summary: 'Super Admin Login (Phone + PIN)' })
  @ApiResponse({ status: 200, description: 'Token issued.' })
  @ApiResponse({ status: 401, description: 'Invalid credentials.' })
  superAdminLogin(@Body() dto: StoreManagerLoginDto) {
    return this.authService.superAdminLogin(dto);
  }

  @Post('parcel-manager/login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  @ApiOperation({ summary: 'Parcel Manager Login (Phone + PIN)' })
  @ApiResponse({ status: 200, description: 'Token issued.' })
  @ApiResponse({ status: 401, description: 'Invalid credentials.' })
  parcelManagerLogin(@Body() dto: StoreManagerLoginDto) {
    return this.authService.parcelManagerLogin(dto);
  }
}
