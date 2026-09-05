/**
 * All Redis Streams event type definitions for DealFlow360
 *
 * Stream names follow pattern: dealflow360:<domain>
 * Events published by one service are consumed by one or more others.
 */

// ─── Base Event Shape ────────────────────────────────────────

export interface BaseEvent<T = unknown> {
  eventId: string;         // UUID for deduplication
  eventType: string;       // e.g. 'quotation.confirmed'
  version: '1.0';
  companyId: string;
  timestamp: string;       // ISO-8601
  payload: T;
}

// ─── Quotation Events ─────────────────────────────────────────
// Stream: dealflow360:quotation

export interface QuotationLine {
  id: string;
  productId: string;
  productName: string;
  variantId?: string;
  categoryId: string;
  categoryName: string;
  qty: number;
  unitPrice: number;
  discountPct: number;
  lineTotal: number;
  marginPct: number;
  isRecurring: boolean;
  planId?: string;
}

export interface QuotationApprovedPayload {
  quotationId: string;
  customerId: string;
  repId: string;
  companyId: string;
  lines: QuotationLine[];
  totalAmount: number;
  currency: string;
}

export interface QuotationConfirmedPayload {
  quotationId: string;
  customerId: string;
  repId: string;
  companyId: string;
  idempotencyKey: string;
  lines: QuotationLine[];
  totalAmount: number;
  currency: string;
  confirmedAt: string;
}

export interface QuotationStatusChangedPayload {
  quotationId: string;
  customerId: string;
  companyId: string;
  previousStatus: string;
  newStatus: string;
  changedBy: string;
  changedAt: string;
}

// ─── Fulfillment Events ───────────────────────────────────────
// Stream: dealflow360:fulfillment

export interface StockArrivedPayload {
  warehouseId: string;
  productId: string;
  variantId?: string;
  companyId: string;
  quantityAdded: number;
  newQuantityOnHand: number;
}

export interface ShipmentDelayedPayload {
  fulfillmentOrderId: string;
  orderId: string;
  warehouseId: string;
  companyId: string;
  expectedShipDate: string;
  currentDate: string;
  delayDays: number;
}

// ─── Billing Events ───────────────────────────────────────────
// Stream: dealflow360:billing

export interface InvoiceCreatedPayload {
  invoiceId: string;
  orderId: string;
  customerId: string;
  companyId: string;
  type: 'ONE_TIME' | 'RECURRING';
  amount: number;
  currency: string;
  dueDate: string;
}

export interface SubscriptionRenewedPayload {
  subscriptionLineId: string;
  orderId: string;
  customerId: string;
  companyId: string;
  planId: string;
  amount: number;
  currency: string;
  nextBillingDate: string;
}

// ─── Event Type Constants ─────────────────────────────────────

export const EventTypes = {
  QUOTATION_APPROVED: 'quotation.approved',
  QUOTATION_CONFIRMED: 'quotation.confirmed',
  QUOTATION_STATUS_CHANGED: 'quotation.status_changed',
  FULFILLMENT_STOCK_ARRIVED: 'fulfillment.stock_arrived',
  FULFILLMENT_SHIPMENT_DELAYED: 'fulfillment.shipment_delayed',
  BILLING_INVOICE_CREATED: 'billing.invoice_created',
  BILLING_SUBSCRIPTION_RENEWED: 'billing.subscription_renewed',
} as const;

export type EventType = (typeof EventTypes)[keyof typeof EventTypes];

// ─── Stream Names ─────────────────────────────────────────────

export const Streams = {
  QUOTATION: 'dealflow360:quotation',
  FULFILLMENT: 'dealflow360:fulfillment',
  BILLING: 'dealflow360:billing',
} as const;
