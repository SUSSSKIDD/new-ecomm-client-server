import {
    Injectable,
    Logger,
    NotFoundException,
    BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { RedisCacheService } from '../common/services/redis-cache.service';
import { RiderRedisService } from './rider-redis.service';
import { CreateDeliveryPersonDto } from './dto/create-delivery-person.dto';
import { DeliveryPersonStatus } from '@prisma/client';
import { TTL } from '../common/redis/ttl.config.js';
import * as bcrypt from 'bcryptjs';


@Injectable()
export class DeliveryService {
    private readonly logger = new Logger(DeliveryService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly cache: RedisCacheService,
        private readonly riderRedis: RiderRedisService,
    ) { }

    // ── Admin: Manage delivery persons ──────────────────────────────

    /** Create a delivery person. Returns the record. */
    async createPerson(dto: CreateDeliveryPersonDto) {
        const pinHash = await bcrypt.hash(dto.pin, 10);

        // Check if delivery person with this phone already exists
        const existing = await this.prisma.deliveryPerson.findUnique({
            where: { phone: dto.phone },
        });

        let person;
        if (existing) {
            // Update existing person (reset PIN, update name)
            person = await this.prisma.deliveryPerson.update({
                where: { id: existing.id },
                data: {
                    name: dto.name,
                    pinHash,
                    isActive: true,
                    status: 'DUTY_OFF',
                },
            });
            this.logger.log(
                `Delivery person updated: ${person.name} (${person.id})`,
            );
        } else {
            person = await this.prisma.deliveryPerson.create({
                data: {
                    name: dto.name,
                    phone: dto.phone,
                    pinHash,
                },
            });
            this.logger.log(
                `Delivery person created: ${person.name} (${person.id})`,
            );
        }

        return person;
    }

    /** List all delivery persons (capped at 500). */
    async findAllPersons() {
        return this.prisma.deliveryPerson.findMany({
            take: 500,
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                name: true,
                phone: true,
                status: true,
                isActive: true,
                createdAt: true,
                _count: { select: { assignments: true } },
            },
        });
    }

    /** Update a delivery person (admin). */
    async updatePerson(
        id: string,
        data: Partial<{ name: string; isActive: boolean; pin: string }>,
    ) {
        const person = await this.prisma.deliveryPerson.findUnique({
            where: { id },
        });
        if (!person) throw new NotFoundException(`Delivery person ${id} not found`);

        const updateData: any = { ...data };
        if (data.pin) {
            updateData.pinHash = await bcrypt.hash(data.pin, 10);
            delete updateData.pin;
        }

        return this.prisma.deliveryPerson.update({
            where: { id },
            data: updateData,
            select: {
                id: true,
                name: true,
                phone: true,
                status: true,
                isActive: true,
            },
        });
    }

    /** Delete a delivery person (admin). Cascade-deletes all assignments first. */
    async deletePerson(id: string) {
        const person = await this.prisma.deliveryPerson.findUnique({
            where: { id },
        });
        if (!person) throw new NotFoundException(`Delivery person ${id} not found`);

        // Cascade-delete all assignments to avoid FK constraint violations
        await this.prisma.$transaction([
            this.prisma.orderAssignment.deleteMany({ where: { deliveryPersonId: id } }),
            this.prisma.parcelAssignment.deleteMany({ where: { deliveryPersonId: id } }),
            this.prisma.deliveryPerson.delete({ where: { id } }),
        ]);

        // Clean up Redis presence/location
        await Promise.all([
            this.riderRedis.setRiderOffline(id),
            this.cache.del(`dp:loc:${id}`),
            this.cache.geoRemove('riders_location', id),
        ]);

        this.logger.log(`Delivery person deleted: ${person.name} (${id})`);
        return person;
    }

    // ── Delivery person: Self-service ───────────────────────────────

    /** Get own profile. */
    async getProfile(personId: string) {
        const person = await this.prisma.deliveryPerson.findUnique({
            where: { id: personId }
        });
        if (!person) throw new NotFoundException('Profile not found');
        return person;
    }

    /** Update GPS location (cached in main Redis + riderdb2). */
    async updateLocation(personId: string, lat: number, lng: number) {
        // Parallel: DB update + main Redis cache + riderdb2 location + riderdb2 presence + geo caching
        await Promise.all([
            this.prisma.deliveryPerson.update({
                where: { id: personId },
                data: { lat, lng, lastLocationAt: new Date() },
            }),
            this.cache.set(
                `dp:loc:${personId}`,
                { lat, lng, updatedAt: new Date().toISOString() },
                TTL.LOCATION,
            ),
            this.cache.geoAdd('riders_location', lng, lat, personId),
            this.riderRedis.setRiderLocation(personId, lat, lng),
            this.riderRedis.setRiderOnline(personId),
        ]);

        return { lat, lng, updated: true };
    }

    /** Set delivery person status (DUTY_OFF/FREE). */
    async setStatus(personId: string, status: DeliveryPersonStatus) {
        if (status === DeliveryPersonStatus.BUSY) {
            throw new BadRequestException('Cannot manually set BUSY');
        }

        const person = await this.prisma.deliveryPerson.findUnique({
            where: { id: personId },
        });

        if (!person) {
            throw new NotFoundException('Delivery person not found');
        }

        if (person.status === DeliveryPersonStatus.BUSY && status === DeliveryPersonStatus.DUTY_OFF) {
            throw new BadRequestException('Complete current delivery first');
        }

        const updated = await this.prisma.deliveryPerson.update({
            where: { id: personId },
            data: { status },
        });

        if (status === DeliveryPersonStatus.DUTY_OFF) {
            await this.riderRedis.setRiderOffline(personId);
        } else if (status === DeliveryPersonStatus.FREE && person.lat && person.lng) {
            await this.riderRedis.setRiderOnline(personId);
            await this.riderRedis.setRiderLocation(personId, person.lat, person.lng);
        }

        this.logger.log(`Delivery person ${updated.name} set to ${status}`);
        return { status: updated.status };
    }

    /** Get assigned orders for a delivery person. */
    async getAssignedOrders(personId: string) {
        return this.prisma.orderAssignment.findMany({
            where: { deliveryPersonId: personId, completedAt: null },
            include: {
                order: {
                    include: {
                        items: true,
                    },
                },
            },
            orderBy: { assignedAt: 'desc' },
        });
    }

    // ── Generic assignment operations (OOP: Template Method pattern) ──

    /** Validate assignment state and return it, or throw. */
    private validateAssignment(
        assignment: { id: string; acceptedAt: Date | null; completedAt: Date | null } | null,
        action: 'accept' | 'reject' | 'complete',
    ) {
        if (!assignment) throw new NotFoundException('Assignment not found');
        if (action === 'accept') {
            if (assignment.acceptedAt) throw new BadRequestException('Assignment already accepted');
            if (assignment.completedAt) throw new BadRequestException('Assignment already completed');
        } else if (action === 'reject') {
            if (assignment.acceptedAt) throw new BadRequestException('Cannot reject an already accepted assignment');
            if (assignment.completedAt) throw new BadRequestException('Assignment already completed');
        } else {
            if (!assignment.acceptedAt) throw new BadRequestException('You must accept the assignment before completing delivery');
            if (assignment.completedAt) throw new BadRequestException('Delivery already completed');
        }
        return assignment;
    }

    /** Accept a delivery assignment (order or parcel). */
    async acceptAssignment(personId: string, orderId: string) {
        const assignment = await this.prisma.orderAssignment.findFirst({
            where: { orderId, deliveryPersonId: personId },
        });
        this.validateAssignment(assignment, 'accept');

        await this.prisma.$transaction([
            this.prisma.orderAssignment.update({
                where: { id: assignment!.id },
                data: { acceptedAt: new Date() },
            }),
            this.prisma.deliveryPerson.update({
                where: { id: personId },
                data: { status: DeliveryPersonStatus.BUSY },
            }),
        ]);

        this.logger.log(`Assignment accepted for order ${orderId} by person ${personId}`);
        return { orderId, accepted: true };
    }

    async acceptParcelAssignment(personId: string, parcelOrderId: string) {
        const assignment = await this.prisma.parcelAssignment.findFirst({
            where: { parcelOrderId, deliveryPersonId: personId },
        });
        this.validateAssignment(assignment, 'accept');

        await this.prisma.$transaction([
            this.prisma.parcelAssignment.update({
                where: { id: assignment!.id },
                data: { acceptedAt: new Date() },
            }),
            this.prisma.deliveryPerson.update({
                where: { id: personId },
                data: { status: DeliveryPersonStatus.BUSY },
            }),
        ]);

        this.logger.log(`Assignment accepted for parcel ${parcelOrderId} by person ${personId}`);
        return { parcelOrderId, accepted: true };
    }

    /** Reject a delivery assignment. Deletes assignment and frees the person. */
    async rejectAssignment(personId: string, orderId: string) {
        const assignment = await this.prisma.orderAssignment.findFirst({
            where: { orderId, deliveryPersonId: personId },
        });
        this.validateAssignment(assignment, 'reject');

        // Store the rejected personId in Redis so auto-assign skips them
        const rejectedKey = `order:rejected:${orderId}`;
        const existing = await this.cache.get<string[]>(rejectedKey);
        const rejectedIds = existing ? [...existing, personId] : [personId];
        await this.cache.set(rejectedKey, rejectedIds, TTL.REJECTED_RIDERS);

        await this.prisma.$transaction([
            this.prisma.orderAssignment.delete({ where: { id: assignment!.id } }),
            this.prisma.deliveryPerson.update({
                where: { id: personId },
                data: { status: DeliveryPersonStatus.FREE },
            }),
        ]);

        this.logger.log(`Assignment rejected for order ${orderId} by person ${personId}`);
        return { orderId, rejected: true };
    }

    async rejectParcelAssignment(personId: string, parcelOrderId: string) {
        const assignment = await this.prisma.parcelAssignment.findFirst({
            where: { parcelOrderId, deliveryPersonId: personId },
        });
        this.validateAssignment(assignment, 'reject');

        await this.prisma.$transaction([
            this.prisma.parcelAssignment.delete({ where: { id: assignment!.id } }),
            this.prisma.deliveryPerson.update({
                where: { id: personId },
                data: { status: DeliveryPersonStatus.FREE },
            }),
            this.prisma.parcelOrder.update({
                where: { id: parcelOrderId },
                data: { status: 'READY_FOR_PICKUP' },
            }),
        ]);

        this.logger.log(`Assignment rejected for parcel ${parcelOrderId} by person ${personId}`);
        return { parcelOrderId, rejected: true };
    }

    async completeDelivery(personId: string, orderId: string, result: 'DELIVERED' | 'NOT_DELIVERED', reason?: string) {
        const assignment = await this.prisma.orderAssignment.findFirst({
            where: { orderId, deliveryPersonId: personId },
        });
        this.validateAssignment(assignment, 'complete');

        if (result === 'NOT_DELIVERED' && (!reason || reason.trim().length < 5)) {
            throw new BadRequestException('A reason is required when marking as NOT_DELIVERED');
        }

        const now = new Date();
        const isDelivered = result === 'DELIVERED';

        await this.prisma.$transaction([
            isDelivered
                ? this.prisma.orderAssignment.update({ where: { id: assignment!.id }, data: { completedAt: now, result } })
                : this.prisma.orderAssignment.delete({ where: { id: assignment!.id } }),
            this.prisma.order.update({
                where: { id: orderId },
                data: isDelivered
                    ? { status: 'DELIVERED', deliveredAt: now }
                    : { status: 'ORDER_PICKED', notDeliveredReason: reason!.trim(), notDeliveredAt: now },
            }),
            this.prisma.deliveryPerson.update({
                where: { id: personId },
                data: { status: DeliveryPersonStatus.FREE },
            }),
        ]);

        this.logger.log(`Delivery ${result} for order ${orderId} by person ${personId}${!isDelivered ? ` — reason: ${reason}` : ''}`);

        // Sync parent order status if this is a child order
        const order = await this.prisma.order.findUnique({
            where: { id: orderId },
            select: { parentOrderId: true },
        });
        if (order?.parentOrderId) {
            await this.syncParentOrderStatus(order.parentOrderId);
        }

        return { orderId, result, completed: true };
    }

    /**
     * Sync parent order status derived from children's statuses.
     * NOTE: Keep in sync with OrdersService.syncParentStatus() — duplicated to avoid circular dependency.
     */
    private async syncParentOrderStatus(parentOrderId: string): Promise<void> {
        const children = await this.prisma.order.findMany({
            where: { parentOrderId },
            select: { status: true },
        });
        if (children.length === 0) return;

        const statuses = children.map((c) => c.status);

        // Separate cancelled from active children
        const activeStatuses = statuses.filter((s) => s !== 'CANCELLED');

        let parentStatus: string;
        if (activeStatuses.length === 0) parentStatus = 'CANCELLED';
        else if (activeStatuses.every((s) => s === 'DELIVERED')) parentStatus = 'DELIVERED';
        else if (activeStatuses.some((s) => s === 'SHIPPED')) parentStatus = 'SHIPPED';
        else if (activeStatuses.some((s) => s === 'ORDER_PICKED')) parentStatus = 'ORDER_PICKED';
        else parentStatus = 'CONFIRMED';

        await this.prisma.order.update({
            where: { id: parentOrderId },
            data: {
                status: parentStatus as any,
                ...(parentStatus === 'DELIVERED' ? { deliveredAt: new Date() } : {}),
            },
        });
    }

    /** Get assigned parcels for a delivery person. */
    async getAssignedParcelOrders(personId: string) {
        return this.prisma.parcelAssignment.findMany({
            where: { deliveryPersonId: personId, completedAt: null },
            include: { parcelOrder: true },
            orderBy: { assignedAt: 'desc' },
        });
    }

    async completeParcelDelivery(personId: string, parcelOrderId: string, result: 'DELIVERED' | 'NOT_DELIVERED', reason?: string) {
        const assignment = await this.prisma.parcelAssignment.findFirst({
            where: { parcelOrderId, deliveryPersonId: personId },
        });
        this.validateAssignment(assignment, 'complete');

        if (result === 'NOT_DELIVERED' && (!reason || reason.trim().length < 5)) {
            throw new BadRequestException('A reason is required when marking as NOT_DELIVERED');
        }

        const now = new Date();
        const isDelivered = result === 'DELIVERED';

        await this.prisma.$transaction([
            isDelivered
                ? this.prisma.parcelAssignment.update({ where: { id: assignment!.id }, data: { completedAt: now, result } })
                : this.prisma.parcelAssignment.delete({ where: { id: assignment!.id } }),
            this.prisma.parcelOrder.update({
                where: { id: parcelOrderId },
                data: isDelivered
                    ? { status: 'DELIVERED', deliveredAt: now }
                    : { status: 'READY_FOR_PICKUP', notDeliveredReason: reason!.trim(), notDeliveredAt: now },
            }),
            this.prisma.deliveryPerson.update({
                where: { id: personId },
                data: { status: DeliveryPersonStatus.FREE },
            }),
        ]);

        this.logger.log(`Parcel delivery ${result} for parcel ${parcelOrderId} by person ${personId}${!isDelivered ? ` — reason: ${reason}` : ''}`);
        return { parcelOrderId, result, completed: true };
    }

    /** Get delivery history (completed orders + parcels). */
    async getDeliveryHistory(personId: string) {
        const [orderHistory, parcelHistory] = await Promise.all([
            this.prisma.orderAssignment.findMany({
                where: { deliveryPersonId: personId, completedAt: { not: null } },
                include: {
                    order: {
                        select: {
                            id: true,
                            orderNumber: true,
                            total: true,
                            paymentMethod: true,
                            deliveryAddress: true,
                            status: true,
                        },
                    },
                },
                orderBy: { completedAt: 'desc' },
                take: 50,
            }),
            this.prisma.parcelAssignment.findMany({
                where: { deliveryPersonId: personId, completedAt: { not: null } },
                include: {
                    parcelOrder: {
                        select: {
                            id: true,
                            parcelNumber: true,
                            codAmount: true,
                            category: true,
                            weight: true,
                            pickupAddress: true,
                            dropAddress: true,
                            status: true,
                        },
                    },
                },
                orderBy: { completedAt: 'desc' },
                take: 50,
            }),
        ]);

        // Merge and sort by completedAt desc
        const combined = [
            ...orderHistory.map((a) => ({
                id: a.id,
                type: 'order' as const,
                orderId: a.order.id,
                orderNumber: a.order.orderNumber,
                total: a.order.total,
                paymentMethod: a.order.paymentMethod,
                deliveryAddress: a.order.deliveryAddress,
                result: a.result,
                completedAt: a.completedAt,
                assignedAt: a.assignedAt,
            })),
            ...parcelHistory.map((a) => ({
                id: a.id,
                type: 'parcel' as const,
                orderId: a.parcelOrder.id,
                orderNumber: a.parcelOrder.parcelNumber,
                total: a.parcelOrder.codAmount,
                paymentMethod: 'COD',
                deliveryAddress: a.parcelOrder.dropAddress,
                result: a.result,
                completedAt: a.completedAt,
                assignedAt: a.assignedAt,
                category: a.parcelOrder.category,
                weight: a.parcelOrder.weight,
            })),
        ].sort((a, b) => new Date(b.completedAt!).getTime() - new Date(a.completedAt!).getTime());

        return combined;
    }

    /** Get cached location for a delivery person (from Redis). */
    async getCachedLocation(personId: string) {
        return this.cache.get<{ lat: number; lng: number; updatedAt: string }>(
            `dp:loc:${personId}`,
        );
    }
}
