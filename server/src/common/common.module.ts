import { Global, Module } from '@nestjs/common';
import { RedisCacheService } from './services/redis-cache.service';
import { SupabaseStorageService } from './services/supabase-storage.service';

@Global()
@Module({
  providers: [RedisCacheService, SupabaseStorageService],
  exports: [RedisCacheService, SupabaseStorageService],
})
export class CommonModule {}
