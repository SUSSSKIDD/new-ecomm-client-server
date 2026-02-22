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
import * as bcrypt from 'bcryptjs';


@Injectable()
export class DeliveryService {
    private readonly logger = new Logger(DeliveryService.name);
    private static readonly LOCATION_TTL = 300; // 5 min

    constructor(
        private readonly prisma: PrismaService,
        private readonly cache: RedisCacheService,
        private readonly riderRedis: RiderRedisService,
    ) { }

    // ── Admin: Manage delivery persons ──────────────────────────────

    /** Create a delivery person. Returns the record + plaintext PIN (shown once). */
    async createPerson(dto: CreateDeliveryPersonDto) {
        // Verify home store exists
        const store = await this.prisma.store.findUnique({
            where: { id: dto.homeStoreId },
        });
        if (!store) {
            throw new NotFoundException(`Store ${dto.homeStoreId} not found`);
        }

        // Use admin-provided PIN
        const pin = dto.pin;
        const pinHash = await bcrypt.hash(pin, 10);

        // Check if delivery person with this phone already exists
        const existing = await this.prisma.deliveryPerson.findUnique({
            where: { phone: dto.phone },
        });

        let person;
        if (existing) {
            // Update existing person (reset PIN, update name/store)
            person = await this.prisma.deliveryPerson.update({
                where: { id: existing.id },
                data: {
                    name: dto.name,
                    pinHash,
                    homeStoreId: dto.homeStoreId,
                    isActive: true,
                    status: 'FREE',
                },
            });
            this.logger.log(
                `Delivery person updated: ${person.name} (${person.id}) at store ${store.name}`,
            );
        } else {
            person = await this.prisma.deliveryPerson.create({
                data: {
                    name: dto.name,
                    phone: dto.phone,
                    pinHash,
                    homeStoreId: dto.homeStoreId,
                },
            });
            this.logger.log(
                `Delivery person created: ${person.name} (${person.id}) at store ${store.name}`,
            );
        }

        return {
            ...person,
            pin, // Show once to admin
            pinHash: undefined, // Don't expose
        };
    }

