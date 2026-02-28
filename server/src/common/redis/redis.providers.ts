import { Provider, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { REDIS_CACHE, REDIS_DELIVERY, REDIS_CACHE_SUB } from './redis.constants.js';

function createRedisFactory(
  token: symbol,
  envVar: string,
  label: string,
): Provider {
  return {
    provide: token,
    useFactory: (config: ConfigService): Redis | null => {
      const logger = new Logger(`Redis:${label}`);
      const url = config.get<string>(envVar);
      if (!url) {
        logger.warn(`${envVar} not set — ${label} disabled`);
        return null;
      }
      const client = new Redis(url, {
        maxRetriesPerRequest: 3,
        retryStrategy: (times) => Math.min(times * 200, 5000),
        enableReadyCheck: true,
        lazyConnect: false,
      });
      client.on('connect', () => logger.log(`${label} connected`));
      client.on('error', (err) => logger.error(`${label} error: ${err.message}`));
      return client;
    },
    inject: [ConfigService],
  };
}

export const redisProviders: Provider[] = [
  createRedisFactory(REDIS_CACHE, 'REDIS_URL', 'Cache'),
  createRedisFactory(REDIS_DELIVERY, 'RIDER_REDIS_URL', 'Delivery'),
  createRedisFactory(REDIS_CACHE_SUB, 'REDIS_URL', 'CacheSub'),
];
