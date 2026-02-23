import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateLedgerEntryDto } from './dto/create-ledger-entry.dto';

@Injectable()
export class LedgerService {
    private readonly logger = new Logger(LedgerService.name);

    constructor(private readonly prisma: PrismaService) { }

    private async generateTransactionId(): Promise<string> {
        const now = new Date();
        const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
        const startOfDay = new Date(now.toISOString().slice(0, 10));

        const count = await this.prisma.paymentLedger.count({
            where: { createdAt: { gte: startOfDay } },
        });

        // Add random suffix to prevent collisions from concurrent requests
        const rand = Math.random().toString(36).slice(2, 4).toUpperCase();
        return `TXN-${dateStr}-${String(count + 1).padStart(4, '0')}${rand}`;
    }

    async create(dto: CreateLedgerEntryDto, retries = 3): Promise<any> {
        const transactionId = await this.generateTransactionId();
        try {
            return await this.prisma.paymentLedger.create({
                data: {
                    storeId: dto.storeId,
                    date: new Date(dto.date),
                    amount: dto.amount,
                    paymentMethod: dto.paymentMethod,
                    referenceNotes: dto.referenceNotes,
                    transactionId,
                },
                include: { store: { select: { name: true, storeCode: true } } },
            });
        } catch (error) {
            // Retry on unique constraint violation (race condition on transactionId)
            if (error.code === 'P2002' && retries > 0) {
                this.logger.warn(`Transaction ID collision on ${transactionId}, retrying...`);
                return this.create(dto, retries - 1);
            }
            throw error;
        }
    }

    async findAll(storeId?: string, startDate?: string, endDate?: string) {
        const where: any = {};
        if (storeId) where.storeId = storeId;
        if (startDate || endDate) {
            where.date = {};
            if (startDate) where.date.gte = new Date(startDate);
            if (endDate) where.date.lte = new Date(endDate);
        }
        return this.prisma.paymentLedger.findMany({
            where,
            orderBy: { date: 'desc' },
            include: { store: { select: { name: true, storeCode: true } } },
        });
    }

    async findByStore(storeId: string) {
        return this.prisma.paymentLedger.findMany({
            where: { storeId },
            orderBy: { date: 'desc' },
        });
    }
}
