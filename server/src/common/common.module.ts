import { Global, Module } from '@nestjs/common';
import { RedisCacheService } from './services/redis-cache.service';
import { SupabaseStorageService } from './services/supabase-storage.service';
import { StockService } from './services/stock.service';

@Global()
@Module({
  providers: [RedisCacheService, SupabaseStorageService, StockService],
  exports: [RedisCacheService, SupabaseStorageService, StockService],
})
export class CommonModule {}
