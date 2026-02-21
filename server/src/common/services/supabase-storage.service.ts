import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
import 'multer';

@Injectable()
export class SupabaseStorageService {
  private readonly logger = new Logger(SupabaseStorageService.name);
  private readonly supabase: SupabaseClient | null;
  private readonly BUCKET = 'product-images';
  private readonly MAX_SIZE = 5 * 1024 * 1024; // 5 MB
  private readonly ALLOWED_TYPES = [
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/jpg',
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
  ): Promise<string> {
    if (!this.supabase) {
      throw new BadRequestException('Image uploads are not configured');
    }

    // Validate MIME type
    if (!this.ALLOWED_TYPES.includes(file.mimetype)) {
      throw new BadRequestException(
        `Invalid file type: ${file.mimetype}. Allowed: ${this.ALLOWED_TYPES.join(', ')}`,
      );
    }

    // Validate size
    if (file.size > this.MAX_SIZE) {
      throw new BadRequestException(
        `File too large: ${(file.size / 1024 / 1024).toFixed(1)}MB. Max: 5MB`,
      );
    }

    // Generate unique filename
    const ext = file.originalname.split('.').pop() || 'jpg';
    const filename = `${folder}/${Date.now()}-${randomUUID().slice(0, 8)}.${ext}`;

    const { error } = await this.supabase.storage
      .from(this.BUCKET)
      .upload(filename, file.buffer, {
        contentType: file.mimetype,
        upsert: false,
      });

    if (error) {
      this.logger.error(`Upload failed: ${error.message}`);
      throw new BadRequestException(`Upload failed: ${error.message}`);
    }

    // Get public URL
    const {
      data: { publicUrl },
    } = this.supabase.storage.from(this.BUCKET).getPublicUrl(filename);

    this.logger.log(`Uploaded: ${filename}`);
    return publicUrl;
  }

  /**
   * Upload multiple files. Returns array of public URLs.
   */
  async uploadMany(
    files: Express.Multer.File[],
    folder: string = 'products',
  ): Promise<string[]> {
    return Promise.all(files.map((f) => this.upload(f, folder)));
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
