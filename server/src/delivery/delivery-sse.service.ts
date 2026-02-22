import { Injectable, Logger } from '@nestjs/common';
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

@Injectable()
export class DeliverySseService {
  private readonly logger = new Logger(DeliverySseService.name);
  private readonly connections = new Map<string, Subject<SseEvent>>();

  /**
   * Register a new SSE connection for a delivery person.
   * Returns the Subject to pipe into the SSE response.
   */
  register(deliveryPersonId: string): Subject<SseEvent> {
    // Close any existing connection
    this.unregister(deliveryPersonId);

    const subject = new Subject<SseEvent>();
    this.connections.set(deliveryPersonId, subject);
    this.logger.log(`SSE connected: ${deliveryPersonId}`);
    return subject;
  }

  /** Unregister a delivery person's SSE connection. */
  unregister(deliveryPersonId: string): void {
    const existing = this.connections.get(deliveryPersonId);
    if (existing) {
      existing.complete();
      this.connections.delete(deliveryPersonId);
      this.logger.log(`SSE disconnected: ${deliveryPersonId}`);
    }
  }

  /** Send an event to a specific delivery person. */
  notify(deliveryPersonId: string, message: SSEMessage): void {
    const subject = this.connections.get(deliveryPersonId);
    if (subject) {
      subject.next({ data: JSON.stringify(message) });
      this.logger.log(`SSE event sent to ${deliveryPersonId}: ${message.type}`);
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
      const subject = this.connections.get(riderId);
      if (subject) {
        subject.next({ data: JSON.stringify(message) });
        sent++;
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
      const subject = this.connections.get(riderId);
      if (subject) {
        subject.next({ data: JSON.stringify(message) });
      }
    }
    this.logger.log(
      `Broadcast ORDER_CLAIMED (${orderId}) to ${riderIds.length} riders`,
    );
  }
}
