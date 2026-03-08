import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { StoresService } from './stores.service';
import { SubcategoryService } from './subcategory.service';
import { CreateStoreDto } from './dto/create-store.dto';
import { UpdateStoreDto } from './dto/update-store.dto';
import {
  UpdateInventoryDto,
  BulkUpdateInventoryDto,
} from './dto/update-inventory.dto';
import { CheckServiceabilityDto } from './dto/check-serviceability.dto';
import {
  CreateCustomSubcategoryDto,
  AdminCreateCustomSubcategoryDto,
  UpsertCategoryConfigDto,
} from './dto/custom-subcategory.dto';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { StoreGuard } from '../auth/guards/store.guard';
import {
  STORE_CATEGORIES,
  STORE_CATEGORY_LABELS,
  CATEGORY_SUBCATEGORIES,
} from '../common/constants/store-categories';

interface AuthenticatedRequest {
  user: { sub: string; phone: string; role: string; storeId?: string };
}

@ApiTags('stores')
@Controller('stores')
export class StoresController {
  constructor(
    private readonly storesService: StoresService,
    private readonly subcategoryService: SubcategoryService,
  ) { }

  // ── Public ───────────────────────────────────────────────────────

  @Get('categories')
  @ApiOperation({ summary: 'Get available store categories (static + custom merged)' })
  @ApiResponse({ status: 200, description: 'Store categories list' })
  async getCategories() {
    const [allCustom, allConfigs] = await Promise.all([
      this.subcategoryService.getAllCustomSubcategories(),
      this.subcategoryService.getAllCategoryConfigs(),
    ]);
    const configMap = new Map(allConfigs.map((c: { storeType: string; subcategory: string; uploadType: string }) => [`${c.storeType}:${c.subcategory}`, c.uploadType]));

    const mergedSubcategories: Record<string, string[]> = {};
    const uploadTypes: Record<string, Record<string, string>> = {};
    for (const storeType of STORE_CATEGORIES) {
      const staticSubs = CATEGORY_SUBCATEGORIES[storeType] || [];
      const customSubs = allCustom
        .filter((c) => c.storeType === storeType)
        .map((c) => c.name);
      mergedSubcategories[storeType] = [...staticSubs, ...customSubs];

      // Build uploadType map per subcategory
      const typeMap: Record<string, string> = {};
      for (const sub of mergedSubcategories[storeType]) {
        const ut = configMap.get(`${storeType}:${sub}`);
        if (ut && ut !== 'NONE') typeMap[sub] = ut;
      }
      if (Object.keys(typeMap).length > 0) uploadTypes[storeType] = typeMap;
    }
    return {
      categories: STORE_CATEGORIES,
      labels: STORE_CATEGORY_LABELS,
      subcategories: mergedSubcategories,
      uploadTypes,
    };
  }

  @Get('serviceability')
  @ApiOperation({
    summary: 'Check if a location is within delivery range of any store',
  })
  @ApiResponse({ status: 200, description: 'Serviceability result' })
  checkServiceability(@Query() query: CheckServiceabilityDto) {
    return this.storesService.checkServiceability(query.lat, query.lng);
  }

  // ── Admin CRUD ──────────────────────────────────────────────────

  @Get()
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'List all stores (Admin)' })
  findAll() {
    return this.storesService.findAll();
  }

  @Post()
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Create a store (Admin)' })
  create(@Body() dto: CreateStoreDto) {
    return this.storesService.create(dto);
  }

  @Patch(':id')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Update a store (Admin)' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateStoreDto) {
    return this.storesService.update(id, dto);
  }

  @Delete(':id')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Delete a store (Admin)' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.storesService.remove(id);
  }

  // ── Inventory ───────────────────────────────────────────────────

  @Get(':id/inventory')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), RolesGuard, StoreGuard)
  @Roles('ADMIN', 'STORE_MANAGER')
  @ApiOperation({ summary: 'Get store inventory (Admin/Store Manager)' })
  getInventory(@Param('id', ParseUUIDPipe) id: string) {
    return this.storesService.getInventory(id);
  }

  @Post(':id/inventory')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), RolesGuard, StoreGuard)
  @Roles('ADMIN', 'STORE_MANAGER')
  @ApiOperation({ summary: 'Set single product stock (Admin/Store Manager)' })
  updateInventory(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateInventoryDto,
  ) {
    return this.storesService.updateInventory(id, dto);
  }

  @Post(':id/inventory/bulk')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), RolesGuard, StoreGuard)
  @Roles('ADMIN', 'STORE_MANAGER')
  @ApiOperation({ summary: 'Bulk set inventory (Admin/Store Manager)' })
  bulkUpdateInventory(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: BulkUpdateInventoryDto,
  ) {
    return this.storesService.bulkUpdateInventory(id, dto.items);
  }

  // ── Custom Subcategories ──────────────────────────────────────────

  @Get('subcategories/custom')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('ADMIN', 'STORE_MANAGER')
  @ApiOperation({ summary: 'List custom subcategories for my store type' })
  async getCustomSubcategories(@Req() req: AuthenticatedRequest) {
    if (req.user.role === 'ADMIN') {
      return this.subcategoryService.getAllCustomSubcategories();
    }
    const store = await this.storesService.findOne(req.user.storeId!);
    return this.subcategoryService.getCustomSubcategoriesByType(store.storeType);
  }

  @Post('subcategories/custom')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('STORE_MANAGER')
  @ApiOperation({ summary: 'Create custom subcategory for my store type' })
  async createCustomSubcategory(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateCustomSubcategoryDto,
  ) {
    const store = await this.storesService.findOne(req.user.storeId!);
    return this.subcategoryService.create(store.storeType, dto.name);
  }

  @Post('subcategories/custom/admin')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Create custom subcategory for any store type (Admin)' })
  createCustomSubcategoryAdmin(@Body() dto: AdminCreateCustomSubcategoryDto) {
    return this.subcategoryService.create(dto.storeType, dto.name);
  }

  @Delete('subcategories/custom/:id')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('ADMIN', 'STORE_MANAGER')
  @ApiOperation({ summary: 'Delete a custom subcategory' })
  deleteCustomSubcategory(@Param('id', ParseUUIDPipe) id: string) {
    return this.subcategoryService.remove(id);
  }

  // ── Category Config (upload type per subcategory) ──────────────

  @Get('category-config')
  @ApiOperation({ summary: 'Get category configs with upload types' })
  getCategoryConfig(@Query('storeType') storeType: string) {
    if (!storeType) storeType = 'DROP_IN_FACTORY';
    return this.subcategoryService.getSubcategoriesWithConfig(storeType);
  }

  @Put('category-config')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('ADMIN', 'STORE_MANAGER')
  @ApiOperation({ summary: 'Set upload type for a subcategory' })
  upsertCategoryConfig(
    @Body() dto: UpsertCategoryConfigDto,
  ) {
    return this.subcategoryService.upsertCategoryConfig(
      dto.storeType, dto.subcategory, dto.uploadType,
    );
  }

  @Delete('category-config/:id')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Delete a category config' })
  deleteCategoryConfig(@Param('id', ParseUUIDPipe) id: string) {
    return this.subcategoryService.removeCategoryConfig(id);
  }
}
