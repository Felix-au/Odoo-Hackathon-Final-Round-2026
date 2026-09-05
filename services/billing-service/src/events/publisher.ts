import type Redis from 'ioredis';
import { v4 as uuidv4 } from 'uuid';

export const Streams = {
  QUOTATION: 'dealflow360:quotation',
  BILLING: 'dealflow360:billing',
} as const;

export const EventTypes = {
  INVOICE_CREATED: 'billing.invoice_created',
  INVOICE_PAID: 'billing.invoice_paid',
  SUBSCRIPTION_RENEWED: 'billing.subscription_renewed',
  SUBSCRIPTION_CANCELLED: 'billing.subscription_cancelled',
  CREDIT_NOTE_ISSUED: 'billing.credit_note_issued',
} as const;

export interface BaseEvent<T = unknown> {
  eventId: string;
  eventType: string;
  version: '1.0';
  companyId: string;
  timestamp: string;
  payload: T;
}

export class BillingEventPublisher {
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
      console.error(`[BillingEventPublisher] Failed to publish event ${eventType}:`, err);
      return null;
    }
  }

  async publishInvoiceCreated(payload: {
    invoiceId: string;
    orderId: string;
    customerId: string;
    companyId: string;
    amount: number;
    currency: string;
    type: string;
  }) {
    return this.publish(Streams.BILLING, EventTypes.INVOICE_CREATED, payload.companyId, payload);
  }

  async publishInvoicePaid(payload: {
    invoiceId: string;
    orderId: string;
    customerId: string;
    companyId: string;
    amount: number;
    paidAt: string;
  }) {
    return this.publish(Streams.BILLING, EventTypes.INVOICE_PAID, payload.companyId, payload);
  }

  async publishSubscriptionRenewed(payload: {
    subscriptionId: string;
    orderId: string;
    customerId: string;
    companyId: string;
    amount: number;
    period: string;
  }) {
    return this.publish(Streams.BILLING, EventTypes.SUBSCRIPTION_RENEWED, payload.companyId, payload);
  }

  async publishSubscriptionCancelled(payload: {
    subscriptionId: string;
    orderId: string;
    companyId: string;
    refundAmount: number;
  }) {
    return this.publish(Streams.BILLING, EventTypes.SUBSCRIPTION_CANCELLED, payload.companyId, payload);
  }

  async publishCreditNoteIssued(payload: {
    creditNoteId: string;
    orderId: string;
    customerId: string;
    companyId: string;
    amount: number;
  }) {
    return this.publish(Streams.BILLING, EventTypes.CREDIT_NOTE_ISSUED, payload.companyId, payload);
  }
}
