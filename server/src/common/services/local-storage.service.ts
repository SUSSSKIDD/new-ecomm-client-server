import {
    Injectable,
    Logger,
    BadRequestException,
    OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { promises as fs } from 'fs';
import * as path from 'path';
import sharp from 'sharp';

@Injectable()
export class LocalStorageService implements OnModuleInit {
    private readonly logger = new Logger(LocalStorageService.name);
    private readonly uploadsDir: string;
    private readonly baseUrl: string;
    private readonly MAX_SIZE = 5 * 1024 * 1024; // 5 MB
    private readonly ALLOWED_TYPES = [
        'image/jpeg',
        'image/png',
        'image/webp',
        'image/jpg',
    ];

    constructor(private readonly config: ConfigService) {
        this.uploadsDir = config.get<string>('UPLOADS_DIR', path.join(process.cwd(), 'uploads'));
        this.baseUrl = config.get<string>('MEDIA_BASE_URL', 'http://localhost:3000');
    }

    async onModuleInit() {
        for (const sub of ['products', 'user-designs', 'print-product-images', 'subcategories']) {
            await fs.mkdir(path.join(this.uploadsDir, sub), { recursive: true });
        }
        this.logger.log(`Local storage ready at ${this.uploadsDir}`);
    }

    async upload(
        file: Express.Multer.File,
        folder = 'products',
        _bucket?: string,
    ): Promise<string> {
        if (!this.ALLOWED_TYPES.includes(file.mimetype)) {
            throw new BadRequestException(
                `Invalid file type: ${file.mimetype}. Allowed: ${this.ALLOWED_TYPES.join(', ')}`,
            );
        }
        if (file.size > this.MAX_SIZE) {
            throw new BadRequestException(
                `File too large: ${(file.size / 1024 / 1024).toFixed(1)} MB. Max: 5 MB`,
            );
        }

        const safeFolder = folder.replace(/[^a-zA-Z0-9_-]/g, '-');
        const subDir = path.join(this.uploadsDir, safeFolder);
        await fs.mkdir(subDir, { recursive: true });

        const filename = `${Date.now()}-${randomUUID().slice(0, 8)}.webp`;
        const filePath = path.join(subDir, filename);

        await sharp(file.buffer)
            .resize({ width: 1200, withoutEnlargement: true })
            .webp({ quality: 82 })
            .toFile(filePath);

        const publicUrl = `${this.baseUrl}/uploads/${safeFolder}/${filename}`;
        this.logger.log(`Saved: ${safeFolder}/${filename}`);
        return publicUrl;
    }

    async uploadMany(
        files: Express.Multer.File[],
        folder = 'products',
        _bucket?: string,
    ): Promise<string[]> {
        return Promise.all(files.map((f) => this.upload(f, folder)));
    }

    async delete(publicUrl: string): Promise<void> {
        try {
            const urlPath = new URL(publicUrl).pathname;
            const relativePath = urlPath.replace(/^\/uploads\//, '');
            const filePath = path.join(this.uploadsDir, relativePath);
            await fs.unlink(filePath);
            this.logger.log(`Deleted: ${filePath}`);
        } catch {
            // Graceful — file may already be gone
        }
    }

    async deleteMany(publicUrls: string[]): Promise<void> {
        await Promise.all(publicUrls.map((u) => this.delete(u)));
    }

    isAvailable(): boolean {
        return true;
    }
}
