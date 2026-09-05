import {
  QuotationStatus,
  ApprovalAction,
  NegotiationStatus,
} from '@prisma/client';
import type {
  QuotationRepository,
  CreateQuotationInput,
  AddLineInput,
  UpdateLineInput,
} from '../../db/repositories/quotation.repository';
import type { CustomerRepository } from '../../db/repositories/customer.repository';
import type { ApprovalLogRepository } from '../../db/repositories/approval-log.repository';
import type { NegotiationRepository } from '../../db/repositories/negotiation.repository';
import type { CatalogClient } from '../../integrations/catalog.client';
import type { QuotationEventPublisher } from '../../events/publisher';
import {
  computeBlendedRiskScore,
  LineRiskInput,
  CeilingMap,
  RiskScoreResult,
} from './risk-score.service';

export class QuotationDomainError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly errorCode = 'QUOTATION_ERROR',
  ) {
    super(message);
    this.name = 'QuotationDomainError';
  }
}

export class QuotationService {
  constructor(
    private readonly quotationRepo: QuotationRepository,
    private readonly customerRepo: CustomerRepository,
    private readonly approvalLogRepo: ApprovalLogRepository,
    private readonly negotiationRepo: NegotiationRepository,
    private readonly catalogClient: CatalogClient,
    private readonly eventPublisher: QuotationEventPublisher,
  ) {}

  async createQuotation(input: CreateQuotationInput) {
    const customer = await this.customerRepo.findById(input.customerId);
    if (!customer) {
      throw new QuotationDomainError(404, `Customer with ID ${input.customerId} not found`, 'CUSTOMER_NOT_FOUND');
    }

    const quotation = await this.quotationRepo.create({
      ...input,
      companyId: customer.companyId,
    });

    return quotation;
  }

  async getQuotation(id: string) {
    const quotation = await this.quotationRepo.findById(id);
    if (!quotation) {
      throw new QuotationDomainError(404, `Quotation with ID ${id} not found`, 'QUOTATION_NOT_FOUND');
    }
    return quotation;
  }

  async listQuotations(filters: {
    companyId?: string;
    repId?: string;
    customerId?: string;
    status?: QuotationStatus;
    search?: string;
    page?: number;
    pageSize?: number;
  }) {
    return this.quotationRepo.list(filters, filters.page ?? 1, filters.pageSize ?? 20);
  }

  async updateQuotationMetadata(
    id: string,
    expectedVersion: number | undefined,
    data: { notes?: string; validUntil?: Date; currency?: string; customerId?: string },
  ) {
    const quotation = await this.getQuotation(id);
    if (quotation.status === QuotationStatus.CONFIRMED || quotation.status === QuotationStatus.SENT) {
      throw new QuotationDomainError(400, `Cannot update quotation metadata when status is ${quotation.status}`);
    }

    if (expectedVersion !== undefined) {
      return this.quotationRepo.updateWithOptimisticLock(id, expectedVersion, data);
    }
    return this.quotationRepo.update(id, data);
  }

  async deleteQuotation(id: string) {
    const quotation = await this.getQuotation(id);
    if (quotation.status !== QuotationStatus.DRAFT) {
      throw new QuotationDomainError(400, `Cannot delete quotation with status ${quotation.status}. Only DRAFT quotations can be deleted.`);
    }
    return this.quotationRepo.delete(id);
  }

  async addLine(id: string, lineInput: AddLineInput) {
    const quotation = await this.getQuotation(id);
    if (quotation.status === QuotationStatus.CONFIRMED) {
      throw new QuotationDomainError(400, `Cannot add lines to confirmed quotation`);
    }

    // Attempt to enrich with Catalog if fields or costPrice missing
    let enriched = { ...lineInput };
    if (!enriched.productName || !enriched.categoryName || !enriched.categoryId || !enriched.costPrice || enriched.costPrice <= 0) {
      const catalogProd = await this.catalogClient.getProduct(lineInput.productId);
      if (catalogProd) {
        const prodCost = catalogProd.costPrice ? Number(catalogProd.costPrice) : 0;
        const prodBase = catalogProd.basePrice ? Number(catalogProd.basePrice) : 100;
        enriched = {
          ...enriched,
          productName: enriched.productName || catalogProd.name,
          categoryId: enriched.categoryId || catalogProd.categoryId,
          categoryName: enriched.categoryName || catalogProd.category?.name || 'General',
          unitPrice: enriched.unitPrice ?? prodBase,
          costPrice: (enriched.costPrice && enriched.costPrice > 0)
            ? enriched.costPrice
            : (prodCost > 0 ? prodCost : Math.round(prodBase * 0.65 * 100) / 100),
        };
      } else if (!enriched.costPrice || enriched.costPrice <= 0) {
        const fallbackPrice = enriched.unitPrice || 100;
        enriched.costPrice = Math.round(fallbackPrice * 0.65 * 100) / 100;
      }
    }

    await this.quotationRepo.addLine(id, enriched);
    await this.recomputeAndSaveRiskScore(id);
    return this.getQuotation(id);
  }

