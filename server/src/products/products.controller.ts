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
import { FilesInterceptor, AnyFilesInterceptor } from '@nestjs/platform-express';
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
  async findAll(@Query() query: ProductQueryDto) {
    const result = await this.productsService.findAll(query);
    return this.stripStorePriceFromResponse(result);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get product by ID' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('lat') lat?: string,
    @Query('lng') lng?: string,
    @Query('pincode') pincode?: string
  ) {
    const product = await this.productsService.findOne(
      id,
      lat ? parseFloat(lat) : undefined,
      lng ? parseFloat(lng) : undefined,
      pincode
    );
    return this.stripStorePriceFromResponse(product);
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
  @UseInterceptors(AnyFilesInterceptor(MULTER_IMAGE_OPTIONS))
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
        variantsJson: { type: 'string', description: 'JSON string of variants' },
      },
      required: ['name', 'price', 'category', 'stock'],
    },
  })
  create(
    @Body() dto: CreateProductDto,
    @UploadedFiles() allFiles: Express.Multer.File[],
    @Req() req: any,
  ) {
    const productImages = allFiles.filter(f => f.fieldname === 'images');
    const variantImageMap: Record<number, Express.Multer.File[]> = {};
    allFiles
      .filter(f => f.fieldname.startsWith('variantImage_'))
      .forEach(f => {
        const idx = parseInt(f.fieldname.split('_')[1], 10);
        if (!variantImageMap[idx]) variantImageMap[idx] = [];
        variantImageMap[idx].push(f);
      });

    if (dto['variantsJson']) {
      dto.variants = JSON.parse(dto['variantsJson']);
    }

    return this.productsService.createWithImages(dto, productImages, req.user?.storeId, variantImageMap);
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

  private stripStorePrice(product: any) {
    if (!product) return product;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { storePrice, ...rest } = product;
    if (rest.variants) {
      rest.variants = rest.variants.map((v: any) => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { storePrice: _, ...vRest } = v;
        return vRest;
      });
    }
    return rest;
  }

  private stripStorePriceFromResponse(res: any) {
    if (!res) return res;
    if (Array.isArray(res)) {
      return res.map(p => this.stripStorePrice(p));
    }
    if (res.data && Array.isArray(res.data)) {
      return { ...res, data: res.data.map((p: any) => this.stripStorePrice(p)) };
    }
    return this.stripStorePrice(res);
  }
}
