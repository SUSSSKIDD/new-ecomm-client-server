import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { SupabaseStorageService } from '../common/services/supabase-storage.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductQueryDto } from './dto/product-query.dto';
import { Prisma } from '@prisma/client';
import { StoreCategoryType, STORE_CATEGORY_LABELS } from '../common/constants/store-categories';
import { SubcategoryService } from '../stores/subcategory.service';
import { StoresService } from '../stores/stores.service';
import { RedisCacheService } from '../common/services/redis-cache.service';
import { paginate } from '../common/utils/pagination.util';
import { TTL } from '../common/redis/ttl.config.js';

@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);
  private static readonly MAX_IMAGES = 3;

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: SupabaseStorageService,
    private readonly cache: RedisCacheService,
    private readonly subcategoryService: SubcategoryService,
    private readonly storesService: StoresService,
  ) { }

  /**
   * Create a product with optional image file uploads.
   */
  async createWithImages(
    dto: CreateProductDto,
    files?: Express.Multer.File[],
    storeId?: string,
  ) {
    const dtoImageCount = dto.images?.length || 0;
    const fileCount = files?.length || 0;

    // Fix #5: Check combined count of URL images + file uploads
    if (dtoImageCount + fileCount > ProductsService.MAX_IMAGES) {
      throw new BadRequestException(
        `Maximum ${ProductsService.MAX_IMAGES} images allowed (got ${dtoImageCount} URLs + ${fileCount} files)`,
      );
    }

    let imageUrls: string[] = dto.images || [];
    let uploadedUrls: string[] = [];

    // Upload files if provided
    if (files && files.length > 0) {
      uploadedUrls = await this.storage.uploadMany(files);
      imageUrls = [...imageUrls, ...uploadedUrls];
    }

    // Remove images from dto since we handle it separately
    const { images: _ignored, ...productData } = dto;

    if (storeId) {
      const store = await this.prisma.store.findUnique({ where: { id: storeId } });
      if (!store) throw new NotFoundException('Store not found');

      const isValid = await this.subcategoryService.isValidSubcategory(store.storeType, dto.category);
      if (!isValid) {
        const allSubs = await this.subcategoryService.getSubcategories(store.storeType);
        throw new BadRequestException(`Category "${dto.category}" is not allowed for store type ${store.storeType}. Allowed: ${allSubs.join(', ')}`);
      }
      // Set category to main store type label, and subCategory to the specific option selected
      productData.subCategory = dto.category;
      productData.category = STORE_CATEGORY_LABELS[store.storeType as StoreCategoryType] || store.storeType;
      productData.isGrocery = store.storeType === 'GROCERY';
    }

    // Fix #4: Clean up uploaded images if DB insert fails
    try {
      const product = await this.prisma.product.create({
        data: {
          ...productData,
          images: imageUrls,
          storeId,
          storeInventory: storeId ? {
            create: {
              storeId,
              stock: productData.stock || 0
            }
          } : undefined,
        },
      });

      this.logger.log(
        `Product created: ${product.name} (${product.id}) with ${imageUrls.length} images`,
      );
      await this.cache.bumpVersion('products');
      return product;
    } catch (error) {
      if (uploadedUrls.length > 0) {
        this.logger.warn('DB insert failed, cleaning up uploaded images');
        await this.storage.deleteMany(uploadedUrls).catch(() => { });
      }
      throw error;
    }
  }

  /**
   * List products with pagination, filtering, and sorting.
   */
  async findAll(query: ProductQueryDto) {
    const {
      page = 1,
      limit = 10,
      search,
      category,
      subCategory,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      lat,
      lng,
    } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.ProductWhereInput = {};

    if (search) {
      where.AND = [{
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
          { category: { contains: search, mode: 'insensitive' } },
        ]
      }];
    }

    if (category) {
      where.category = { equals: category, mode: 'insensitive' };
    }

    if (subCategory) {
      where.subCategory = { equals: subCategory, mode: 'insensitive' };
    }

    // Default to active products only for customers/public view
    where.isActive = true;

    let storeIdsHash = '';
    let storeIds: string[] = [];
    if (lat !== undefined && lng !== undefined) {
      const nearbyStores = await this.storesService.findNearbyStores(lat, lng);
      storeIds = nearbyStores.filter(s => s.distance <= 10).map(s => s.id).sort();
      
      if (storeIds.length === 0) {
        return paginate([], 0, page, limit);
      }
      storeIdsHash = storeIds.join(',');

      const geoCondition = {
        OR: [
          { storeId: { in: storeIds } },
          { storeInventory: { some: { storeId: { in: storeIds } } } }
        ]
      };

      if (where.AND) {
        (where.AND as object[]).push(geoCondition);
      } else {
        where.AND = [geoCondition];
      }
    }

    const ver = await this.cache.getVersion('products');
    const cacheKey = `products:v${ver}:q:${search ?? ''}|${category ?? ''}|${subCategory ?? ''}|${storeIdsHash}|${sortBy}|${sortOrder}|${page}|${limit}`;
    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;

    const [products, total] = await Promise.all([
      this.prisma.product.findMany({
        skip,
        take: Number(limit),
        where,
        orderBy: { [sortBy]: sortOrder },
        include: storeIds.length > 0 ? {
          storeInventory: {
            where: { storeId: { in: storeIds } },
            select: { stock: true }
          }
        } : undefined,
      }),
      this.prisma.product.count({ where }),
    ]);

    const processedProducts = products.map((p: any) => {
      if (p.storeInventory !== undefined) {
        const localStock = p.storeInventory && p.storeInventory.length > 0 
           ? p.storeInventory.reduce((acc: number, inv: any) => acc + inv.stock, 0)
           : p.stock;
        
        const { storeInventory, ...rest } = p;
        return { ...rest, stock: localStock };
      }
      return p;
    });

    processedProducts.sort((a: any, b: any) => {
      const aOut = (a.stock || 0) <= 0;
      const bOut = (b.stock || 0) <= 0;
      if (aOut === bOut) return 0;
      return aOut ? 1 : -1;
    });

    const result = paginate(processedProducts, total, page, limit);
    await this.cache.set(cacheKey, result, TTL.PRODUCT_LIST);
    return result;
  }

  /**
   * Get a single product by ID.
   */
  async findOne(id: string, lat?: number, lng?: number) {
    let storeIds: string[] = [];
    if (lat !== undefined && lng !== undefined) {
      const nearbyStores = await this.storesService.findNearbyStores(lat, lng);
      storeIds = nearbyStores.filter(s => s.distance <= 10).map(s => s.id);
    }

    const product = await this.prisma.product.findUnique({
      where: { id },
      include: storeIds.length > 0 ? {
        storeInventory: {
          where: { storeId: { in: storeIds } },
          select: { stock: true }
        }
      } : undefined,
    });

    if (!product) {
      throw new NotFoundException(`Product ${id} not found`);
    }

    if (!product.isActive) {
      throw new NotFoundException(`Product ${id} is currently inactive`);
    }

    if (storeIds.length > 0 && (product as any).storeInventory !== undefined) {
      const localStock = (product as any).storeInventory && (product as any).storeInventory.length > 0
        ? (product as any).storeInventory.reduce((acc: number, inv: any) => acc + inv.stock, 0)
        : product.stock;
      const { storeInventory, ...rest } = product as any;
      return { ...rest, stock: localStock };
    }

    return product;
  }

  async findStoreProducts(storeId: string) {
    const products = await this.prisma.product.findMany({
      where: { storeId },
      orderBy: { createdAt: 'desc' },
      include: {
        storeInventory: {
          where: { storeId },
          select: { stock: true },
        },
      },
    });

    // Replace product.stock with store-specific inventory stock
    const processedProducts = products.map((p) => ({
      ...p,
      stock: p.storeInventory?.[0]?.stock ?? p.stock,
      storeInventory: undefined,
    }));

    processedProducts.sort((a: any, b: any) => {
      const aOut = (a.stock || 0) <= 0;
      const bOut = (b.stock || 0) <= 0;
      if (aOut === bOut) return 0;
      return aOut ? 1 : -1;
    });

    return processedProducts;
  }

  private checkOwnership(product: any, storeId?: string) {
    if (storeId && product.storeId !== storeId) {
      throw new ForbiddenException('You do not own this product');
    }
  }

  /**
   * Update a product's fields (no image handling).
   */
  async update(id: string, dto: UpdateProductDto, storeId?: string) {
    const product = await this.findOne(id);
    this.checkOwnership(product, storeId);

    const updateData: any = { ...dto };
    if (dto.stock !== undefined && product.storeId) {
      updateData.storeInventory = {
        updateMany: {
          where: { storeId: product.storeId },
          data: { stock: dto.stock }
        }
      };
    }

    if (dto.category && product.storeId) {
      const store = await this.prisma.store.findUnique({ where: { id: product.storeId } });
      if (store) {
        updateData.subCategory = dto.category;
        updateData.category = STORE_CATEGORY_LABELS[store.storeType as StoreCategoryType] || store.storeType;
      }
    }

    const updated = await this.prisma.product.update({
      where: { id },
      data: updateData,
    });

    this.logger.log(`Product updated: ${updated.name} (${id})`);
    await this.cache.bumpVersion('products');
    return updated;
  }

  /**
   * Update a product with optional new image uploads.
   */
  async updateWithImages(
    id: string,
    dto: UpdateProductDto,
    files?: Express.Multer.File[],
    storeId?: string,
  ) {
    const product = await this.findOne(id);
    this.checkOwnership(product, storeId);

    let newImageUrls: string[] = [];

    if (files && files.length > 0) {
      const currentCount = product.images?.length || 0;
      if (currentCount + files.length > ProductsService.MAX_IMAGES) {
        throw new BadRequestException(
          `Cannot add ${files.length} images. Product has ${currentCount}/${ProductsService.MAX_IMAGES}. Remove some first.`,
        );
      }
      newImageUrls = await this.storage.uploadMany(files);
    }

    try {
      const updateData: any = { ...dto };
      if (newImageUrls.length > 0) {
        updateData.images = [...(product.images || []), ...newImageUrls];
      }

      if (dto.stock !== undefined && product.storeId) {
        updateData.storeInventory = {
          updateMany: {
            where: { storeId: product.storeId },
            data: { stock: dto.stock }
          }
        };
      }

      if (dto.category && product.storeId) {
        const store = await this.prisma.store.findUnique({ where: { id: product.storeId } });
        if (store) {
          updateData.subCategory = dto.category;
          updateData.category = STORE_CATEGORY_LABELS[store.storeType as StoreCategoryType] || store.storeType;
        }
      }

      const updated = await this.prisma.product.update({
        where: { id },
        data: updateData,
      });

      this.logger.log(`Product updated: ${updated.name} (${id}) with ${newImageUrls.length} new images`);
      await this.cache.bumpVersion('products');
      return updated;
    } catch (error) {
      if (newImageUrls.length > 0) {
        await this.storage.deleteMany(newImageUrls).catch(() => { });
      }
      throw error;
    }
  }

  /**
   * Delete a product and clean up its images from storage.
   * DB record is deleted first to avoid orphaned state on DB failure.
   */
  async remove(id: string, storeId?: string) {
    const product = await this.findOne(id);
    this.checkOwnership(product, storeId);

    // Delete DB record first — if this fails, images remain intact
    await this.prisma.product.delete({ where: { id } });
    this.logger.log(`Product deleted: ${product.name} (${id})`);
    await this.cache.bumpVersion('products');

    // Clean up images from storage (non-critical, best effort)
    if (product.images && product.images.length > 0) {
      this.storage.deleteMany(product.images).catch((err) => {
        this.logger.warn(
          `Image cleanup failed for deleted product ${id}: ${err.message}`,
        );
      });
    }

    return { message: `Product "${product.name}" deleted`, id };
  }

  /**
   * Add images to an existing product. Enforces max 3 total.
   * Uses a transaction to prevent TOCTOU race conditions.
   */
  async addImages(id: string, files: Express.Multer.File[], storeId?: string) {
    // Upload files first (outside transaction to avoid holding DB lock)
    const newUrls = await this.storage.uploadMany(files);

    try {
      const updated = await this.prisma.$transaction(async (tx) => {
        // Re-read inside transaction for atomic check
        const product = await tx.product.findUnique({ where: { id } });
        if (!product) {
          throw new NotFoundException(`Product ${id} not found`);
        }
        if (storeId && product.storeId !== storeId) {
          throw new ForbiddenException('You do not own this product');
        }

        const currentCount = product.images?.length || 0;
        if (currentCount + newUrls.length > ProductsService.MAX_IMAGES) {
          throw new BadRequestException(
            `Cannot add ${newUrls.length} images. Product has ${currentCount}/${ProductsService.MAX_IMAGES}. Remove some first.`,
          );
        }

        const updatedImages = [...(product.images || []), ...newUrls];
        return tx.product.update({
          where: { id },
          data: { images: updatedImages },
        });
      });

      this.logger.log(
        `Added ${newUrls.length} images to product ${updated.name} (${id})`,
      );
      await this.cache.bumpVersion('products');
      return updated;
    } catch (error) {
      // Clean up uploaded images if transaction failed
      await this.storage.deleteMany(newUrls).catch(() => { });
      throw error;
    }
  }

  /**
   * Remove a specific image from a product by URL.
   */
  async removeImage(id: string, imageUrl: string, storeId?: string) {
    const product = await this.findOne(id);
    this.checkOwnership(product, storeId);

    if (!product.images?.includes(imageUrl)) {
      throw new NotFoundException('Image URL not found on this product');
    }

    // Delete from storage
    await this.storage.delete(imageUrl);

    // Remove from product
    const updatedImages = product.images.filter((url) => url !== imageUrl);
    const updated = await this.prisma.product.update({
      where: { id },
      data: { images: updatedImages },
    });

    this.logger.log(`Removed image from product ${product.name} (${id})`);
    await this.cache.bumpVersion('products');
    return updated;
  }
}