    /** List all delivery persons. */
    async findAllPersons() {
        return this.prisma.deliveryPerson.findMany({
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                name: true,
                phone: true,
                status: true,
                isActive: true,
                homeStoreId: true,
                homeStore: { select: { id: true, name: true } },
                createdAt: true,
                _count: { select: { assignments: true } },
            },
        });
    }

    /** Update a delivery person (admin). */
    async updatePerson(
        id: string,
        data: Partial<{ name: string; isActive: boolean; homeStoreId: string }>,
    ) {
        const person = await this.prisma.deliveryPerson.findUnique({
            where: { id },
        });
        if (!person) throw new NotFoundException(`Delivery person ${id} not found`);

        return this.prisma.deliveryPerson.update({
            where: { id },
            data,
            select: {
                id: true,
                name: true,
                phone: true,
                status: true,
                isActive: true,
                homeStoreId: true,
            },
        });
    }

    /** Delete a delivery person (admin). */
    async deletePerson(id: string) {
        const person = await this.prisma.deliveryPerson.findUnique({
            where: { id },
        });
        if (!person) throw new NotFoundException(`Delivery person ${id} not found`);

        return this.prisma.deliveryPerson.delete({
            where: { id }
        });
    }

    // ── Delivery person: Self-service ───────────────────────────────

    /** Get own profile. */
    async getProfile(personId: string) {
        const person = await this.prisma.deliveryPerson.findUnique({
            where: { id: personId },
            include: {
                homeStore: { select: { id: true, name: true, pincode: true } },
            },
        });
        if (!person) throw new NotFoundException('Profile not found');
        const { pinHash: _, ...profile } = person;
        return profile;
    }

    /** Update GPS location (cached in main Redis + riderdb2). */
    async updateLocation(personId: string, lat: number, lng: number) {
        // Parallel: DB update + main Redis cache + riderdb2 location + riderdb2 presence
        await Promise.all([
            this.prisma.deliveryPerson.update({
                where: { id: personId },
                data: { lat, lng, lastLocationAt: new Date() },
            }),
            this.cache.set(
                `dp:loc:${personId}`,
                { lat, lng, updatedAt: new Date().toISOString() },
                DeliveryService.LOCATION_TTL,
            ),
            this.riderRedis.setRiderLocation(personId, lat, lng),
            this.riderRedis.setRiderOnline(personId),
        ]);

        return { lat, lng, updated: true };
    }

    /** Set delivery person status (FREE/BUSY). */
    async setStatus(personId: string, status: DeliveryPersonStatus) {
        const person = await this.prisma.deliveryPerson.update({
            where: { id: personId },
            data: { status },
        });
        this.logger.log(`Delivery person ${person.name} set to ${status}`);
        return { status: person.status };
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

    /** Accept a delivery assignment. */
    async acceptAssignment(personId: string, orderId: string) {
        const assignment = await this.prisma.orderAssignment.findFirst({
            where: { orderId, deliveryPersonId: personId },
        });
        if (!assignment) {
            throw new NotFoundException('Assignment not found');
        }
        if (assignment.acceptedAt) {
            throw new BadRequestException('Assignment already accepted');
        }
        if (assignment.completedAt) {
            throw new BadRequestException('Assignment already completed');
        }

        await this.prisma.orderAssignment.update({
            where: { id: assignment.id },
            data: { acceptedAt: new Date() },
        });

        this.logger.log(`Assignment accepted for order ${orderId} by person ${personId}`);
        return { orderId, accepted: true };
    }

    /** Reject a delivery assignment. Deletes assignment and frees the person. */
    async rejectAssignment(personId: string, orderId: string) {
        const assignment = await this.prisma.orderAssignment.findFirst({
            where: { orderId, deliveryPersonId: personId },
        });
        if (!assignment) {
            throw new NotFoundException('Assignment not found');
        }
        if (assignment.acceptedAt) {
            throw new BadRequestException('Cannot reject an already accepted assignment');
        }
        if (assignment.completedAt) {
            throw new BadRequestException('Assignment already completed');
        }

        // Store the rejected personId in Redis so auto-assign skips them
        const rejectedKey = `order:rejected:${orderId}`;
        const existing = await this.cache.get<string[]>(rejectedKey);
        const rejectedIds = existing ? [...existing, personId] : [personId];
        await this.cache.set(rejectedKey, rejectedIds, 3600); // 1 hour TTL

        await this.prisma.$transaction([
            this.prisma.orderAssignment.delete({ where: { id: assignment.id } }),
            this.prisma.deliveryPerson.update({
                where: { id: personId },
                data: { status: DeliveryPersonStatus.FREE },
            }),
        ]);

        this.logger.log(`Assignment rejected for order ${orderId} by person ${personId}`);
        return { orderId, rejected: true };
    }

    /** Mark delivery as complete (DELIVERED / NOT_DELIVERED). */
    async completeDelivery(personId: string, orderId: string, result: 'DELIVERED' | 'NOT_DELIVERED') {
        if (result !== 'DELIVERED' && result !== 'NOT_DELIVERED') {
            throw new BadRequestException('Result must be DELIVERED or NOT_DELIVERED');
        }

        const assignment = await this.prisma.orderAssignment.findFirst({
            where: { orderId, deliveryPersonId: personId },
        });
        if (!assignment) {
            throw new NotFoundException('Assignment not found');
        }
        if (!assignment.acceptedAt) {
            throw new BadRequestException('You must accept the assignment before completing delivery');
        }
        if (assignment.completedAt) {
            throw new BadRequestException('Delivery already completed');
        }

        await this.prisma.$transaction([
            this.prisma.orderAssignment.update({
                where: { id: assignment.id },
                data: { completedAt: new Date(), result },
            }),
            this.prisma.order.update({
                where: { id: orderId },
                data: {
                    status: result === 'DELIVERED' ? 'DELIVERED' : 'ORDER_PICKED',
                    ...(result === 'DELIVERED' ? { deliveredAt: new Date() } : {}),
                },
            }),
            this.prisma.deliveryPerson.update({
                where: { id: personId },
                data: { status: DeliveryPersonStatus.FREE },
            }),
        ]);

        this.logger.log(
            `Delivery ${result} for order ${orderId} by person ${personId}`,
        );

        return { orderId, result, completed: true };
    }

    /** Get cached location for a delivery person (from Redis). */
    async getCachedLocation(personId: string) {
        return this.cache.get<{ lat: number; lng: number; updatedAt: string }>(
            `dp:loc:${personId}`,
        );
    }
}
