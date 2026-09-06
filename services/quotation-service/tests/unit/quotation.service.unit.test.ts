import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QuotationStatus, ApprovalAction } from '@prisma/client';
import { QuotationService, QuotationDomainError } from '../../src/domain/services/quotation.service';

describe('QuotationService', () => {
  let quotationRepo: any;
  let customerRepo: any;
  let approvalLogRepo: any;
  let negotiationRepo: any;
  let catalogClient: any;
  let eventPublisher: any;
  let service: QuotationService;

  beforeEach(() => {
    quotationRepo = {
      findById: vi.fn(),
      findByIdempotencyKey: vi.fn(),
      list: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateWithOptimisticLock: vi.fn(),
      delete: vi.fn(),
      addLine: vi.fn(),
      updateLine: vi.fn(),
      removeLine: vi.fn(),
      recalculateTotals: vi.fn(),
      getPipeline: vi.fn(),
    };

    customerRepo = {
      findById: vi.fn(),
      findByEmail: vi.fn(),
      list: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      setPortalAccess: vi.fn(),
    };

    approvalLogRepo = {
      create: vi.fn(),
      findByQuotationId: vi.fn(),
    };

    negotiationRepo = {
      create: vi.fn(),
      findByQuotationId: vi.fn(),
      resolve: vi.fn(),
    };

    catalogClient = {
      getProduct: vi.fn(),
      getDiscountCeilings: vi.fn().mockResolvedValue({
        tierCeilings: { GOLD: 15, SILVER: 10, BRONZE: 5 },
        categoryCeilings: { 'cat-svc': 10, 'cat-hw': 15 },
      }),
      resolveApprovalChain: vi.fn().mockResolvedValue({
        riskScore: 20,
        requiredRoles: ['SALES_MANAGER'],
      }),
      getUpsellSuggestions: vi.fn().mockResolvedValue([]),
    };

    eventPublisher = {
      publishQuotationConfirmed: vi.fn().mockResolvedValue('msg-1'),
      publishQuotationApproved: vi.fn().mockResolvedValue('msg-2'),
      publishQuotationRejected: vi.fn().mockResolvedValue('msg-3'),
      publishQuotationStatusChanged: vi.fn().mockResolvedValue('msg-4'),
      publishNegotiationReceived: vi.fn().mockResolvedValue('msg-5'),
    };

    service = new QuotationService(
      quotationRepo,
      customerRepo,
      approvalLogRepo,
      negotiationRepo,
      catalogClient,
      eventPublisher,
    );
  });

  describe('submitForApproval', () => {
    it('moves to APPROVED immediately when score is 0', async () => {
      const mockQuote = {
        id: 'quote-1',
        status: QuotationStatus.DRAFT,
        customerId: 'cust-1',
        repId: 'rep-1',
        companyId: 'default',
        currency: 'USD',
        totalAmount: 1000,
        totalMarginPct: 30,
        customer: { tier: 'GOLD' },
        lines: [
          {
            id: 'l1',
            categoryId: 'cat-hw',
            discountPct: 10, // under 15
            quantity: 1,
            lineTotal: 1000,
          },
        ],
        approvalLogs: [],
      };

      quotationRepo.findById.mockResolvedValue(mockQuote);
      quotationRepo.update.mockResolvedValue({
        ...mockQuote,
        status: QuotationStatus.APPROVED,
        blendedRiskScore: 0,
      });

      const result = await service.submitForApproval('quote-1', 'rep-1');

      expect(result.status).toBe(QuotationStatus.APPROVED);
      expect(result.approvalRequired).toBe(false);
      expect(eventPublisher.publishQuotationApproved).toHaveBeenCalled();
    });

    it('moves to PENDING_MANAGER_APPROVAL when score triggers manager', async () => {
      const mockQuote = {
        id: 'quote-2',
        status: QuotationStatus.DRAFT,
        customerId: 'cust-1',
        repId: 'rep-1',
        companyId: 'default',
        currency: 'USD',
        totalAmount: 1000,
        totalMarginPct: 15,
        customer: { tier: 'GOLD' },
        lines: [
          {
            id: 'l1',
            categoryId: 'cat-svc',
            discountPct: 18, // over 10 -> violation
            quantity: 1,
            lineTotal: 1000,
          },
        ],
        approvalLogs: [],
      };

      quotationRepo.findById.mockResolvedValue(mockQuote);
      quotationRepo.update.mockResolvedValue({
        ...mockQuote,
        status: QuotationStatus.PENDING_MANAGER_APPROVAL,
        blendedRiskScore: 20,
      });

      const result = await service.submitForApproval('quote-2', 'rep-1');

      expect(result.status).toBe(QuotationStatus.PENDING_MANAGER_APPROVAL);
      expect(result.approvalRequired).toBe(true);
      expect(eventPublisher.publishQuotationStatusChanged).toHaveBeenCalled();
    });

    it('throws when quotation is not in DRAFT or REJECTED status', async () => {
      quotationRepo.findById.mockResolvedValue({
        id: 'quote-3',
        status: QuotationStatus.APPROVED,
        lines: [{ id: 'l1' }],
      });

      await expect(service.submitForApproval('quote-3', 'rep-1')).rejects.toThrow(
        QuotationDomainError,
      );
    });
  });

  describe('approve', () => {
    it('SALES_MANAGER approval with single-tier flow -> APPROVED', async () => {
      const mockQuote = {
        id: 'quote-high-risk',
        status: QuotationStatus.PENDING_MANAGER_APPROVAL,
        customerId: 'cust-1',
        repId: 'rep-1',
        companyId: 'default',
        blendedRiskScore: 45, // > 30 triggers finance
        lines: [],
      };

      quotationRepo.findById.mockResolvedValue(mockQuote);
      quotationRepo.update.mockResolvedValue({
        ...mockQuote,
        status: QuotationStatus.APPROVED,
      });

      const result = await service.approve(
        'quote-high-risk',
        { id: 'mgr-1', name: 'Sales Manager', role: 'SALES_MANAGER' },
        'Approved by manager',
      );

      expect(approvalLogRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          action: ApprovalAction.APPROVE,
          approverRole: 'SALES_MANAGER',
        }),
      );
      expect(quotationRepo.update).toHaveBeenCalledWith(
        'quote-high-risk',
        { status: QuotationStatus.APPROVED },
      );
      expect(result?.status).toBe(QuotationStatus.APPROVED);
    });

    it('SALES_MANAGER approval without Finance required -> APPROVED', async () => {
      const mockQuote = {
        id: 'quote-med-risk',
        status: QuotationStatus.PENDING_MANAGER_APPROVAL,
        customerId: 'cust-1',
        repId: 'rep-1',
        companyId: 'default',
        blendedRiskScore: 15, // <= 30
        lines: [],
        totalAmount: 1000,
        currency: 'USD',
      };

      quotationRepo.findById.mockResolvedValue(mockQuote);
      quotationRepo.update.mockResolvedValue({
        ...mockQuote,
        status: QuotationStatus.APPROVED,
      });

      const result = await service.approve(
        'quote-med-risk',
        { id: 'mgr-1', name: 'Sales Manager', role: 'SALES_MANAGER' },
      );

      expect(quotationRepo.update).toHaveBeenCalledWith(
        'quote-med-risk',
        { status: QuotationStatus.APPROVED },
      );
      expect(result?.status).toBe(QuotationStatus.APPROVED);
      expect(eventPublisher.publishQuotationApproved).toHaveBeenCalled();
    });

    it('FINANCE approval -> APPROVED', async () => {
      const mockQuote = {
        id: 'quote-finance',
        status: QuotationStatus.PENDING_FINANCE_APPROVAL,
        customerId: 'cust-1',
        repId: 'rep-1',
        companyId: 'default',
        blendedRiskScore: 45,
        lines: [],
        totalAmount: 5000,
        currency: 'USD',
      };

      quotationRepo.findById.mockResolvedValue(mockQuote);
      quotationRepo.update.mockResolvedValue({
        ...mockQuote,
        status: QuotationStatus.APPROVED,
      });

      const result = await service.approve(
        'quote-finance',
        { id: 'fin-1', name: 'Finance Lead', role: 'FINANCE' },
      );

      expect(result?.status).toBe(QuotationStatus.APPROVED);
      expect(eventPublisher.publishQuotationApproved).toHaveBeenCalled();
    });

    it('throws INSUFFICIENT_ROLE when SALES_REP tries to approve', async () => {
      const mockQuote = {
        id: 'quote-1',
        status: QuotationStatus.PENDING_MANAGER_APPROVAL,
      };
      quotationRepo.findById.mockResolvedValue(mockQuote);

      await expect(
        service.approve('quote-1', { id: 'rep-1', name: 'Rep', role: 'SALES_REP' }),
      ).rejects.toThrow(QuotationDomainError);
    });
  });

  describe('portal negotiate', () => {
    it('re-enters approval flow when proposed discount exceeds threshold', async () => {
      const mockQuote = {
        id: 'quote-portal',
        customerId: 'cust-1',
        companyId: 'default',
        status: QuotationStatus.SENT,
        totalAmount: 1000,
        customer: { tier: 'GOLD' },
        lines: [
          {
            id: 'l1',
            categoryId: 'cat-svc', // ceiling 10
            discountPct: 5,
            quantity: 1,
            lineTotal: 1000,
          },
        ],
      };

      quotationRepo.findById.mockResolvedValue(mockQuote);
      negotiationRepo.create.mockResolvedValue({ id: 'neg-1' });
      quotationRepo.update.mockResolvedValue({
        ...mockQuote,
        status: QuotationStatus.PENDING_MANAGER_APPROVAL,
      });

      const res = await service.portalNegotiate('quote-portal', 'cust-1', {
        message: 'Can we get 25% on this?',
        proposedDiscount: 25, // 25 > 10 => violates ceiling
      });

      expect(res.reEnteredApproval).toBe(true);
      expect(res.status).toBe(QuotationStatus.PENDING_MANAGER_APPROVAL);
      expect(eventPublisher.publishNegotiationReceived).toHaveBeenCalled();
    });

    it('throws when customer does not own quotation', async () => {
      quotationRepo.findById.mockResolvedValue({
        id: 'quote-portal',
        customerId: 'cust-1',
      });

      await expect(
        service.portalNegotiate('quote-portal', 'cust-other', {
          message: 'Hello',
        }),
      ).rejects.toThrow(QuotationDomainError);
    });
  });

  describe('confirm', () => {
    it('idempotent confirmation returns existing quote when key matches', async () => {
      const existing = {
        id: 'quote-confirmed',
        status: QuotationStatus.CONFIRMED,
        idempotencyKey: 'key-123',
      };

      quotationRepo.findByIdempotencyKey.mockResolvedValue(existing);

      const res = await service.confirm('quote-confirmed', 'user-1', 'key-123');

      expect(res).toEqual(existing);
      expect(eventPublisher.publishQuotationConfirmed).not.toHaveBeenCalled();
    });

    it('confirms APPROVED quotation and publishes event', async () => {
      const mockQuote = {
        id: 'quote-app',
        customerId: 'cust-1',
        repId: 'rep-1',
        companyId: 'default',
        status: QuotationStatus.APPROVED,
        lines: [],
        totalAmount: 2000,
        currency: 'USD',
      };

      quotationRepo.findById.mockResolvedValue(mockQuote);
      quotationRepo.update.mockResolvedValue({
        ...mockQuote,
        status: QuotationStatus.CONFIRMED,
      });

      const res = await service.confirm('quote-app', 'user-1');

      expect(res?.status).toBe(QuotationStatus.CONFIRMED);
      expect(eventPublisher.publishQuotationConfirmed).toHaveBeenCalled();
    });
  });
});
