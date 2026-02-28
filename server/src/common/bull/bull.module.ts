import { DynamicModule, Logger, Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';

@Module({})
export class BullConfigModule {
  private static readonly logger = new Logger('BullConfigModule');

  static forRoot(): DynamicModule {
    return {
      module: BullConfigModule,
      imports: [
        BullModule.forRootAsync({
          inject: [ConfigService],
          useFactory: (config: ConfigService) => {
            const host = config.get('BULL_REDIS_HOST', '');
            const url = config.get('REDIS_URL', '');
            if (!host && !url) {
              BullConfigModule.logger.warn(
                'No BULL_REDIS_HOST or REDIS_URL — BullMQ queues will be unavailable',
              );
              // Return a connection that won't auto-connect
              return {
                connection: {
                  host: '127.0.0.1',
                  port: 6379,
                  maxRetriesPerRequest: 0,
                  lazyConnect: true,
                  enableOfflineQueue: false,
                  retryStrategy: () => null,
                },
              };
            }
            return {
              connection: {
                host: host || 'localhost',
                port: config.get<number>('BULL_REDIS_PORT', 6379),
              },
            };
          },
        }),
        BullModule.registerQueue({ name: 'delivery' }),
      ],
      exports: [BullModule],
    };
  }
}
