import {
  InvoiceStatus,
  InvoiceType,
  SubscriptionStatus,
} from '@prisma/client';
import type { InvoiceRepository } from '../../db/repositories/invoice.repository';
import type { SubscriptionRepository } from '../../db/repositories/subscription.repository';
import type { PaymentRepository, RecordPaymentInput } from '../../db/repositories/payment.repository';
import type { BillingEventPublisher } from '../../events/publisher';
import { computeProration, daysBetween } from './proration.service';
import { computeCancellation } from './cancellation.service';

export class BillingDomainError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly errorCode = 'BILLING_ERROR',
  ) {
    super(message);
    this.name = 'BillingDomainError';
  }
}

export interface QuotationConfirmedEventPayload {
  quotationId: string;
  customerId: string;
  repId?: string;
  companyId?: string;
  idempotencyKey?: string | null;
  lines: Array<{
    id?: string;
    productId: string;
    productName: string;
    quantity?: number;
    qty?: number;
    unitPrice: number;
    discountPct?: number;
    taxAmount?: number;
    isRecurring?: boolean;
    planId?: string | null;
    planInterval?: string | null;
  }>;
  totalAmount: number;
  currency?: string;
  confirmedAt?: string;
}

export class BillingService {
  constructor(
    private readonly invoiceRepo: InvoiceRepository,
    private readonly subscriptionRepo: SubscriptionRepository,
    private readonly paymentRepo: PaymentRepository,
    private readonly eventPublisher: BillingEventPublisher,
  ) {}

  /**
   * REQ-F-162, REQ-BR-010, CHECK-BILL-001:
   * Splits confirmed quotation lines into:
   * 1. ONE_TIME invoice for non-recurring lines
   * 2. SubscriptionLine records for recurring lines
   */
  async handleQuotationConfirmed(payload: QuotationConfirmedEventPayload) {
    const companyId = payload.companyId ?? 'default';
    const orderId = payload.quotationId;
    const customerId = payload.customerId;
    const currency = payload.currency ?? 'USD';
    const confirmedAt = payload.confirmedAt ? new Date(payload.confirmedAt) : new Date();

    const oneTimeLines = payload.lines.filter((l) => !l.isRecurring);
    const recurringLines = payload.lines.filter((l) => l.isRecurring);

    let createdInvoice = null;

    // 1. Create ONE_TIME invoice if non-recurring lines exist
    if (oneTimeLines.length > 0) {
      const dueDate = new Date(confirmedAt);
      dueDate.setDate(dueDate.getDate() + 15); // Net 15 terms

      createdInvoice = await this.invoiceRepo.create({
        companyId,
        orderId,
        customerId,
        type: InvoiceType.ONE_TIME,
        status: InvoiceStatus.SENT,
        currency,
        dueDate,
        idempotencyKey: payload.idempotencyKey ? `inv-${payload.idempotencyKey}` : null,
        lines: oneTimeLines.map((l) => ({
          productId: l.productId,
          description: l.productName,
          quantity: l.quantity ?? l.qty ?? 1,
          unitPrice: Number(l.unitPrice),
          discountPct: l.discountPct ?? 0,
          taxAmount: l.taxAmount !== undefined ? Number(l.taxAmount) : 0,
        })),
      });

      await this.eventPublisher.publishInvoiceCreated({
        invoiceId: createdInvoice.id,
        orderId,
        customerId,
        companyId,
        amount: Number(createdInvoice.totalAmount),
        currency,
        type: 'ONE_TIME',
      });
    }

    // 2. Create SubscriptionLine records for recurring lines
    const createdSubs = [];
    for (const r of recurringLines) {
      const interval = (r.planInterval || 'MONTHLY').toUpperCase();
      const sub = await this.subscriptionRepo.create({
        companyId,
        orderId,
        customerId,
        planId: r.planId || r.productId,
        planName: r.productName,
        interval,
        unitPrice: Number(r.unitPrice),
        quantity: r.quantity ?? r.qty ?? 1,
        currency,
        startDate: confirmedAt,
        cancellationPolicy: 'end_of_period',
        partialRefundPct: 0,
      });

      createdSubs.push(sub);
    }

    return {
      invoice: createdInvoice,
      subscriptions: createdSubs,
    };
  }

