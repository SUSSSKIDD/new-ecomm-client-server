import {
  Controller,
  Post,
  UseGuards,
  UseInterceptors,
  UploadedFiles,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FilesInterceptor, FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiConsumes } from '@nestjs/swagger';
import { LocalStorageService } from '../common/services/local-storage.service';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

const MULTER_IMAGE_OPTIONS = {
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req: any, file: Express.Multer.File, cb: any) => {
    if (['image/jpeg', 'image/png', 'image/webp', 'image/jpg'].includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type: ${file.mimetype}. Only JPEG, PNG, WebP allowed.`), false);
    }
  },
};

@ApiTags('uploads')
@Controller('uploads')
export class UploadsController {
  constructor(private readonly storage: LocalStorageService) { }

  @Post('user-designs')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @UseInterceptors(FilesInterceptor('designs', 3, MULTER_IMAGE_OPTIONS))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload user design/photo images (max 3)' })
  async uploadDesigns(@UploadedFiles() files: Express.Multer.File[]) {
    if (!files || files.length === 0) {
      throw new BadRequestException('At least one image file is required');
    }
    if (files.length > 3) {
      throw new BadRequestException('Maximum 3 images allowed');
    }

    const urls = await this.storage.uploadMany(files, 'user-designs', 'user-uploads');
    return { urls };
  }

  @Post('product-image')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('ADMIN')
  @UseInterceptors(FileInterceptor('image', MULTER_IMAGE_OPTIONS))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload a single product image for print products' })
  async uploadProductImage(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('Image file is required');
    }

    const url = await this.storage.upload(file, 'print product images');
    return { url };
  }
}