  async updateLine(id: string, lineId: string, input: UpdateLineInput) {
    const quotation = await this.getQuotation(id);
    if (quotation.status === QuotationStatus.CONFIRMED) {
      throw new QuotationDomainError(400, `Cannot update lines on confirmed quotation`);
    }

    await this.quotationRepo.updateLine(lineId, input);
    await this.recomputeAndSaveRiskScore(id);
    return this.getQuotation(id);
  }

  async removeLine(id: string, lineId: string) {
    const quotation = await this.getQuotation(id);
    if (quotation.status === QuotationStatus.CONFIRMED) {
      throw new QuotationDomainError(400, `Cannot remove lines from confirmed quotation`);
    }

    await this.quotationRepo.removeLine(lineId);
    await this.recomputeAndSaveRiskScore(id);
    return this.getQuotation(id);
  }

  async computeRiskScore(id: string): Promise<RiskScoreResult> {
    const quotation = await this.getQuotation(id);
    const ceilingsResponse = await this.catalogClient.getDiscountCeilings(quotation.companyId);

    const tier = quotation.customer.tier.toUpperCase();
    const tierCeiling = ceilingsResponse.tierCeilings[tier] ?? 15;

    const ceilingMap: CeilingMap = {
      tierCeiling,
      categoryCeilings: ceilingsResponse.categoryCeilings || {},
    };

    const riskInputs: LineRiskInput[] = quotation.lines.map((l: any) => ({
      lineId: l.id,
      categoryId: l.categoryId,
      discountPct: l.discountPct,
      quantity: l.quantity,
      lineTotal: Number(l.lineTotal),
    }));

    const totalOrderValue = Number(quotation.totalAmount);
    const riskResult = computeBlendedRiskScore(riskInputs, ceilingMap, totalOrderValue);

    return riskResult;
  }

  async recomputeAndSaveRiskScore(id: string): Promise<RiskScoreResult> {
    const riskResult = await this.computeRiskScore(id);
    await this.quotationRepo.update(id, {
      blendedRiskScore: riskResult.blendedScore,
    });
    return riskResult;
  }

  async submitForApproval(id: string, repId: string) {
    const quotation = await this.getQuotation(id);
    if (quotation.status !== QuotationStatus.DRAFT && quotation.status !== QuotationStatus.REJECTED) {
      throw new QuotationDomainError(400, `Cannot submit quotation with status ${quotation.status}. Must be DRAFT or REJECTED.`);
    }

    if (quotation.lines.length === 0) {
      throw new QuotationDomainError(400, 'Cannot submit quotation with no lines.');
    }

    const riskResult = await this.recomputeAndSaveRiskScore(id);

    let nextStatus: QuotationStatus;
    let approvalRequired = false;
    let requiredApprovers: string[] = [];

    if (riskResult.blendedScore === 0) {
      nextStatus = QuotationStatus.APPROVED;
      approvalRequired = false;
    } else {
      approvalRequired = true;
      const chain = await this.catalogClient.resolveApprovalChain(riskResult.blendedScore);
      requiredApprovers = chain.requiredRoles;
      nextStatus = QuotationStatus.PENDING_MANAGER_APPROVAL;
    }

    const previousStatus = quotation.status;
    const updated = await this.quotationRepo.update(id, {
      status: nextStatus,
    });

    await this.eventPublisher.publishQuotationStatusChanged({
      quotationId: id,
      customerId: quotation.customerId,
      companyId: quotation.companyId,
      previousStatus,
      newStatus: nextStatus,
      changedBy: repId,
      changedAt: new Date().toISOString(),
    });

    if (nextStatus === QuotationStatus.APPROVED) {
      await this.eventPublisher.publishQuotationApproved({
        quotationId: id,
        customerId: quotation.customerId,
        repId: quotation.repId,
        companyId: quotation.companyId,
        lines: quotation.lines,
        totalAmount: Number(quotation.totalAmount),
        currency: quotation.currency,
      });
    }

    return {
      id: updated!.id,
      status: updated!.status,
      blendedRiskScore: updated!.blendedRiskScore,
      approvalRequired,
      requiredApprovers,
      approvalLog: updated!.approvalLogs,
    };
  }

