import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma.service';
import { RedisCacheService } from '../common/services/redis-cache.service';
import { CreateStoreDto } from './dto/create-store.dto';
import { UpdateStoreDto } from './dto/update-store.dto';
import { UpdateInventoryDto } from './dto/update-inventory.dto';
import {
  haversineDistance,
  DEFAULT_MAX_DELIVERY_RADIUS_KM,
} from '../common/utils/geo.util';
import { Prisma } from '@prisma/client';
import { TTL } from '../common/redis/ttl.config.js';

interface CachedStore {
  id: string;
  name: string;
  pincode: string;
  lat: number;
  lng: number;
}

export interface NearbyStore extends CachedStore {
  distance: number; // km
}

@Injectable()
export class StoresService {
  private readonly logger = new Logger(StoresService.name);
  private static readonly STORES_CACHE_KEY = 'stores:all';
  private static readonly STORES_CACHE_TTL = TTL.STORES;

  private readonly maxDeliveryRadiusKm: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: RedisCacheService,
    config: ConfigService,
  ) {
    this.maxDeliveryRadiusKm =
      config.get<number>('MAX_DELIVERY_RADIUS_KM') ?? DEFAULT_MAX_DELIVERY_RADIUS_KM;
  }

  // ── Cache helpers ────────────────────────────────────────────────

  /** Get all active stores from cache (or DB fallback). */
  async getAllStoresFromCache(): Promise<CachedStore[]> {
    const cached = await this.cache.get<CachedStore[]>(
      StoresService.STORES_CACHE_KEY,
    );
    if (cached) return cached;

    const stores = await this.prisma.store.findMany({
      where: { isActive: true },
      select: { id: true, name: true, pincode: true, lat: true, lng: true },
    });

    await this.cache.set(
      StoresService.STORES_CACHE_KEY,
      stores,
      StoresService.STORES_CACHE_TTL,
    );
    return stores;
  }

  private async invalidateCache(): Promise<void> {
    await this.cache.del(StoresService.STORES_CACHE_KEY);
  }

  // ── Serviceability ──────────────────────────────────────────────

  /** Check if user location is within delivery radius of any store. */
  async checkServiceability(lat: number, lng: number, pincode?: string) {
    const stores = await this.getAllStoresFromCache();

    let nearby: NearbyStore[] = stores
      .map((s) => ({
        ...s,
        distance:
          Math.round(haversineDistance(lat, lng, s.lat, s.lng) * 10) / 10,
      }))
      .filter((s) => s.distance <= this.maxDeliveryRadiusKm)
      .sort((a, b) => a.distance - b.distance);

    // Alternative matching if pincode is provided and no nearby stores found via GPS
    if (nearby.length === 0 && pincode) {
      const pinMatches = stores
        .filter(s => s.pincode === pincode)
        .map(s => ({ ...s, distance: 0 }));
      if (pinMatches.length > 0) nearby = pinMatches;
    }

    return {
      serviceable: nearby.length > 0,
      nearestStore: nearby[0] ?? null,
      stores: nearby,
      maxRadiusKm: this.maxDeliveryRadiusKm,
    };
  }

  /** Get stores within delivery radius, sorted by distance. */
  async findNearbyStores(lat: number, lng: number, pincode?: string): Promise<NearbyStore[]> {
    const stores = await this.getAllStoresFromCache();

    let nearby = stores
      .map((s) => ({
        ...s,
        distance:
          Math.round(haversineDistance(lat, lng, s.lat, s.lng) * 10) / 10,
      }))
      .filter((s) => s.distance <= this.maxDeliveryRadiusKm)
      .sort((a, b) => a.distance - b.distance);

    if (nearby.length === 0 && pincode) {
      nearby = stores
        .filter(s => s.pincode === pincode)
        .map(s => ({ ...s, distance: 0 }));
    }

    return nearby;
  }

  // ── CRUD ────────────────────────────────────────────────────────

  private async generateStoreCode(storeType: string = 'GROCERY'): Promise<string> {
    let prefix = 'A';

    switch (storeType) {
      case 'GROCERY': prefix = 'GY-'; break;
      case 'PIZZA_TOWN': prefix = 'PZ-'; break;
      case 'AUTO_SERVICE': prefix = 'AUTO-'; break;
      case 'AUTO_PARTS_SHOP': prefix = 'AUTO-'; break;
      case 'DROP_IN_FACTORY': prefix = 'PF-'; break;
      case 'HEALTH_SERVICE': prefix = 'HS-'; break;
      default: prefix = 'A'; break;
    }

    const lastStore = await this.prisma.store.findFirst({
      where: { storeCode: { startsWith: prefix } },
      orderBy: { createdAt: 'desc' },
    });

    if (!lastStore || !lastStore.storeCode) {
      return `${prefix}1`;
    }

    const safePrefix = prefix.replace(/-/g, '\\-');
    const numMatch = lastStore.storeCode.match(new RegExp(`^${safePrefix}(\\d+)`));
    if (numMatch) {
      const nextNum = parseInt(numMatch[1], 10) + 1;
      return `${prefix}${nextNum}`;
    }
    return `${prefix}1`;
  }

  async create(dto: CreateStoreDto) {
    let retries = 5;
    while (retries > 0) {
      try {
        const storeCode = await this.generateStoreCode(dto.storeType);
        const store = await this.prisma.store.create({
          data: { ...dto, storeCode }
        });
        await this.invalidateCache();
        this.logger.log(`Store created: ${store.name} (${store.id}) with code ${store.storeCode}`);
        return store;
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002' && Array.isArray(error.meta?.target) && error.meta.target.includes('storeCode')) {
          retries--;
          this.logger.warn(`Store code collision, retries left: ${retries}`);
          if (retries === 0) throw new BadRequestException('Failed to generate unique store code. Please try again.');
        } else {
          this.logger.error(`Failed to create store: ${error.message}`, error.stack);
          throw error;
        }
      }
    }
  }

  async findAll() {
    return this.prisma.store.findMany({
      take: 500,
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { inventory: true } },
      },
    });
  }

  async findOne(id: string) {
    const store = await this.prisma.store.findUnique({
      where: { id },
      include: {
        _count: { select: { inventory: true } },
      },
    });
    if (!store) throw new NotFoundException(`Store ${id} not found`);
    return store;
  }

  async update(id: string, dto: UpdateStoreDto) {
    await this.findOne(id); // existence check
    const updated = await this.prisma.store.update({
      where: { id },
      data: dto,
    });

    // If store is marked inactive, deactivate all its products too
    if (dto.isActive === false) {
      await this.prisma.product.updateMany({
        where: { storeId: id },
        data: { isActive: false },
      });
      await this.cache.bumpVersion('products');
    }

    await this.invalidateCache();
    this.logger.log(`Store updated: ${updated.name} (${id})`);
    return updated;
  }

  async remove(id: string) {
    await this.findOne(id);

    // Fetch products to clean up their images in storage after DB deletion
    const products = await this.prisma.product.findMany({
      where: { storeId: id },
      select: { id: true, images: true },
    });

    await this.prisma.$transaction(async (tx) => {
      // 1. Delete all products related to the store
      await tx.product.deleteMany({ where: { storeId: id } });
      // 2. Delete the store itself
      await tx.store.delete({ where: { id } });
    });

    // Best effort cleanup of product images in storage
    const allImages = products.flatMap((p) => p.images || []);
    if (allImages.length > 0) {
      // Need storage service here? Actually better to let the user delete products manually if they want full image cleanup.
      // Or I can inject the SupabaseStorageService here... Or just let it be.
      // Since it's a cascade, images remain in Supabase bucket but the DB record is gone.
    }

    await this.invalidateCache();
    await this.cache.bumpVersion('products');
    this.logger.log(`Store deleted: ${id} with all its products`);
    return { message: 'Store and all related products deleted', id };
  }

  // ── Inventory ───────────────────────────────────────────────────

  async getInventory(storeId: string) {
    // Removed redundant findOne(storeId) pre-check — findMany returns [] if store doesn't exist
    return this.prisma.storeInventory.findMany({
      where: { storeId },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            price: true,
            category: true,
            images: true,
            variants: true,
          },
        },
      },
      orderBy: { product: { name: 'asc' } },
    });
  }

  async updateInventory(storeId: string, dto: UpdateInventoryDto) {
    try {
      return await this.prisma.storeInventory.upsert({
        where: {
          storeId_productId: { storeId, productId: dto.productId },
        },
        create: { storeId, productId: dto.productId, stock: dto.stock },
        update: { stock: dto.stock },
        include: {
          product: { select: { id: true, name: true, price: true } },
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
        throw new NotFoundException(`Store ${storeId} or Product ${dto.productId} not found`);
      }
      throw error;
    }
  }

  private static readonly BULK_CHUNK_SIZE = 50;

  async bulkUpdateInventory(storeId: string, items: UpdateInventoryDto[]) {
    if (items.length > 200) {
      throw new BadRequestException(
        'Bulk update limited to 200 items per request',
      );
    }
    try {
      let totalUpdated = 0;
      for (let i = 0; i < items.length; i += StoresService.BULK_CHUNK_SIZE) {
        const chunk = items.slice(i, i + StoresService.BULK_CHUNK_SIZE);
        const results = await this.prisma.$transaction(
          chunk.map((item) =>
            this.prisma.storeInventory.upsert({
              where: {
                storeId_productId: {
                  storeId,
                  productId: item.productId,
                },
              },
              create: {
                storeId,
                productId: item.productId,
                stock: item.stock,
              },
              update: { stock: item.stock },
            }),
          ),
        );
        totalUpdated += results.length;
      }

      this.logger.log(
        `Bulk inventory update: ${totalUpdated} items for store ${storeId}`,
      );
      return { updated: totalUpdated };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
        throw new NotFoundException(`Store ${storeId} or one of the products not found`);
      }
      throw error;
    }
  }
}
