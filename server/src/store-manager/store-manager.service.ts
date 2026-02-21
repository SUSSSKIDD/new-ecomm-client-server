import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateStoreManagerDto } from './dto/create-store-manager.dto';
import { UpdateStoreManagerDto } from './dto/update-store-manager.dto';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class StoreManagerService {
    constructor(private readonly prisma: PrismaService) { }

    async create(dto: CreateStoreManagerDto) {
        // Validate store exists
        const store = await this.prisma.store.findUnique({
            where: { id: dto.storeId },
        });
        if (!store) {
            throw new NotFoundException(`Store ${dto.storeId} not found`);
        }

        const existing = await this.prisma.storeManager.findUnique({
            where: { phone: dto.phone },
        });
        if (existing) {
            throw new ConflictException('Manager with this phone already exists');
        }

        const salt = await bcrypt.genSalt(10);
        const pinHash = await bcrypt.hash(dto.pin, salt);

        const manager = await this.prisma.storeManager.create({
            data: {
                name: dto.name,
                phone: dto.phone,
                storeId: dto.storeId,
                pinHash,
            },
        });
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { pinHash: _, ...result } = manager;
        return result;
    }

    async findAll() {
        const managers = await this.prisma.storeManager.findMany({
            where: { isActive: true },
            include: { store: true },
            orderBy: { createdAt: 'desc' },
        });
        return managers.map(({ pinHash, ...rest }) => rest);
    }

    async findOne(id: string) {
        const manager = await this.prisma.storeManager.findUnique({
            where: { id },
            include: { store: true },
        });
        if (!manager) throw new NotFoundException(`Store manager ${id} not found`);
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { pinHash: _, ...result } = manager;
        return result;
    }

    async update(id: string, dto: UpdateStoreManagerDto) {
        await this.findOne(id);

        const data: any = { ...dto };

        // Hash PIN if provided
        if (dto.pin) {
            const salt = await bcrypt.genSalt(10);
            data.pinHash = await bcrypt.hash(dto.pin, salt);
            delete data.pin;
        }

        // Check phone uniqueness if phone is being changed
        if (dto.phone) {
            const existing = await this.prisma.storeManager.findUnique({
                where: { phone: dto.phone },
            });
            if (existing && existing.id !== id) {
                throw new ConflictException('Manager with this phone already exists');
            }
        }

        const updated = await this.prisma.storeManager.update({
            where: { id },
            data,
        });
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { pinHash: _, ...result } = updated;
        return result;
    }

    async remove(id: string) {
        await this.findOne(id);
        await this.prisma.storeManager.update({
            where: { id },
            data: { isActive: false },
        });
        return { message: 'Store manager deactivated', id };
    }
}
