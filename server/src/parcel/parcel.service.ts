import {
    Injectable,
    Logger,
    NotFoundException,
    BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { AutoAssignService } from '../delivery/auto-assign.service';
import { OrderPoolService } from '../delivery/order-pool.service';
import { DeliverySseService } from '../sse/delivery-sse.service';
import { paginate } from '../common/utils/pagination.util';
import { CreateParcelOrderDto } from './dto/create-parcel-order.dto';
import { ApproveParcelDto } from './dto/approve-parcel.dto';
import { UpdateParcelStatusDto } from './dto/update-parcel-status.dto';
import { ParcelQueryDto } from './dto/parcel-query.dto';
import { UserSseService } from '../sse/user-sse.service';
import { ParcelStatus, ParcelCategory, Prisma } from '@prisma/client';

import { randomBytes } from 'crypto';

@Injectable()
export class ParcelService {
    private readonly logger = new Logger(ParcelService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly autoAssignService: AutoAssignService,
        private readonly orderPoolService: OrderPoolService,
        private readonly sseService: DeliverySseService,
        private readonly userSseService: UserSseService,
    ) { }


    private generateParcelNumber(): string {
        const now = new Date();
        const datePart = now.toISOString().slice(0, 10).replace(/-/g, '');
        const randomPart = randomBytes(4).toString('hex').toUpperCase().slice(0, 6);
        return `PD-${datePart}-${randomPart}`;
    }

    private generateDeliveryPin(): string {
        return Math.floor(1000 + Math.random() * 9000).toString();
    }

    // ── Customer Methods ──────────────────────────────────────────────

    async create(userId: string, dto: CreateParcelOrderDto) {
        const pickupTime = new Date(dto.pickupTime);
        const dropTime = new Date(dto.dropTime);
        const now = new Date();

        if (pickupTime <= now) {
            throw new BadRequestException('Pickup time must be in the future');
        }
        if (dropTime <= pickupTime) {
            throw new BadRequestException('Drop time must be after pickup time');
        }

        if (dto.category === ParcelCategory.OTHERS && !dto.categoryOther) {
            throw new BadRequestException(
                'Please specify category details when selecting OTHERS',
            );
        }

        const parcelNumber = this.generateParcelNumber();
        const deliveryPin = this.generateDeliveryPin();

        const parcel = await this.prisma.parcelOrder.create({
            data: {
                userId,
                parcelNumber,
                deliveryPin,
                status: ParcelStatus.PENDING,
                pickupAddress: dto.pickupAddress as any,
                pickupLat: dto.pickupAddress.lat,
                pickupLng: dto.pickupAddress.lng,
                dropAddress: dto.dropAddress as any,
                dropLat: dto.dropAddress.lat,
                dropLng: dto.dropAddress.lng,
                category: dto.category,
                categoryOther: dto.categoryOther,
                weight: dto.weight,
                length: dto.length,
                width: dto.width,
                height: dto.height,
                pickupTime,
                dropTime,
            } as any,
        });

        this.logger.log(`Parcel created: ${parcel.parcelNumber}`);
        return parcel;
    }

    async findAllByUser(userId: string, query: ParcelQueryDto) {
        const { page = 1, limit = 10, status } = query;
        const skip = (page - 1) * limit;
        const where: Prisma.ParcelOrderWhereInput = { userId };
        if (status) where.status = status;

        const [parcels, total] = await Promise.all([
            this.prisma.parcelOrder.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit,
                include: {
                    assignment: {
                        include: {
                            deliveryPerson: {
                                select: { id: true, name: true, phone: true },
                            },
                        },
                    },
                },
            }),
            this.prisma.parcelOrder.count({ where }),
        ]);

        return paginate(parcels, total, page, limit);
    }

    async findOneByUser(userId: string, id: string) {
        const parcel = await this.prisma.parcelOrder.findUnique({
            where: { id },
            include: {
                assignment: {
                    include: {
                        deliveryPerson: {
                            select: { id: true, name: true, phone: true },
                        },
                    },
                },
            },
        });

        if (!parcel || parcel.userId !== userId) {
            throw new NotFoundException('Parcel not found');
        }

        return parcel;
    }

    async cancelByUser(userId: string, id: string) {
        const parcel = await this.findOneByUser(userId, id);

        if (
            parcel.status !== ParcelStatus.PENDING &&
            parcel.status !== ParcelStatus.APPROVED
        ) {
            throw new BadRequestException(
                `Cannot cancel parcel with status "${parcel.status}"`,
            );
        }

        const cancelled = await this.prisma.parcelOrder.update({
            where: { id },
            data: { status: ParcelStatus.CANCELLED },
        });

        this.logger.log(`Parcel ${parcel.parcelNumber} cancelled by user`);
        return cancelled;
    }

    // ── Admin Methods ─────────────────────────────────────────────────

    async findAllAdmin(query: ParcelQueryDto) {
        const { page = 1, limit = 10, status } = query;
        const skip = (page - 1) * limit;
        const where: Prisma.ParcelOrderWhereInput = {};
        if (status) where.status = status;

        const [parcels, total] = await Promise.all([
            this.prisma.parcelOrder.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit,
                include: {
                    user: { select: { name: true, phone: true } },
                    assignment: {
                        include: {
                            deliveryPerson: {
                                select: { id: true, name: true, phone: true },
                            },
                        },
                    },
                },
            }),
            this.prisma.parcelOrder.count({ where }),
        ]);

        return paginate(parcels, total, page, limit);
    }

    async getOneAdmin(id: string) {
        const parcel = await this.prisma.parcelOrder.findUnique({
            where: { id },
            include: {
                user: { select: { id: true, name: true, phone: true } },
                assignment: {
                    include: {
                        deliveryPerson: {
                            select: { id: true, name: true, phone: true },
                        },
                    },
                },
            },
        });
        if (!parcel) throw new NotFoundException('Parcel not found');
        return parcel;
    }

    async approveParcel(id: string, dto: ApproveParcelDto) {
        const parcel = await this.prisma.parcelOrder.findUnique({ where: { id } });
        if (!parcel) throw new NotFoundException('Parcel not found');

        if (parcel.status !== ParcelStatus.PENDING) {
            throw new BadRequestException(`Cannot approve parcel in status ${parcel.status}`);
        }

        const updated = await this.prisma.parcelOrder.update({
            where: { id },
            data: {
                codAmount: dto.codAmount,
                status: ParcelStatus.APPROVED,
                approvedAt: new Date(),
                paymentStatus: 'COD_PENDING',
            },
        });

        this.logger.log(`Parcel ${parcel.parcelNumber} APPROVED with COD ${dto.codAmount}`);
        return updated;
    }

    async setReadyForPickup(id: string) {
        const parcel = await this.prisma.parcelOrder.findUnique({ where: { id } });
        if (!parcel) throw new NotFoundException('Parcel not found');

        if (parcel.status !== ParcelStatus.APPROVED) {
            throw new BadRequestException('Parcel must be APPROVED first');
        }

        const updated = await this.prisma.parcelOrder.update({
            where: { id },
            data: { status: ParcelStatus.READY_FOR_PICKUP },
        });

        this.logger.log(`Parcel ${parcel.parcelNumber} is READY_FOR_PICKUP`);

        // Auto-trigger assignment (configurable behavior)
        // this.triggerDeliveryAssignment(id).catch(e => this.logger.error(e));

        return updated;
    }

    // Valid parcel status transitions (admin-controlled)
    private static readonly VALID_PARCEL_TRANSITIONS: Record<string, ParcelStatus[]> = {
        PENDING: [ParcelStatus.APPROVED, ParcelStatus.CANCELLED],
        APPROVED: [ParcelStatus.READY_FOR_PICKUP, ParcelStatus.CANCELLED],
        READY_FOR_PICKUP: [ParcelStatus.CANCELLED], // ASSIGNED set by claim system
        ASSIGNED: [ParcelStatus.PICKED_UP, ParcelStatus.CANCELLED],
        PICKED_UP: [ParcelStatus.IN_TRANSIT, ParcelStatus.CANCELLED],
        IN_TRANSIT: [ParcelStatus.CANCELLED], // DELIVERED set by rider only
        DELIVERED: [],
        CANCELLED: [],
    };

    async updateStatus(id: string, dto: UpdateParcelStatusDto) {
        const parcel = await this.prisma.parcelOrder.findUnique({
            where: { id },
            include: { assignment: true },
        });
        if (!parcel) throw new NotFoundException('Parcel not found');

        if (dto.status === ParcelStatus.DELIVERED) {
            throw new BadRequestException('DELIVERED status can only be set by rider');
        }

        const allowed = ParcelService.VALID_PARCEL_TRANSITIONS[parcel.status] ?? [];
        if (!allowed.includes(dto.status)) {
            throw new BadRequestException(
                `Cannot transition from ${parcel.status} to ${dto.status}`,
            );
        }

        // Cancellation cleanup: remove from pool, notify riders, free assigned rider
        if (dto.status === ParcelStatus.CANCELLED) {
            return this.cancelParcel(id, parcel);
        }

        const updated = await this.prisma.parcelOrder.update({
            where: { id },
            data: { status: dto.status },
        });

        // Notify user via SSE
        this.userSseService.notify(parcel.userId, {
            type: 'PARCEL_STATUS_UPDATED',
            data: { parcelId: id, status: dto.status, parcelNumber: parcel.parcelNumber },
        });

        return updated;
    }

    /** Handle all cancellation side-effects in one place. */
    private async cancelParcel(
        id: string,
        parcel: { parcelNumber: string; assignment?: { id: string; deliveryPersonId: string } | null },
    ) {
        const updates: Prisma.PrismaPromise<any>[] = [
            this.prisma.parcelOrder.update({
                where: { id },
                data: { status: ParcelStatus.CANCELLED },
            }),
        ];

        // If assigned to a rider, delete assignment and free the rider
        if (parcel.assignment) {
            updates.push(
                this.prisma.parcelAssignment.delete({ where: { id: parcel.assignment.id } }),
                this.prisma.deliveryPerson.update({
                    where: { id: parcel.assignment.deliveryPersonId },
                    data: { status: 'FREE' },
                }),
            );
        }

        const [cancelled] = await this.prisma.$transaction(updates);

        // Remove from delivery pool (no-op if not in pool)
        this.orderPoolService.removeOrder(id).catch((err) =>
            this.logger.error(`Failed to remove cancelled parcel ${id} from pool: ${err.message}`),
        );

        // Notify all connected riders to remove from their UI
        this.sseService.broadcastOrderClaimed('', id);

        this.logger.log(`Parcel ${parcel.parcelNumber} CANCELLED — pool + riders cleaned up`);
        return cancelled;
    }

    /** Admin manually triggers the broadcast sequence to nearby riders. */
    async triggerDeliveryAssignment(id: string) {
        const parcel = await this.prisma.parcelOrder.findUnique({
            where: { id },
        });
        if (!parcel) throw new NotFoundException('Parcel not found');

        if (parcel.status !== ParcelStatus.READY_FOR_PICKUP && parcel.status !== ParcelStatus.ASSIGNED) {
            throw new BadRequestException('Parcel must be READY_FOR_PICKUP to assign');
        }

        const assignment = await this.prisma.parcelAssignment.findUnique({
            where: { parcelOrderId: id },
        });

        if (assignment) {
            throw new BadRequestException('Parcel already has an active assignment');
        }

        await this.orderPoolService.broadcastParcelOrder(id);

        return { message: 'Parcel assignment sequence started. Finding nearby riders...' };
    }
}
