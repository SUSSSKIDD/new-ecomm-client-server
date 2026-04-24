import { Global, Module } from '@nestjs/common';
import { redisProviders } from './redis/redis.providers.js';
import { RedisCacheService } from './services/redis-cache.service';
import { LocalStorageService } from './services/local-storage.service';
import { StockService } from './services/stock.service';

@Global()
@Module({
  providers: [...redisProviders, RedisCacheService, LocalStorageService, StockService],
  exports: [...redisProviders, RedisCacheService, LocalStorageService, StockService],
})
export class CommonModule {}
