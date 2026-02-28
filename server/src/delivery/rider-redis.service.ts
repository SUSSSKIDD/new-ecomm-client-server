import { Inject, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import { REDIS_DELIVERY } from '../common/redis/redis.constants.js';
import { TTL } from '../common/redis/ttl.config.js';

/**
 * Wraps a single dedicated ioredis connection for the competitive order claiming system.
 * Key prefixes keep data logically separated:
 *   avail:*, lock:*, idempotent:*  — Order pool & distributed locks
 *   rider:*                        — Rider presence, location, eligible sets
 */
@Injectable()
export class RiderRedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RiderRedisService.name);

  constructor(@Inject(REDIS_DELIVERY) private readonly client: Redis | null) {
    if (!client) {
      this.logger.warn('Delivery Redis not available — order pool disabled');
    }
  }

  async onModuleDestroy() {
    if (this.client) {
      await this.client.quit();
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // Order Pool (sorted set by timestamp)
  // ═══════════════════════════════════════════════════════════════

  /** Add an order to the available pool. Score = timestamp for FIFO ordering. */
  async addToPool(orderId: string): Promise<void> {
    if (!this.client) return;
    try {
      await this.client.zadd('avail:orders', Date.now(), orderId);
    } catch (e) {
      this.logger.error(`addToPool failed: ${e}`);
    }
  }

  /** Remove an order from the available pool. */
  async removeFromPool(orderId: string): Promise<void> {
    if (!this.client) return;
    try {
      await this.client.zrem('avail:orders', orderId);
    } catch (e) {
      this.logger.error(`removeFromPool failed: ${e}`);
    }
  }

  /** Get all order IDs currently in the pool (oldest first). */
  async getPoolOrderIds(): Promise<string[]> {
    if (!this.client) return [];
    try {
      return await this.client.zrange('avail:orders', 0, -1);
    } catch {
      return [];
    }
  }

  /** Store a full order snapshot for fast reads by riders. */
  async setOrderSnapshot(orderId: string, snapshot: any): Promise<void> {
    if (!this.client) return;
    try {
      await this.client.set(
        `avail:order:${orderId}`,
        JSON.stringify(snapshot),
        'EX',
        TTL.ORDER_SNAPSHOT,
      );
    } catch (e) {
      this.logger.error(`setOrderSnapshot failed: ${e}`);
    }
  }

  /** Retrieve order snapshot. */
  async getOrderSnapshot(orderId: string): Promise<any | null> {
    if (!this.client) return null;
    try {
      const raw = await this.client.get(`avail:order:${orderId}`);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  /** Delete order snapshot. */
  async deleteOrderSnapshot(orderId: string): Promise<void> {
    if (!this.client) return;
    try {
      await this.client.del(`avail:order:${orderId}`);
    } catch {}
  }

  /** Batch-get order snapshots using MGET (single round-trip). */
  async getOrderSnapshots(orderIds: string[]): Promise<(any | null)[]> {
    if (!this.client || orderIds.length === 0) return [];
    try {
      const keys = orderIds.map((id) => `avail:order:${id}`);
      const results = await this.client.mget(...keys);
      return results.map((raw) => {
        if (!raw) return null;
        try {
          return JSON.parse(raw);
        } catch {
          return null;
        }
      });
    } catch {
      return orderIds.map(() => null);
    }
  }

  // ── Distributed lock (SET NX) ──

  /**
   * Attempt to acquire a lock for claiming an order.
   * Returns true if lock acquired (this rider wins), false otherwise.
   * FAIL CLOSED: returns false on error so multiple riders cannot claim simultaneously.
   */
  async acquireLock(orderId: string, riderId: string, ttlSeconds = TTL.LOCK): Promise<boolean> {
    if (!this.client) return false;
    try {
      const result = await this.client.set(
        `lock:order:${orderId}`,
        riderId,
        'EX',
        ttlSeconds,
        'NX',
      );
      return result === 'OK';
    } catch (e) {
      this.logger.error(`acquireLock failed for order ${orderId}: ${e}`);
      return false;
    }
  }

  /** Release a lock (only if this rider still holds it). */
  async releaseLock(orderId: string, riderId: string): Promise<void> {
    if (!this.client) return;
    try {
      const holder = await this.client.get(`lock:order:${orderId}`);
      if (holder === riderId) {
        await this.client.del(`lock:order:${orderId}`);
      }
    } catch {}
  }

  // ── Idempotency ──

  /** Check if this rider already claimed this order (for network retries). */
  async checkIdempotency(orderId: string, riderId: string): Promise<boolean> {
    if (!this.client) return false;
    try {
      const val = await this.client.get(`idempotent:claim:${orderId}:${riderId}`);
      return val !== null;
    } catch {
      return false;
    }
  }

  /** Mark this claim as done (TTL 5 min for retry window). */
  async setIdempotency(orderId: string, riderId: string): Promise<void> {
    if (!this.client) return;
    try {
      await this.client.set(
        `idempotent:claim:${orderId}:${riderId}`,
        '1',
        'EX',
        TTL.IDEMPOTENCY,
      );
    } catch {}
  }

  // ═══════════════════════════════════════════════════════════════
  // Rider Presence & Location
  // ═══════════════════════════════════════════════════════════════

  /** Mark a rider as online. TTL 5 minutes (must be refreshed by GPS updates). */
  async setRiderOnline(riderId: string, ttlSeconds = TTL.RIDER_ONLINE): Promise<void> {
    if (!this.client) return;
    try {
      await this.client.set(`rider:online:${riderId}`, '1', 'EX', ttlSeconds);
    } catch {}
  }

  /** Mark a rider as offline manually. */
  async setRiderOffline(riderId: string): Promise<void> {
    if (!this.client) return;
    try {
      await this.client.del(`rider:online:${riderId}`);
    } catch {}
  }

  /** Check if a rider is currently online. */
  async isRiderOnline(riderId: string): Promise<boolean> {
    if (!this.client) return false;
    try {
      const val = await this.client.get(`rider:online:${riderId}`);
      return val !== null;
    } catch {
      return false;
    }
  }

  /** Cache rider location for fast proximity queries. */
  async setRiderLocation(riderId: string, lat: number, lng: number): Promise<void> {
    if (!this.client) return;
    try {
      await this.client.set(
        `rider:loc:${riderId}`,
        JSON.stringify({ lat, lng, updatedAt: new Date().toISOString() }),
        'EX',
        TTL.LOCATION,
      );
    } catch {}
  }

  /** Get a single rider's cached location. */
  async getRiderLocation(riderId: string): Promise<{ lat: number; lng: number } | null> {
    if (!this.client) return null;
    try {
      const raw = await this.client.get(`rider:loc:${riderId}`);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  /** Batch-get multiple rider locations in a single call. */
  async getRiderLocations(riderIds: string[]): Promise<({ lat: number; lng: number } | null)[]> {
    if (!this.client || riderIds.length === 0) return riderIds.map(() => null);
    try {
      const keys = riderIds.map((id) => `rider:loc:${id}`);
      const results = await this.client.mget(...keys);
      return results.map((raw) => {
        if (!raw) return null;
        try {
          return JSON.parse(raw);
        } catch {
          return null;
        }
      });
    } catch {
      return riderIds.map(() => null);
    }
  }

  // ── Eligible riders tracking (per order) ──

  /** Record which riders were notified about an order. */
  async addEligibleRiders(orderId: string, riderIds: string[]): Promise<void> {
    if (!this.client || riderIds.length === 0) return;
    try {
      await this.client.sadd(`rider:eligible:${orderId}`, ...riderIds);
      await this.client.expire(`rider:eligible:${orderId}`, TTL.ELIGIBLE_RIDERS);
    } catch {}
  }

  /** Get all riders who were notified about an order. */
  async getEligibleRiders(orderId: string): Promise<string[]> {
    if (!this.client) return [];
    try {
      return await this.client.smembers(`rider:eligible:${orderId}`);
    } catch {
      return [];
    }
  }

  /** Cleanup eligible riders set for an order. */
  async deleteEligibleRiders(orderId: string): Promise<void> {
    if (!this.client) return;
    try {
      await this.client.del(`rider:eligible:${orderId}`);
    } catch {}
  }
}
