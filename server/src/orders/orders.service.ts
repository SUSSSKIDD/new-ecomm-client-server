import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma.service';
import { CartService } from '../cart/cart.service';
import { RedisCacheService } from '../common/services/redis-cache.service';
import { OrderFulfillmentService, FulfillmentResult } from './order-fulfillment.service';
import { AutoAssignService } from '../delivery/auto-assign.service';
import { LedgerService } from '../ledger/ledger.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrderQueryDto } from './dto/order-query.dto';
import {
  OrderPreview,
  PreviewItem,
  FulfillmentPreview,
} from './interfaces/order-preview.interface';
import { OrderStatus, PaymentMethod, PaymentStatus, Prisma } from '@prisma/client';
import { randomBytes } from 'crypto';

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);
  private readonly deliveryFee: number;
  private readonly taxRate: number;
  private readonly freeDeliveryThreshold: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly cartService: CartService,
    private readonly cache: RedisCacheService,
    private readonly config: ConfigService,
    private readonly fulfillmentService: OrderFulfillmentService,
    private readonly autoAssignService: AutoAssignService,
    private readonly ledgerService: LedgerService,
  ) {
    this.deliveryFee = Number(this.config.get('DELIVERY_FEE', '40'));
    this.taxRate = Number(this.config.get('TAX_RATE', '0.05'));
    this.freeDeliveryThreshold = Number(
      this.config.get('FREE_DELIVERY_THRESHOLD', '500'),
    );
  }

  /**
   * Generate a unique order number: UD-YYYYMMDD-XXXXXX
   */
  private generateOrderNumber(): string {
    const now = new Date();
    const datePart = now.toISOString().slice(0, 10).replace(/-/g, '');
    const randomPart = randomBytes(4).toString('hex').toUpperCase().slice(0, 6);
    return `UD-${datePart}-${randomPart}`;
  }

  /**
   * Create ledger entries for an order, grouped by store.
   * Fire-and-forget — failures are logged but don't block the order.
   */
  private async createLedgerEntries(order: any, paymentMethod: string) {
    try {
      const items = order.items || [];
      // Group order item totals by storeId
      const storeAmounts = new Map<string, number>();
      for (const item of items) {
        const sid = item.storeId;
        if (!sid) continue;
        storeAmounts.set(sid, (storeAmounts.get(sid) || 0) + item.total);
      }

      // If no store-level items, try the delivery address or skip
      if (storeAmounts.size === 0) return;

      const method = paymentMethod === 'COD' ? 'CASH' : 'OTHER';
      const now = new Date().toISOString();

      await Promise.all(
        Array.from(storeAmounts.entries()).map(([storeId, amount]) =>
          this.ledgerService.create({
            storeId,
            date: now,
            amount,
            paymentMethod: method,
            referenceNotes: `Order ${order.orderNumber} (${paymentMethod})`,
          }).catch((err) =>
            this.logger.error(`Ledger entry failed for order ${order.orderNumber} store ${storeId}: ${err.message}`),
          ),
        ),
      );

      this.logger.log(`Ledger entries created for order ${order.orderNumber}`);
    } catch (err) {
      this.logger.error(`Ledger creation failed for order ${order.orderNumber}: ${err.message}`);
    }
  }

  /**
   * Calculate order totals from items.
   */
  private calculateTotals(items: PreviewItem[]): {
    subtotal: number;
    deliveryFee: number;
    tax: number;
    total: number;
    freeDeliveryEligible: boolean;
  } {
    const subtotal = items.reduce((sum, item) => sum + item.total, 0);
    const freeDeliveryEligible = subtotal >= this.freeDeliveryThreshold;
    const deliveryFee = freeDeliveryEligible ? 0 : this.deliveryFee;
    const tax = Math.round(subtotal * this.taxRate * 100) / 100;
    const total = Math.round((subtotal + deliveryFee + tax) * 100) / 100;

    return { subtotal, deliveryFee, tax, total, freeDeliveryEligible };
  }

  /**
   * Preview the order from the current cart (no DB writes).
   * If addressId is provided, includes fulfillment data (store assignments).
   */
  async preview(
    userId: string,
    addressId?: string,
  ): Promise<OrderPreview | FulfillmentPreview> {
    // Parallel: fetch cart + address (if provided) simultaneously
    const [cart, address] = await Promise.all([
      this.cartService.getCart(userId),
      addressId
        ? this.prisma.address.findUnique({ where: { id: addressId } })
        : Promise.resolve(null),
    ]);

    if (cart.items.length === 0) {
      throw new BadRequestException('Cart is empty');
    }

    // Fetch live product data
    const productIds = cart.items.map((i) => i.productId);
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds } },
    });
    const productMap = new Map(products.map((p) => [p.id, p]));

    const items: PreviewItem[] = cart.items.map((cartItem) => {
      const product = productMap.get(cartItem.productId);
      if (!product) {
        return {
          productId: cartItem.productId,
          name: cartItem.name,
          price: cartItem.price,
          quantity: cartItem.quantity,
          total: cartItem.price * cartItem.quantity,
          image: cartItem.image,
          inStock: false,
        };
      }
      return {
        productId: product.id,
        name: product.name,
        price: product.price,
        quantity: cartItem.quantity,
        total: product.price * cartItem.quantity,
        image: product.images?.[0] ?? null,
        inStock: product.stock >= cartItem.quantity,
      };
    });

    const totals = this.calculateTotals(items);

    // If no addressId, return basic preview (backward compatible)
    if (!addressId) {
      return { items, ...totals };
    }

    if (!address || address.userId !== userId) {
      throw new ForbiddenException('Address not found or not yours');
    }

    if (address.lat == null || address.lng == null) {
      return { items, ...totals };
    }

    // Resolve store assignments (cache for reuse during order creation)
    const cartItemInputs = cart.items.map((ci) => {
      const product = productMap.get(ci.productId);
      return {
        productId: ci.productId,
        name: product?.name ?? ci.name,
        price: product?.price ?? ci.price,
        quantity: ci.quantity,
        image: product?.images?.[0] ?? ci.image,
      };
    });

    const fulfillment = await this.fulfillmentService.resolveStoreAssignment(
      address.lat,
      address.lng,
      cartItemInputs,
    );

    // Cache fulfillment result for 5 minutes (reused by order creation)
    const fulfillmentCacheKey = `fulfillment:${userId}:${addressId}`;
    await this.cache.set(fulfillmentCacheKey, fulfillment, 300);

    // Re-calculate totals based on available items only
    const availablePreviewItems: PreviewItem[] = fulfillment.availableItems.map(
      (fi) => ({
        productId: fi.productId,
        name: fi.name,
        price: fi.price,
        quantity: fi.quantity,
        total: fi.total,
        image: fi.image,
        inStock: true,
      }),
    );

    const adjustedTotals = this.calculateTotals(availablePreviewItems);

    return {
      items,
      ...adjustedTotals,
      fulfillment,
    } as FulfillmentPreview;
  }

  /**
   * Create an order. Atomic stock decrement + idempotency key.
   * Now uses StoreInventory for stock management when location data available.
   */
  async create(userId: string, dto: CreateOrderDto, idempotencyKey: string) {
    // 1-3. Parallel: idempotency check + address validation + cart read
    const [existingOrder, address, cart] = await Promise.all([
      this.prisma.order.findUnique({
        where: { idempotencyKey },
        include: { items: true },
      }),
      this.prisma.address.findUnique({
        where: { id: dto.addressId },
      }),
      this.cartService.getCart(userId),
    ]);

    if (existingOrder) {
      if (existingOrder.userId !== userId) {
        throw new NotFoundException('Order not found');
      }
      this.logger.log(
        `Idempotent hit: returning existing order ${existingOrder.orderNumber}`,
      );
      return existingOrder;
    }

    if (!address || address.userId !== userId) {
      throw new ForbiddenException('Address does not belong to this user');
    }

    if (cart.items.length === 0) {
      throw new BadRequestException('Cart is empty');
    }

    // Determine which items to order
    let itemsToOrder = cart.items;
    if (dto.confirmedItems && dto.confirmedItems.length > 0) {
      const confirmedMap = new Map(
        dto.confirmedItems.map((ci) => [ci.productId, ci.quantity]),
      );
      itemsToOrder = cart.items.filter((ci) => confirmedMap.has(ci.productId));
      itemsToOrder = itemsToOrder.map((ci) => ({
        ...ci,
        quantity: confirmedMap.get(ci.productId) ?? ci.quantity,
      }));
    }

    if (itemsToOrder.length === 0) {
      throw new BadRequestException('No items to order');
    }

    // 4-5. Parallel: fetch products + resolve fulfillment (uses cart data, doesn't need fresh products)
    const productIds = itemsToOrder.map((i) => i.productId);
    const lat = dto.lat ?? address.lat;
    const lng = dto.lng ?? address.lng;
    const needsFulfillment = lat != null && lng != null;
    const fulfillmentCacheKey = needsFulfillment
      ? `fulfillment:${userId}:${dto.addressId}`
      : null;

    // Build cart item inputs from cart snapshot (for fulfillment - doesn't need DB product data)
    const cartItemInputsForFulfillment = needsFulfillment
      ? itemsToOrder.map((ci) => ({
        productId: ci.productId,
        name: ci.name,
        price: ci.price,
        quantity: ci.quantity,
        image: ci.image ?? null,
      }))
      : null;

    // Run product fetch + fulfillment resolution in parallel
    const [products, fulfillmentResult] = await Promise.all([
      this.prisma.product.findMany({
        where: { id: { in: productIds } },
      }),
      needsFulfillment
        ? (async () => {
          // Try cache first
          const cached = await this.cache.get<FulfillmentResult>(fulfillmentCacheKey!);
          if (cached) {
            this.cache.del(fulfillmentCacheKey!).catch(() => { });
            return cached;
          }
          return this.fulfillmentService.resolveStoreAssignment(
            lat!, lng!, cartItemInputsForFulfillment!,
          );
        })()
        : Promise.resolve(null),
    ]);

    const productMap = new Map(products.map((p) => [p.id, p]));

    for (const cartItem of itemsToOrder) {
      const product = productMap.get(cartItem.productId);
      if (!product) {
        throw new NotFoundException(
          `Product ${cartItem.productId} no longer exists`,
        );
      }
    }

    // 5. Process fulfillment results
    let storeAssignments: Map<string, string> | null = null; // productId -> storeId

    if (fulfillmentResult) {
      if (fulfillmentResult.unavailableItems.length > 0) {
        const unavailableNames = fulfillmentResult.unavailableItems
          .map((i) => i.name)
          .join(', ');
        throw new BadRequestException(
          `These items are unavailable for delivery: ${unavailableNames}`,
        );
      }

      storeAssignments = new Map(
        fulfillmentResult.availableItems.map((fi) => [fi.productId, fi.storeId!]),
      );
    }

    // 6. Build order items
    const orderItems = itemsToOrder.map((cartItem) => {
      const product = productMap.get(cartItem.productId)!;
      return {
        productId: product.id,
        name: product.name,
        price: product.price,
        quantity: cartItem.quantity,
        total: product.price * cartItem.quantity,
        storeId: storeAssignments?.get(product.id) ?? null,
      };
    });

    // 7. Calculate totals
    const subtotal = orderItems.reduce((sum, item) => sum + item.total, 0);
    const freeDelivery = subtotal >= this.freeDeliveryThreshold;
    const deliveryFee = freeDelivery ? 0 : this.deliveryFee;
    const tax = Math.round(subtotal * this.taxRate * 100) / 100;
    const total = Math.round((subtotal + deliveryFee + tax) * 100) / 100;

    // 8. Determine payment status
    const paymentStatus =
      dto.paymentMethod === PaymentMethod.COD
        ? PaymentStatus.COD_PENDING
        : PaymentStatus.PENDING;

    const orderStatus =
      dto.paymentMethod === PaymentMethod.COD
        ? OrderStatus.CONFIRMED
        : OrderStatus.PENDING;

    // 9. Atomic transaction: stock decrement + order creation
    const orderNumber = this.generateOrderNumber();

    const order = await this.prisma.$transaction(async (tx) => {
      // Batch decrement stock
      const storeItems = orderItems.filter((i) => i.storeId);
      const globalItems = orderItems.filter((i) => !i.storeId);

      if (storeItems.length > 0) {
        const values: string[] = [];
        const params: any[] = [];
        storeItems.forEach((item, idx) => {
          const i = idx * 3; // 3 params per item
          values.push(`($${i + 1}, $${i + 2}, $${i + 3}::int)`);
          params.push(item.storeId, item.productId, item.quantity);
        });

        const updatedCount = await tx.$executeRawUnsafe(
          `UPDATE "StoreInventory" AS si
           SET "stock" = "stock" - v.qty
           FROM (VALUES ${values.join(',')}) AS v("storeId", "productId", "qty")
           WHERE si."storeId" = v."storeId" 
             AND si."productId" = v."productId" 
             AND si."stock" >= v.qty`,
          ...params,
        );

        if (updatedCount !== storeItems.length) {
          throw new ConflictException(
            'Stock race detected for one or more items at assigned store. Please retry.',
          );
        }
      }

      if (globalItems.length > 0) {
        const values: string[] = [];
        const params: any[] = [];
        globalItems.forEach((item, idx) => {
          const i = idx * 2; // 2 params per item
          values.push(`($${i + 1}, $${i + 2}::int)`);
          params.push(item.productId, item.quantity);
        });

        const updatedCount = await tx.$executeRawUnsafe(
          `UPDATE "Product" AS p
           SET "stock" = "stock" - v.qty
           FROM (VALUES ${values.join(',')}) AS v("id", "qty")
           WHERE p."id" = v."id" 
             AND p."stock" >= v.qty`,
          ...params,
        );

        if (updatedCount !== globalItems.length) {
          throw new ConflictException(
            'Stock race detected for one or more items. Please retry.',
          );
        }
      }

      // Create order with items (including storeId)
      return tx.order.create({
        data: {
          userId,
          orderNumber,
          status: orderStatus,
          paymentMethod: dto.paymentMethod,
          paymentStatus,
          deliveryAddress: address as any,
          subtotal,
          deliveryFee,
          tax,
          total,
          idempotencyKey,
          items: {
            create: orderItems.map((oi) => ({
              productId: oi.productId,
              name: oi.name,
              price: oi.price,
              quantity: oi.quantity,
              total: oi.total,
              storeId: oi.storeId,
            })),
          },
        },
        include: { items: true },
      });
    });

    // 10-11. Parallel: clear cart + invalidate order list cache
    const createKeysToDelete: string[] = [];
    const createLimits = [10, 20, 50];
    for (const lim of createLimits) {
      for (let p = 1; p <= 5; p++) {
        createKeysToDelete.push(`orders:${userId}:p${p}:l${lim}`);
      }
    }
    await Promise.all([
      this.cartService.clearCart(userId),
      this.cache.delMany(createKeysToDelete),
    ]);

    this.logger.log(
      `Order ${order.orderNumber} created for user ${userId} (${dto.paymentMethod})`,
    );

    // COD orders are CONFIRMED immediately — record in ledger
    if (dto.paymentMethod === PaymentMethod.COD) {
      this.createLedgerEntries(order, 'COD');
    }

    return order;
  }

  /**
   * List user's orders (paginated, cached 5 min).
   */
  async findAll(userId: string, query: OrderQueryDto) {
    const { page = 1, limit = 10 } = query;
    const cacheKey = `orders:${userId}:p${page}:l${limit}`;

    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;

    const skip = (page - 1) * limit;

    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          items: true,
          assignment: {
            include: {
              deliveryPerson: {
                select: { id: true, name: true, phone: true },
              },
            },
          },
        },
      }),
      this.prisma.order.count({ where: { userId } }),
    ]);

    const result = {
      data: orders,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };

    await this.cache.set(cacheKey, result, 300);
    return result;
  }

  /**
   * Get minimal order details for payments.
   */
  async findOneBasic(userId: string, orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        total: true,
        paymentMethod: true,
        paymentStatus: true,
        razorpayOrderId: true,
        userId: true,
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.userId !== userId) {
      throw new NotFoundException('Order not found');
    }

    return order;
  }

  /**
   * Get a single order detail with items.
   */
  async findOne(userId: string, orderId: string, role?: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: true,
        assignment: {
          include: {
            deliveryPerson: {
              select: { id: true, name: true, phone: true, status: true },
            },
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.userId !== userId && role !== 'ADMIN') {
      throw new NotFoundException('Order not found');
    }

    return order;
  }

  /**
   * Cancel an order. Only if PENDING or CONFIRMED. Restores stock atomically.
   * Now restores to StoreInventory when storeId is present on items.
   */
  async cancel(userId: string, orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        userId: true,
        orderNumber: true,
        status: true,
        paymentStatus: true,
        items: {
          select: { productId: true, quantity: true, storeId: true, id: true, name: true, price: true, total: true, orderId: true },
        },
      },
    });

    if (!order || order.userId !== userId) {
      throw new NotFoundException('Order not found');
    }

    if (
      order.status !== OrderStatus.PENDING &&
      order.status !== OrderStatus.CONFIRMED
    ) {
      throw new BadRequestException(
        `Cannot cancel order with status "${order.status}"`,
      );
    }

    const cancelledOrder = await this.prisma.$transaction(async (tx) => {
      // Batch restore stock
      const storeItems = order.items.filter((i) => i.storeId);
      const globalItems = order.items.filter((i) => !i.storeId);

      if (storeItems.length > 0) {
        const values: string[] = [];
        const params: any[] = [];
        storeItems.forEach((item, idx) => {
          const i = idx * 3;
          values.push(`($${i + 1}, $${i + 2}, $${i + 3}::int)`);
          params.push(item.storeId, item.productId, item.quantity);
        });

        await tx.$executeRawUnsafe(
          `UPDATE "StoreInventory" AS si
           SET "stock" = "stock" + v.qty
           FROM (VALUES ${values.join(',')}) AS v("storeId", "productId", "qty")
           WHERE si."storeId" = v."storeId" AND si."productId" = v."productId"`,
          ...params,
        );
      }

      if (globalItems.length > 0) {
        const values: string[] = [];
        const params: any[] = [];
        globalItems.forEach((item, idx) => {
          const i = idx * 2;
          values.push(`($${i + 1}, $${i + 2}::int)`);
          params.push(item.productId, item.quantity);
        });

        await tx.$executeRawUnsafe(
          `UPDATE "Product" AS p
           SET "stock" = "stock" + v.qty
           FROM (VALUES ${values.join(',')}) AS v("id", "qty")
           WHERE p."id" = v."id"`,
          ...params,
        );
      }

      return tx.order.update({
        where: { id: orderId },
        data: {
          status: OrderStatus.CANCELLED,
          paymentStatus:
            order.paymentStatus === PaymentStatus.PAID
              ? PaymentStatus.REFUNDED
              : PaymentStatus.FAILED,
        },
      });
    });

    // Fire-and-forget cache invalidation (doesn't block response)
    const cancelKeysToDelete: string[] = [`order:status:${orderId}`];
    const cancelLimits = [10, 20, 50];
    for (const lim of cancelLimits) {
      for (let p = 1; p <= 5; p++) {
        cancelKeysToDelete.push(`orders:${userId}:p${p}:l${lim}`);
      }
    }
    this.cache.delMany(cancelKeysToDelete).catch(() => { });

    this.logger.log(`Order ${order.orderNumber} cancelled`);
    // Attach items from initial fetch (avoids redundant include in update)
    return { ...cancelledOrder, items: order.items };
  }

  /**
   * Update order after successful payment verification.
   * Triggers auto-assignment after payment.
   */
  async markAsPaid(
    orderId: string,
    razorpayPaymentId: string,
    razorpaySignature: string,
  ) {
    // Conditional update in a single query (avoids read + write)
    const updateCount = await this.prisma.$executeRawUnsafe(
      `UPDATE "Order" SET "status" = 'CONFIRMED', "paymentStatus" = 'PAID',
       "razorpayPaymentId" = $1, "razorpaySignature" = $2, "paidAt" = NOW(),
       "updatedAt" = NOW()
       WHERE "id" = $3 AND "paymentStatus" != 'PAID'`,
      razorpayPaymentId,
      razorpaySignature,
      orderId,
    );

    // Fetch the order with items for response + ledger
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });
    if (!order) throw new NotFoundException('Order not found');

    if (updateCount === 0) {
      this.logger.log(`Order ${order.orderNumber} already marked as PAID, skipping`);
      return order;
    }

    // Fire-and-forget: cache invalidation
    const paidKeysToDelete: string[] = [`order:status:${orderId}`];
    const paidLimits = [10, 20, 50];
    for (const limit of paidLimits) {
      for (let p = 1; p <= 5; p++) {
        paidKeysToDelete.push(`orders:${order.userId}:p${p}:l${limit}`);
      }
    }
    this.cache.delMany(paidKeysToDelete).catch(() => { });

    // Record online payment in ledger
    this.createLedgerEntries(order, 'RAZORPAY');

    this.logger.log(`Order ${order.orderNumber} marked as PAID`);

    return order;
  }

  /**
   * Find an order by its Razorpay order ID.
   */
  async findByRazorpayOrderId(razorpayOrderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { razorpayOrderId },
    });
    if (!order) {
      throw new NotFoundException(
        `Order with Razorpay ID ${razorpayOrderId} not found`,
      );
    }
    return order;
  }

  /**
   * Set the Razorpay order ID on an order.
   */
  async setRazorpayOrderId(orderId: string, razorpayOrderId: string) {
    return this.prisma.order.update({
      where: { id: orderId },
      data: { razorpayOrderId },
    });
  }
  async findStoreOrders(storeId: string, query: OrderQueryDto) {
    const {
      page = 1,
      limit = 10,
      status,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.OrderWhereInput = {
      items: { some: { storeId } },
    };
    if (status) {
      where.status = status;
    }

    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        skip,
        take: Number(limit),
        where,
        orderBy: { [sortBy]: sortOrder },
        include: {
          items: true,
          user: { select: { name: true, phone: true } },
          assignment: {
            include: {
              deliveryPerson: { select: { id: true, name: true, phone: true } },
            },
          },
        },
      }),
      this.prisma.order.count({ where }),
    ]);

    return {
      data: orders,
      meta: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / Number(limit)),
      },
    };
  }

  async findAllAdmin(query: OrderQueryDto) {
    const {
      page = 1,
      limit = 10,
      status,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.OrderWhereInput = {};
    if (status) {
      where.status = status;
    }

    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        skip,
        take: Number(limit),
        where,
        orderBy: { [sortBy]: sortOrder },
        include: {
          items: true,
          user: { select: { name: true, phone: true } },
          assignment: {
            include: {
              deliveryPerson: { select: { id: true, name: true, phone: true } },
            },
          },
        },
      }),
      this.prisma.order.count({ where }),
    ]);

    return {
      data: orders,
      meta: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / Number(limit)),
      },
    };
  }

  // Valid order status transitions (one-way hierarchy)
  // CONFIRMED → ORDER_PICKED → SHIPPED → DELIVERED
  // DELIVERED can only be set by delivery person via completeDelivery()
  private static readonly VALID_TRANSITIONS: Record<string, OrderStatus[]> = {
    PENDING: [OrderStatus.CONFIRMED],
    CONFIRMED: [OrderStatus.ORDER_PICKED],
    ORDER_PICKED: [OrderStatus.SHIPPED],
    SHIPPED: [],     // DELIVERED is set only by delivery person
    DELIVERED: [],
    CANCELLED: [],
  };

  async updateStatus(id: string, status: OrderStatus, storeId?: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!order) throw new NotFoundException('Order not found');

    // Block admin from manually setting DELIVERED — only delivery person can
    if (status === OrderStatus.DELIVERED) {
      throw new BadRequestException(
        'DELIVERED status can only be set by the delivery person',
      );
    }

    if (storeId) {
      const hasStoreItems = order.items.some((i) => i.storeId === storeId);
      if (!hasStoreItems) {
        throw new ForbiddenException(
          'Order does not contain items from your store',
        );
      }
    }

    // Validate transition (one-way only)
    const allowed = OrdersService.VALID_TRANSITIONS[order.status] ?? [];
    if (!allowed.includes(status)) {
      throw new BadRequestException(
        `Cannot transition from ${order.status} to ${status}`,
      );
    }

    const updated = await this.prisma.order.update({
      where: { id },
      data: { status },
    });

    // Auto-trigger delivery search when order is packed
    if (status === OrderStatus.ORDER_PICKED) {
      this.autoAssignService
        .assignOrder(id)
        .catch((err) =>
          this.logger.error(
            `Auto-assign failed for order ${id}: ${err.message}`,
          ),
        );
    }

    return updated;
  }

  /**
   * Manually trigger delivery assignment for an order (admin action).
   */
  async triggerDeliveryAssignment(orderId: string, storeId?: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true, assignment: true },
    });
    if (!order) throw new NotFoundException('Order not found');

    if (storeId) {
      const hasStoreItems = order.items.some((i) => i.storeId === storeId);
      if (!hasStoreItems) {
        throw new ForbiddenException(
          'Order does not contain items from your store',
        );
      }
    }

    if (
      order.status === OrderStatus.CANCELLED ||
      order.status === OrderStatus.DELIVERED ||
      order.status === OrderStatus.PENDING
    ) {
      throw new BadRequestException(
        `Cannot assign delivery for order with status "${order.status}"`,
      );
    }

    if (order.assignment) {
      throw new BadRequestException('Order already has a delivery assignment');
    }

    await this.autoAssignService.assignOrder(orderId);

    // Check if assignment was created
    const assignment = await this.prisma.orderAssignment.findUnique({
      where: { orderId },
      include: {
        deliveryPerson: {
          select: { id: true, name: true, phone: true },
        },
      },
    });

    if (assignment) {
      return {
        message: `Delivery assigned to ${assignment.deliveryPerson.name}`,
        assignment,
      };
    }

    return { message: 'No free delivery partners available at the moment' };
  }
}
