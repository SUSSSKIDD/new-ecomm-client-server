import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { RedisCacheService } from '../common/services/redis-cache.service';
import { Cart, CartItem } from './interfaces/cart.interface';
import { AddToCartDto } from './dto/add-to-cart.dto';
import { UpdateCartItemDto } from './dto/update-cart-item.dto';
import { TTL } from '../common/redis/ttl.config.js';

@Injectable()
export class CartService {
  private readonly logger = new Logger(CartService.name);
  private static readonly CART_TTL = TTL.CART; // 48 hours
  private static readonly CART_PREFIX = 'cart:';

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: RedisCacheService,
  ) { }

  /**
   * Build the Redis key for a user's cart.
   */
  private cartKey(userId: string): string {
    return `${CartService.CART_PREFIX}${userId}`;
  }

  /**
   * Get the user's cart. Returns an empty cart if none exists.
   */
  async getCart(userId: string): Promise<Cart> {
    const cart = await this.cache.get<Cart>(this.cartKey(userId));
    if (!cart) {
      return { userId, items: [], updatedAt: new Date().toISOString() };
    }
    return cart;
  }

  /**
   * Add an item to cart. Validates product exists and has sufficient stock.
   * If item already exists, increments quantity.
   */
  async addItem(userId: string, dto: AddToCartDto): Promise<Cart> {
    // Validate product exists
    const [product, maxStoreResult] = await Promise.all([
      this.prisma.product.findUnique({
        where: { id: dto.productId },
        include: { store: true },
      }),
      this.prisma.storeInventory.aggregate({
        where: { productId: dto.productId },
        _max: { stock: true },
      }),
    ]);

    if (!product) {
      throw new NotFoundException(`Product ${dto.productId} not found`);
    }

    // Validate printProductId references an active print product
    if (dto.printProductId) {
      const printProduct = await (this.prisma as any).printProduct.findUnique({
        where: { id: dto.printProductId },
      });
      if (!printProduct || !printProduct.isActive) {
        throw new BadRequestException(
          `Print product ${dto.printProductId} not found or inactive`,
        );
      }
    }

    const maxStoreStock = maxStoreResult._max.stock ?? 0;
    // Optimistic stock check: uses max of global and best store stock.
    // Exact store-level validation happens at fulfillment/order creation time.
    let availableStock = Math.max(product.stock, maxStoreStock);
    let overridePrice = product.price;
    let variantLabel = undefined;
    let variantId = undefined;

    if (dto.variantId) {
      const variant = await (this.prisma as any).productVariant.findUnique({
        where: { id: dto.variantId }
      });
      if (!variant || variant.productId !== dto.productId) {
        throw new BadRequestException('Invalid variant');
      }
      availableStock = variant.stock;
      overridePrice = variant.price;
      variantLabel = variant.label;
      variantId = variant.id;
    }

    if (availableStock < dto.quantity) {
      throw new BadRequestException(
        `Insufficient stock. Available: ${availableStock}`,
      );
    }

    const cart = await this.getCart(userId);

    // Cross-Category Validation: All items in cart must share the same storeType
    if (cart.items.length > 0) {
      // Fetch storeType of one existing item (sample first item)
      const firstItem = cart.items[0];
      const existingProduct = await this.prisma.product.findUnique({
        where: { id: firstItem.productId },
        include: { store: true },
      });
      
      const existingType = existingProduct?.store?.storeType || 'GROCERY';
      const newType = product.store?.storeType || 'GROCERY';
      
      if (existingType !== newType) {
        throw new BadRequestException(
          `Cannot add ${newType} items to a cart containing ${existingType} items. Please clear your cart first.`,
        );
      }
    }
    const existingIndex = cart.items.findIndex(
      (item) => item.productId === dto.productId && item.variantId === variantId,
    );

    if (existingIndex >= 0) {
      // Increment existing item quantity
      const newQty = cart.items[existingIndex].quantity + dto.quantity;
      if (newQty > availableStock) {
        throw new BadRequestException(
          `Cannot add ${dto.quantity} more. Total would exceed stock (${availableStock}).`,
        );
      }
      cart.items[existingIndex].quantity = newQty;
      // Refresh price snapshot
      cart.items[existingIndex].price = overridePrice;
      cart.items[existingIndex].name = product.name;
      cart.items[existingIndex].image = product.images?.[0] ?? null;
      cart.items[existingIndex].taxRate = product.taxRate ?? 0;
      if (variantId) {
        cart.items[existingIndex].variantId = variantId;
        cart.items[existingIndex].variantLabel = variantLabel;
      }
      // Update custom fields if provided
      if (dto.selectedSize !== undefined) cart.items[existingIndex].selectedSize = dto.selectedSize;
      if (dto.userUploadUrls !== undefined) cart.items[existingIndex].userUploadUrls = dto.userUploadUrls;
      if (dto.printProductId !== undefined) cart.items[existingIndex].printProductId = dto.printProductId;
    } else {
      // Add new item with price/name snapshot
      const newItem: CartItem = {
        productId: dto.productId,
        quantity: dto.quantity,
        price: overridePrice,
        name: product.name,
        image: product.images?.[0] ?? null,
        taxRate: product.taxRate ?? 0,
        ...(variantId ? { variantId, variantLabel } : {}),
        ...(dto.selectedSize && { selectedSize: dto.selectedSize }),
        ...(dto.userUploadUrls?.length && { userUploadUrls: dto.userUploadUrls }),
        ...(dto.printProductId && { printProductId: dto.printProductId }),
      };
      cart.items.push(newItem);
    }

    cart.updatedAt = new Date().toISOString();
    await this.cache.set(this.cartKey(userId), cart, CartService.CART_TTL);
    this.logger.log(
      `Cart updated for user ${userId}: ${cart.items.length} items`,
    );
    return cart;
  }

  /**
   * Update quantity of a specific item in the cart.
   * Refreshes price snapshot from current product data.
   */
  async updateItem(
    userId: string,
    productId: string,
    dto: UpdateCartItemDto,
    variantId?: string,
  ): Promise<Cart> {
    const cart = await this.getCart(userId);
    const itemIndex = cart.items.findIndex(
      (item) => item.productId === productId && item.variantId === variantId,
    );
    if (itemIndex < 0) {
      throw new NotFoundException(`Item ${productId} not in cart`);
    }

    // Validate stock for updated quantity
    const [product, maxStoreResult] = await Promise.all([
      this.prisma.product.findUnique({
        where: { id: productId },
      }),
      this.prisma.storeInventory.aggregate({
        where: { productId },
        _max: { stock: true },
      }),
    ]);

    if (!product) {
      throw new NotFoundException(`Product ${productId} no longer exists`);
    }
    const maxStoreStock = maxStoreResult._max.stock ?? 0;
    let availableStock = Math.max(product.stock, maxStoreStock);
    let overridePrice = product.price;
    let variantLabel = cart.items[itemIndex].variantLabel;

    if (variantId) {
      const variant = await this.prisma.productVariant.findUnique({
        where: { id: variantId }
      });
      if (variant) {
        availableStock = variant.stock;
        overridePrice = variant.price;
        variantLabel = variant.label;
      }
    }

    if (dto.quantity > availableStock) {
      throw new BadRequestException(
        `Insufficient stock. Available: ${availableStock}`,
      );
    }

    // Refresh snapshot
    cart.items[itemIndex].quantity = dto.quantity;
    cart.items[itemIndex].price = overridePrice;
    cart.items[itemIndex].name = product.name;
    cart.items[itemIndex].image = product.images?.[0] ?? null;
    cart.items[itemIndex].taxRate = product.taxRate ?? 0;
    if (variantId) {
      cart.items[itemIndex].variantLabel = variantLabel;
    }

    cart.updatedAt = new Date().toISOString();
    await this.cache.set(this.cartKey(userId), cart, CartService.CART_TTL);
    return cart;
  }

  /**
   * Remove a specific item from the cart.
   */
  async removeItem(userId: string, productId: string, variantId?: string): Promise<Cart> {
    const cart = await this.getCart(userId);
    const initialLength = cart.items.length;
    cart.items = cart.items.filter((item) => !(item.productId === productId && item.variantId === variantId));

    if (cart.items.length === initialLength) {
      throw new NotFoundException(`Item ${productId} not in cart`);
    }

    cart.updatedAt = new Date().toISOString();
    await this.cache.set(this.cartKey(userId), cart, CartService.CART_TTL);
    return cart;
  }

  /**
   * Clear the entire cart.
   */
  async clearCart(userId: string): Promise<void> {
    await this.cache.del(this.cartKey(userId));
    this.logger.log(`Cart cleared for user ${userId}`);
  }
}