  /**
   * REQ-F-161, REQ-IMP-006, CHECK-BILL-002, CHECK-BILL-003:
   * Records payment on invoice with idempotency prevention.
   */
  async recordPayment(
    invoiceId: string,
    data: {
      amount: number;
      currency?: string;
      method: string;
      reference?: string | null;
      idempotencyKey?: string | null;
      recordedBy: string;
      companyId?: string;
    },
  ) {
    const invoice = await this.invoiceRepo.findById(invoiceId);
    if (!invoice) {
      throw new BillingDomainError(404, `Invoice with ID ${invoiceId} not found`, 'NOT_FOUND');
    }

    // Check duplicate payment via idempotency key
    if (data.idempotencyKey) {
      const existingPayment = await this.paymentRepo.findByIdempotencyKey(data.idempotencyKey);
      if (existingPayment) {
        return {
          invoiceId: invoice.id,
          status: invoice.status,
          paidAt: invoice.paidAt,
          payment: existingPayment,
        };
      }
    }

    const payment = await this.paymentRepo.recordPayment({
      companyId: invoice.companyId,
      invoiceId,
      amount: data.amount,
      currency: data.currency ?? invoice.currency,
      method: data.method,
      reference: data.reference,
      recordedBy: data.recordedBy,
      idempotencyKey: data.idempotencyKey,
    });

    // Re-fetch all payments for invoice to check if full amount is paid
    const allPayments = await this.paymentRepo.findByInvoiceId(invoiceId);
    const totalPaid = allPayments.reduce((sum, p) => sum + Number(p.amount), 0);

    let updatedInvoice = invoice;
    if (totalPaid >= Number(invoice.totalAmount)) {
      const paidAt = new Date();
      updatedInvoice = await this.invoiceRepo.updateStatus(invoiceId, InvoiceStatus.PAID, { paidAt });

      await this.eventPublisher.publishInvoicePaid({
        invoiceId: invoice.id,
        orderId: invoice.orderId,
        customerId: invoice.customerId,
        companyId: invoice.companyId,
        amount: Number(payment.amount),
        paidAt: paidAt.toISOString(),
      });
    }

    return {
      invoiceId: updatedInvoice.id,
      status: updatedInvoice.status,
      paidAt: updatedInvoice.paidAt,
      payment,
    };
  }

  async sendInvoice(invoiceId: string) {
    const invoice = await this.invoiceRepo.findById(invoiceId);
    if (!invoice) {
      throw new BillingDomainError(404, `Invoice with ID ${invoiceId} not found`, 'NOT_FOUND');
    }

    return this.invoiceRepo.updateStatus(invoiceId, InvoiceStatus.SENT);
  }

  async voidInvoice(invoiceId: string) {
    const invoice = await this.invoiceRepo.findById(invoiceId);
    if (!invoice) {
      throw new BillingDomainError(404, `Invoice with ID ${invoiceId} not found`, 'NOT_FOUND');
    }

    if (invoice.status === InvoiceStatus.PAID) {
      throw new BillingDomainError(400, 'Cannot void an already paid invoice');
    }

    return this.invoiceRepo.updateStatus(invoiceId, InvoiceStatus.VOIDED, { voidedAt: new Date() });
  }

  async getInvoice(id: string) {
    const invoice = await this.invoiceRepo.findById(id);
    if (!invoice) {
      throw new BillingDomainError(404, `Invoice with ID ${id} not found`, 'NOT_FOUND');
    }
    return invoice;
  }

  async listInvoices(filters: {
    companyId?: string;
    customerId?: string;
    orderId?: string;
    status?: InvoiceStatus;
    type?: InvoiceType;
    page?: number;
    pageSize?: number;
  }) {
    return this.invoiceRepo.list(filters, filters.page ?? 1, filters.pageSize ?? 20);
  }

