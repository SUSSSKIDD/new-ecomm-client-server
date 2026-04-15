import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);
  private readonly pool: Pool;

  private readonly _db: PrismaClient;

  constructor(config: ConfigService) {
    const connectionString = config.get<string>('DATABASE_URL');
    const pool = new Pool({
      connectionString,
      max: 50, // Max connections in pool
      min: 10, // Keep 10 warm connections ready
      idleTimeoutMillis: 30_000, // Close idle connections after 30s
      connectionTimeoutMillis: 5_000, // Fail fast if can't connect in 5s
    });
    const adapter = new PrismaPg(pool);
    super({ adapter });
    this.pool = pool;
    // Prisma 7 + adapter mode loses model delegates on subclass instances.
    // Store a reference to the base PrismaClient so .db.model works correctly.
    this._db = new PrismaClient({ adapter });
  }

  /** Workaround: Prisma 7 + adapter mode loses model typings on subclasses. */
  get db(): any {
    return this._db;
  }

  async onModuleInit() {
    await this.$connect();
    this.logger.log(
      `Database connected (pool: max=${this.pool.options.max}, min=${this.pool.options.min})`,
    );
  }

  async onModuleDestroy() {
    await this.$disconnect();
    await this.pool.end();
  }
}
