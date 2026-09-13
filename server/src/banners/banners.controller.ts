import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  ParseIntPipe,
  UseGuards,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import * as multer from 'multer';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { LocalStorageService } from '../common/services/local-storage.service';
import { BannersService } from './banners.service';

@ApiTags('banners')
@Controller('banners')
export class BannersController {
  constructor(
    private readonly bannersService: BannersService,
    private readonly localStorage: LocalStorageService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List active homepage banners (public)' })
  findActive() {
    return this.bannersService.findActive();
  }

  @Get('admin')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'List all 3 banner slots, including empty ones (Admin)' })
  findAllSlots() {
    return this.bannersService.findAllSlots();
  }

  @Post(':slot')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('ADMIN')
  @UseInterceptors(
    FileInterceptor('image', {
      storage: multer.memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
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
    }),
  )
  @ApiOperation({ summary: 'Upload/update a banner slot (Admin)' })
  async upsert(
    @Param('slot', ParseIntPipe) slot: number,
    @Body()
    dto: {
      linkUrl?: string;
      badgeText?: string;
      heading?: string;
      subheading?: string;
    },
    @UploadedFile() file?: Express.Multer.File,
  ) {
    const imageUrl = file
      ? await this.localStorage.upload(file, 'homepage-banners')
      : undefined;
    return this.bannersService.upsert(slot, {
      imageUrl,
      linkUrl: dto.linkUrl !== undefined ? dto.linkUrl || null : undefined,
      badgeText: dto.badgeText !== undefined ? dto.badgeText || null : undefined,
      heading: dto.heading !== undefined ? dto.heading || null : undefined,
      subheading: dto.subheading !== undefined ? dto.subheading || null : undefined,
    });
  }

  @Delete(':slot')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Remove a banner slot (Admin)' })
  remove(@Param('slot', ParseIntPipe) slot: number) {
    return this.bannersService.remove(slot);
  }
}
