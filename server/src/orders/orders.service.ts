import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma.service';
import { CartService } from '../cart/cart.service';
import { RedisCacheService } from '../common/services/redis-cache.service';
import { StockService } from '../common/services/stock.service';
import { paginate } from '../common/utils/pagination.util';
import { OrderFulfillmentService, FulfillmentResult } from './order-fulfillment.service';
import { AllocationResult } from './allocation.service';
import { AutoAssignService } from '../delivery/auto-assign.service';
import { LedgerService } from '../ledger/ledger.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrderQueryDto } from './dto/order-query.dto';
import {
  OrderPreview,
  PreviewItem,
  FulfillmentPreview,
  AllocationPreview,
} from './interfaces/order-preview.interface';
import { OrderStatus, PaymentMethod, PaymentStatus, Prisma } from '@prisma/client';
import { randomBytes } from 'crypto';
import { TTL } from '../common/redis/ttl.config.js';

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);
  private readonly deliveryFee: number;

  private readonly freeDeliveryThreshold: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly cartService: CartService,
    private readonly cache: RedisCacheService,
    private readonly config: ConfigService,
    private readonly fulfillmentService: OrderFulfillmentService,
    private readonly autoAssignService: AutoAssignService,
    private readonly ledgerService: LedgerService,
    private readonly stockService: StockService,
  ) {
    this.deliveryFee = Number(this.config.get('DELIVERY_FEE', '40'));

    this.freeDeliveryThreshold = Number(
      this.config.get('FREE_DELIVERY_THRESHOLD', '500'),
    );
  }

  private static readonly GRACE_PERIOD_MS = 90_000; // 90 seconds
  private static readonly CACHE_LIMITS = [10, 20, 50];
  private static readonly CACHE_MAX_PAGES = 5;

  /**
   * Invalidate paginated order-list cache for a user (+ optional order status key).
   * Replaces 4 duplicate key-building loops.
   */
  private invalidateOrderCache(userId: string, orderId?: string): void {
    const keys: string[] = [];
    if (orderId) keys.push(`order:status:${orderId}`);
    for (const lim of OrdersService.CACHE_LIMITS) {
      for (let p = 1; p <= OrdersService.CACHE_MAX_PAGES; p++) {
        keys.push(`orders:${userId}:p${p}:l${lim}`);
      }
    }
    this.cache.delMany(keys).catch(() => {});
  }

  /**
   * Compute canCancel / canModify / graceExpiresAt for an order.
   * Confirmed orders are now immutable.
   */
  private computeGraceFields(order: { status: string; confirmedAt?: Date | null }) {
    return {
      canCancel: order.status === 'PENDING',
      canModify: false,
      graceExpiresAt: null,
    };
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
   * Calculate order totals using per-item taxRate (Indian GST).
   * Each item must carry a `taxRate` property (percentage 0-100).
   * Tax is never applied to the delivery fee.
   */
  private calculateTotals(items: (PreviewItem & { taxRate?: number })[]): {
    subtotal: number;
    deliveryFee: number;
    tax: number;
    total: number;
    freeDeliveryEligible: boolean;
  } {
    const subtotal = items.reduce((sum, item) => sum + item.total, 0);
    const freeDeliveryEligible = subtotal >= this.freeDeliveryThreshold;
    const deliveryFee = freeDeliveryEligible ? 0 : this.deliveryFee;

    // Per-item tax: price × qty × (taxRate / 100), rounded to 2dp
    const tax = items.reduce((taxSum, item) => {
      const rate = item.taxRate ?? 0;
      const itemTax = Math.round(item.total * (rate / 100) * 100) / 100;
      return taxSum + itemTax;
    }, 0);

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

    const items: (PreviewItem & { taxRate: number })[] = cart.items.map((cartItem) => {
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
          taxRate: 0,
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
        taxRate: (product as any).taxRate ?? 0,
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

    // Single allocation call — derives both fulfillment and allocation preview
    const allocation = await this.fulfillmentService.resolveAllocation(
      address.lat, address.lng, cartItemInputs,
    );
    const fulfillment = this.fulfillmentService.allocationToFulfillment(allocation);

    // Re-calculate totals based on available items only
    const availablePreviewItems: (PreviewItem & { taxRate: number })[] = fulfillment.availableItems.map(
      (fi) => ({
        productId: fi.productId,
        name: fi.name,
        price: fi.price,
        quantity: fi.quantity,
        total: fi.total,
        image: fi.image,
        inStock: true,
        taxRate: (productMap.get(fi.productId) as any)?.taxRate ?? 0,
      }),
    );

    const adjustedTotals = this.calculateTotals(availablePreviewItems);

    return {
      items,
      ...adjustedTotals,
      fulfillment,
      allocation: {
        type: allocation.type,
        storeCount: allocation.storeAllocations.length,
        stores: allocation.storeAllocations.map((sa) => ({
          storeName: sa.storeName,
          itemCount: sa.items.length,
          subtotal: sa.items.reduce((s, i) => s + i.price * i.quantity, 0),
        })),
      },
    } as FulfillmentPreview;
  }

  /**
   * Create an order. Atomic stock decrement + idempotency key.
   * Now uses StoreInventory for stock management when location data available.
   */
  async create(userId: string, dto: CreateOrderDto, idempotencyKey: string) {
    // 1-3. Parallel: idempotency check + address validation
    const [existingOrder, address] = await Promise.all([
      this.prisma.order.findUnique({
        where: { idempotencyKey },
        include: { items: true },
      }),
      this.prisma.address.findUnique({
        where: { id: dto.addressId },
      }),
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

    // Determine which items to order
    let itemsToOrder: any[] = [];
    let isBuyNow = false;

    if (dto.items && dto.items.length > 0) {
      // Buy Now: items provided directly, fetch from DB
      isBuyNow = true;
      const productIds = dto.items.map((i) => i.productId);
      const products = await this.prisma.product.findMany({
         where: { id: { in: productIds } },
       });
 
       if (products.length !== dto.items.length) {
         throw new BadRequestException('One or more products not found');
       }
  
       const itemMap = new Map(dto.items.map((i) => [i.productId, i.quantity]));
       itemsToOrder = products.map((p) => ({
         productId: p.id,
         name: p.name,
         price: p.price,
         quantity: itemMap.get(p.id) ?? 1,
         image: p.images?.[0] ?? null,
         taxRate: (p as any).taxRate ?? 0,
       }));
    } else {
      // Normal flow: use cart
      const cart = await this.cartService.getCart(userId);
      if (cart.items.length === 0) {
        throw new BadRequestException('Cart is empty');
      }

      itemsToOrder = cart.items;
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
    }

    if (itemsToOrder.length === 0) {
      throw new BadRequestException('No items to order');
    }

    // 4-5. Parallel: fetch products + resolve allocation
    const productIds = itemsToOrder.map((i) => i.productId);
    const lat = dto.lat ?? address.lat;
    const lng = dto.lng ?? address.lng;
    const needsFulfillment = lat != null && lng != null;

    // Build cart item inputs from cart snapshot
    const cartItemInputsForFulfillment = needsFulfillment
      ? itemsToOrder.map((ci) => ({
        productId: ci.productId,
        name: ci.name,
        price: ci.price,
        quantity: ci.quantity,
        image: ci.image ?? null,
      }))
      : null;

    // Run product fetch + allocation resolution in parallel
    const [products, allocationResult] = await Promise.all([
      this.prisma.product.findMany({
        where: { id: { in: productIds } },
      }),
      needsFulfillment
        ? this.fulfillmentService.resolveAllocation(
            lat!, lng!, cartItemInputsForFulfillment!,
          )
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

    // 5. Process allocation results
    if (allocationResult) {
      if (allocationResult.unfulfillableItems.length > 0) {
        const unavailableNames = allocationResult.unfulfillableItems
          .map((i) => i.name)
          .join(', ');
        throw new BadRequestException(
          `These items are unavailable for delivery: ${unavailableNames}`,
        );
      }
    }

    // 6. Determine payment status + order status
    const paymentStatus =
      dto.paymentMethod === PaymentMethod.COD
        ? PaymentStatus.COD_PENDING
        : PaymentStatus.PENDING;

    const orderStatus =
      dto.paymentMethod === PaymentMethod.COD
        ? OrderStatus.CONFIRMED
        : OrderStatus.PENDING;

    const confirmedAt =
      dto.paymentMethod === PaymentMethod.COD ? new Date() : null;

    // 7. Branch: single-store vs multi-store
    let order: any;

    if (!allocationResult || allocationResult.type === 'SINGLE_STORE') {
      // Single-store path (or no fulfillment data)
      order = await this.createSingleStoreOrder(
        userId, dto, idempotencyKey, address, itemsToOrder, productMap,
        allocationResult, orderStatus, paymentStatus, confirmedAt,
      );
    } else {
      // Multi-store path
      order = await this.createMultiStoreOrder(
        userId, dto, idempotencyKey, address, itemsToOrder, productMap,
        allocationResult, orderStatus, paymentStatus, confirmedAt,
      );
    }

    // Clear cart (only for cart-based orders) + invalidate cache
    await Promise.all([
      !isBuyNow ? this.cartService.clearCart(userId) : Promise.resolve(),
      Promise.resolve(this.invalidateOrderCache(userId)),
    ]);

    this.logger.log(
      `Order ${order.orderNumber} created for user ${userId} (${dto.paymentMethod})`,
    );

    // COD orders are CONFIRMED immediately — record in ledger
    if (dto.paymentMethod === PaymentMethod.COD) {
      if (order.childOrders?.length > 0) {
        // Multi-store: create ledger entries per child (parent has no items)
        for (const child of order.childOrders) {
          this.createLedgerEntries(child, 'COD');
        }
      } else {
        this.createLedgerEntries(order, 'COD');
      }
    }

    return { ...order, ...this.computeGraceFields(order) };
  }

  /**
   * Create a single-store order (current behavior).
   */
  private async createSingleStoreOrder(
    userId: string,
    dto: CreateOrderDto,
    idempotencyKey: string,
    address: any,
    itemsToOrder: any[],
    productMap: Map<string, any>,
    allocationResult: AllocationResult | null,
    orderStatus: OrderStatus,
    paymentStatus: PaymentStatus,
    confirmedAt: Date | null,
  ) {
    // Build store assignments from single-store allocation
    let storeAssignments: Map<string, string> | null = null;
    if (allocationResult && allocationResult.storeAllocations.length > 0) {
      storeAssignments = new Map<string, string>();
      for (const sa of allocationResult.storeAllocations) {
        for (const item of sa.items) {
          storeAssignments.set(item.productId, sa.storeId);
        }
      }
    }

    const orderItems = itemsToOrder.map((cartItem) => {
      const product = productMap.get(cartItem.productId)!;
      return {
        productId: product.id,
        name: product.name,
        price: product.price,
        quantity: cartItem.quantity,
        total: product.price * cartItem.quantity,
        taxRate: product.taxRate ?? 0,
        storeId: storeAssignments?.get(product.id) ?? null,
        selectedSize: cartItem.selectedSize ?? null,
        userUploadUrls: cartItem.userUploadUrls ?? [],
        printProductId: cartItem.printProductId ?? null,
      };
    });

    const subtotal = orderItems.reduce((sum, item) => sum + item.total, 0);
    const freeDelivery = subtotal >= this.freeDeliveryThreshold;
    const deliveryFee = freeDelivery ? 0 : this.deliveryFee;
    // Per-item tax: sum of (itemTotal × itemTaxRate / 100), rounded to 2dp each
    const tax = orderItems.reduce((acc, oi) => {
      return acc + Math.round(oi.total * ((oi.taxRate ?? 0) / 100) * 100) / 100;
    }, 0);
    const total = Math.round((subtotal + deliveryFee + tax) * 100) / 100;

    const orderNumber = this.generateOrderNumber();

    return this.prisma.$transaction(async (tx) => {
      await this.stockService.adjustStock(tx, orderItems, 'decrement');

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
          confirmedAt,
          items: {
            create: orderItems.map((oi) => ({
              productId: oi.productId,
              name: oi.name,
              price: oi.price,
              quantity: oi.quantity,
              total: oi.total,
              taxRate: oi.taxRate ?? 0,
              storeId: oi.storeId,
              selectedSize: oi.selectedSize,
              userUploadUrls: oi.userUploadUrls,
              printProductId: oi.printProductId,
            })),
          },
        },
        include: { items: true },
      });
    });
  }

  /**
   * Create a multi-store order with parent + child sub-orders.
   * All done in a single atomic transaction.
   */
  private async createMultiStoreOrder(
    userId: string,
    dto: CreateOrderDto,
    idempotencyKey: string,
    address: any,
    itemsToOrder: any[],
    productMap: Map<string, any>,
    allocationResult: AllocationResult,
    orderStatus: OrderStatus,
    paymentStatus: PaymentStatus,
    confirmedAt: Date | null,
  ) {
    // Build a lookup for cart item custom fields
    const cartItemLookup = new Map(itemsToOrder.map((ci) => [ci.productId, ci]));

    // Build order items per store from allocation
    const storeOrderItems = allocationResult.storeAllocations.map((sa) => ({
      storeId: sa.storeId,
      storeName: sa.storeName,
      items: sa.items.map((item) => {
        const product = productMap.get(item.productId)!;
        const cartItem = cartItemLookup.get(item.productId);
        return {
          productId: product.id,
          name: product.name,
          price: product.price,
          quantity: item.quantity,
          total: product.price * item.quantity,
          taxRate: (product as any).taxRate ?? 0,
          storeId: sa.storeId,
          selectedSize: cartItem?.selectedSize ?? null,
          userUploadUrls: cartItem?.userUploadUrls ?? [],
          printProductId: cartItem?.printProductId ?? null,
        };
      }),
    }));

    // Calculate aggregate totals
    const allItems = storeOrderItems.flatMap((s) => s.items);
    const subtotal = allItems.reduce((sum, item) => sum + item.total, 0);
    const freeDelivery = subtotal >= this.freeDeliveryThreshold;
    const deliveryFee = freeDelivery ? 0 : this.deliveryFee;
    // Per-item tax across all stores
    const tax = allItems.reduce((acc, oi) => {
      return acc + Math.round(oi.total * ((oi.taxRate ?? 0) / 100) * 100) / 100;
    }, 0);
    const total = Math.round((subtotal + deliveryFee + tax) * 100) / 100;

    const parentOrderNumber = this.generateOrderNumber();

    return this.prisma.$transaction(async (tx) => {
      // Batch decrement stock for ALL items across all stores
      await this.stockService.adjustStock(tx, allItems, 'decrement');

      // Create parent order (umbrella, no items)
      const parentOrder = await tx.order.create({
        data: {
          userId,
          orderNumber: parentOrderNumber,
          status: orderStatus,
          paymentMethod: dto.paymentMethod,
          paymentStatus,
          deliveryAddress: address as any,
          subtotal,
          deliveryFee,
          tax,
          total,
          idempotencyKey,
          confirmedAt,
          isParent: true,
        },
      });

      // Create child orders — one per store
      const childOrders: any[] = [];
      let assignedDeliveryFee = 0;
      for (let i = 0; i < storeOrderItems.length; i++) {
        const storeGroup = storeOrderItems[i];
        const childSubtotal = storeGroup.items.reduce((sum, item) => sum + item.total, 0);
        const isLast = i === storeOrderItems.length - 1;
        // Split delivery fee proportionally — assign rounding remainder to last child
        const childDeliveryFee = isLast
          ? Math.round((deliveryFee - assignedDeliveryFee) * 100) / 100
          : subtotal > 0
            ? Math.round((childSubtotal / subtotal) * deliveryFee * 100) / 100
            : 0;
        assignedDeliveryFee += childDeliveryFee;
        // Per-item tax for this store's items only
        const childTax = storeGroup.items.reduce((acc, oi) => {
          return acc + Math.round(oi.total * ((oi.taxRate ?? 0) / 100) * 100) / 100;
        }, 0);
        const childTotal = Math.round((childSubtotal + childDeliveryFee + childTax) * 100) / 100;

        const childOrder = await tx.order.create({
          data: {
            userId,
            orderNumber: `${parentOrderNumber}-${i + 1}`,
            status: orderStatus,
            paymentMethod: dto.paymentMethod,
            paymentStatus,
            deliveryAddress: address as any,
            subtotal: childSubtotal,
            deliveryFee: childDeliveryFee,
            tax: childTax,
            total: childTotal,
            idempotencyKey: `${idempotencyKey}-child-${i + 1}`,
            confirmedAt,
            parentOrderId: parentOrder.id,
            items: {
              create: storeGroup.items.map((oi) => ({
                productId: oi.productId,
                name: oi.name,
                price: oi.price,
                quantity: oi.quantity,
                total: oi.total,
                taxRate: oi.taxRate ?? 0,
                storeId: oi.storeId,
                selectedSize: oi.selectedSize,
                userUploadUrls: oi.userUploadUrls,
                printProductId: oi.printProductId,
              })),
            },
          },
          include: { items: true },
        });
        childOrders.push(childOrder);
      }

      return {
        ...parentOrder,
        items: [],
        childOrders,
      };
    });
  }

  /**
   * Sync parent order status based on children's statuses.
   * Called after any child order status change.
   */
  private async syncParentStatus(parentOrderId: string): Promise<void> {
    const children = await this.prisma.order.findMany({
      where: { parentOrderId },
      select: { status: true },
    });

    if (children.length === 0) return;

    const statuses = children.map((c) => c.status);

    // Separate cancelled from active children
    const activeStatuses = statuses.filter((s) => s !== OrderStatus.CANCELLED);

    let parentStatus: OrderStatus;
    if (activeStatuses.length === 0) {
      // All children cancelled
      parentStatus = OrderStatus.CANCELLED;
    } else if (activeStatuses.every((s) => s === OrderStatus.DELIVERED)) {
      parentStatus = OrderStatus.DELIVERED;
    } else if (activeStatuses.some((s) => s === OrderStatus.SHIPPED)) {
      parentStatus = OrderStatus.SHIPPED;
    } else if (activeStatuses.some((s) => s === OrderStatus.ORDER_PICKED)) {
      parentStatus = OrderStatus.ORDER_PICKED;
    } else {
      parentStatus = OrderStatus.CONFIRMED;
    }

    await this.prisma.order.update({
      where: { id: parentOrderId },
      data: {
        status: parentStatus,
        ...(parentStatus === OrderStatus.DELIVERED ? { deliveredAt: new Date() } : {}),
      },
    });
  }

  /**
   * List user's orders (paginated, cached 5 min).
   * Excludes child orders — users see parent or single-store orders only.
   */
  async findAll(userId: string, query: OrderQueryDto) {
    const { page = 1, limit = 10 } = query;
    const cacheKey = `orders:${userId}:p${page}:l${limit}`;

    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;

    const skip = (page - 1) * limit;

    const where: Prisma.OrderWhereInput = {
      userId,
      parentOrderId: null, // Exclude child orders — show parent or standalone
    };

    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
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
          childOrders: {
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
            orderBy: { orderNumber: 'asc' },
          },
        },
      }),
      this.prisma.order.count({ where }),
    ]);

    const data = orders.map((o) => ({
      ...o,
      ...this.computeGraceFields(o),
    }));

    const result = paginate(data, total, page, limit);
    await this.cache.set(cacheKey, result, TTL.ORDER_LIST);
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
        childOrders: {
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
          orderBy: { orderNumber: 'asc' },
        },
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.userId !== userId && role !== 'ADMIN') {
      throw new NotFoundException('Order not found');
    }

    return { ...order, ...this.computeGraceFields(order) };
  }

  /**
   * Cancel an order. Only if PENDING or CONFIRMED. Restores stock atomically.
   * For parent orders: cascade cancel all non-terminal children.
   * For child orders: cancel child only, then sync parent status.
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
        confirmedAt: true,
        isParent: true,
        parentOrderId: true,
        items: {
          select: { productId: true, quantity: true, storeId: true, id: true, name: true, price: true, total: true, orderId: true },
        },
        childOrders: {
          select: {
            id: true,
            status: true,
            paymentStatus: true,
            items: {
              select: { productId: true, quantity: true, storeId: true, id: true, name: true, price: true, total: true, orderId: true },
            },
          },
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

    // Grace period check — use parent's confirmedAt for child orders
    const graceOrder = order.parentOrderId
      ? await this.prisma.order.findUnique({
          where: { id: order.parentOrderId },
          select: { confirmedAt: true },
        })
      : order;

    if (order.status === OrderStatus.CONFIRMED) {
      const grace = this.computeGraceFields({ status: order.status, confirmedAt: graceOrder?.confirmedAt });
      if (!grace.canCancel) {
        throw new BadRequestException(
          'Grace period expired. Order can no longer be cancelled.',
        );
      }
    }

    const newPaymentStatus = (ps: PaymentStatus) =>
      ps === PaymentStatus.PAID ? PaymentStatus.REFUNDED : PaymentStatus.FAILED;

    if (order.isParent) {
      // Cascade cancel all non-terminal child orders
      await this.prisma.$transaction(async (tx) => {
        for (const child of order.childOrders) {
          if (child.status === OrderStatus.CANCELLED || child.status === OrderStatus.DELIVERED) continue;
          if (child.items.length > 0) {
            await this.stockService.adjustStock(tx, child.items, 'increment');
          }
          await tx.order.update({
            where: { id: child.id },
            data: {
              status: OrderStatus.CANCELLED,
              paymentStatus: newPaymentStatus(child.paymentStatus as PaymentStatus),
            },
          });
        }
        // Cancel parent itself
        await tx.order.update({
          where: { id: orderId },
          data: {
            status: OrderStatus.CANCELLED,
            paymentStatus: newPaymentStatus(order.paymentStatus as PaymentStatus),
          },
        });
      });
    } else {
      // Single-store or child order cancel
      await this.prisma.$transaction(async (tx) => {
        if (order.items.length > 0) {
          await this.stockService.adjustStock(tx, order.items, 'increment');
        }
        await tx.order.update({
          where: { id: orderId },
          data: {
            status: OrderStatus.CANCELLED,
            paymentStatus: newPaymentStatus(order.paymentStatus as PaymentStatus),
          },
        });
      });

      // If child order, sync parent status
      if (order.parentOrderId) {
        await this.syncParentStatus(order.parentOrderId);
      }
    }

    this.invalidateOrderCache(userId, orderId);

    this.logger.log(`Order ${order.orderNumber} cancelled`);

    const cancelledOrder = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true, childOrders: { include: { items: true } } },
    });

    return { ...cancelledOrder, ...this.computeGraceFields({ status: OrderStatus.CANCELLED, confirmedAt: order.confirmedAt }) };
  }

  /**
   * Modify order items within the 90-second grace period.
   * Restores old stock, validates + decrements new stock, recalculates totals.
   */
  async modifyOrder(
    userId: string,
    orderId: string,
    modifications: { productId: string; quantity: number }[],
  ) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        userId: true,
        orderNumber: true,
        status: true,
        confirmedAt: true,
        deliveryFee: true,
        isParent: true,
        parentOrderId: true,
        items: {
          select: { id: true, productId: true, name: true, price: true, quantity: true, total: true, taxRate: true, storeId: true, orderId: true },
        },
      },
    });

    if (!order || order.userId !== userId) {
      throw new NotFoundException('Order not found');
    }

    // Parent orders cannot be modified directly — modify individual child orders
    if (order.isParent) {
      throw new BadRequestException(
        'Cannot modify a multi-store order directly. Modify individual sub-orders instead.',
      );
    }

    // Grace period check — use parent's confirmedAt for child orders
    const graceSource = order.parentOrderId
      ? await this.prisma.order.findUnique({
          where: { id: order.parentOrderId },
          select: { confirmedAt: true },
        })
      : order;
    const grace = this.computeGraceFields({ status: order.status, confirmedAt: graceSource?.confirmedAt });
    if (!grace.canModify) {
      throw new BadRequestException(
        'Grace period expired. Order can no longer be modified.',
      );
    }

    // Build a map of requested changes: productId -> newQuantity
    const modMap = new Map(modifications.map((m) => [m.productId, m.quantity]));

    // Validate all modification productIds exist in the order
    for (const productId of modMap.keys()) {
      if (!order.items.find((i) => i.productId === productId)) {
        throw new BadRequestException(
          `Product ${productId} is not in this order`,
        );
      }
    }

    // Must keep at least one item
    const remainingItems = order.items.filter((i) => {
      const newQty = modMap.get(i.productId);
      return newQty === undefined ? true : newQty > 0;
    });
    if (remainingItems.length === 0 && order.items.every((i) => modMap.has(i.productId))) {
      throw new BadRequestException(
        'Cannot remove all items. Cancel the order instead.',
      );
    }

    const updatedOrder = await this.prisma.$transaction(async (tx) => {
      // 1. Restore stock for ALL current items (simpler than computing deltas)
      await this.stockService.adjustStock(tx, order.items, 'increment');

      // 2. Compute new items list
      const newItems = order.items
        .map((item) => {
          const newQty = modMap.has(item.productId) ? modMap.get(item.productId)! : item.quantity;
          return { ...item, quantity: newQty, total: item.price * newQty };
        })
        .filter((item) => item.quantity > 0);

      // 3. Decrement stock for new quantities
      await this.stockService.adjustStock(tx, newItems, 'decrement');

      // 4. Delete removed items
      const removedIds = order.items
        .filter((item) => modMap.has(item.productId) && modMap.get(item.productId) === 0)
        .map((item) => item.id);
      if (removedIds.length > 0) {
        await tx.orderItem.deleteMany({ where: { id: { in: removedIds } } });
      }

      // 5. Update quantities for remaining items
      for (const newItem of newItems) {
        const oldItem = order.items.find((i) => i.productId === newItem.productId);
        if (oldItem && (oldItem.quantity !== newItem.quantity)) {
          await tx.orderItem.update({
            where: { id: oldItem.id },
            data: { quantity: newItem.quantity, total: newItem.total },
          });
        }
      }

      // 6. Recalculate totals using per-item taxRate snapshot from OrderItem
      const subtotal = newItems.reduce((sum, item) => sum + item.total, 0);
      const tax = newItems.reduce((acc, oi) => {
        const rate = oi.taxRate ?? 0;
        return acc + Math.round(oi.total * (rate / 100) * 100) / 100;
      }, 0);
      const deliveryFee = subtotal >= this.freeDeliveryThreshold ? 0 : this.deliveryFee;
      const total = Math.round((subtotal + deliveryFee + tax) * 100) / 100;

      return tx.order.update({
        where: { id: orderId },
        data: { subtotal, deliveryFee, tax, total },
        include: { items: true },
      });
    });

    // If child order, sync parent totals
    if (order.parentOrderId) {
      const siblings = await this.prisma.order.findMany({
        where: { parentOrderId: order.parentOrderId },
        select: { subtotal: true, deliveryFee: true, tax: true, total: true },
      });
      const parentSubtotal = siblings.reduce((s, c) => s + c.subtotal, 0);
      const parentDeliveryFee = siblings.reduce((s, c) => s + c.deliveryFee, 0);
      const parentTax = siblings.reduce((s, c) => s + c.tax, 0);
      const parentTotal = siblings.reduce((s, c) => s + c.total, 0);
      await this.prisma.order.update({
        where: { id: order.parentOrderId },
        data: { subtotal: parentSubtotal, deliveryFee: parentDeliveryFee, tax: parentTax, total: parentTotal },
      });
    }

    this.invalidateOrderCache(userId, orderId);

    this.logger.log(`Order ${order.orderNumber} modified within grace period`);
    return { ...updatedOrder, ...this.computeGraceFields({ ...updatedOrder, confirmedAt: graceSource?.confirmedAt ?? order.confirmedAt }) };
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
       "confirmedAt" = NOW(), "updatedAt" = NOW()
       WHERE "id" = $3 AND "paymentStatus" != 'PAID'`,
      razorpayPaymentId,
      razorpaySignature,
      orderId,
    );

    // Fetch the order with items + children for response + ledger
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true, childOrders: { include: { items: true } } },
    });
    if (!order) throw new NotFoundException('Order not found');

    if (updateCount === 0) {
      this.logger.log(`Order ${order.orderNumber} already marked as PAID, skipping`);
      return order;
    }

    // If multi-store parent, also confirm all child orders
    if (order.isParent && order.childOrders.length > 0) {
      await this.prisma.$executeRawUnsafe(
        `UPDATE "Order" SET "status" = 'CONFIRMED', "paymentStatus" = 'PAID',
         "razorpayPaymentId" = $1, "razorpaySignature" = $2,
         "paidAt" = NOW(), "confirmedAt" = NOW(), "updatedAt" = NOW()
         WHERE "parentOrderId" = $3 AND "status" = 'PENDING'`,
        razorpayPaymentId,
        razorpaySignature,
        orderId,
      );
    }

    this.invalidateOrderCache(order.userId, orderId);

    // Record online payment in ledger
    if (order.childOrders?.length > 0) {
      for (const child of order.childOrders) {
        this.createLedgerEntries(child, 'RAZORPAY');
      }
    } else {
      this.createLedgerEntries(order, 'RAZORPAY');
    }

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

    return paginate(orders, total, page, limit);
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

    const where: Prisma.OrderWhereInput = {
      parentOrderId: null, // Show parent/standalone only, not child orders
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
          childOrders: {
            include: {
              items: true,
              assignment: {
                include: {
                  deliveryPerson: { select: { id: true, name: true, phone: true } },
                },
              },
            },
            orderBy: { orderNumber: 'asc' },
          },
        },
      }),
      this.prisma.order.count({ where }),
    ]);

    return paginate(orders, total, page, limit);
  }

  // Valid order status transitions (one-way hierarchy)
  // CONFIRMED → ORDER_PICKED → SHIPPED → DELIVERED
  // DELIVERED can only be set by delivery person via completeDelivery()
  private static readonly VALID_TRANSITIONS: Record<string, OrderStatus[]> = {
    PENDING: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
    CONFIRMED: [OrderStatus.PROCESSING, OrderStatus.ORDER_PICKED, OrderStatus.CANCELLED],
    PROCESSING: [OrderStatus.ORDER_PICKED, OrderStatus.CANCELLED],
    ORDER_PICKED: [OrderStatus.SHIPPED, OrderStatus.CANCELLED],
    SHIPPED: [OrderStatus.CANCELLED],     // DELIVERED is set only by delivery person
    DELIVERED: [],
    CANCELLED: [],
  };

  async updateStatus(id: string, status: OrderStatus, storeId?: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!order) throw new NotFoundException('Order not found');

    // Parent orders cannot have status set directly — status is derived from children
    if (order.isParent) {
      throw new BadRequestException(
        'Cannot update status of a multi-store parent order directly. Update individual sub-orders.',
      );
    }

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

    // If admin cancels, restore stock atomically (same logic as user cancel)
    if (status === OrderStatus.CANCELLED) {
      const cancelledOrder = await this.prisma.$transaction(async (tx) => {
        await this.stockService.adjustStock(tx, order.items, 'increment');

        return tx.order.update({
          where: { id },
          data: {
            status: OrderStatus.CANCELLED,
            paymentStatus:
              order.paymentStatus === PaymentStatus.PAID
                ? PaymentStatus.REFUNDED
                : PaymentStatus.FAILED,
          },
        });
      });

      // Sync parent status if this is a child order
      if (order.parentOrderId) {
        await this.syncParentStatus(order.parentOrderId);
      }

      this.logger.log(`Order ${order.orderNumber} cancelled by admin with stock restoration`);
      return cancelledOrder;
    }

    const updateData: any = { status };
    if (status === OrderStatus.CONFIRMED && !order.confirmedAt) {
      updateData.confirmedAt = new Date();
    }

    const updated = await this.prisma.order.update({
      where: { id },
      data: updateData,
    });

    // Sync parent status if this is a child order
    if (order.parentOrderId) {
      await this.syncParentStatus(order.parentOrderId);
    }

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
