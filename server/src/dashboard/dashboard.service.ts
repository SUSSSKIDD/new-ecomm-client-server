import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { RedisCacheService } from '../common/services/redis-cache.service';
import { OrderStatus, PaymentStatus } from '@prisma/client';

@Injectable()
export class DashboardService {
    constructor(
        private prisma: PrismaService,
        private cache: RedisCacheService,
    ) { }

    async getStoreStats(storeId: string) {
        const cacheKey = `dashboard:store:${storeId}`;
        const cached = await this.cache.get<any>(cacheKey);
        if (cached) return cached;

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const [totalOrders, todayOrders, revenueResult, todayRevenueResult,
            ordersByStatusRaw, totalProducts, lowStockProducts, store] = await Promise.all([
            this.prisma.order.count({
                where: { items: { some: { storeId } } },
            }),
            this.prisma.order.count({
                where: {
                    items: { some: { storeId } },
                    createdAt: { gte: today },
                },
            }),
            this.prisma.orderItem.aggregate({
                where: {
                    storeId,
                    order: {
                        status: { not: OrderStatus.CANCELLED },
                        paymentStatus: PaymentStatus.PAID,
                    },
                },
                _sum: { total: true },
            }),
            this.prisma.orderItem.aggregate({
                where: {
                    storeId,
                    order: {
                        status: { not: OrderStatus.CANCELLED },
                        paymentStatus: PaymentStatus.PAID,
                        createdAt: { gte: today },
                    },
                },
                _sum: { total: true },
            }),
            this.prisma.order.groupBy({
                by: ['status'],
                where: { items: { some: { storeId } } },
                _count: { status: true },
            }),
            this.prisma.storeInventory.count({
                where: { storeId },
            }),
            this.prisma.storeInventory.count({
                where: { storeId, stock: { lte: 10 } },
            }),
            this.prisma.store.findUnique({
                where: { id: storeId },
                select: { name: true, storeCode: true },
            }),
        ]);

        const totalRevenue = revenueResult._sum.total || 0;
        const todayRevenue = todayRevenueResult._sum.total || 0;

        const ordersByStatus = ordersByStatusRaw.reduce((acc, curr) => {
            acc[curr.status] = curr._count.status;
            return acc;
        }, {} as Record<string, number>);

        const result = {
            storeName: store?.name,
            storeCode: store?.storeCode,
            totalOrders,
            totalRevenue,
            todayOrders,
            todayRevenue,
            ordersByStatus,
            totalProducts,
            lowStockProducts,
        };

        // Cache for 60s — dashboard is read-heavy, slight staleness is fine
        await this.cache.set(cacheKey, result, 60);
        return result;
    }

    async getDeliveryStats(deliveryPersonId: string) {
        const cacheKey = `dashboard:rider:${deliveryPersonId}`;
        const cached = await this.cache.get<any>(cacheKey);
        if (cached) return cached;

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const [totalRides, todayRides, person, allAssignments] = await Promise.all([
            this.prisma.orderAssignment.count({
                where: { deliveryPersonId, completedAt: { not: null } },
            }),
            this.prisma.orderAssignment.count({
                where: {
                    deliveryPersonId,
                    completedAt: { gte: today },
                },
            }),
            this.prisma.deliveryPerson.findUnique({
                where: { id: deliveryPersonId },
                select: { name: true },
            }),
            this.prisma.orderAssignment.count({
                where: { deliveryPersonId },
            }),
        ]);

        const FEE = 40;
        const totalEarnings = totalRides * FEE;
        const todayEarnings = todayRides * FEE;
        const completionRate =
            allAssignments > 0
                ? Math.round((totalRides / allAssignments) * 100)
                : 0;

        const result = {
            name: person?.name,
            totalRides,
            totalEarnings,
            todayRides,
            todayEarnings,
            completionRate: `${completionRate}%`,
        };

        await this.cache.set(cacheKey, result, 60);
        return result;
    }
}
