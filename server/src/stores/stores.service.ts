import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { RedisCacheService } from '../common/services/redis-cache.service';
import { CreateStoreDto } from './dto/create-store.dto';
import { UpdateStoreDto } from './dto/update-store.dto';
import { UpdateInventoryDto } from './dto/update-inventory.dto';
import {
  haversineDistance,
  MAX_DELIVERY_RADIUS_KM,
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

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: RedisCacheService,
  ) { }

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
  async checkServiceability(lat: number, lng: number) {
    const stores = await this.getAllStoresFromCache();

    const nearby: NearbyStore[] = stores
      .map((s) => ({
        ...s,
        distance:
          Math.round(haversineDistance(lat, lng, s.lat, s.lng) * 10) / 10,
      }))
      .filter((s) => s.distance <= MAX_DELIVERY_RADIUS_KM)
      .sort((a, b) => a.distance - b.distance);

    return {
      serviceable: nearby.length > 0,
      nearestStore: nearby[0] ?? null,
      stores: nearby,
      maxRadiusKm: MAX_DELIVERY_RADIUS_KM,
    };
  }

  /** Get stores within delivery radius, sorted by distance. */
  async findNearbyStores(lat: number, lng: number): Promise<NearbyStore[]> {
    const stores = await this.getAllStoresFromCache();

    return stores
      .map((s) => ({
        ...s,
        distance:
          Math.round(haversineDistance(lat, lng, s.lat, s.lng) * 10) / 10,
      }))
      .filter((s) => s.distance <= MAX_DELIVERY_RADIUS_KM)
      .sort((a, b) => a.distance - b.distance);
  }

  // ── CRUD ────────────────────────────────────────────────────────

  private async generateStoreCode(): Promise<string> {
    const lastStore = await this.prisma.store.findFirst({
      where: { storeCode: { startsWith: 'A' } },
      orderBy: { storeCode: 'desc' },
    });

    if (!lastStore || !lastStore.storeCode) {
      return 'A1';
    }

    const numMatch = lastStore.storeCode.match(/A(\d+)/);
    if (numMatch) {
      const nextNum = parseInt(numMatch[1], 10) + 1;
      return `A${nextNum}`;
    }
    return 'A1';
  }

  async create(dto: CreateStoreDto) {
    let retries = 5;
    while (retries > 0) {
      try {
        const storeCode = await this.generateStoreCode();
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
        _count: { select: { inventory: true, deliveryPersons: true } },
      },
    });
  }

  async findOne(id: string) {
    const store = await this.prisma.store.findUnique({
      where: { id },
      include: {
        _count: { select: { inventory: true, deliveryPersons: true } },
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
    await this.invalidateCache();
    this.logger.log(`Store updated: ${updated.name} (${id})`);
    return updated;
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.store.delete({ where: { id } });
    await this.invalidateCache();
    this.logger.log(`Store deleted: ${id}`);
    return { message: 'Store deleted', id };
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
