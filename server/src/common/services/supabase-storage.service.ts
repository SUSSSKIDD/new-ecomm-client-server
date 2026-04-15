import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const sharp: (input: Buffer) => import('sharp').Sharp = require('sharp');
import 'multer';

@Injectable()
export class SupabaseStorageService {
  private readonly logger = new Logger(SupabaseStorageService.name);
  private readonly supabase: SupabaseClient | null;
  private readonly BUCKET = 'product-images';
  private readonly MAX_SIZE = 5 * 1024 * 1024; // 5 MB
  private readonly ALLOWED_IMAGE_TYPES = [
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/jpg',
  ];
  private readonly ALLOWED_VIDEO_TYPES = [
    'video/mp4',
    'video/webm',
    'video/ogg',
    'video/quicktime',
  ];

  constructor(config: ConfigService) {
    const url = config.get<string>('SUPABASE_URL');
    const key = config.get<string>('SUPABASE_SERVICE_ROLE_KEY');

    if (!url || !key) {
      this.logger.warn(
        'SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set — image uploads disabled',
      );
      this.supabase = null;
      return;
    }

    this.supabase = createClient(url, key);
    this.logger.log('Supabase Storage connected');
  }

  /**
   * Upload a single file to Supabase Storage.
   * Returns the public URL of the uploaded image.
   */
  async upload(
    file: Express.Multer.File,
    folder: string = 'products',
    bucket?: string,
  ): Promise<string> {
    if (!this.supabase) {
      throw new BadRequestException('Image uploads are not configured');
    }

    const targetBucket = bucket || this.BUCKET;
    const isImage = this.ALLOWED_IMAGE_TYPES.includes(file.mimetype);
    const isVideo = this.ALLOWED_VIDEO_TYPES.includes(file.mimetype);

    // Validate MIME type
    if (!isImage && !isVideo) {
      throw new BadRequestException(
        `Invalid file type: ${file.mimetype}. Allowed images: ${this.ALLOWED_IMAGE_TYPES.join(', ')}. Allowed videos: ${this.ALLOWED_VIDEO_TYPES.join(', ')}`,
      );
    }

    // Validate size
    if (file.size > this.MAX_SIZE) {
      throw new BadRequestException(
        `File too large: ${(file.size / 1024 / 1024).toFixed(1)}MB. Max: 5MB`,
      );
    }

    let uploadBuffer: Buffer = file.buffer;
    let contentType: string = file.mimetype;
    let ext: string;

    if (isImage) {
      // Convert every image to WebP with quality/size optimisations
      uploadBuffer = await sharp(file.buffer)
        .rotate()                          // auto-orient from EXIF
        .resize({ width: 1200, height: 1200, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 82, effort: 4 })  // effort 4 = good compression, fast enough
        .toBuffer();
      contentType = 'image/webp';
      ext = 'webp';
    } else {
      // Video — pass through as-is
      const mimeToExt: Record<string, string> = {
        'video/mp4': 'mp4',
        'video/webm': 'webm',
        'video/ogg': 'ogv',
        'video/quicktime': 'mov',
      };
      ext = mimeToExt[file.mimetype] || 'mp4';
    }

    // Generate unique filename
    const filename = `${folder}/${Date.now()}-${randomUUID().slice(0, 8)}.${ext}`;

    const { error } = await this.supabase.storage
      .from(targetBucket)
      .upload(filename, uploadBuffer, {
        contentType,
        upsert: false,
      });

    if (error) {
      this.logger.error(`Upload failed: ${error.message}`);
      throw new BadRequestException(`Upload failed: ${error.message}`);
    }

    // Get public URL
    const {
      data: { publicUrl },
    } = this.supabase.storage.from(targetBucket).getPublicUrl(filename);

    this.logger.log(`Uploaded: ${filename} (bucket: ${targetBucket})`);
    return publicUrl;
  }

  /**
   * Upload multiple files. Returns array of public URLs.
   */
  async uploadMany(
    files: Express.Multer.File[],
    folder: string = 'products',
    bucket?: string,
  ): Promise<string[]> {
    return Promise.all(files.map((f) => this.upload(f, folder, bucket)));
  }

  /**
   * Delete a single image from storage by its public URL.
   */
  async delete(publicUrl: string): Promise<void> {
    if (!this.supabase) return;

    try {
      // Extract the path from the public URL
      // URL format: https://<project>.supabase.co/storage/v1/object/public/<bucket>/<path>
      // Bucket name may be URL-encoded (spaces → %20)
      const encodedBucket = encodeURIComponent(this.BUCKET);
      const separator = `/storage/v1/object/public/${encodedBucket}/`;
      const urlParts = publicUrl.split(separator);
      if (urlParts.length < 2) {
        this.logger.warn(`Cannot parse storage path from URL: ${publicUrl}`);
        return;
      }

      const filePath = urlParts[1];
      const { error } = await this.supabase.storage
        .from(this.BUCKET)
        .remove([filePath]);

      if (error) {
        this.logger.warn(`Delete failed for ${filePath}: ${error.message}`);
      } else {
        this.logger.log(`Deleted: ${filePath}`);
      }
    } catch {
      // Graceful degradation — image may have already been deleted
    }
  }

  /**
   * Delete multiple images by their public URLs in a single batch call.
   */
  async deleteMany(publicUrls: string[]): Promise<void> {
    if (!this.supabase || publicUrls.length === 0) return;

    const encodedBucket = encodeURIComponent(this.BUCKET);
    const separator = `/storage/v1/object/public/${encodedBucket}/`;

    const paths: string[] = [];
    const fallbackUrls: string[] = [];

    for (const url of publicUrls) {
      const parts = url.split(separator);
      if (parts.length >= 2) {
        paths.push(parts[1]);
      } else {
        fallbackUrls.push(url);
      }
    }

    // Batch delete all parseable paths in one call
    if (paths.length > 0) {
      const { error } = await this.supabase.storage
        .from(this.BUCKET)
        .remove(paths);
      if (error) {
        this.logger.warn(`Batch delete failed: ${error.message}`);
      } else {
        this.logger.log(`Batch deleted ${paths.length} files`);
      }
    }

    // Fall back to individual deletes for unparseable URLs
    for (const url of fallbackUrls) {
      await this.delete(url);
    }
  }

  /**
   * Check if the service is available (Supabase configured).
   */
  isAvailable(): boolean {
    return this.supabase !== null;
  }
}
