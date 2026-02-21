import {
  Controller,
  Post,
  Param,
  Body,
  Headers,
  UseGuards,
  Req,
  RawBody,
  Get,
  ParseUUIDPipe,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiExcludeEndpoint,
} from '@nestjs/swagger';
import { Request } from 'express';
import { PaymentsService } from './payments.service';
import { VerifyPaymentDto } from './dto/verify-payment.dto';

interface AuthenticatedRequest extends Request {
  user: { sub: string; phone: string; role: string };
}

@ApiTags('payments')
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get('status')
  @ApiOperation({ summary: 'Check payment gateway status (mock vs live)' })
  getStatus() {
    return {
      mockMode: this.paymentsService.isInMockMode(),
      message: this.paymentsService.isInMockMode()
        ? 'Running in MOCK mode — all payments auto-succeed'
        : 'Running in LIVE mode — connected to Razorpay',
    };
  }

  @Post('create/:orderId')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Create a Razorpay order for payment' })
  async createRazorpayOrder(
    @Req() req: AuthenticatedRequest,
    @Param('orderId', ParseUUIDPipe) orderId: string,
  ) {
    return this.paymentsService.createRazorpayOrder(req.user.sub, orderId);
  }

  @Post('mock/:orderId')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({
    summary: 'Mock payment — instantly mark order as paid (dev only)',
  })
  async mockPayment(
    @Req() req: AuthenticatedRequest,
    @Param('orderId', ParseUUIDPipe) orderId: string,
  ) {
    return this.paymentsService.mockPayment(req.user.sub, orderId);
  }

  @Post('verify')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Verify Razorpay payment (client-side)' })
  async verifyPayment(
    @Req() req: AuthenticatedRequest,
    @Body() dto: VerifyPaymentDto,
  ) {
    return this.paymentsService.verifyPayment(
      req.user.sub,
      dto.razorpay_order_id,
      dto.razorpay_payment_id,
      dto.razorpay_signature,
    );
  }

  @Post('webhook')
  @ApiExcludeEndpoint()
  async handleWebhook(
    @RawBody() rawBody: Buffer,
    @Headers('x-razorpay-signature') signature: string,
  ) {
    return this.paymentsService.handleWebhook(rawBody, signature);
  }
}
