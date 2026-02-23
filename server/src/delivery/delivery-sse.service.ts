import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Subject } from 'rxjs';

export interface SSEMessage {
  type: string;
  data: any;
}

/**
 * NestJS @Sse() expects objects with { data: string } shape.
 * The browser `MessageEvent` constructor is NOT available in Node.js.
 */
interface SseEvent {
  data: string;
}

interface ConnectionEntry {
  subject: Subject<SseEvent>;
  connectedAt: number;
  lastActivity: number;
}

@Injectable()
export class DeliverySseService implements OnModuleDestroy {
  private readonly logger = new Logger(DeliverySseService.name);
  private readonly connections = new Map<string, ConnectionEntry>();
  private staleCheckInterval: ReturnType<typeof setInterval>;

  /** Max idle time before a stale connection is swept (5 minutes). */
  private static readonly STALE_TIMEOUT_MS = 5 * 60 * 1000;

  constructor() {
    // Sweep stale connections every 2 minutes
    this.staleCheckInterval = setInterval(() => {
      this.sweepStaleConnections();
    }, 2 * 60 * 1000);
  }

  onModuleDestroy() {
    clearInterval(this.staleCheckInterval);
    for (const [, entry] of this.connections) {
      entry.subject.complete();
    }
    this.connections.clear();
  }

  /**
   * Register a new SSE connection for a delivery person.
   * Returns the Subject to pipe into the SSE response.
   */
  register(deliveryPersonId: string): Subject<SseEvent> {
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

  /** Send an event to a specific delivery person. */
  notify(deliveryPersonId: string, message: SSEMessage): void {
    const entry = this.connections.get(deliveryPersonId);
    if (entry) {
      try {
        entry.subject.next({ data: JSON.stringify(message) });
        entry.lastActivity = Date.now();
        this.logger.log(`SSE event sent to ${deliveryPersonId}: ${message.type}`);
      } catch (err) {
        this.logger.error(`SSE notify failed for ${deliveryPersonId}: ${err.message}`);
        this.unregister(deliveryPersonId);
      }
    }
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

  /** Broadcast a new available order to multiple riders for competitive claiming. */
  broadcastAvailableOrder(riderIds: string[], snapshot: any): void {
    const message: SSEMessage = {
      type: 'NEW_AVAILABLE_ORDER',
      data: snapshot,
    };
    let sent = 0;
    for (const riderId of riderIds) {
      const entry = this.connections.get(riderId);
      if (entry) {
        try {
          entry.subject.next({ data: JSON.stringify(message) });
          entry.lastActivity = Date.now();
          sent++;
        } catch (err) {
          this.logger.error(`SSE broadcast failed for rider ${riderId}: ${err.message}`);
          this.unregister(riderId);
        }
      }
    }
    this.logger.log(
      `Broadcast NEW_AVAILABLE_ORDER to ${sent}/${riderIds.length} connected riders`,
    );
  }

  /** Notify riders that an order has been claimed (remove from their UI). */
  broadcastOrderClaimed(riderIds: string[], orderId: string): void {
    const message: SSEMessage = {
      type: 'ORDER_CLAIMED',
      data: { orderId },
    };
    for (const riderId of riderIds) {
      const entry = this.connections.get(riderId);
      if (entry) {
        try {
          entry.subject.next({ data: JSON.stringify(message) });
          entry.lastActivity = Date.now();
        } catch (err) {
          this.logger.error(`SSE claimed broadcast failed for rider ${riderId}: ${err.message}`);
          this.unregister(riderId);
        }
      }
    }
    this.logger.log(
      `Broadcast ORDER_CLAIMED (${orderId}) to ${riderIds.length} riders`,
    );
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
