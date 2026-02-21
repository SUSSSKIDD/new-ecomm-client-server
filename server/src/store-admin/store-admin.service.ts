import {
    Injectable,
    NotFoundException,
    BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateStoreAdminDto } from './dto/create-store-admin.dto';
import { UpdateStoreAdminDto } from './dto/update-store-admin.dto';
import * as bcrypt from 'bcryptjs';
import { Prisma } from '@prisma/client';

@Injectable()
export class StoreAdminService {
    constructor(private readonly prisma: PrismaService) { }

    async create(dto: CreateStoreAdminDto) {
        // Check if phone unique
        const existing = await this.prisma.storeAdmin.findUnique({
            where: { phone: dto.phone },
        });
        if (existing) {
            throw new BadRequestException('Phone number already in use by another Store Admin');
        }

        // Verify store exists
        const store = await this.prisma.store.findUnique({
            where: { id: dto.storeId },
        });
        if (!store) {
            throw new NotFoundException(`Store ${dto.storeId} not found`);
        }

        const pinHash = await bcrypt.hash(dto.pin, 10);

        const admin = await this.prisma.storeAdmin.create({
            data: {
                name: dto.name,
                phone: dto.phone,
                pinHash,
                storeId: dto.storeId,
            },
            include: { store: true },
        });
        const { pinHash: _, ...result } = admin;
        return result;
    }

    async findAll() {
        const admins = await this.prisma.storeAdmin.findMany({
            include: { store: true },
            orderBy: { createdAt: 'desc' },
        });
        return admins.map(({ pinHash: _, ...rest }) => rest);
    }

    async findOne(id: string) {
        const admin = await this.prisma.storeAdmin.findUnique({
            where: { id },
            include: { store: true },
        });
        if (!admin) throw new NotFoundException('Store Admin not found');
        const { pinHash: _, ...result } = admin;
        return result;
    }

    async update(id: string, dto: UpdateStoreAdminDto) {
        await this.findOne(id);

        const data: Prisma.StoreAdminUpdateInput = {};

        if (dto.name) data.name = dto.name;
        if (dto.phone) data.phone = dto.phone;

        if (dto.storeId) {
            data.store = { connect: { id: dto.storeId } };
        }

        if (dto.pin) {
            data.pinHash = await bcrypt.hash(dto.pin, 10);
        }

        // Explicitly allow isActive update if passed ?? No, DTO doesn't have it.
        // If needed, we add it to DTO. But spec didn't mention it for update.
        // Spec said DELETE to deactivate.
        // We'll leave isActive alone here.

        try {
            const updated = await this.prisma.storeAdmin.update({
                where: { id },
                data,
            });
            const { pinHash: _, ...result } = updated;
            return result;
        } catch (e) {
            if (
                e instanceof Prisma.PrismaClientKnownRequestError &&
                e.code === 'P2002'
            ) {
                throw new BadRequestException('Phone number already in use');
            }
            throw e;
        }
    }

    async remove(id: string) {
        // Soft delete
        return this.prisma.storeAdmin.update({
            where: { id },
            data: { isActive: false },
        });
    }
}
