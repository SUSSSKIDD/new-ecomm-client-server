import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CATEGORY_SUBCATEGORIES, StoreCategoryType } from '../common/constants/store-categories';
import { PrismaClientKnownRequestError } from '@prisma/client-runtime-utils';

@Injectable()
export class SubcategoryService {
  private readonly logger = new Logger(SubcategoryService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get all subcategories (static + custom) for a given store type.
   */
  async getSubcategories(storeType: string): Promise<string[]> {
    const staticSubs = CATEGORY_SUBCATEGORIES[storeType as StoreCategoryType] || [];
    const customSubs = await this.prisma.db.customSubcategory.findMany({
      where: { storeType },
      orderBy: { createdAt: 'asc' },
      select: { name: true },
    });
    return [...staticSubs, ...customSubs.map((c: any) => c.name)];
  }

  /**
   * Get all custom subcategories grouped by store type (with IDs for management).
   */
  async getAllCustomSubcategories() {
    return this.prisma.db.customSubcategory.findMany({
      orderBy: [{ storeType: 'asc' }, { createdAt: 'asc' }],
    });
  }

  /**
   * Get custom subcategories for a specific store type (with IDs for management).
   */
  async getCustomSubcategoriesByType(storeType: string) {
    return this.prisma.db.customSubcategory.findMany({
      where: { storeType },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Create a custom subcategory for a store type.
   */
  async create(storeType: string, name: string) {
    const trimmed = name.trim();

    // Validate against static subcategories — disallow duplicates
    const staticSubs = CATEGORY_SUBCATEGORIES[storeType as StoreCategoryType] || [];
    if (staticSubs.some((s) => s.toLowerCase() === trimmed.toLowerCase())) {
      throw new ConflictException(`Subcategory "${trimmed}" already exists as a default subcategory`);
    }

    try {
      const subcategory = await this.prisma.db.customSubcategory.create({
        data: { storeType, name: trimmed },
      });
      this.logger.log(`Custom subcategory created: "${trimmed}" under ${storeType}`);
      return subcategory;
    } catch (error) {
      if (
        error instanceof PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(`Subcategory "${trimmed}" already exists for ${storeType}`);
      }
      throw error;
    }
  }

  /**
   * Delete a custom subcategory by ID and all its related products & configs.
   */
  async remove(id: string) {
    const subcategory = await this.prisma.db.customSubcategory.findUnique({
      where: { id },
    });
    if (!subcategory) {
      throw new NotFoundException(`Subcategory ${id} not found`);
    }

    const { name, storeType } = subcategory;

    // Cascade delete products and configs in a transaction
    await this.prisma.db.$transaction([
      this.prisma.db.product.deleteMany({
        where: {
          category: storeType,
          subCategory: name,
        },
      }),
      this.prisma.db.categoryConfig.deleteMany({
        where: {
          storeType,
          subcategory: name,
        },
      }),
      this.prisma.db.customSubcategory.delete({
        where: { id },
      }),
    ]);

    this.logger.log(`Custom subcategory and related products deleted: "${name}" from ${storeType}`);
    return { message: `Subcategory "${name}" and its products deleted`, id };
  }

  /**
   * Check if a subcategory name is valid for a store type (static or custom).
   */
  async isValidSubcategory(storeType: string, name: string): Promise<boolean> {
    const staticSubs = CATEGORY_SUBCATEGORIES[storeType as StoreCategoryType] || [];
    if (staticSubs.includes(name)) return true;

    const custom = await this.prisma.db.customSubcategory.findUnique({
      where: { storeType_name: { storeType, name } },
    });
    return !!custom;
  }

  // ── Category Config (upload type per subcategory) ─────────────

  /**
   * Get all category configs across all store types.
   */
  async getAllCategoryConfigs() {
    return this.prisma.db.categoryConfig.findMany();
  }

  /**
   * Get all category configs for a store type.
   * Returns a map: subcategoryName → uploadType
   */
  async getCategoryConfigs(storeType: string): Promise<Record<string, string>> {
    const configs = await this.prisma.db.categoryConfig.findMany({
      where: { storeType },
    });
    const map: Record<string, string> = {};
    for (const c of configs) {
      map[c.subcategory] = c.uploadType;
    }
    return map;
  }

  /**
   * Get subcategories enriched with upload type config.
   */
  async getSubcategoriesWithConfig(storeType: string) {
    const [subcategories, configs] = await Promise.all([
      this.getSubcategories(storeType),
      this.getCategoryConfigs(storeType),
    ]);
    return subcategories.map((name) => ({
      name,
      uploadType: configs[name] || 'NONE',
    }));
  }

  /**
   * Upsert category config (set upload type and/or banner image URL for a subcategory).
   */
  async upsertCategoryConfig(storeType: string, subcategory: string, uploadType?: string, bannerImage?: string) {
    const validTypes = ['NONE', 'PHOTO_UPLOAD', 'DESIGN_UPLOAD'];
    if (uploadType && !validTypes.includes(uploadType)) {
      throw new BadRequestException(`Invalid uploadType. Must be one of: ${validTypes.join(', ')}`);
    }

    const dataToUpdate: any = {};
    if (uploadType) dataToUpdate.uploadType = uploadType;
    if (bannerImage !== undefined) dataToUpdate.bannerImage = bannerImage;

    // Default values if creating
    const createData = {
      storeType,
      subcategory,
      uploadType: uploadType || 'NONE',
      bannerImage: bannerImage || null,
    };

    const result = await this.prisma.db.categoryConfig.upsert({
      where: { storeType_subcategory: { storeType, subcategory } },
      update: dataToUpdate,
      create: createData,
    });
    this.logger.log(`Category config updated: ${storeType}/${subcategory}`);
    return result;
  }

  async removeBannerImage(storeType: string, subcategory: string) {
    const result = await this.prisma.db.categoryConfig.upsert({
      where: { storeType_subcategory: { storeType, subcategory } },
      update: { bannerImage: null },
      create: { storeType, subcategory, bannerImage: null },
    });
    return result;
  }

  /**
   * Delete a category config by ID.
   */
  async removeCategoryConfig(id: string) {
    const config = await this.prisma.db.categoryConfig.findUnique({ where: { id } });
    if (!config) throw new NotFoundException(`Category config ${id} not found`);

    await this.prisma.db.categoryConfig.delete({ where: { id } });
    this.logger.log(`Category config deleted: ${config.storeType}/${config.subcategory}`);
    return { message: 'Config removed', id };
  }
}
