import { Inject, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import { REDIS_CACHE } from '../redis/redis.constants.js';

@Injectable()
export class RedisCacheService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisCacheService.name);
  private hits = 0;
  private misses = 0;

  constructor(@Inject(REDIS_CACHE) readonly client: Redis | null) {
    if (!client) {
      this.logger.warn('Redis client not available — caching disabled');
    }
  }

  async onModuleDestroy() {
    if (this.client) {
      await this.client.quit();
    }
  }

  // ── Core CRUD ──────────────────────────────────────────────────────

  async get<T>(key: string): Promise<T | null> {
    if (!this.client) return null;
    try {
      const raw = await this.client.get(key);
      if (raw === null) {
        this.misses++;
        return null;
      }
      this.hits++;
      try {
        return JSON.parse(raw) as T;
      } catch {
        return raw as unknown as T;
      }
    } catch (e) {
      this.logger.error(`get failed for ${key}: ${e}`);
      this.misses++;
      return null;
    }
  }

  async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    if (!this.client) return;
    try {
      await this.client.set(key, JSON.stringify(value), 'EX', ttlSeconds);
    } catch (e) {
      this.logger.error(`set failed for ${key}: ${e}`);
    }
  }

  async del(key: string): Promise<void> {
    if (!this.client) return;
    try {
      await this.client.del(key);
    } catch (e) {
      this.logger.error(`del failed for ${key}: ${e}`);
    }
  }

  /** Delete multiple keys in a single call. */
  async delMany(keys: string[]): Promise<void> {
    if (!this.client || keys.length === 0) return;
    try {
      await this.client.del(...keys);
    } catch (e) {
      this.logger.error(`delMany failed: ${e}`);
    }
  }

  // ── Batch operations ───────────────────────────────────────────────

  /** Batch GET: fetch multiple keys in a single round-trip. */
  async mget<T>(...keys: string[]): Promise<(T | null)[]> {
    if (!this.client || keys.length === 0) return keys.map(() => null);
    try {
      const results = await this.client.mget(...keys);
      return results.map((raw) => {
        if (raw === null) return null;
        try {
          return JSON.parse(raw) as T;
        } catch {
          return raw as unknown as T;
        }
      });
    } catch (e) {
      this.logger.error(`mget failed: ${e}`);
      return keys.map(() => null);
    }
  }

  /** Execute multiple commands in a single round-trip via pipeline. */
  async pipeline(
    commands: Array<{ op: 'get' | 'set' | 'del'; key: string; value?: unknown; ttl?: number }>,
  ): Promise<unknown[]> {
    if (!this.client || commands.length === 0) return [];
    try {
      const pipe = this.client.pipeline();
      for (const cmd of commands) {
        switch (cmd.op) {
          case 'get':
            pipe.get(cmd.key);
            break;
          case 'set':
            if (cmd.ttl) {
              pipe.set(cmd.key, JSON.stringify(cmd.value), 'EX', cmd.ttl);
            } else {
              pipe.set(cmd.key, JSON.stringify(cmd.value));
            }
            break;
          case 'del':
            pipe.del(cmd.key);
            break;
        }
      }
      const results = await pipe.exec();
      return (results || []).map(([err, val]) => (err ? null : val));
    } catch (e) {
      this.logger.error(`pipeline failed: ${e}`);
      return [];
    }
  }

  // ── Pattern deletion (kept for edge cases, prefer bumpVersion) ─────

  async delPattern(pattern: string): Promise<void> {
    if (!this.client) return;
    try {
      const stream = this.client.scanStream({ match: pattern, count: 100 });
      const pipeline = this.client.pipeline();
      let count = 0;

      await new Promise<void>((resolve, reject) => {
        stream.on('data', (keys: string[]) => {
          for (const key of keys) {
            pipeline.del(key);
            count++;
          }
        });
        stream.on('end', () => resolve());
        stream.on('error', (err) => reject(err));
      });

      if (count > 0) {
        await pipeline.exec();
      }
    } catch (e) {
      this.logger.error(`delPattern failed for ${pattern}: ${e}`);
    }
  }

  // ── Cache versioning (replaces delPattern for hot paths) ───────────

  async getVersion(prefix: string): Promise<number> {
    if (!this.client) return 0;
    try {
      const v = await this.client.get(`v:${prefix}`);
      return v ? parseInt(v, 10) : 0;
    } catch (e) {
      this.logger.error(`getVersion failed for ${prefix}: ${e}`);
      return 0;
    }
  }

  async bumpVersion(prefix: string): Promise<void> {
    if (!this.client) return;
    try {
      await this.client.incr(`v:${prefix}`);
    } catch (e) {
      this.logger.error(`bumpVersion failed for ${prefix}: ${e}`);
    }
  }

  /** Increment a key and set TTL on first creation using atomic Lua script. Returns the new count. */
  async incr(key: string, ttlSeconds: number): Promise<number> {
    if (!this.client) return 0;
    try {
      const script = `
        local count = redis.call("incr", KEYS[1])
        if count == 1 then
          redis.call("expire", KEYS[1], ARGV[1])
        end
        return count
      `;
      return await this.client.eval(script, 1, key, ttlSeconds) as number;
    } catch (e) {
      this.logger.error(`incr failed for ${key}: ${e}`);
      return 0;
    }
  }

  // ── Geospatial ─────────────────────────────────────────────────────

  async geoAdd(key: string, longitude: number, latitude: number, member: string): Promise<void> {
    if (!this.client) return;
    try {
      await this.client.geoadd(key, longitude, latitude, member);
    } catch (e) {
      this.logger.error(`geoAdd failed for ${key} member ${member}: ${e}`);
    }
  }

  async geoRemove(key: string, member: string): Promise<void> {
    if (!this.client) return;
    try {
      await this.client.zrem(key, member);
    } catch (e) {
      this.logger.error(`geoRemove failed for ${key} member ${member}: ${e}`);
    }
  }

  async geoSearchRadius(
    key: string,
    longitude: number,
    latitude: number,
    radius: number,
    limitCount: number = 10,
    unit: 'km' | 'm' = 'km',
  ): Promise<string[]> {
    if (!this.client) return [];
    try {
      const results = await this.client.call(
        'GEOSEARCH',
        key,
        'FROMLONLAT',
        String(longitude),
        String(latitude),
        'BYRADIUS',
        String(radius),
        unit.toUpperCase(),
        'ASC',
        'COUNT',
        String(limitCount),
      ) as string[];
      return results || [];
    } catch (e) {
      this.logger.error(`geoSearchRadius failed for ${key}: ${e}`);
      return [];
    }
  }

  // ── Metrics ────────────────────────────────────────────────────────

  getStats() {
    const total = this.hits + this.misses;
    return {
      hits: this.hits,
      misses: this.misses,
      hitRate: total > 0 ? ((this.hits / total) * 100).toFixed(1) + '%' : 'N/A',
    };
  }
}
