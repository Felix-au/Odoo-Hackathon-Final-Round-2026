import type Redis from 'ioredis';
import { v4 as uuidv4 } from 'uuid';

export const Streams = {
  QUOTATION: 'dealflow360:quotation',
  FULFILLMENT: 'dealflow360:fulfillment',
  BILLING: 'dealflow360:billing',
} as const;

export const EventTypes = {
  QUOTATION_APPROVED: 'quotation.approved',
  QUOTATION_CONFIRMED: 'quotation.confirmed',
  QUOTATION_REJECTED: 'quotation.rejected',
  QUOTATION_NEGOTIATION_RECEIVED: 'quotation.negotiation_received',
  QUOTATION_STATUS_CHANGED: 'quotation.status_changed',
} as const;

export interface BaseEvent<T = unknown> {
  eventId: string;
  eventType: string;
  version: '1.0';
  companyId: string;
  timestamp: string;
  payload: T;
}

export class QuotationEventPublisher {
  constructor(private readonly redis: Redis | null) {}

  async publish<T>(
    stream: string,
    eventType: string,
    companyId: string,
    payload: T,
  ): Promise<string | null> {
    if (!this.redis) {
      return null;
    }

    try {
      const event: BaseEvent<T> = {
        eventId: uuidv4(),
        eventType,
        version: '1.0',
        companyId,
        timestamp: new Date().toISOString(),
        payload,
      };

      const messageId = await this.redis.xadd(
        stream,
        '*',
        'eventId', event.eventId,
        'eventType', event.eventType,
        'version', event.version,
        'companyId', event.companyId,
        'timestamp', event.timestamp,
        'payload', JSON.stringify(event.payload),
      );

      return messageId;
    } catch (err) {
      console.error(`[EventPublisher] Failed to publish event ${eventType}:`, err);
      return null;
    }
  }

  async publishQuotationConfirmed(payload: {
    quotationId: string;
    customerId: string;
    repId: string;
    companyId: string;
    idempotencyKey?: string | null;
    lines: any[];
    totalAmount: number;
    currency: string;
    confirmedAt: string;
  }) {
    return this.publish(Streams.QUOTATION, EventTypes.QUOTATION_CONFIRMED, payload.companyId, payload);
  }

  async publishQuotationApproved(payload: {
    quotationId: string;
    customerId: string;
    repId: string;
    companyId: string;
    lines: any[];
    totalAmount: number;
    currency: string;
  }) {
    return this.publish(Streams.QUOTATION, EventTypes.QUOTATION_APPROVED, payload.companyId, payload);
  }

  async publishQuotationRejected(payload: {
    quotationId: string;
    customerId: string;
    repId: string;
    companyId: string;
    reason?: string | null;
  }) {
    return this.publish(Streams.QUOTATION, EventTypes.QUOTATION_REJECTED, payload.companyId, payload);
  }

  async publishQuotationStatusChanged(payload: {
    quotationId: string;
    customerId: string;
    companyId: string;
    previousStatus: string;
    newStatus: string;
    changedBy: string;
    changedAt: string;
  }) {
    return this.publish(Streams.QUOTATION, EventTypes.QUOTATION_STATUS_CHANGED, payload.companyId, payload);
  }

  async publishNegotiationReceived(payload: {
    quotationId: string;
    customerId: string;
    companyId: string;
    proposedDiscount?: number | null;
    message?: string | null;
  }) {
    return this.publish(Streams.QUOTATION, EventTypes.QUOTATION_NEGOTIATION_RECEIVED, payload.companyId, payload);
  }
}
