import {
  Injectable,
  Logger,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, randomUUID, timingSafeEqual } from 'crypto';
import { OrdersService } from '../orders/orders.service';
import { PrismaService } from '../prisma.service';
import { PaymentMethod, PaymentStatus } from '@prisma/client';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const Razorpay = require('razorpay');

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private razorpay: any;
  private readonly keyId: string;
  private readonly keySecret: string;
  private readonly webhookSecret: string;
  private readonly isMockMode: boolean;

  constructor(
    private readonly config: ConfigService,
    private readonly ordersService: OrdersService,
    private readonly prisma: PrismaService,
  ) {
    this.keyId = this.config.get('RAZORPAY_KEY_ID', '');
    this.keySecret = this.config.get('RAZORPAY_KEY_SECRET', '');
    this.webhookSecret = this.config.get('RAZORPAY_WEBHOOK_SECRET', '');

    if (this.keyId && this.keySecret) {
      this.razorpay = new Razorpay({
        key_id: this.keyId,
        key_secret: this.keySecret,
      });
      this.isMockMode = false;
      this.logger.log('Razorpay SDK initialized (LIVE mode)');
    } else {
      this.isMockMode = true;
      this.logger.warn(
        '⚡ Razorpay credentials not set — running in MOCK payment mode. All payments will auto-succeed.',
      );
    }
  }

  /**
   * Create a Razorpay order for a given internal order.
   * In mock mode: generates a fake order ID and returns mock data.
   */
  async createRazorpayOrder(userId: string, orderId: string) {
    const order = await this.ordersService.findOneBasic(userId, orderId);

    if (order.paymentMethod !== PaymentMethod.RAZORPAY) {
      throw new BadRequestException('Order is not a Razorpay order');
    }
    if (order.paymentStatus === PaymentStatus.PAID) {
      throw new BadRequestException('Order is already paid');
    }

    // If we already created a Razorpay order, return it
    if (order.razorpayOrderId) {
      return {
        razorpayOrderId: order.razorpayOrderId,
        key: this.isMockMode ? 'rzp_mock_key' : this.keyId,
        amount: Math.round(order.total * 100),
        currency: 'INR',
        orderNumber: order.orderNumber,
        mockMode: this.isMockMode,
      };
    }

    if (this.isMockMode) {
      // --- MOCK MODE ---
      const mockRpOrderId = `order_MOCK_${randomUUID().replace(/-/g, '').slice(0, 14)}`;

      await this.ordersService.setRazorpayOrderId(orderId, mockRpOrderId);

      this.logger.log(
        `[MOCK] Razorpay order ${mockRpOrderId} created for ${order.orderNumber}`,
      );

      return {
        razorpayOrderId: mockRpOrderId,
        key: 'rzp_mock_key',
        amount: Math.round(order.total * 100),
        currency: 'INR',
        orderNumber: order.orderNumber,
        mockMode: true,
      };
    }

    // --- LIVE MODE ---
    const rpOrder = await this.razorpay.orders.create({
      amount: Math.round(order.total * 100),
      currency: 'INR',
      receipt: order.orderNumber,
    });

    await this.ordersService.setRazorpayOrderId(orderId, rpOrder.id);

    this.logger.log(
      `Razorpay order ${rpOrder.id} created for order ${order.orderNumber}`,
    );

    return {
      razorpayOrderId: rpOrder.id,
      key: this.keyId,
      amount: rpOrder.amount,
      currency: rpOrder.currency,
      orderNumber: order.orderNumber,
      mockMode: false,
    };
  }

  /**
   * Mock payment: instantly marks the order as paid without real gateway.
   * Allowed in mock mode AND when using Razorpay test keys (rzp_test_*).
   * Blocked only with live production keys (rzp_live_*).
   */
  async mockPayment(userId: string, orderId: string) {
    const isTestKey = this.keyId.startsWith('rzp_test_');
    if (!this.isMockMode && !isTestKey) {
      throw new BadRequestException(
        'Mock payments are disabled with production Razorpay keys',
      );
    }

    const order = await this.ordersService.findOneBasic(userId, orderId);

    if (order.paymentStatus === PaymentStatus.PAID) {
      return {
        message: 'Order already paid',
        order,
        mockMode: true,
      };
    }

    if (order.status === 'CANCELLED') {
      throw new BadRequestException('Cannot process payment for a cancelled order');
    }

    if (order.status === 'DELIVERED') {
      throw new BadRequestException('Cannot process payment for an already delivered order');
    }

    if (order.paymentMethod !== PaymentMethod.RAZORPAY) {
      throw new BadRequestException('Order is not a Razorpay order');
    }

    const mockPaymentId = `pay_MOCK_${randomUUID().replace(/-/g, '').slice(0, 14)}`;
    const mockSignature = `mock_sig_${randomUUID().replace(/-/g, '')}`;

    const updated = await this.ordersService.markAsPaid(
      order.id,
      mockPaymentId,
      mockSignature,
    );

    this.logger.log(
      `[MOCK] Payment auto-succeeded for order ${order.orderNumber}`,
    );

    return {
      message: 'Mock payment successful',
      order: updated,
      mockMode: true,
      mockPaymentId,
    };
  }

  /**
   * Client-side payment verification via HMAC signature.
   * In mock mode: auto-succeeds.
   */
  async verifyPayment(
    userId: string,
    razorpayOrderId: string,
    razorpayPaymentId: string,
    razorpaySignature: string,
  ) {
    const order =
      await this.ordersService.findByRazorpayOrderId(razorpayOrderId);

    if (order.userId !== userId) {
      throw new ForbiddenException('Order does not belong to this user');
    }

    if (order.paymentStatus === PaymentStatus.PAID) {
      return { message: 'Order already paid', order };
    }

    if (order.status === 'CANCELLED') {
      throw new BadRequestException('Cannot verify payment for a cancelled order');
    }

    if (order.status === 'DELIVERED') {
      throw new BadRequestException('Cannot verify payment for an already delivered order');
    }

    if (this.isMockMode) {
      // In mock mode, skip signature verification
      const updated = await this.ordersService.markAsPaid(
        order.id,
        razorpayPaymentId,
        razorpaySignature,
      );

      this.logger.log(`[MOCK] Payment verified for order ${order.orderNumber}`);

      return {
        message: 'Mock payment verified successfully',
        order: updated,
        mockMode: true,
      };
    }

    // --- LIVE: verify signature (constant-time comparison) ---
    const body = `${razorpayOrderId}|${razorpayPaymentId}`;
    const expectedSignature = createHmac('sha256', this.keySecret)
      .update(body)
      .digest('hex');

    if (!this.safeCompare(expectedSignature, razorpaySignature)) {
      throw new ForbiddenException('Invalid payment signature');
    }

    const updated = await this.ordersService.markAsPaid(
      order.id,
      razorpayPaymentId,
      razorpaySignature,
    );

    this.logger.log(`Payment verified for order ${order.orderNumber}`);

    return { message: 'Payment verified successfully', order: updated };
  }

  /**
   * Server-to-server webhook from Razorpay.
   * Disabled in mock mode.
   */
  async handleWebhook(rawBody: Buffer, signature: string) {
    if (this.isMockMode) {
      return { status: 'mock_mode', message: 'Webhooks disabled in mock mode' };
    }

    if (!this.webhookSecret) {
      throw new BadRequestException('Webhook secret not configured');
    }

    const expectedSignature = createHmac('sha256', this.webhookSecret)
      .update(rawBody)
      .digest('hex');

    if (!this.safeCompare(expectedSignature, signature)) {
      this.logger.warn('Webhook signature verification failed');
      throw new ForbiddenException('Invalid webhook signature');
    }

    let payload: any;
    try {
      payload = JSON.parse(rawBody.toString());
    } catch {
      this.logger.warn('Webhook: malformed JSON body');
      return { status: 'invalid_payload' };
    }
    const event = payload.event;

    this.logger.log(`Webhook received: ${event}`);

    if (event === 'payment.captured') {
      const paymentEntity = payload.payload?.payment?.entity;
      if (!paymentEntity) return { status: 'ignored' };

      const razorpayOrderId = paymentEntity.order_id;
      const razorpayPaymentId = paymentEntity.id;

      try {
        const order =
          await this.ordersService.findByRazorpayOrderId(razorpayOrderId);

        if (order.paymentStatus === PaymentStatus.PAID) {
          this.logger.log(`Webhook: order ${order.orderNumber} already paid, skipping`);
          return { status: 'already_paid' };
        }

        if (order.status === 'CANCELLED') {
          this.logger.warn(`Webhook: order ${order.orderNumber} is cancelled, skipping payment`);
          return { status: 'order_cancelled' };
        }

        // Compute the actual payment signature (not the webhook signature)
        const paymentSignature = createHmac('sha256', this.keySecret)
          .update(`${razorpayOrderId}|${razorpayPaymentId}`)
          .digest('hex');

        await this.ordersService.markAsPaid(
          order.id,
          razorpayPaymentId,
          paymentSignature,
        );

        this.logger.log(`Webhook: order ${order.orderNumber} marked as paid`);
      } catch (err) {
        if (err instanceof NotFoundException) {
          this.logger.warn(
            `Webhook: order for Razorpay ID ${razorpayOrderId} not found, ignoring`,
          );
        } else {
          throw err;
        }
      }
    }

    return { status: 'ok' };
  }

  /**
   * Returns whether the service is in mock mode.
   */
  isInMockMode(): boolean {
    return this.isMockMode;
  }

  /**
   * Constant-time string comparison to prevent timing attacks on HMAC signatures.
   */
  private safeCompare(a: string, b: string): boolean {
    if (a.length !== b.length) {
      return false;
    }
    return timingSafeEqual(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8'));
  }
}
