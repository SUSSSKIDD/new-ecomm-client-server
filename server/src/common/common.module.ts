import { Global, Module } from '@nestjs/common';
import { redisProviders } from './redis/redis.providers.js';
import { RedisCacheService } from './services/redis-cache.service';
import { LocalStorageService } from './services/local-storage.service';
import { StockService } from './services/stock.service';
import { GeocodingService } from './services/geocoding.service';

@Global()
@Module({
  providers: [
    ...redisProviders,
    RedisCacheService,
    LocalStorageService,
    StockService,
    GeocodingService,
  ],
  exports: [
    ...redisProviders,
    RedisCacheService,
    LocalStorageService,
    StockService,
    GeocodingService,
  ],
})
export class CommonModule {}
