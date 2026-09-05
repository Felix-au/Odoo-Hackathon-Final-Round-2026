import { describe, it, expect, vi, beforeEach } from 'vitest';
import { InvoiceStatus, InvoiceType, SubscriptionStatus, Prisma } from '@prisma/client';
import { BillingService } from '../../src/domain/services/billing.service';

describe('BillingService', () => {
  let invoiceRepo: any;
  let subscriptionRepo: any;
  let paymentRepo: any;
  let eventPublisher: any;
  let service: BillingService;

  beforeEach(() => {
    invoiceRepo = {
      findById: vi.fn(),
      findByIdempotencyKey: vi.fn(),
      findByOrderId: vi.fn(),
      list: vi.fn(),
      create: vi.fn(),
      updateStatus: vi.fn(),
    };

    subscriptionRepo = {
      findById: vi.fn(),
      findByOrderId: vi.fn(),
      list: vi.fn(),
      create: vi.fn(),
      updateQuantity: vi.fn(),
      cancel: vi.fn(),
      findDueForBilling: vi.fn(),
      findUpcomingRenewals: vi.fn(),
      advanceBillingDate: vi.fn(),
    };

    paymentRepo = {
      findById: vi.fn(),
      findByIdempotencyKey: vi.fn(),
      findByInvoiceId: vi.fn(),
      recordPayment: vi.fn(),
    };

    eventPublisher = {
      publishInvoiceCreated: vi.fn().mockResolvedValue('msg-1'),
      publishInvoicePaid: vi.fn().mockResolvedValue('msg-2'),
      publishSubscriptionRenewed: vi.fn().mockResolvedValue('msg-3'),
      publishSubscriptionCancelled: vi.fn().mockResolvedValue('msg-4'),
      publishCreditNoteIssued: vi.fn().mockResolvedValue('msg-5'),
    };

    service = new BillingService(invoiceRepo, subscriptionRepo, paymentRepo, eventPublisher);
  });

  describe('handleQuotationConfirmed (CHECK-BILL-001)', () => {
    it('creates ONE_TIME invoice for hardware lines and SubscriptionLine for recurring line', async () => {
      const mockCreatedInvoice = {
        id: 'inv-1',
        orderId: 'quote-100',
        customerId: 'cust-1',
        type: InvoiceType.ONE_TIME,
        status: InvoiceStatus.SENT,
        totalAmount: 2598.0,
      };

      const mockCreatedSub = {
        id: 'sub-1',
        orderId: 'quote-100',
        customerId: 'cust-1',
        planId: 'prod-plan-1',
        planName: 'Cloud Backup Monthly',
        interval: 'MONTHLY',
        unitPrice: 49.99,
        quantity: 2,
        status: SubscriptionStatus.ACTIVE,
      };

      invoiceRepo.create.mockResolvedValue(mockCreatedInvoice);
      subscriptionRepo.create.mockResolvedValue(mockCreatedSub);

      const payload = {
        quotationId: 'quote-100',
        customerId: 'cust-1',
        companyId: 'default',
        lines: [
          {
            productId: 'prod-hw-1',
            productName: 'Enterprise Laptop',
            quantity: 2,
            unitPrice: 1299.0,
            isRecurring: false,
          },
          {
            productId: 'prod-plan-1',
            productName: 'Cloud Backup Monthly',
            quantity: 2,
            unitPrice: 49.99,
            isRecurring: true,
            planInterval: 'MONTHLY',
          },
        ],
        totalAmount: 2697.98,
        currency: 'USD',
        confirmedAt: '2026-09-05T00:00:00Z',
      };

      const result = await service.handleQuotationConfirmed(payload);

      expect(invoiceRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          type: InvoiceType.ONE_TIME,
          orderId: 'quote-100',
        }),
      );
      expect(subscriptionRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          orderId: 'quote-100',
          planName: 'Cloud Backup Monthly',
          interval: 'MONTHLY',
        }),
      );
      expect(eventPublisher.publishInvoiceCreated).toHaveBeenCalled();
      expect(result.invoice).toEqual(mockCreatedInvoice);
      expect(result.subscriptions.length).toBe(1);
    });
  });

  describe('recordPayment (CHECK-BILL-002, CHECK-BILL-003)', () => {
    it('CHECK-BILL-002: records payment and marks invoice PAID when full amount is paid', async () => {
      const mockInvoice = {
        id: 'inv-1',
        orderId: 'quote-1',
        customerId: 'cust-1',
        companyId: 'default',
        status: InvoiceStatus.SENT,
        totalAmount: 1000.0,
        currency: 'USD',
      };

      const mockPayment = {
        id: 'pay-1',
        invoiceId: 'inv-1',
        amount: 1000.0,
        currency: 'USD',
        method: 'bank_transfer',
      };

      invoiceRepo.findById.mockResolvedValue(mockInvoice);
      paymentRepo.findByIdempotencyKey.mockResolvedValue(null);
      paymentRepo.recordPayment.mockResolvedValue(mockPayment);
      paymentRepo.findByInvoiceId.mockResolvedValue([mockPayment]);
      invoiceRepo.updateStatus.mockResolvedValue({
        ...mockInvoice,
        status: InvoiceStatus.PAID,
        paidAt: new Date(),
      });

      const result = await service.recordPayment('inv-1', {
        amount: 1000.0,
        method: 'bank_transfer',
        recordedBy: 'user-fin-1',
      });

      expect(result.status).toBe(InvoiceStatus.PAID);
      expect(invoiceRepo.updateStatus).toHaveBeenCalledWith(
        'inv-1',
        InvoiceStatus.PAID,
        expect.objectContaining({ paidAt: expect.any(Date) }),
      );
      expect(eventPublisher.publishInvoicePaid).toHaveBeenCalled();
    });

    it('CHECK-BILL-003: idempotent payment prevents duplicate records', async () => {
      const existingPayment = {
        id: 'pay-existing',
        invoiceId: 'inv-1',
        amount: 500.0,
        idempotencyKey: 'idem-key-999',
      };

      const mockInvoice = {
        id: 'inv-1',
        status: InvoiceStatus.PAID,
        paidAt: new Date(),
      };

      invoiceRepo.findById.mockResolvedValue(mockInvoice);
      paymentRepo.findByIdempotencyKey.mockResolvedValue(existingPayment);

      const result = await service.recordPayment('inv-1', {
        amount: 500.0,
        method: 'card',
        idempotencyKey: 'idem-key-999',
        recordedBy: 'user-fin-1',
      });

      expect(result.payment).toEqual(existingPayment);
      expect(paymentRepo.recordPayment).not.toHaveBeenCalled();
      expect(eventPublisher.publishInvoicePaid).not.toHaveBeenCalled();
    });
  });

  describe('updateSubscriptionQuantity (CHECK-BILL-004)', () => {
    it('calculates proration and creates adjustment invoice on quantity change', async () => {
      const mockSub = {
        id: 'sub-1',
        orderId: 'quote-1',
        customerId: 'cust-1',
        companyId: 'default',
        planId: 'plan-1',
        planName: 'ProSupport Monthly',
        interval: 'MONTHLY',
        unitPrice: 49.99,
        quantity: 5,
        currency: 'USD',
        status: SubscriptionStatus.ACTIVE,
        currentPeriodStart: new Date('2026-09-01T00:00:00Z'),
        currentPeriodEnd: new Date('2026-10-01T00:00:00Z'),
      };

      subscriptionRepo.findById.mockResolvedValue(mockSub);
      invoiceRepo.create.mockResolvedValue({ id: 'inv-adj-1', totalAmount: 74.98 });
      subscriptionRepo.updateQuantity.mockResolvedValue({ ...mockSub, quantity: 8 });

      const result = await service.updateSubscriptionQuantity('sub-1', 8, '2026-09-16T00:00:00Z');

      expect(result.oldQuantity).toBe(5);
      expect(result.newQuantity).toBe(8);
      expect(result.proration.netAmount).toBeCloseTo(74.98, 1);
      expect(result.adjustmentInvoiceId).toBe('inv-adj-1');
      expect(subscriptionRepo.updateQuantity).toHaveBeenCalledWith('sub-1', 8);
    });
  });

  describe('cancelSubscription (CHECK-BILL-005)', () => {
    it('creates credit note invoice on immediate cancellation with partial refund', async () => {
      const mockSub = {
        id: 'sub-1',
        orderId: 'quote-1',
        customerId: 'cust-1',
        companyId: 'default',
        planId: 'plan-1',
        planName: 'Enterprise SaaS',
        unitPrice: 200,
        quantity: 1,
        cancellationPolicy: 'immediate',
        partialRefundPct: 50,
        status: SubscriptionStatus.ACTIVE,
        currentPeriodStart: new Date('2026-09-01T00:00:00Z'),
        currentPeriodEnd: new Date('2026-10-01T00:00:00Z'),
        currency: 'USD',
      };

      subscriptionRepo.findById.mockResolvedValue(mockSub);
      invoiceRepo.create.mockResolvedValue({ id: 'credit-note-1', totalAmount: 50.0 });
      subscriptionRepo.cancel.mockResolvedValue({ ...mockSub, status: SubscriptionStatus.CANCELLED });

      const result = await service.cancelSubscription('sub-1', '2026-09-16T00:00:00Z', 'Downsizing');

      expect(result.status).toBe('CANCELLED');
      expect(result.creditNoteAmount).toBeCloseTo(50.0, 1);
      expect(result.creditNoteInvoiceId).toBe('credit-note-1');
      expect(eventPublisher.publishCreditNoteIssued).toHaveBeenCalled();
      expect(eventPublisher.publishSubscriptionCancelled).toHaveBeenCalled();
    });
  });

  describe('getBillingSchedule (CHECK-BILL-006)', () => {
    it('returns one-time invoice and future schedules for recurring lines', async () => {
      const mockInvoices = [
        {
          id: 'inv-ot-1',
          type: InvoiceType.ONE_TIME,
          status: InvoiceStatus.SENT,
          totalAmount: 6498.0,
          dueDate: new Date('2026-09-20T00:00:00Z'),
        },
      ];

      const mockSubs = [
        {
          id: 'sub-1',
          planName: 'ProSupport Monthly',
          quantity: 5,
          unitPrice: 49.99,
          interval: 'MONTHLY',
          nextBillingDate: new Date('2026-10-05T00:00:00Z'),
          status: SubscriptionStatus.ACTIVE,
        },
      ];

      invoiceRepo.findByOrderId.mockResolvedValue(mockInvoices);
      subscriptionRepo.findByOrderId.mockResolvedValue(mockSubs);

      const result = await service.getBillingSchedule('order-1');

      expect(result.orderId).toBe('order-1');
      expect(result.oneTimeInvoice?.amount).toBe('6498.00');
      expect(result.recurringLines.length).toBe(1);
      expect(result.recurringLines[0]?.nextBillingDate).toBe('2026-10-05');
      expect(result.recurringLines[0]?.schedule.length).toBe(2);
    });
  });
});
