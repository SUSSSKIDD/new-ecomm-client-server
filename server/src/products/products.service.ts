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

import { RedisCacheService } from '../common/services/redis-cache.service';

@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);
  private static readonly MAX_IMAGES = 3;

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: SupabaseStorageService,
    private readonly cache: RedisCacheService,
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

    // Fix #4: Clean up uploaded images if DB insert fails
    try {
      const product = await this.prisma.product.create({
        data: {
          ...productData,
          images: imageUrls,
          storeId,
        },
      });

      this.logger.log(
        `Product created: ${product.name} (${product.id}) with ${imageUrls.length} images`,
      );
      await this.cache.delPattern('products:*');
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
    } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.ProductWhereInput = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { category: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (category) {
      where.category = { equals: category, mode: 'insensitive' };
    }

    if (subCategory) {
      where.subCategory = { equals: subCategory, mode: 'insensitive' };
    }

    const cacheKey = `products:q:${search ?? ''}|${category ?? ''}|${subCategory ?? ''}|${sortBy}|${sortOrder}|${page}|${limit}`;
    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;

    const [products, total] = await Promise.all([
      this.prisma.product.findMany({
        skip,
        take: Number(limit),
        where,
        orderBy: { [sortBy]: sortOrder },
      }),
      this.prisma.product.count({ where }),
    ]);

    const result = {
      data: products,
      meta: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / Number(limit)),
      },
    };

    await this.cache.set(cacheKey, result, 120);
    return result;


  }

  /**
   * Get a single product by ID.
   */
  async findOne(id: string) {
    const product = await this.prisma.product.findUnique({ where: { id } });
    if (!product) {
      throw new NotFoundException(`Product ${id} not found`);
    }
    return product;
  }

  async findStoreProducts(storeId: string) {
    return this.prisma.product.findMany({
      where: { storeId },
      orderBy: { createdAt: 'desc' },
    });
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

    const updated = await this.prisma.product.update({
      where: { id },
      data: dto,
    });

    this.logger.log(`Product updated: ${updated.name} (${id})`);
    await this.cache.delPattern('products:*');
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

      const updated = await this.prisma.product.update({
        where: { id },
        data: updateData,
      });

      this.logger.log(`Product updated: ${updated.name} (${id}) with ${newImageUrls.length} new images`);
      await this.cache.delPattern('products:*');
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
    await this.cache.delPattern('products:*');

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
      await this.cache.delPattern('products:*');
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
    await this.cache.delPattern('products:*');
    return updated;
  }
}
