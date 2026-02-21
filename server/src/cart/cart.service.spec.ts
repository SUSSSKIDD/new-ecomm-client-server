import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CartService } from './cart.service';
import { PrismaService } from '../prisma.service';
import { RedisCacheService } from '../common/services/redis-cache.service';

describe('CartService', () => {
  let service: CartService;
  let prisma: any;
  let cache: jest.Mocked<RedisCacheService>;

  const userId = 'user-uuid-1';

  const mockProduct = {
    id: 'product-uuid-1',
    name: 'Organic Apples',
    price: 120,
    mrp: 150,
    stock: 50,
    category: 'Grocery',
    images: ['https://example.com/apple.jpg'],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockCart = {
    userId,
    items: [
      {
        productId: 'product-uuid-1',
        quantity: 2,
        price: 120,
        name: 'Organic Apples',
        image: 'https://example.com/apple.jpg',
      },
    ],
    updatedAt: new Date().toISOString(),
  };

  beforeEach(async () => {
    prisma = {
      product: {
        findUnique: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CartService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: RedisCacheService,
          useValue: {
            get: jest.fn().mockResolvedValue(null),
            set: jest.fn().mockResolvedValue(undefined),
            del: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    service = module.get<CartService>(CartService);
    cache = module.get(RedisCacheService);
    jest.clearAllMocks();
  });

  describe('getCart', () => {
    it('should return empty cart when no cart exists in Redis', async () => {
      cache.get.mockResolvedValue(null);

      const cart = await service.getCart(userId);

      expect(cart.userId).toBe(userId);
      expect(cart.items).toHaveLength(0);
    });

    it('should return existing cart from Redis', async () => {
      cache.get.mockResolvedValue(mockCart);

      const cart = await service.getCart(userId);

      expect(cart.items).toHaveLength(1);
      expect(cart.items[0].name).toBe('Organic Apples');
    });
  });

  describe('addItem', () => {
    it('should add a new item to empty cart', async () => {
      cache.get.mockResolvedValue(null); // empty cart
      prisma.product.findUnique.mockResolvedValue(mockProduct);

      const cart = await service.addItem(userId, {
        productId: 'product-uuid-1',
        quantity: 1,
      });

      expect(cart.items).toHaveLength(1);
      expect(cart.items[0].productId).toBe('product-uuid-1');
      expect(cart.items[0].quantity).toBe(1);
      expect(cart.items[0].price).toBe(120);
      expect(cache.set).toHaveBeenCalledWith(
        `cart:${userId}`,
        expect.any(Object),
        604800, // 7 days
      );
    });

    it('should increment quantity for existing item', async () => {
      cache.get.mockResolvedValue({ ...mockCart });
      prisma.product.findUnique.mockResolvedValue(mockProduct);

      const cart = await service.addItem(userId, {
        productId: 'product-uuid-1',
        quantity: 3,
      });

      expect(cart.items[0].quantity).toBe(5); // 2 + 3
    });

    it('should refresh price snapshot when adding existing item', async () => {
      cache.get.mockResolvedValue({
        ...mockCart,
        items: [{ ...mockCart.items[0], price: 100 }], // old price
      });
      prisma.product.findUnique.mockResolvedValue(mockProduct); // current price: 120

      const cart = await service.addItem(userId, {
        productId: 'product-uuid-1',
        quantity: 1,
      });

      expect(cart.items[0].price).toBe(120); // refreshed to current
    });

    it('should throw if product not found', async () => {
      prisma.product.findUnique.mockResolvedValue(null);

      await expect(
        service.addItem(userId, {
          productId: 'nonexistent',
          quantity: 1,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw if quantity exceeds stock', async () => {
      prisma.product.findUnique.mockResolvedValue({
        ...mockProduct,
        stock: 2,
      });

      await expect(
        service.addItem(userId, {
          productId: 'product-uuid-1',
          quantity: 5,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw if total quantity would exceed stock', async () => {
      cache.get.mockResolvedValue({
        ...mockCart,
        items: [{ ...mockCart.items[0], quantity: 48 }],
      });
      prisma.product.findUnique.mockResolvedValue(mockProduct); // stock: 50

      await expect(
        service.addItem(userId, {
          productId: 'product-uuid-1',
          quantity: 5, // 48 + 5 = 53 > 50
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('updateItem', () => {
    it('should update item quantity', async () => {
      cache.get.mockResolvedValue({ ...mockCart });
      prisma.product.findUnique.mockResolvedValue(mockProduct);

      const cart = await service.updateItem(userId, 'product-uuid-1', {
        quantity: 5,
      });

      expect(cart.items[0].quantity).toBe(5);
    });

    it('should refresh price snapshot on update', async () => {
      cache.get.mockResolvedValue({
        ...mockCart,
        items: [{ ...mockCart.items[0], price: 100 }],
      });
      prisma.product.findUnique.mockResolvedValue(mockProduct);

      const cart = await service.updateItem(userId, 'product-uuid-1', {
        quantity: 3,
      });

      expect(cart.items[0].price).toBe(120);
    });

    it('should throw if item not in cart', async () => {
      cache.get.mockResolvedValue({
        userId,
        items: [],
        updatedAt: new Date().toISOString(),
      });

      await expect(
        service.updateItem(userId, 'product-uuid-1', { quantity: 3 }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw if quantity exceeds stock', async () => {
      cache.get.mockResolvedValue({ ...mockCart });
      prisma.product.findUnique.mockResolvedValue({
        ...mockProduct,
        stock: 2,
      });

      await expect(
        service.updateItem(userId, 'product-uuid-1', { quantity: 5 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw if product no longer exists', async () => {
      cache.get.mockResolvedValue({ ...mockCart });
      prisma.product.findUnique.mockResolvedValue(null);

      await expect(
        service.updateItem(userId, 'product-uuid-1', { quantity: 3 }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('removeItem', () => {
    it('should remove item from cart', async () => {
      cache.get.mockResolvedValue({ ...mockCart });

      const cart = await service.removeItem(userId, 'product-uuid-1');

      expect(cart.items).toHaveLength(0);
      expect(cache.set).toHaveBeenCalled();
    });

    it('should throw if item not in cart', async () => {
      cache.get.mockResolvedValue({ ...mockCart });

      await expect(
        service.removeItem(userId, 'nonexistent-product'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('clearCart', () => {
    it('should delete cart from Redis', async () => {
      await service.clearCart(userId);

      expect(cache.del).toHaveBeenCalledWith(`cart:${userId}`);
    });
  });
});
