import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  UseGuards,
  UseInterceptors,
  UploadedFiles,
  Req,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FilesInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductQueryDto } from './dto/product-query.dto';
import { RemoveImageDto } from './dto/remove-image.dto';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

import { StoreGuard } from '../auth/guards/store.guard';

const MULTER_IMAGE_OPTIONS = {
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (_req: any, file: Express.Multer.File, cb: any) => {
    if (
      ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'].includes(
        file.mimetype,
      )
    ) {
      cb(null, true);
    } else {
      cb(
        new Error(
          `Invalid file type: ${file.mimetype}. Only JPEG, PNG, WebP allowed.`,
        ),
        false,
      );
    }
  },
};

@ApiTags('products')
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) { }

  // ─── PUBLIC ENDPOINTS ─────────────────────────────────────────

  @Get()
  @ApiOperation({ summary: 'List products with pagination and filters' })
  findAll(@Query() query: ProductQueryDto) {
    return this.productsService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get product by ID' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('lat') lat?: string,
    @Query('lng') lng?: string
  ) {
    return this.productsService.findOne(
      id,
      lat ? parseFloat(lat) : undefined,
      lng ? parseFloat(lng) : undefined
    );
  }

  @Get('admin/my-store')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), RolesGuard, StoreGuard)
  @Roles('ADMIN', 'STORE_MANAGER')
  @ApiOperation({ summary: 'List products for my store (Store Admin / Store Manager)' })
  findStoreProducts(@Req() req: any) {
    const storeId = req.user?.storeId;
    if (!storeId && req.user.role !== 'ADMIN') {
      return [];
    }
    if (req.user.role === 'ADMIN') {
      return this.productsService.findAll({});
    }
    return this.productsService.findStoreProducts(storeId);
  }

  // ─── ADMIN ENDPOINTS ──────────────────────────────────────────

  @Post()
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), RolesGuard, StoreGuard)
  @Roles('ADMIN', 'STORE_MANAGER')
  @UseInterceptors(FilesInterceptor('images', 3, MULTER_IMAGE_OPTIONS))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Create a product with image uploads (Admin only)' })
  @ApiResponse({ status: 201, description: 'Product created' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        description: { type: 'string' },
        price: { type: 'number' },
        mrp: { type: 'number' },
        category: { type: 'string' },
        subCategory: { type: 'string' },
        stock: { type: 'number' },
        isGrocery: { type: 'boolean' },
        storeLocation: { type: 'string' },
        images: { type: 'array', items: { type: 'string', format: 'binary' } },
      },
      required: ['name', 'price', 'category', 'stock'],
    },
  })
  create(
    @Body() dto: CreateProductDto,
    @UploadedFiles() files: Express.Multer.File[],
    @Req() req: any,
  ) {
    return this.productsService.createWithImages(dto, files, req.user?.storeId);
  }

  @Patch(':id')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), RolesGuard, StoreGuard)
  @Roles('ADMIN', 'STORE_MANAGER')
  @UseInterceptors(FilesInterceptor('images', 3, MULTER_IMAGE_OPTIONS))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Update product details (Admin only)' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProductDto,
    @UploadedFiles() files: Express.Multer.File[],
    @Req() req: any,
  ) {
    return this.productsService.updateWithImages(id, dto, files, req.user?.storeId);
  }

  @Delete(':id')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), RolesGuard, StoreGuard)
  @Roles('ADMIN', 'STORE_MANAGER')
  @ApiOperation({ summary: 'Delete product + cleanup images (Admin only)' })
  remove(@Param('id', ParseUUIDPipe) id: string, @Req() req: any) {
    return this.productsService.remove(id, req.user?.storeId);
  }

  @Post(':id/images')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), RolesGuard, StoreGuard)
  @Roles('ADMIN', 'STORE_MANAGER')
  @UseInterceptors(FilesInterceptor('images', 3, MULTER_IMAGE_OPTIONS))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Add images to existing product (Admin only, max 3 total)',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        images: { type: 'array', items: { type: 'string', format: 'binary' } },
      },
    },
  })
  addImages(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFiles() files: Express.Multer.File[],
    @Req() req: any,
  ) {
    return this.productsService.addImages(id, files, req.user?.storeId);
  }

  @Delete(':id/images')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), RolesGuard, StoreGuard)
  @Roles('ADMIN', 'STORE_MANAGER')
  @ApiOperation({
    summary: 'Remove a specific image from product (Admin only)',
  })
  removeImage(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RemoveImageDto,
    @Req() req: any,
  ) {
    return this.productsService.removeImage(id, dto.imageUrl, req.user?.storeId);
  }

  @Post(':id/variants')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), RolesGuard, StoreGuard)
  @Roles('ADMIN', 'STORE_MANAGER')
  @ApiOperation({ summary: 'Add a variant to a product' })
  addVariant(@Param('id', ParseUUIDPipe) id: string, @Body() dto: any) {
    return this.productsService.addVariant(id, dto);
  }

  @Patch(':id/variants/:variantId')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), RolesGuard, StoreGuard)
  @Roles('ADMIN', 'STORE_MANAGER')
  @ApiOperation({ summary: 'Update a variant' })
  updateVariant(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('variantId', ParseUUIDPipe) variantId: string,
    @Body() dto: any,
  ) {
    return this.productsService.updateVariant(variantId, dto);
  }

  @Delete(':id/variants/:variantId')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), RolesGuard, StoreGuard)
  @Roles('ADMIN', 'STORE_MANAGER')
  @ApiOperation({ summary: 'Delete a variant' })
  deleteVariant(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('variantId', ParseUUIDPipe) variantId: string,
  ) {
    return this.productsService.deleteVariant(variantId);
  }
}
