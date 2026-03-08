import {
  Controller,
  Post,
  UseGuards,
  UseInterceptors,
  UploadedFiles,
  BadRequestException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiConsumes } from '@nestjs/swagger';
import { SupabaseStorageService } from '../common/services/supabase-storage.service';

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
  constructor(private readonly storage: SupabaseStorageService) {}

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
}