  async approve(
    id: string,
    approver: { id: string; name: string; role: string },
    reason?: string,
  ) {
    const quotation = await this.getQuotation(id);

    if (quotation.status === QuotationStatus.APPROVED) {
      return quotation;
    }

    if (
      quotation.status !== QuotationStatus.PENDING_MANAGER_APPROVAL &&
      quotation.status !== QuotationStatus.PENDING_FINANCE_APPROVAL &&
      quotation.status !== QuotationStatus.DRAFT
    ) {
      throw new QuotationDomainError(400, `Quotation is not pending approval (status: ${quotation.status})`);
    }

    const allowedRoles = ['ADMIN', 'SALES_MANAGER', 'FINANCE'];
    if (!allowedRoles.includes(approver.role)) {
      throw new QuotationDomainError(403, `Role ${approver.role} is not authorized to approve quotations`, 'INSUFFICIENT_ROLE');
    }

    // Role check depending on status
    if (quotation.status === QuotationStatus.PENDING_FINANCE_APPROVAL) {
      if (approver.role !== 'FINANCE' && approver.role !== 'ADMIN') {
        throw new QuotationDomainError(403, 'Quotation is waiting for FINANCE approval', 'INSUFFICIENT_ROLE');
      }
    }

    await this.approvalLogRepo.create({
      quotationId: id,
      approverId: approver.id,
      approverName: approver.name,
      approverRole: approver.role,
      action: ApprovalAction.APPROVE,
      reason: reason || null,
      riskScore: quotation.blendedRiskScore,
    });

    let nextStatus: QuotationStatus;
    const previousStatus = quotation.status;

    if (quotation.status === QuotationStatus.PENDING_MANAGER_APPROVAL || quotation.status === QuotationStatus.DRAFT) {
      // Check if Finance approval is also needed (score > 30)
      if (quotation.blendedRiskScore > 30 && approver.role !== 'ADMIN' && approver.role !== 'FINANCE') {
        nextStatus = QuotationStatus.PENDING_FINANCE_APPROVAL;
      } else {
        nextStatus = QuotationStatus.APPROVED;
      }
    } else {
      nextStatus = QuotationStatus.APPROVED;
    }

    const updated = await this.quotationRepo.update(id, {
      status: nextStatus,
    });

    await this.eventPublisher.publishQuotationStatusChanged({
      quotationId: id,
      customerId: quotation.customerId,
      companyId: quotation.companyId,
      previousStatus,
      newStatus: nextStatus,
      changedBy: approver.id,
      changedAt: new Date().toISOString(),
    });

    if (nextStatus === QuotationStatus.APPROVED) {
      await this.eventPublisher.publishQuotationApproved({
        quotationId: id,
        customerId: quotation.customerId,
        repId: quotation.repId,
        companyId: quotation.companyId,
        lines: quotation.lines,
        totalAmount: Number(quotation.totalAmount),
        currency: quotation.currency,
      });
    }

    return updated;
  }

  async reject(
    id: string,
    approver: { id: string; name: string; role: string },
    reason: string,
  ) {
    if (!reason || reason.trim() === '') {
      throw new QuotationDomainError(400, 'Rejection reason is required');
    }

    const quotation = await this.getQuotation(id);
    if (
      quotation.status !== QuotationStatus.PENDING_MANAGER_APPROVAL &&
      quotation.status !== QuotationStatus.PENDING_FINANCE_APPROVAL
    ) {
      throw new QuotationDomainError(400, `Quotation cannot be rejected in status ${quotation.status}`);
    }

    await this.approvalLogRepo.create({
      quotationId: id,
      approverId: approver.id,
      approverName: approver.name,
      approverRole: approver.role,
      action: ApprovalAction.REJECT,
      reason,
      riskScore: quotation.blendedRiskScore,
    });

    const previousStatus = quotation.status;
    const updated = await this.quotationRepo.update(id, {
      status: QuotationStatus.REJECTED,
    });

    await this.eventPublisher.publishQuotationStatusChanged({
      quotationId: id,
      customerId: quotation.customerId,
      companyId: quotation.companyId,
      previousStatus,
      newStatus: QuotationStatus.REJECTED,
      changedBy: approver.id,
      changedAt: new Date().toISOString(),
    });

    await this.eventPublisher.publishQuotationRejected({
      quotationId: id,
      customerId: quotation.customerId,
      repId: quotation.repId,
      companyId: quotation.companyId,
      reason,
    });

    return updated;
  }

