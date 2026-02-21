import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
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
import { CreateStoreDto } from './dto/create-store.dto';
import { UpdateStoreDto } from './dto/update-store.dto';
import {
  UpdateInventoryDto,
  BulkUpdateInventoryDto,
} from './dto/update-inventory.dto';
import { CheckServiceabilityDto } from './dto/check-serviceability.dto';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { StoreGuard } from '../auth/guards/store.guard';
import {
  STORE_CATEGORIES,
  STORE_CATEGORY_LABELS,
  CATEGORY_SUBCATEGORIES,
} from '../common/constants/store-categories';

@ApiTags('stores')
@Controller('stores')
export class StoresController {
  constructor(private readonly storesService: StoresService) { }

  // ── Public ───────────────────────────────────────────────────────

  @Get('categories')
  @ApiOperation({ summary: 'Get available store categories' })
  @ApiResponse({ status: 200, description: 'Store categories list' })
  getCategories() {
    return {
      categories: STORE_CATEGORIES,
      labels: STORE_CATEGORY_LABELS,
      subcategories: CATEGORY_SUBCATEGORIES,
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
}