  /**
   * REQ-F-132, REQ-BR-011, CHECK-BILL-004:
   * Mid-cycle quantity change triggers proration and adjustment invoice.
   */
  async updateSubscriptionQuantity(
    subscriptionId: string,
    newQuantity: number,
    changeDateStr?: string,
  ) {
    const sub = await this.subscriptionRepo.findById(subscriptionId);
    if (!sub) {
      throw new BillingDomainError(404, `Subscription with ID ${subscriptionId} not found`, 'NOT_FOUND');
    }

    if (sub.status !== SubscriptionStatus.ACTIVE) {
      throw new BillingDomainError(400, `Cannot modify subscription in status ${sub.status}`);
    }

    const changeDate = changeDateStr ? new Date(changeDateStr) : new Date();

    const proration = computeProration({
      subscriptionLineId: sub.id,
      currentPeriodStart: sub.currentPeriodStart,
      currentPeriodEnd: sub.currentPeriodEnd,
      changeDate,
      oldQuantity: sub.quantity,
      newQuantity,
      unitPrice: Number(sub.unitPrice),
      prorationMode: 'DAILY',
    });

    let adjustmentInvoiceId: string | null = null;

    if (proration.netAmount !== 0) {
      const invType = proration.creditNote ? InvoiceType.CREDIT_NOTE : InvoiceType.PRORATION;
      const invStatus = proration.creditNote ? InvoiceStatus.CREDIT_NOTE : InvoiceStatus.SENT;

      const invoice = await this.invoiceRepo.create({
        companyId: sub.companyId,
        orderId: sub.orderId,
        customerId: sub.customerId,
        type: invType,
        status: invStatus,
        currency: sub.currency,
        notes: `Mid-cycle adjustment: ${sub.planName} quantity changed from ${sub.quantity} to ${newQuantity}`,
        lines: [
          {
            productId: sub.planId,
            description: `Prorated adjustment: ${sub.planName} (${sub.quantity} -> ${newQuantity})`,
            quantity: 1,
            unitPrice: Math.abs(proration.netAmount),
          },
        ],
      });

      adjustmentInvoiceId = invoice.id;

      await this.eventPublisher.publishInvoiceCreated({
        invoiceId: invoice.id,
        orderId: sub.orderId,
        customerId: sub.customerId,
        companyId: sub.companyId,
        amount: Math.abs(proration.netAmount),
        currency: sub.currency,
        type: invType,
      });
    }

    await this.subscriptionRepo.updateQuantity(subscriptionId, newQuantity);

    return {
      subscriptionId: sub.id,
      oldQuantity: sub.quantity,
      newQuantity,
      proration,
      adjustmentInvoiceId,
    };
  }

  /**
   * REQ-F-133, REQ-F-134, REQ-BR-012, CHECK-BILL-005:
   * Cancellation triggers credit note/refund if policy allows.
   */
  async cancelSubscription(
    subscriptionId: string,
    cancelledAtStr?: string,
    reason?: string,
  ) {
    const sub = await this.subscriptionRepo.findById(subscriptionId);
    if (!sub) {
      throw new BillingDomainError(404, `Subscription with ID ${subscriptionId} not found`, 'NOT_FOUND');
    }

    if (sub.status !== SubscriptionStatus.ACTIVE) {
      throw new BillingDomainError(400, `Cannot cancel subscription in status ${sub.status}`);
    }

    const cancelledAt = cancelledAtStr ? new Date(cancelledAtStr) : new Date();

    const cancellation = computeCancellation(
      {
        unitPrice: Number(sub.unitPrice),
        quantity: sub.quantity,
        cancellationPolicy: sub.cancellationPolicy,
        partialRefundPct: sub.partialRefundPct,
        currentPeriodStart: sub.currentPeriodStart,
        currentPeriodEnd: sub.currentPeriodEnd,
      },
      cancelledAt,
    );

    let creditNoteInvoiceId: string | null = null;

    if (cancellation.creditNoteAmount > 0) {
      const creditNote = await this.invoiceRepo.create({
        companyId: sub.companyId,
        orderId: sub.orderId,
        customerId: sub.customerId,
        type: InvoiceType.CREDIT_NOTE,
        status: InvoiceStatus.CREDIT_NOTE,
        currency: sub.currency,
        notes: `Credit note for cancellation of ${sub.planName}. Reason: ${reason || 'Customer cancellation'}`,
        lines: [
          {
            productId: sub.planId,
            description: `Cancellation credit: ${sub.planName}`,
            quantity: 1,
            unitPrice: cancellation.creditNoteAmount,
          },
        ],
      });

      creditNoteInvoiceId = creditNote.id;

      await this.eventPublisher.publishCreditNoteIssued({
        creditNoteId: creditNote.id,
        orderId: sub.orderId,
        customerId: sub.customerId,
        companyId: sub.companyId,
        amount: cancellation.creditNoteAmount,
      });
    }

    await this.subscriptionRepo.cancel(subscriptionId, cancelledAt);

    await this.eventPublisher.publishSubscriptionCancelled({
      subscriptionId: sub.id,
      orderId: sub.orderId,
      companyId: sub.companyId,
      refundAmount: cancellation.refundAmount,
    });

    return {
      subscriptionId: sub.id,
      effectiveDate: cancellation.effectiveDate,
      creditNoteAmount: cancellation.creditNoteAmount,
      creditNoteInvoiceId,
      status: 'CANCELLED',
    };
  }

