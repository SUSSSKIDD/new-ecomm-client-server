import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { OrdersService } from './orders.service';
import { CartService } from '../cart/cart.service';
import { PrismaService } from '../prisma.service';
import { RedisCacheService } from '../common/services/redis-cache.service';
import { OrderStatus, PaymentMethod, PaymentStatus } from '@prisma/client';

describe('OrdersService', () => {
  let service: OrdersService;
  let prisma: any;
  let cartService: jest.Mocked<CartService>;
  let cache: jest.Mocked<RedisCacheService>;

  const userId = 'user-uuid-1';

  const mockProduct = {
    id: 'product-uuid-1',
    name: 'Organic Apples',
    price: 120,
    mrp: 150,
    stock: 50,
    category: 'Grocery',
    subCategory: 'Fruits',
    images: ['https://example.com/apple.jpg'],
    isGrocery: true,
    description: 'Fresh organic apples',
    storeLocation: 'A1',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockAddress = {
    id: 'address-uuid-1',
    userId,
    type: 'HOME',
    houseNo: '42',
    street: 'MG Road',
    city: 'Bangalore',
    state: 'Karnataka',
    zipCode: '560001',
    landmark: 'Near Park',
    mapsLink: null,
    recipientName: null,
    recipientPhone: null,
    createdAt: new Date(),
  };

  const mockCart = {
    userId,
    items: [
      {
        productId: 'product-uuid-1',
        quantity: 3,
        price: 120,
        name: 'Organic Apples',
        image: 'https://example.com/apple.jpg',
      },
    ],
    updatedAt: new Date().toISOString(),
  };

  const mockOrder = {
    id: 'order-uuid-1',
    userId,
    orderNumber: 'UD-20260214-A1B2C3',
    status: OrderStatus.PENDING,
    paymentMethod: PaymentMethod.RAZORPAY,
    paymentStatus: PaymentStatus.PENDING,
    subtotal: 360,
    deliveryFee: 0,
    tax: 18,
    total: 378,
    idempotencyKey: 'idem-key-1',
    razorpayOrderId: null,
    razorpayPaymentId: null,
    razorpaySignature: null,
    deliveryAddress: mockAddress,
    createdAt: new Date(),
    updatedAt: new Date(),
    paidAt: null,
    deliveredAt: null,
    items: [
      {
        id: 'item-uuid-1',
        orderId: 'order-uuid-1',
        productId: 'product-uuid-1',
        name: 'Organic Apples',
        price: 120,
        quantity: 3,
        total: 360,
      },
    ],
  };

  beforeEach(async () => {
    prisma = {
      order: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      product: {
        findMany: jest.fn(),
      },
      address: {
        findUnique: jest.fn(),
      },
      $transaction: jest.fn(),
      $executeRawUnsafe: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: CartService,
          useValue: {
            getCart: jest.fn(),
            clearCart: jest.fn(),
          },
        },
        {
          provide: RedisCacheService,
          useValue: {
            get: jest.fn().mockResolvedValue(null),
            set: jest.fn().mockResolvedValue(undefined),
            del: jest.fn().mockResolvedValue(undefined),
            delPattern: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: (key: string, defaultVal?: string) => {
              const config: Record<string, string> = {
                DELIVERY_FEE: '40',
                TAX_RATE: '0.05',
                FREE_DELIVERY_THRESHOLD: '500',
              };
              return config[key] ?? defaultVal ?? '';
            },
          },
        },
      ],
    }).compile();

    service = module.get<OrdersService>(OrdersService);
    cartService = module.get(CartService);
    cache = module.get(RedisCacheService);
    jest.clearAllMocks();
  });

  describe('preview', () => {
    it('should return order preview with correct totals', async () => {
      cartService.getCart.mockResolvedValue(mockCart);
      prisma.product.findMany.mockResolvedValue([mockProduct]);

      const preview = await service.preview(userId);

      expect(preview.items).toHaveLength(1);
      expect(preview.items[0].name).toBe('Organic Apples');
      expect(preview.items[0].price).toBe(120);
      expect(preview.items[0].quantity).toBe(3);
      expect(preview.items[0].total).toBe(360);
      expect(preview.items[0].inStock).toBe(true);
      expect(preview.subtotal).toBe(360);
      expect(preview.freeDeliveryEligible).toBe(false); // 360 < 500
      expect(preview.deliveryFee).toBe(40);
      expect(preview.tax).toBe(18); // 360 * 0.05
    });

    it('should throw if cart is empty', async () => {
      cartService.getCart.mockResolvedValue({
        userId,
        items: [],
        updatedAt: new Date().toISOString(),
      });

      await expect(service.preview(userId)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should mark out-of-stock items', async () => {
      cartService.getCart.mockResolvedValue({
        ...mockCart,
        items: [{ ...mockCart.items[0], quantity: 100 }],
      });
      prisma.product.findMany.mockResolvedValue([
        { ...mockProduct, stock: 50 },
      ]);

      const preview = await service.preview(userId);

      expect(preview.items[0].inStock).toBe(false);
    });

    it('should mark products that no longer exist', async () => {
      cartService.getCart.mockResolvedValue(mockCart);
      prisma.product.findMany.mockResolvedValue([]); // product deleted

      const preview = await service.preview(userId);

      expect(preview.items[0].inStock).toBe(false);
    });

    it('should grant free delivery for orders >= 500', async () => {
      const largeCart = {
        userId,
        items: [{ ...mockCart.items[0], quantity: 5 }],
        updatedAt: new Date().toISOString(),
      };
      cartService.getCart.mockResolvedValue(largeCart);
      prisma.product.findMany.mockResolvedValue([mockProduct]);

      const preview = await service.preview(userId);

      // 5 * 120 = 600 >= 500
      expect(preview.subtotal).toBe(600);
      expect(preview.freeDeliveryEligible).toBe(true);
      expect(preview.deliveryFee).toBe(0);
    });
  });

  describe('create', () => {
    it('should return existing order on idempotency hit', async () => {
      prisma.order.findUnique.mockResolvedValue(mockOrder);

      const result = await service.create(
        userId,
        { addressId: 'address-uuid-1', paymentMethod: PaymentMethod.RAZORPAY },
        'idem-key-1',
      );

      expect(result.orderNumber).toBe(mockOrder.orderNumber);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('should reject if address does not belong to user', async () => {
      prisma.order.findUnique.mockResolvedValue(null); // no idempotency hit
      prisma.address.findUnique.mockResolvedValue({
        ...mockAddress,
        userId: 'other-user',
      });

      await expect(
        service.create(
          userId,
          {
            addressId: 'address-uuid-1',
            paymentMethod: PaymentMethod.RAZORPAY,
          },
          'new-idem-key',
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should reject if cart is empty', async () => {
      prisma.order.findUnique.mockResolvedValue(null);
      prisma.address.findUnique.mockResolvedValue(mockAddress);
      cartService.getCart.mockResolvedValue({
        userId,
        items: [],
        updatedAt: new Date().toISOString(),
      });

      await expect(
        service.create(
          userId,
          {
            addressId: 'address-uuid-1',
            paymentMethod: PaymentMethod.RAZORPAY,
          },
          'new-idem-key',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject if product stock is insufficient', async () => {
      prisma.order.findUnique.mockResolvedValue(null);
      prisma.address.findUnique.mockResolvedValue(mockAddress);
      cartService.getCart.mockResolvedValue({
        ...mockCart,
        items: [{ ...mockCart.items[0], quantity: 999 }],
      });
      prisma.product.findMany.mockResolvedValue([mockProduct]);

      await expect(
        service.create(
          userId,
          {
            addressId: 'address-uuid-1',
            paymentMethod: PaymentMethod.RAZORPAY,
          },
          'new-idem-key',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should create order with correct payment status for COD', async () => {
      prisma.order.findUnique.mockResolvedValue(null);
      prisma.address.findUnique.mockResolvedValue(mockAddress);
      cartService.getCart.mockResolvedValue(mockCart);
      prisma.product.findMany.mockResolvedValue([mockProduct]);

      const createdOrder = {
        ...mockOrder,
        paymentMethod: PaymentMethod.COD,
        paymentStatus: PaymentStatus.COD_PENDING,
        status: OrderStatus.CONFIRMED,
      };
      prisma.$transaction.mockImplementation(async (fn: any) => {
        const tx = {
          $executeRawUnsafe: jest.fn().mockResolvedValue(1),
          order: { create: jest.fn().mockResolvedValue(createdOrder) },
        };
        return fn(tx);
      });

      const result = await service.create(
        userId,
        { addressId: 'address-uuid-1', paymentMethod: PaymentMethod.COD },
        'new-idem-key',
      );

      expect(result.paymentStatus).toBe(PaymentStatus.COD_PENDING);
      expect(result.status).toBe(OrderStatus.CONFIRMED);
      expect(cartService.clearCart).toHaveBeenCalledWith(userId);
    });

    it('should create order with PENDING status for RAZORPAY', async () => {
      prisma.order.findUnique.mockResolvedValue(null);
      prisma.address.findUnique.mockResolvedValue(mockAddress);
      cartService.getCart.mockResolvedValue(mockCart);
      prisma.product.findMany.mockResolvedValue([mockProduct]);

      const createdOrder = { ...mockOrder };
      prisma.$transaction.mockImplementation(async (fn: any) => {
        const tx = {
          $executeRawUnsafe: jest.fn().mockResolvedValue(1),
          order: { create: jest.fn().mockResolvedValue(createdOrder) },
        };
        return fn(tx);
      });

      const result = await service.create(
        userId,
        { addressId: 'address-uuid-1', paymentMethod: PaymentMethod.RAZORPAY },
        'new-idem-key',
      );

      expect(result.paymentStatus).toBe(PaymentStatus.PENDING);
      expect(result.status).toBe(OrderStatus.PENDING);
    });

    it('should throw ConflictException on stock race condition', async () => {
      prisma.order.findUnique.mockResolvedValue(null);
      prisma.address.findUnique.mockResolvedValue(mockAddress);
      cartService.getCart.mockResolvedValue(mockCart);
      prisma.product.findMany.mockResolvedValue([mockProduct]);

      prisma.$transaction.mockImplementation(async (fn: any) => {
        const tx = {
          $executeRawUnsafe: jest.fn().mockResolvedValue(0), // stock race
          order: { create: jest.fn() },
        };
        return fn(tx);
      });

      await expect(
        service.create(
          userId,
          {
            addressId: 'address-uuid-1',
            paymentMethod: PaymentMethod.RAZORPAY,
          },
          'new-idem-key',
        ),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('findAll', () => {
    it('should return paginated orders', async () => {
      const orders = [mockOrder];
      prisma.order.findMany.mockResolvedValue(orders);
      prisma.order.count.mockResolvedValue(1);

      const result = await service.findAll(userId, { page: 1, limit: 10 });

      expect(result.data).toEqual(orders);
      expect(result.meta.total).toBe(1);
      expect(result.meta.totalPages).toBe(1);
    });

    it('should return cached result if available', async () => {
      const cachedResult = {
        data: [mockOrder],
        meta: { page: 1, limit: 10, total: 1, totalPages: 1 },
      };
      cache.get.mockResolvedValue(cachedResult);

      const result = await service.findAll(userId, { page: 1, limit: 10 });

      expect(result).toEqual(cachedResult);
      expect(prisma.order.findMany).not.toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('should return order belonging to user', async () => {
      prisma.order.findUnique.mockResolvedValue(mockOrder);

      const result = await service.findOne(userId, 'order-uuid-1');

      expect(result.orderNumber).toBe(mockOrder.orderNumber);
    });

    it('should throw if order not found', async () => {
      prisma.order.findUnique.mockResolvedValue(null);

      await expect(service.findOne(userId, 'nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw if order belongs to different user', async () => {
      prisma.order.findUnique.mockResolvedValue({
        ...mockOrder,
        userId: 'other-user',
      });

      await expect(service.findOne(userId, 'order-uuid-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('cancel', () => {
    it('should cancel a PENDING order and restore stock', async () => {
      prisma.order.findUnique.mockResolvedValue(mockOrder);

      const cancelledOrder = {
        ...mockOrder,
        status: OrderStatus.CANCELLED,
        paymentStatus: PaymentStatus.FAILED,
      };
      prisma.$transaction.mockImplementation(async (fn: any) => {
        const tx = {
          $executeRawUnsafe: jest.fn().mockResolvedValue(1),
          order: { update: jest.fn().mockResolvedValue(cancelledOrder) },
        };
        return fn(tx);
      });

      const result = await service.cancel(userId, 'order-uuid-1');

      expect(result.status).toBe(OrderStatus.CANCELLED);
      expect(result.paymentStatus).toBe(PaymentStatus.FAILED);
    });

    it('should set REFUNDED status if order was PAID', async () => {
      prisma.order.findUnique.mockResolvedValue({
        ...mockOrder,
        status: OrderStatus.CONFIRMED,
        paymentStatus: PaymentStatus.PAID,
      });

      const cancelledOrder = {
        ...mockOrder,
        status: OrderStatus.CANCELLED,
        paymentStatus: PaymentStatus.REFUNDED,
      };
      prisma.$transaction.mockImplementation(async (fn: any) => {
        const tx = {
          $executeRawUnsafe: jest.fn().mockResolvedValue(1),
          order: { update: jest.fn().mockResolvedValue(cancelledOrder) },
        };
        return fn(tx);
      });

      const result = await service.cancel(userId, 'order-uuid-1');

      expect(result.paymentStatus).toBe(PaymentStatus.REFUNDED);
    });

    it('should reject cancellation of SHIPPED orders', async () => {
      prisma.order.findUnique.mockResolvedValue({
        ...mockOrder,
        status: OrderStatus.SHIPPED,
      });

      await expect(service.cancel(userId, 'order-uuid-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should reject cancellation of DELIVERED orders', async () => {
      prisma.order.findUnique.mockResolvedValue({
        ...mockOrder,
        status: OrderStatus.DELIVERED,
      });

      await expect(service.cancel(userId, 'order-uuid-1')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('markAsPaid', () => {
    it('should mark order as paid', async () => {
      prisma.order.findUnique.mockResolvedValue(mockOrder);
      const updatedOrder = {
        ...mockOrder,
        status: OrderStatus.CONFIRMED,
        paymentStatus: PaymentStatus.PAID,
        razorpayPaymentId: 'pay_123',
        razorpaySignature: 'sig_abc',
        paidAt: new Date(),
      };
      prisma.order.update.mockResolvedValue(updatedOrder);

      const result = await service.markAsPaid(
        'order-uuid-1',
        'pay_123',
        'sig_abc',
      );

      expect(result.paymentStatus).toBe(PaymentStatus.PAID);
      expect(result.status).toBe(OrderStatus.CONFIRMED);
    });

    it('should be idempotent - skip if already paid', async () => {
      prisma.order.findUnique.mockResolvedValue({
        ...mockOrder,
        paymentStatus: PaymentStatus.PAID,
      });

      const result = await service.markAsPaid(
        'order-uuid-1',
        'pay_123',
        'sig_abc',
      );

      expect(result.paymentStatus).toBe(PaymentStatus.PAID);
      expect(prisma.order.update).not.toHaveBeenCalled();
    });

    it('should throw if order not found', async () => {
      prisma.order.findUnique.mockResolvedValue(null);

      await expect(
        service.markAsPaid('nonexistent', 'pay_123', 'sig_abc'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('findByRazorpayOrderId', () => {
    it('should find order by Razorpay order ID', async () => {
      prisma.order.findUnique.mockResolvedValue({
        ...mockOrder,
        razorpayOrderId: 'order_rp_abc',
      });

      const result = await service.findByRazorpayOrderId('order_rp_abc');

      expect(result.razorpayOrderId).toBe('order_rp_abc');
    });

    it('should throw if not found', async () => {
      prisma.order.findUnique.mockResolvedValue(null);

      await expect(
        service.findByRazorpayOrderId('nonexistent'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('setRazorpayOrderId', () => {
    it('should set razorpay order ID on order', async () => {
      prisma.order.update.mockResolvedValue({
        ...mockOrder,
        razorpayOrderId: 'order_rp_new',
      });

      const result = await service.setRazorpayOrderId(
        'order-uuid-1',
        'order_rp_new',
      );

      expect(result.razorpayOrderId).toBe('order_rp_new');
      expect(prisma.order.update).toHaveBeenCalledWith({
        where: { id: 'order-uuid-1' },
        data: { razorpayOrderId: 'order_rp_new' },
      });
    });
  });
});
