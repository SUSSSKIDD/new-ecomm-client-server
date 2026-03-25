import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit, ServiceUnavailableException } from '@nestjs/common';
import { Subject } from 'rxjs';
import Redis from 'ioredis';
import { REDIS_CACHE, REDIS_CACHE_SUB } from '../common/redis/redis.constants';

export interface SSEMessage {
  type: string;
  data: any;
}

interface SseEvent {
  data: string;
}

interface ConnectionEntry {
  subject: Subject<SseEvent>;
  connectedAt: number;
  lastActivity: number;
}

@Injectable()
export class UserSseService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(UserSseService.name);
  private readonly connections = new Map<string, ConnectionEntry>();
  private staleCheckInterval!: ReturnType<typeof setInterval>;

  private static readonly STALE_TIMEOUT_MS = 10 * 60 * 1000; // 10 mins for users
  private static readonly MAX_CONNECTIONS = 2000; // Users are more numerous
  private static readonly CHANNEL = 'sse:user';

  constructor(
    @Inject(REDIS_CACHE) private readonly publisher: Redis | null,
    @Inject(REDIS_CACHE_SUB) private readonly subscriber: Redis | null,
  ) {}

  onModuleInit() {
    this.staleCheckInterval = setInterval(() => {
      this.sweepStaleConnections();
    }, 2 * 60 * 1000);

    if (this.subscriber) {
      this.subscriber.subscribe(UserSseService.CHANNEL).catch((err: any) => {
        this.logger.error(`Failed to subscribe to ${UserSseService.CHANNEL}: ${err?.message || err}`);
      });
      this.subscriber.on('message', (channel, message) => {
        if (channel !== UserSseService.CHANNEL) return;
        try {
          const { userId, payload } = JSON.parse(message);
          const entry = this.connections.get(userId);
          if (entry) {
            entry.subject.next({ data: payload });
            entry.lastActivity = Date.now();
          }
        } catch (err: any) {
          this.logger.error(`Pub/Sub message parse error: ${err?.message || err}`);
        }
      });
      this.logger.log('User SSE Pub/Sub subscriber initialized');
    }
  }

  onModuleDestroy() {
    clearInterval(this.staleCheckInterval);
    if (this.subscriber) {
      this.subscriber.unsubscribe(UserSseService.CHANNEL).catch(() => {});
    }
    for (const [, entry] of this.connections) {
      entry.subject.complete();
    }
    this.connections.clear();
  }

  register(userId: string): Subject<SseEvent> {
    if (this.connections.size >= UserSseService.MAX_CONNECTIONS) {
      throw new ServiceUnavailableException('User SSE connection limit reached');
    }
    this.unregister(userId);

    const subject = new Subject<SseEvent>();
    const now = Date.now();
    this.connections.set(userId, {
      subject,
      connectedAt: now,
      lastActivity: now,
    });
    return subject;
  }

  unregister(userId: string): void {
    const existing = this.connections.get(userId);
    if (existing) {
      existing.subject.complete();
      this.connections.delete(userId);
    }
  }

  notify(userId: string, message: SSEMessage): void {
    const payload = JSON.stringify(message);
    const entry = this.connections.get(userId);
    if (entry) {
        entry.subject.next({ data: payload });
        entry.lastActivity = Date.now();
    }
    // Cross-instance
    if (this.publisher) {
        this.publisher.publish(UserSseService.CHANNEL, JSON.stringify({ userId, payload })).catch(() => {});
    }
  }

  private sweepStaleConnections(): void {
    const now = Date.now();
    for (const [id, entry] of this.connections) {
      if (now - entry.lastActivity > UserSseService.STALE_TIMEOUT_MS) {
        this.unregister(id);
      }
    }
  }
}