  async getSubscription(id: string) {
    const sub = await this.subscriptionRepo.findById(id);
    if (!sub) {
      throw new BillingDomainError(404, `Subscription with ID ${id} not found`, 'NOT_FOUND');
    }
    return sub;
  }

  async listSubscriptions(filters: {
    companyId?: string;
    customerId?: string;
    orderId?: string;
    status?: SubscriptionStatus;
    page?: number;
    pageSize?: number;
  }) {
    return this.subscriptionRepo.list(filters, filters.page ?? 1, filters.pageSize ?? 20);
  }

  /**
   * REQ-F-131, CHECK-BILL-006:
   * Upcoming billing schedule for an order.
   */
  async getBillingSchedule(orderId: string) {
    const invoices = await this.invoiceRepo.findByOrderId(orderId);
    const subscriptions = await this.subscriptionRepo.findByOrderId(orderId);

    const oneTime = invoices.find((i) => i.type === InvoiceType.ONE_TIME);

    const recurringLines = subscriptions.map((s) => {
      const schedule = [];
      let dateCursor = new Date(s.nextBillingDate);
      const amount = (Number(s.unitPrice) * s.quantity).toFixed(2);

      // Project next 2 upcoming billing cycles
      for (let i = 0; i < 2; i++) {
        schedule.push({
          date: dateCursor.toISOString().split('T')[0],
          amount,
        });
        const next = new Date(dateCursor);
        if (s.interval.toUpperCase() === 'YEARLY') {
          next.setFullYear(next.getFullYear() + 1);
        } else if (s.interval.toUpperCase() === 'QUARTERLY') {
          next.setMonth(next.getMonth() + 3);
        } else {
          next.setMonth(next.getMonth() + 1);
        }
        dateCursor = next;
      }

      return {
        id: s.id,
        planName: s.planName,
        quantity: s.quantity,
        unitPrice: Number(s.unitPrice).toFixed(2),
        nextBillingDate: s.nextBillingDate.toISOString().split('T')[0],
        status: s.status,
        schedule,
      };
    });

    return {
      orderId,
      oneTimeInvoice: oneTime
        ? {
            id: oneTime.id,
            amount: Number(oneTime.totalAmount).toFixed(2),
            status: oneTime.status,
            dueDate: oneTime.dueDate ? oneTime.dueDate.toISOString().split('T')[0] : null,
          }
        : null,
      recurringLines,
    };
  }

  /**
   * REQ-RPT-006: Upcoming renewals in next 30 days
   */
  async getUpcomingRenewals(companyId = 'default', daysAhead = 30) {
    return this.subscriptionRepo.findUpcomingRenewals(companyId, daysAhead);
  }
}
