import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { OrdersService } from '../orders/orders.service';
import { PrismaService } from '../prisma.service';
import { PaymentMethod, PaymentStatus, OrderStatus } from '@prisma/client';
import { createHmac } from 'crypto';

describe('PaymentsService', () => {
  let service: PaymentsService;
  let ordersService: jest.Mocked<OrdersService>;
  let configService: ConfigService;

  const mockOrder = {
    id: 'order-uuid-1',
    userId: 'user-uuid-1',
    orderNumber: 'UD-20260214-A1B2C3',
    status: OrderStatus.PENDING,
    paymentMethod: PaymentMethod.RAZORPAY,
    paymentStatus: PaymentStatus.PENDING,
    total: 599.5,
    subtotal: 550,
    deliveryFee: 0,
    tax: 49.5,
    razorpayOrderId: null,
    razorpayPaymentId: null,
    razorpaySignature: null,
    idempotencyKey: 'idem-key-1',
    deliveryAddress: {},
    createdAt: new Date(),
    updatedAt: new Date(),
    paidAt: null,
    deliveredAt: null,
    items: [],
    assignment: null,
  };

  const mockOrdersService = {
    findOne: jest.fn(),
    findByRazorpayOrderId: jest.fn(),
    setRazorpayOrderId: jest.fn(),
    markAsPaid: jest.fn(),
  };

  const mockPrismaService = {};

  // ─── MOCK MODE TESTS ───────────────────────────────────────────

  describe('Mock Mode (no Razorpay credentials)', () => {
    beforeEach(async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          PaymentsService,
          {
            provide: OrdersService,
            useValue: mockOrdersService,
          },
          {
            provide: PrismaService,
            useValue: mockPrismaService,
          },
          {
            provide: ConfigService,
            useValue: {
              get: (key: string, defaultVal?: string) => {
                const config: Record<string, string> = {
                  RAZORPAY_KEY_ID: '',
                  RAZORPAY_KEY_SECRET: '',
                  RAZORPAY_WEBHOOK_SECRET: '',
                };
                return config[key] ?? defaultVal ?? '';
              },
            },
          },
        ],
      }).compile();

      service = module.get<PaymentsService>(PaymentsService);
      ordersService = module.get(OrdersService);
      jest.clearAllMocks();
    });

    it('should be in mock mode', () => {
      expect(service.isInMockMode()).toBe(true);
    });

    describe('createRazorpayOrder', () => {
      it('should create a mock Razorpay order', async () => {
        ordersService.findOne.mockResolvedValue({ ...mockOrder });
        ordersService.setRazorpayOrderId.mockResolvedValue(undefined);

        const result = await service.createRazorpayOrder(
          'user-uuid-1',
          'order-uuid-1',
        );

        expect(result.mockMode).toBe(true);
        expect(result.razorpayOrderId).toMatch(/^order_MOCK_/);
        expect(result.key).toBe('rzp_mock_key');
        expect(result.amount).toBe(59950); // 599.5 * 100
        expect(result.currency).toBe('INR');
        expect(ordersService.setRazorpayOrderId).toHaveBeenCalled();
      });

      it('should return existing Razorpay order if already created', async () => {
        const orderWithRpId = {
          ...mockOrder,
          razorpayOrderId: 'order_MOCK_existing123',
        };
        ordersService.findOne.mockResolvedValue(orderWithRpId);

        const result = await service.createRazorpayOrder(
          'user-uuid-1',
          'order-uuid-1',
        );

        expect(result.razorpayOrderId).toBe('order_MOCK_existing123');
        expect(ordersService.setRazorpayOrderId).not.toHaveBeenCalled();
      });

      it('should reject non-Razorpay orders', async () => {
        ordersService.findOne.mockResolvedValue({
          ...mockOrder,
          paymentMethod: PaymentMethod.COD,
        });

        await expect(
          service.createRazorpayOrder('user-uuid-1', 'order-uuid-1'),
        ).rejects.toThrow(BadRequestException);
      });

      it('should reject already-paid orders', async () => {
        ordersService.findOne.mockResolvedValue({
          ...mockOrder,
          paymentStatus: PaymentStatus.PAID,
        });

        await expect(
          service.createRazorpayOrder('user-uuid-1', 'order-uuid-1'),
        ).rejects.toThrow(BadRequestException);
      });
    });

    describe('mockPayment', () => {
      it('should instantly mark order as paid', async () => {
        ordersService.findOne.mockResolvedValue({ ...mockOrder });
        ordersService.markAsPaid.mockResolvedValue({
          ...mockOrder,
          paymentStatus: PaymentStatus.PAID,
          status: OrderStatus.CONFIRMED,
        });

        const result = await service.mockPayment('user-uuid-1', 'order-uuid-1');

        expect(result.mockMode).toBe(true);
        expect(result.message).toBe('Mock payment successful');
        expect(result.mockPaymentId).toMatch(/^pay_MOCK_/);
        expect(ordersService.markAsPaid).toHaveBeenCalledWith(
          'order-uuid-1',
          expect.stringMatching(/^pay_MOCK_/),
          expect.stringMatching(/^mock_sig_/),
        );
      });

      it('should return early if order is already paid', async () => {
        ordersService.findOne.mockResolvedValue({
          ...mockOrder,
          paymentStatus: PaymentStatus.PAID,
        });

        const result = await service.mockPayment('user-uuid-1', 'order-uuid-1');

        expect(result.message).toBe('Order already paid');
        expect(ordersService.markAsPaid).not.toHaveBeenCalled();
      });

      it('should reject non-Razorpay orders', async () => {
        ordersService.findOne.mockResolvedValue({
          ...mockOrder,
          paymentMethod: PaymentMethod.COD,
        });

        await expect(
          service.mockPayment('user-uuid-1', 'order-uuid-1'),
        ).rejects.toThrow(BadRequestException);
      });
    });

    describe('verifyPayment', () => {
      it('should auto-succeed in mock mode', async () => {
        const orderWithRpId = {
          ...mockOrder,
          razorpayOrderId: 'order_MOCK_abc123',
        };
        ordersService.findByRazorpayOrderId.mockResolvedValue(orderWithRpId);
        ordersService.markAsPaid.mockResolvedValue({
          ...orderWithRpId,
          paymentStatus: PaymentStatus.PAID,
        });

        const result = await service.verifyPayment(
          'user-uuid-1',
          'order_MOCK_abc123',
          'pay_MOCK_xyz',
          'fake_signature',
        );

        expect(result.mockMode).toBe(true);
        expect(result.message).toBe('Mock payment verified successfully');
      });

      it('should reject if order does not belong to user', async () => {
        ordersService.findByRazorpayOrderId.mockResolvedValue({
          ...mockOrder,
          userId: 'different-user',
          razorpayOrderId: 'order_MOCK_abc',
        });

        await expect(
          service.verifyPayment(
            'user-uuid-1',
            'order_MOCK_abc',
            'pay_id',
            'sig',
          ),
        ).rejects.toThrow(ForbiddenException);
      });
    });

    describe('handleWebhook', () => {
      it('should return mock_mode status when in mock mode', async () => {
        const result = await service.handleWebhook(
          Buffer.from('{}'),
          'some-signature',
        );

        expect(result.status).toBe('mock_mode');
      });
    });
  });

  // ─── LIVE MODE TESTS ───────────────────────────────────────────

  describe('Live Mode (with Razorpay credentials)', () => {
    const TEST_KEY_ID = 'rzp_test_key123';
    const TEST_KEY_SECRET = 'test_secret_abc';
    const TEST_WEBHOOK_SECRET = 'webhook_secret_xyz';

    beforeEach(async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          PaymentsService,
          {
            provide: OrdersService,
            useValue: mockOrdersService,
          },
          {
            provide: PrismaService,
            useValue: mockPrismaService,
          },
          {
            provide: ConfigService,
            useValue: {
              get: (key: string, defaultVal?: string) => {
                const config: Record<string, string> = {
                  RAZORPAY_KEY_ID: TEST_KEY_ID,
                  RAZORPAY_KEY_SECRET: TEST_KEY_SECRET,
                  RAZORPAY_WEBHOOK_SECRET: TEST_WEBHOOK_SECRET,
                };
                return config[key] ?? defaultVal ?? '';
              },
            },
          },
        ],
      }).compile();

      service = module.get<PaymentsService>(PaymentsService);
      ordersService = module.get(OrdersService);
      jest.clearAllMocks();
    });

    it('should not be in mock mode', () => {
      expect(service.isInMockMode()).toBe(false);
    });

    describe('mockPayment', () => {
      it('should reject mock payments in live mode', async () => {
        await expect(
          service.mockPayment('user-uuid-1', 'order-uuid-1'),
        ).rejects.toThrow(BadRequestException);
      });
    });

    describe('verifyPayment', () => {
      it('should verify a valid Razorpay signature', async () => {
        const razorpayOrderId = 'order_live_abc123';
        const razorpayPaymentId = 'pay_live_xyz789';
        const validSignature = createHmac('sha256', TEST_KEY_SECRET)
          .update(`${razorpayOrderId}|${razorpayPaymentId}`)
          .digest('hex');

        const orderWithRpId = {
          ...mockOrder,
          razorpayOrderId,
          userId: 'user-uuid-1',
        };
        ordersService.findByRazorpayOrderId.mockResolvedValue(orderWithRpId);
        ordersService.markAsPaid.mockResolvedValue({
          ...orderWithRpId,
          paymentStatus: PaymentStatus.PAID,
          status: OrderStatus.CONFIRMED,
        });

        const result = await service.verifyPayment(
          'user-uuid-1',
          razorpayOrderId,
          razorpayPaymentId,
          validSignature,
        );

        expect(result.message).toBe('Payment verified successfully');
        expect(ordersService.markAsPaid).toHaveBeenCalledWith(
          'order-uuid-1',
          razorpayPaymentId,
          validSignature,
        );
      });

      it('should reject an invalid signature', async () => {
        const razorpayOrderId = 'order_live_abc123';
        ordersService.findByRazorpayOrderId.mockResolvedValue({
          ...mockOrder,
          razorpayOrderId,
          userId: 'user-uuid-1',
        });

        await expect(
          service.verifyPayment(
            'user-uuid-1',
            razorpayOrderId,
            'pay_xyz',
            'invalid_signature_here',
          ),
        ).rejects.toThrow(ForbiddenException);
      });
    });

    describe('handleWebhook', () => {
      it('should process payment.captured event with valid signature', async () => {
        const payload = {
          event: 'payment.captured',
          payload: {
            payment: {
              entity: {
                id: 'pay_webhook_123',
                order_id: 'order_webhook_abc',
              },
            },
          },
        };
        const rawBody = Buffer.from(JSON.stringify(payload));
        const signature = createHmac('sha256', TEST_WEBHOOK_SECRET)
          .update(rawBody)
          .digest('hex');

        ordersService.findByRazorpayOrderId.mockResolvedValue({
          ...mockOrder,
          razorpayOrderId: 'order_webhook_abc',
        });
        ordersService.markAsPaid.mockResolvedValue({
          ...mockOrder,
          paymentStatus: PaymentStatus.PAID,
        });

        const result = await service.handleWebhook(rawBody, signature);

        expect(result.status).toBe('ok');
        expect(ordersService.markAsPaid).toHaveBeenCalledWith(
          'order-uuid-1',
          'pay_webhook_123',
          signature,
        );
      });

      it('should reject webhook with invalid signature', async () => {
        const rawBody = Buffer.from('{"event":"payment.captured"}');

        await expect(
          service.handleWebhook(rawBody, 'bad_signature'),
        ).rejects.toThrow(ForbiddenException);
      });

      it('should ignore non payment.captured events', async () => {
        const payload = { event: 'payment.failed' };
        const rawBody = Buffer.from(JSON.stringify(payload));
        const signature = createHmac('sha256', TEST_WEBHOOK_SECRET)
          .update(rawBody)
          .digest('hex');

        const result = await service.handleWebhook(rawBody, signature);

        expect(result.status).toBe('ok');
        expect(ordersService.markAsPaid).not.toHaveBeenCalled();
      });

      it('should handle missing order gracefully in webhook', async () => {
        const payload = {
          event: 'payment.captured',
          payload: {
            payment: {
              entity: {
                id: 'pay_unknown',
                order_id: 'order_unknown',
              },
            },
          },
        };
        const rawBody = Buffer.from(JSON.stringify(payload));
        const signature = createHmac('sha256', TEST_WEBHOOK_SECRET)
          .update(rawBody)
          .digest('hex');

        ordersService.findByRazorpayOrderId.mockRejectedValue(
          new NotFoundException('Order not found'),
        );

        const result = await service.handleWebhook(rawBody, signature);

        expect(result.status).toBe('ok');
      });
    });
  });
});
