import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from '@upstash/redis';

/**
 * Wraps two dedicated Upstash Redis instances for the competitive order claiming system.
 *
 * riderdb1 — Order pool, distributed locks, idempotency keys
 * riderdb2 — Rider presence & location cache
 */
@Injectable()
export class RiderRedisService {
  private readonly logger = new Logger(RiderRedisService.name);
  private readonly db1: Redis | null;
  private readonly db2: Redis | null;

  constructor(config: ConfigService) {
    // ── DB1: Order pool + locks ──
    const url1 = config.get<string>('RIDER_REDIS1_URL');
    const token1 = config.get<string>('RIDER_REDIS1_TOKEN');
    if (url1 && token1) {
      this.db1 = new Redis({ url: url1, token: token1 });
      this.logger.log('RiderRedis DB1 (order pool) connected');
    } else {
      this.db1 = null;
      this.logger.warn('RIDER_REDIS1 credentials missing — order pool disabled');
    }

    // ── DB2: Rider presence + location ──
    const url2 = config.get<string>('RIDER_REDIS2_URL');
    const token2 = config.get<string>('RIDER_REDIS2_TOKEN');
    if (url2 && token2) {
      this.db2 = new Redis({ url: url2, token: token2 });
      this.logger.log('RiderRedis DB2 (rider presence) connected');
    } else {
      this.db2 = null;
      this.logger.warn('RIDER_REDIS2 credentials missing — rider presence disabled');
    }
  }

  get isAvailable(): boolean {
    return this.db1 !== null && this.db2 !== null;
  }

  // ═══════════════════════════════════════════════════════════════
  // DB1 — Order Pool (sorted set by timestamp)
  // ═══════════════════════════════════════════════════════════════

  /** Add an order to the available pool. Score = timestamp for FIFO ordering. */
  async addToPool(orderId: string): Promise<void> {
    if (!this.db1) return;
    try {
      await this.db1.zadd('avail:orders', { score: Date.now(), member: orderId });
    } catch (e) {
      this.logger.error(`addToPool failed: ${e}`);
    }
  }

  /** Remove an order from the available pool. */
  async removeFromPool(orderId: string): Promise<void> {
    if (!this.db1) return;
    try {
      await this.db1.zrem('avail:orders', orderId);
    } catch (e) {
      this.logger.error(`removeFromPool failed: ${e}`);
    }
  }

  /** Get all order IDs currently in the pool (oldest first). */
  async getPoolOrderIds(): Promise<string[]> {
    if (!this.db1) return [];
    try {
      return await this.db1.zrange('avail:orders', 0, -1);
    } catch {
      return [];
    }
  }

  /** Store a full order snapshot for fast reads by riders. TTL 10 min. */
  async setOrderSnapshot(orderId: string, snapshot: any): Promise<void> {
    if (!this.db1) return;
    try {
      await this.db1.set(`avail:order:${orderId}`, JSON.stringify(snapshot), { ex: 600 });
    } catch (e) {
      this.logger.error(`setOrderSnapshot failed: ${e}`);
    }
  }

  /** Retrieve order snapshot. */
  async getOrderSnapshot(orderId: string): Promise<any | null> {
    if (!this.db1) return null;
    try {
      const raw = await this.db1.get<string>(`avail:order:${orderId}`);
      return raw ? (typeof raw === 'string' ? JSON.parse(raw) : raw) : null;
    } catch {
      return null;
    }
  }

  /** Delete order snapshot. */
  async deleteOrderSnapshot(orderId: string): Promise<void> {
    if (!this.db1) return;
    try {
      await this.db1.del(`avail:order:${orderId}`);
    } catch { }
  }

  // ── Distributed lock (SET NX) ──

  /**
   * Attempt to acquire a lock for claiming an order.
   * Returns true if lock acquired (this rider wins), false otherwise.
   */
  async acquireLock(orderId: string, riderId: string, ttlSeconds = 30): Promise<boolean> {
    if (!this.db1) return true; // graceful degradation — allow Prisma layer to handle
    try {
      const result = await this.db1.set(`lock:order:${orderId}`, riderId, {
        nx: true,
        ex: ttlSeconds,
      });
      return result === 'OK';
    } catch {
      return true; // degrade gracefully
    }
  }

