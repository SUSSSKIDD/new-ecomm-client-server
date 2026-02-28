import { Global, Module } from '@nestjs/common';
import { redisProviders } from './redis/redis.providers.js';
import { RedisCacheService } from './services/redis-cache.service';
import { SupabaseStorageService } from './services/supabase-storage.service';
import { StockService } from './services/stock.service';

@Global()
@Module({
  providers: [...redisProviders, RedisCacheService, SupabaseStorageService, StockService],
  exports: [...redisProviders, RedisCacheService, SupabaseStorageService, StockService],
})
export class CommonModule {}