  async returnForRevision(
    id: string,
    approver: { id: string; name: string; role: string },
    reason: string,
  ) {
    if (!reason || reason.trim() === '') {
      throw new QuotationDomainError(400, 'Revision reason is required');
    }

    const quotation = await this.getQuotation(id);
    if (
      quotation.status !== QuotationStatus.PENDING_MANAGER_APPROVAL &&
      quotation.status !== QuotationStatus.PENDING_FINANCE_APPROVAL
    ) {
      throw new QuotationDomainError(400, `Quotation cannot be returned for revision in status ${quotation.status}`);
    }

    await this.approvalLogRepo.create({
      quotationId: id,
      approverId: approver.id,
      approverName: approver.name,
      approverRole: approver.role,
      action: ApprovalAction.RETURN_FOR_REVISION,
      reason,
      riskScore: quotation.blendedRiskScore,
    });

    const previousStatus = quotation.status;
    const updated = await this.quotationRepo.update(id, {
      status: QuotationStatus.DRAFT,
    });

    await this.eventPublisher.publishQuotationStatusChanged({
      quotationId: id,
      customerId: quotation.customerId,
      companyId: quotation.companyId,
      previousStatus,
      newStatus: QuotationStatus.DRAFT,
      changedBy: approver.id,
      changedAt: new Date().toISOString(),
    });

    return updated;
  }

  async send(id: string, userId: string) {
    const quotation = await this.getQuotation(id);
    if (
      quotation.status !== QuotationStatus.APPROVED &&
      quotation.status !== QuotationStatus.DRAFT &&
      quotation.status !== QuotationStatus.SENT
    ) {
      throw new QuotationDomainError(400, `Cannot send quotation in status ${quotation.status}. Must be APPROVED or DRAFT.`);
    }

    const previousStatus = quotation.status;
    const updated = await this.quotationRepo.update(id, {
      status: QuotationStatus.SENT,
    });

    await this.eventPublisher.publishQuotationStatusChanged({
      quotationId: id,
      customerId: quotation.customerId,
      companyId: quotation.companyId,
      previousStatus,
      newStatus: QuotationStatus.SENT,
      changedBy: userId,
      changedAt: new Date().toISOString(),
    });

    return updated;
  }

  async confirm(id: string, userId: string, idempotencyKey?: string | null) {
    // REQ-IMP-006: Check idempotency key
    if (idempotencyKey) {
      const existingByKey = await this.quotationRepo.findByIdempotencyKey(idempotencyKey);
      if (existingByKey) {
        return existingByKey;
      }
    }

    const quotation = await this.getQuotation(id);

    // If already confirmed with same or no key, return idempotent success
    if (quotation.status === QuotationStatus.CONFIRMED) {
      return quotation;
    }

    if (
      quotation.status !== QuotationStatus.APPROVED &&
      quotation.status !== QuotationStatus.UNDER_NEGOTIATION
    ) {
      throw new QuotationDomainError(400, `Cannot confirm quotation in status ${quotation.status}. Must be APPROVED or UNDER_NEGOTIATION.`);
    }

    const confirmedAt = new Date();
    const previousStatus = quotation.status;

    const updated = await this.quotationRepo.update(id, {
      status: QuotationStatus.CONFIRMED,
      confirmedAt,
      idempotencyKey: idempotencyKey || null,
    });

    await this.eventPublisher.publishQuotationStatusChanged({
      quotationId: id,
      customerId: quotation.customerId,
      companyId: quotation.companyId,
      previousStatus,
      newStatus: QuotationStatus.CONFIRMED,
      changedBy: userId,
      changedAt: confirmedAt.toISOString(),
    });

    await this.eventPublisher.publishQuotationConfirmed({
      quotationId: id,
      customerId: quotation.customerId,
      repId: quotation.repId,
      companyId: quotation.companyId,
      idempotencyKey: idempotencyKey || null,
      lines: quotation.lines,
      totalAmount: Number(quotation.totalAmount),
      currency: quotation.currency,
      confirmedAt: confirmedAt.toISOString(),
    });

    return updated;
  }

