import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { PrismaClient, Prisma } from '@prisma/client';
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
  private readonly directPool: Pool;
  private readonly directClient: PrismaClient;

  constructor(config: ConfigService) {
    const connectionString = config.get<string>('DATABASE_URL');
    const pool = new Pool({
      connectionString,
      max: 10,
      min: 2,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 5_000,
    });
    const adapter = new PrismaPg(pool);
    super({ adapter });
    this.pool = pool;
    // Prisma 7 + adapter mode loses model delegates on subclass instances.
    // Store a reference to the base PrismaClient so .db.model works correctly.
    this._db = new PrismaClient({ adapter });

    // Direct connection bypasses PgBouncer (uses port 5432) for interactive
    // $transaction(async tx =>) calls that require a stable server connection.
    const directUrl = config.get<string>('DIRECT_URL') ?? connectionString;
    this.directPool = new Pool({
      connectionString: directUrl,
      max: 5,
      min: 1,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 5_000,
    });
    this.directClient = new PrismaClient({
      adapter: new PrismaPg(this.directPool),
    });
  }

  /** Workaround: Prisma 7 + adapter mode loses model typings on subclasses. */
  get db(): any {
    return this._db;
  }

  /**
   * Run an interactive transaction on a direct PostgreSQL connection,
   * bypassing PgBouncer. Use instead of $transaction(async tx =>) everywhere
   * to guarantee atomicity regardless of PgBouncer pool mode.
   */
  directTx<T>(
    fn: (tx: Prisma.TransactionClient) => Promise<T>,
    options?: Parameters<PrismaClient['$transaction']>[1],
  ): Promise<T> {
    return this.directClient.$transaction(fn, options);
  }

  async onModuleInit() {
    await this.$connect();
    await this.directClient.$connect();
    this.logger.log(
      `Database connected (pooled max=${this.pool.options.max}, direct max=${this.directPool.options.max})`,
    );
  }

  async onModuleDestroy() {
    await this.$disconnect();
    await this.directClient.$disconnect();
    await this.pool.end();
    await this.directPool.end();
  }
}
