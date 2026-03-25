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
export class DeliverySseService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DeliverySseService.name);
  private readonly connections = new Map<string, ConnectionEntry>();
  private staleCheckInterval!: ReturnType<typeof setInterval>;

  private static readonly STALE_TIMEOUT_MS = 5 * 60 * 1000;
  private static readonly MAX_CONNECTIONS = 500;
  private static readonly CHANNEL = 'sse:delivery';

  constructor(
    @Inject(REDIS_CACHE) private readonly publisher: Redis | null,
    @Inject(REDIS_CACHE_SUB) private readonly subscriber: Redis | null,
  ) {}

  onModuleInit() {
    // Sweep stale connections every 2 minutes
    this.staleCheckInterval = setInterval(() => {
      this.sweepStaleConnections();
    }, 2 * 60 * 1000);

    // Subscribe to Redis Pub/Sub for cross-instance SSE delivery
    if (this.subscriber) {
      this.subscriber.subscribe(DeliverySseService.CHANNEL).catch((err: any) => {
        this.logger.error(`Failed to subscribe to ${DeliverySseService.CHANNEL}: ${err?.message || err}`);
      });
      this.subscriber.on('message', (channel, message) => {
        if (channel !== DeliverySseService.CHANNEL) return;
        try {
          const { targetIds, payload } = JSON.parse(message);
          for (const id of targetIds) {
            const entry = this.connections.get(id);
            if (entry) {
              entry.subject.next({ data: payload });
              entry.lastActivity = Date.now();
            }
          }
        } catch (err: any) {
          this.logger.error(`Pub/Sub message parse error: ${err?.message || err}`);
        }
      });
      this.logger.log('SSE Pub/Sub subscriber initialized');
    }
  }

  onModuleDestroy() {
    clearInterval(this.staleCheckInterval);
    if (this.subscriber) {
      this.subscriber.unsubscribe(DeliverySseService.CHANNEL).catch(() => {});
    }
    for (const [, entry] of this.connections) {
      entry.subject.complete();
    }
    this.connections.clear();
  }

  /** Register a new SSE connection for a delivery person. */
  register(deliveryPersonId: string): Subject<SseEvent> {
    if (this.connections.size >= DeliverySseService.MAX_CONNECTIONS) {
      throw new ServiceUnavailableException('SSE connection limit reached');
    }

    // Close any existing connection
    this.unregister(deliveryPersonId);

    const subject = new Subject<SseEvent>();
    const now = Date.now();
    this.connections.set(deliveryPersonId, {
      subject,
      connectedAt: now,
      lastActivity: now,
    });
    this.logger.log(`SSE connected: ${deliveryPersonId} (total: ${this.connections.size})`);
    return subject;
  }

  /** Unregister a delivery person's SSE connection. */
  unregister(deliveryPersonId: string): void {
    const existing = this.connections.get(deliveryPersonId);
    if (existing) {
      existing.subject.complete();
      this.connections.delete(deliveryPersonId);
      this.logger.log(`SSE disconnected: ${deliveryPersonId} (total: ${this.connections.size})`);
    }
  }

  /** Send an event to a specific delivery person (local + pub/sub). */
  notify(deliveryPersonId: string, message: SSEMessage): void {
    const payload = JSON.stringify(message);

    // Local delivery
    const entry = this.connections.get(deliveryPersonId);
    if (entry) {
      try {
        entry.subject.next({ data: payload });
        entry.lastActivity = Date.now();
      } catch (err) {
        this.logger.error(`SSE notify failed for ${deliveryPersonId}: ${err.message}`);
        this.unregister(deliveryPersonId);
      }
    }

    // Publish for other instances
    this.publish([deliveryPersonId], payload);
  }

  /** Notify a delivery person about a new order assignment. */
  notifyNewOrder(deliveryPersonId: string, order: any): void {
    this.notify(deliveryPersonId, {
      type: 'NEW_ORDER',
      data: {
        orderId: order.id,
        orderNumber: order.orderNumber,
        total: order.total,
        paymentMethod: order.paymentMethod,
        itemCount: order.items?.length ?? 0,
      },
    });
  }

  /** Check if a delivery person is currently connected. */
  isConnected(deliveryPersonId: string): boolean {
    return this.connections.has(deliveryPersonId);
  }

  /** Broadcast a new available order to multiple riders. */
  broadcastAvailableOrder(riderIds: string[], snapshot: any): void {
    const message: SSEMessage = {
      type: 'NEW_AVAILABLE_ORDER',
      data: snapshot,
    };
    const payload = JSON.stringify(message);
    let sent = 0;

    for (const riderId of riderIds) {
      const entry = this.connections.get(riderId);
      if (entry) {
        try {
          entry.subject.next({ data: payload });
          entry.lastActivity = Date.now();
          sent++;
        } catch (err) {
          this.logger.error(`SSE broadcast failed for rider ${riderId}: ${err.message}`);
          this.unregister(riderId);
        }
      }
    }

    // Publish for other instances
    this.publish(riderIds, payload);

    this.logger.log(
      `Broadcast NEW_AVAILABLE_ORDER to ${sent}/${riderIds.length} connected riders`,
    );
  }

  /** Notify ALL connected riders that an order has been claimed (remove from their UI). */
  broadcastOrderClaimed(excludeRiderId: string, orderId: string): void {
    const message: SSEMessage = {
      type: 'ORDER_CLAIMED',
      data: { orderId },
    };
    const payload = JSON.stringify(message);

    const targetIds: string[] = [];
    for (const [riderId, entry] of this.connections) {
      if (riderId === excludeRiderId) continue;
      targetIds.push(riderId);
      try {
        entry.subject.next({ data: payload });
        entry.lastActivity = Date.now();
      } catch (err) {
        this.logger.error(`SSE claimed broadcast failed for rider ${riderId}: ${err.message}`);
        this.unregister(riderId);
      }
    }

    // Publish for other instances (all connected riders minus the claimer)
    if (targetIds.length > 0) {
      this.publish(targetIds, payload);
    }

    this.logger.log(
      `Broadcast ORDER_CLAIMED (${orderId}) to ${targetIds.length} connected riders`,
    );
  }

  /** Publish SSE event to Redis for cross-instance delivery. */
  private publish(targetIds: string[], payload: string): void {
    if (!this.publisher) return;
    this.publisher
      .publish(DeliverySseService.CHANNEL, JSON.stringify({ targetIds, payload }))
      .catch((err) => {
        this.logger.error(`Pub/Sub publish error: ${err.message}`);
      });
  }

  /** Remove connections that have been idle beyond the stale timeout. */
  private sweepStaleConnections(): void {
    const now = Date.now();
    let swept = 0;
    for (const [id, entry] of this.connections) {
      if (now - entry.lastActivity > DeliverySseService.STALE_TIMEOUT_MS) {
        this.logger.warn(`Sweeping stale SSE connection: ${id} (idle ${Math.round((now - entry.lastActivity) / 1000)}s)`);
        this.unregister(id);
        swept++;
      }
    }
    if (swept > 0) {
      this.logger.log(`Swept ${swept} stale SSE connections (remaining: ${this.connections.size})`);
    }
  }
}