  async markLost(id: string, userId: string) {
    const quotation = await this.getQuotation(id);
    if (quotation.status === QuotationStatus.CONFIRMED) {
      throw new QuotationDomainError(400, 'Cannot mark confirmed quotation as LOST');
    }

    const previousStatus = quotation.status;
    const updated = await this.quotationRepo.update(id, {
      status: QuotationStatus.LOST,
    });

    await this.eventPublisher.publishQuotationStatusChanged({
      quotationId: id,
      customerId: quotation.customerId,
      companyId: quotation.companyId,
      previousStatus,
      newStatus: QuotationStatus.LOST,
      changedBy: userId,
      changedAt: new Date().toISOString(),
    });

    return updated;
  }

  async portalNegotiate(
    id: string,
    customerId: string,
    input: {
      message?: string;
      proposedDiscount?: number;
      lineComments?: Record<string, string>;
    },
  ) {
    const quotation = await this.getQuotation(id);
    if (quotation.customerId !== customerId) {
      throw new QuotationDomainError(403, 'Customer does not own this quotation', 'FORBIDDEN');
    }

    if (quotation.status !== QuotationStatus.SENT && quotation.status !== QuotationStatus.UNDER_NEGOTIATION) {
      throw new QuotationDomainError(400, `Cannot negotiate quotation in status ${quotation.status}`);
    }

    const negotiation = await this.negotiationRepo.create({
      quotationId: id,
      customerId,
      message: input.message,
      proposedDiscount: input.proposedDiscount,
      lineComments: input.lineComments,
    });

    let reEnteredApproval = false;
    let nextStatus: QuotationStatus = QuotationStatus.UNDER_NEGOTIATION;

    if (input.proposedDiscount !== undefined && input.proposedDiscount > 0) {
      // Re-evaluate risk with proposed discount across lines or average
      const ceilingsResponse = await this.catalogClient.getDiscountCeilings(quotation.companyId);
      const tierCeiling = ceilingsResponse.tierCeilings[quotation.customer.tier.toUpperCase()] ?? 15;

      const riskInputs: LineRiskInput[] = quotation.lines.map((l: any) => ({
        lineId: l.id,
        categoryId: l.categoryId,
        discountPct: Math.max(l.discountPct, input.proposedDiscount!),
        quantity: l.quantity,
        lineTotal: Number(l.lineTotal),
      }));

      const newRisk = computeBlendedRiskScore(
        riskInputs,
        { tierCeiling, categoryCeilings: ceilingsResponse.categoryCeilings || {} },
        Number(quotation.totalAmount),
      );

      // If new risk score exceeds threshold (REQ-BR-008, CHECK-QUOT-004)
      if (newRisk.blendedScore > 0) {
        nextStatus = QuotationStatus.PENDING_MANAGER_APPROVAL;
        reEnteredApproval = true;
      }
    }

    const previousStatus = quotation.status;
    const updated = await this.quotationRepo.update(id, {
      status: nextStatus,
    });

    await this.eventPublisher.publishNegotiationReceived({
      quotationId: id,
      customerId,
      companyId: quotation.companyId,
      proposedDiscount: input.proposedDiscount,
      message: input.message,
    });

    if (previousStatus !== nextStatus) {
      await this.eventPublisher.publishQuotationStatusChanged({
        quotationId: id,
        customerId,
        companyId: quotation.companyId,
        previousStatus,
        newStatus: nextStatus,
        changedBy: customerId,
        changedAt: new Date().toISOString(),
      });
    }

    return {
      id: updated!.id,
      status: updated!.status,
      negotiationId: negotiation.id,
      reEnteredApproval,
      message: reEnteredApproval
        ? 'The requested discount requires additional approval. We will notify you once reviewed.'
        : 'Your request has been submitted. The sales team will review and respond.',
    };
  }

  async portalConfirm(id: string, customerId: string, idempotencyKey?: string | null) {
    const quotation = await this.getQuotation(id);
    if (quotation.customerId !== customerId) {
      throw new QuotationDomainError(403, 'Customer does not own this quotation', 'FORBIDDEN');
    }

    return this.confirm(id, customerId, idempotencyKey);
  }

  async getUpsellSuggestions(id: string) {
    const quotation = await this.getQuotation(id);
    const productIds = quotation.lines.map((l: any) => l.productId);
    return this.catalogClient.getUpsellSuggestions(productIds, quotation.totalMarginPct);
  }

  async getPipeline(companyId: string, repId?: string) {
    return this.quotationRepo.getPipeline(companyId, repId);
  }
}