  /** Release a lock (only if this rider still holds it). */
  async releaseLock(orderId: string, riderId: string): Promise<void> {
    if (!this.db1) return;
    try {
      const holder = await this.db1.get<string>(`lock:order:${orderId}`);
      if (holder === riderId) {
        await this.db1.del(`lock:order:${orderId}`);
      }
    } catch { }
  }

  // ── Idempotency ──

  /** Check if this rider already claimed this order (for network retries). */
  async checkIdempotency(orderId: string, riderId: string): Promise<boolean> {
    if (!this.db1) return false;
    try {
      const val = await this.db1.get<string>(`idempotent:claim:${orderId}:${riderId}`);
      return val !== null;
    } catch {
      return false;
    }
  }

  /** Mark this claim as done (TTL 5 min for retry window). */
  async setIdempotency(orderId: string, riderId: string): Promise<void> {
    if (!this.db1) return;
    try {
      await this.db1.set(`idempotent:claim:${orderId}:${riderId}`, '1', { ex: 300 });
    } catch { }
  }

  // ═══════════════════════════════════════════════════════════════
  // DB2 — Rider Presence & Location
  // ═══════════════════════════════════════════════════════════════

  /** Mark a rider as online. TTL 5 minutes (must be refreshed by GPS updates). */
  async setRiderOnline(riderId: string, ttlSeconds = 300): Promise<void> {
    if (!this.db2) return;
    try {
      await this.db2.set(`rider:online:${riderId}`, '1', { ex: ttlSeconds });
    } catch { }
  }

  /** Mark a rider as offline manually. */
  async setRiderOffline(riderId: string): Promise<void> {
    if (!this.db2) return;
    try {
      await this.db2.del(`rider:online:${riderId}`);
    } catch { }
  }

  /** Check if a rider is currently online. */
  async isRiderOnline(riderId: string): Promise<boolean> {
    if (!this.db2) return false;
    try {
      const val = await this.db2.get<string>(`rider:online:${riderId}`);
      return val !== null;
    } catch {
      return false;
    }
  }

  /** Cache rider location in DB2 for fast proximity queries. */
  async setRiderLocation(riderId: string, lat: number, lng: number): Promise<void> {
    if (!this.db2) return;
    try {
      await this.db2.set(
        `rider:loc:${riderId}`,
        JSON.stringify({ lat, lng, updatedAt: new Date().toISOString() }),
        { ex: 300 },
      );
    } catch { }
  }

  /** Get a single rider's cached location. */
  async getRiderLocation(riderId: string): Promise<{ lat: number; lng: number } | null> {
    if (!this.db2) return null;
    try {
      const raw = await this.db2.get<string>(`rider:loc:${riderId}`);
      if (!raw) return null;
      return typeof raw === 'string' ? JSON.parse(raw) : raw;
    } catch {
      return null;
    }
  }

  /** Batch-get multiple rider locations in a single call. */
  async getRiderLocations(riderIds: string[]): Promise<({ lat: number; lng: number } | null)[]> {
    if (!this.db2 || riderIds.length === 0) return riderIds.map(() => null);
    try {
      const keys = riderIds.map((id) => `rider:loc:${id}`);
      const results = await this.db2.mget<(string | null)[]>(...keys);
      return results.map((raw) => {
        if (!raw) return null;
        try {
          return typeof raw === 'string' ? JSON.parse(raw) : raw;
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
    if (!this.db2 || riderIds.length === 0) return;
    try {
      await (this.db2.sadd as any)(`rider:eligible:${orderId}`, ...riderIds);
      await this.db2.expire(`rider:eligible:${orderId}`, 600); // 10 min TTL
    } catch { }
  }

  /** Get all riders who were notified about an order. */
  async getEligibleRiders(orderId: string): Promise<string[]> {
    if (!this.db2) return [];
    try {
      return await this.db2.smembers(`rider:eligible:${orderId}`);
    } catch {
      return [];
    }
  }

  /** Cleanup eligible riders set for an order. */
  async deleteEligibleRiders(orderId: string): Promise<void> {
    if (!this.db2) return;
    try {
      await this.db2.del(`rider:eligible:${orderId}`);
    } catch { }
  }
}
