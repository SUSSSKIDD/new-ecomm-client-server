import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from '@upstash/redis';

@Injectable()
export class RedisCacheService {
  private readonly logger = new Logger(RedisCacheService.name);
  private readonly client: Redis | null;

  constructor(config: ConfigService) {
    const url = config.get<string>('UPSTASH_REDIS_REST_URL');
    const token = config.get<string>('UPSTASH_REDIS_REST_TOKEN');

    if (!url || !token) {
      this.logger.warn(
        'UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN not set — caching disabled',
      );
      this.client = null;
      return;
    }

    this.client = new Redis({ url, token });
    this.logger.log('Upstash Redis connected');
  }

  async get<T>(key: string): Promise<T | null> {
    if (!this.client) return null;
    try {
      const data = await this.client.get<T>(key);
      return data ?? null;
    } catch {
      return null;
    }
  }

  async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    if (!this.client) return;
    try {
      await this.client.set(key, value, { ex: ttlSeconds });
    } catch {
      // Graceful degradation — cache miss on next read
    }
  }

  async del(key: string): Promise<void> {
    if (!this.client) return;
    try {
      await this.client.del(key);
    } catch {
      // no-op
    }
  }

  /**
   * Delete multiple keys in a single call (avoids N individual HTTP calls to Upstash).
   */
  async delMany(keys: string[]): Promise<void> {
    if (!this.client || keys.length === 0) return;
    try {
      await this.client.del(...keys);
    } catch {
      // no-op
    }
  }

  /**
   * Batch GET: fetch multiple keys in a single HTTP call using Upstash mget.
   */
  async mget<T>(...keys: string[]): Promise<(T | null)[]> {
    if (!this.client || keys.length === 0) return keys.map(() => null);
    try {
      const results = await this.client.mget<(T | null)[]>(...keys);
      return results;
    } catch {
      return keys.map(() => null);
    }
  }

  /**
   * Execute multiple commands in a single HTTP round-trip using Upstash pipeline.
   */
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
              pipe.set(cmd.key, cmd.value, { ex: cmd.ttl });
            } else {
              pipe.set(cmd.key, cmd.value);
            }
            break;
          case 'del':
            pipe.del(cmd.key);
            break;
        }
      }
      const results = await pipe.exec();
      return results;
    } catch {
      return [];
    }
  }

  async delPattern(pattern: string): Promise<void> {
    if (!this.client) return;
    try {
      let cursor: string | number = 0;
      const keysToDelete: string[] = [];
      do {
        const [nextCursor, keys] = await this.client.scan(cursor, {
          match: pattern,
          count: 100,
        });
        cursor = nextCursor;
        keysToDelete.push(...keys);
      } while (cursor !== 0 && cursor !== '0');

      if (keysToDelete.length > 0) {
        await this.client.del(...keysToDelete);
      }
    } catch {
      // no-op
    }
  }
}
