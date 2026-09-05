import { AnalyticsRepository, QuotationReportFilters } from '../../db/repositories/analytics.repository';
import { DealHealthRepository } from '../../db/repositories/deal-health.repository';
import {
  mean,
  standardDeviation,
  calculateStalledSeverity,
  isDiscountAnomaly,
  daysBetween,
} from './deal-health.service';
import { EmailSender } from '../../integrations/email.sender';
import { ReportExportService } from './report-export.service';
import { PrismaClient } from '@prisma/client';

export class AnalyticsDomainError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly errorCode: string = 'ANALYTICS_ERROR',
  ) {
    super(message);
    this.name = 'AnalyticsDomainError';
  }
}

export class AnalyticsService {
  constructor(
    private readonly analyticsRepo: AnalyticsRepository,
    private readonly dealHealthRepo: DealHealthRepository,
    private readonly emailSender: EmailSender,
    private readonly exportService: ReportExportService,
    private readonly prisma: PrismaClient,
  ) {}

  // ─── Deal Health ──────────────────────────────────────────────────────────

  /**
   * Run deal health checks for a company:
   * 1. Detect stalled deals (REQ-F-150, REQ-BR-014, CHECK-ANA-002)
   * 2. Detect discount anomalies per rep (REQ-F-151, REQ-BR-015, CHECK-ANA-003)
   */
  async runDealHealthCheck(companyId = 'default') {
    const config = await this.dealHealthRepo.getConfig(companyId);
    const now = new Date();
    const cutoffDate = new Date(now.getTime() - config.stallDaysThreshold * 24 * 60 * 60 * 1000);

    // 1. Detect Stalled Deals
    const activeQuotations = await this.prisma.quotationSnapshot.findMany({
      where: {
        companyId,
        status: {
          in: ['DRAFT', 'PENDING_MANAGER_APPROVAL', 'PENDING_FINANCE_APPROVAL', 'SENT', 'UNDER_NEGOTIATION'],
        },
        lastActivityAt: { lt: cutoffDate },
      },
    });

    const generatedAlerts = [];

    for (const q of activeQuotations) {
      const daysInactive = daysBetween(q.lastActivityAt, now);
      const severity = calculateStalledSeverity(daysInactive, config.stallDaysThreshold);

      const alert = await this.dealHealthRepo.upsertAlert({
        companyId,
        quotationId: q.id,
        type: 'STALLED',
        severity,
        message: `Quotation for ${q.customerName} has been inactive for ${daysInactive} days`,
      });
      generatedAlerts.push(alert);
    }

    // 2. Detect Discount Anomalies per Rep
    // Group past quotations by repId
    const repQuotations = await this.prisma.quotationSnapshot.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
    });

    const repMap: Record<string, typeof repQuotations> = {};
    for (const q of repQuotations) {
      if (!repMap[q.repId]) repMap[q.repId] = [];
      repMap[q.repId].push(q);
    }

    for (const [repId, quotes] of Object.entries(repMap)) {
      // Baseline history: past/closed quotations (or quotes other than draft/pending)
      const pastQuotes = quotes.filter(
        (q) => !['DRAFT', 'PENDING_MANAGER_APPROVAL', 'PENDING_FINANCE_APPROVAL'].includes(q.status),
      );
      const baselineQuotes = pastQuotes.length > 0 ? pastQuotes : quotes;

      const scores = baselineQuotes.map((q) => q.blendedRiskScore);
      const avg = mean(scores);
      const stdDev = standardDeviation(scores, avg);

      // Check active DRAFT or PENDING quotations for this rep
      const currentQuotes = quotes.filter((q) =>
        ['DRAFT', 'PENDING_MANAGER_APPROVAL', 'PENDING_FINANCE_APPROVAL'].includes(q.status),
      );

      for (const q of currentQuotes) {
        const check = isDiscountAnomaly(q.blendedRiskScore, avg, stdDev, config.anomalyStdDevFactor);
        if (check.isAnomaly) {
          const repName = q.repName;
          const alert = await this.dealHealthRepo.upsertAlert({
            companyId,
            quotationId: q.id,
            type: 'DISCOUNT_ANOMALY',
            severity: check.severity,
            message: `Rep ${repName}'s discount on this deal (score: ${q.blendedRiskScore.toFixed(1)}) is significantly above their average (avg: ${avg.toFixed(1)})`,
          });
          generatedAlerts.push(alert);
        }
      }
    }

    return generatedAlerts;
  }

  async getDealHealth(companyId = 'default') {
    const alerts = await this.dealHealthRepo.findAlerts(companyId, false);

    // Enrich alerts with quotation snapshots
    const enrichedAlerts = [];
    let stalledCount = 0;
    let anomalyCount = 0;
    let slippageCount = 0;

    for (const a of alerts) {
      if (a.type === 'STALLED') stalledCount++;
      if (a.type === 'DISCOUNT_ANOMALY') anomalyCount++;
      if (a.type === 'DELIVERY_SLIPPAGE') slippageCount++;

      const quotation = await this.prisma.quotationSnapshot.findUnique({
        where: { id: a.quotationId },
      });

      enrichedAlerts.push({
        id: a.id,
        quotationId: a.quotationId,
        type: a.type,
        severity: a.severity,
        message: a.message,
        customerName: quotation?.customerName ?? 'Unknown Customer',
        repName: quotation?.repName ?? 'Unknown Rep',
        quotationAmount: quotation ? Number(quotation.totalAmount).toFixed(2) : '0.00',
        daysSinceActivity: quotation ? daysBetween(quotation.lastActivityAt, new Date()) : 0,
        isResolved: a.isResolved,
        createdAt: a.createdAt.toISOString(),
      });
    }

    return {
      alerts: enrichedAlerts,
      summary: {
        stalledCount,
        anomalyCount,
        slippageCount,
      },
    };
  }

  async getDealHealthConfig(companyId = 'default') {
    return this.dealHealthRepo.getConfig(companyId);
  }

  async updateDealHealthConfig(
    companyId = 'default',
    data: {
      stallDaysThreshold?: number;
      anomalyStdDevFactor?: number;
      deliverySlippageDays?: number;
    },
  ) {
    return this.dealHealthRepo.updateConfig(companyId, data);
  }

  /**
   * REQ-F-154, REQ-BONUS-004, CHECK-ANA-005:
   * Nudge or escalation action from an alert.
   */
  async triggerNudge(
    alertId: string,
    type: 'EMAIL_NUDGE' | 'ESCALATION',
    message: string,
    triggeredBy: string,
  ) {
    const alert = await this.dealHealthRepo.findAlertById(alertId);
    if (!alert) {
      throw new AnalyticsDomainError(404, `Alert with ID ${alertId} not found`, 'NOT_FOUND');
    }

    const quotation = await this.prisma.quotationSnapshot.findUnique({
      where: { id: alert.quotationId },
    });

    const repEmail = quotation ? `${quotation.repName.toLowerCase().replace(/\s+/g, '.')}@dealflow360.dev` : 'rep@dealflow360.dev';
    const managerEmail = 'atharva.manager@dealflow360.com';
    const sentTo = type === 'ESCALATION' ? [managerEmail] : [repEmail];

    // 1. Record NudgeAction
    const nudge = await this.dealHealthRepo.createNudge({
      alertId,
      quotationId: alert.quotationId,
      triggeredBy,
      type,
      sentTo,
    });

    // 2. Dispatch Email via SMTP
    if (type === 'EMAIL_NUDGE') {
      await this.emailSender.sendNudgeEmail(sentTo, alert.quotationId, message);
    } else {
      await this.emailSender.sendEscalationEmail(sentTo, alert.quotationId, message);
    }

    return {
      nudgeId: nudge.id,
      alertId: alert.id,
      quotationId: alert.quotationId,
      type,
      sentTo,
      createdAt: nudge.createdAt.toISOString(),
    };
  }

  async resolveAlert(alertId: string) {
    const alert = await this.dealHealthRepo.findAlertById(alertId);
    if (!alert) {
      throw new AnalyticsDomainError(404, `Alert with ID ${alertId} not found`, 'NOT_FOUND');
    }
    return this.dealHealthRepo.resolveAlert(alertId);
  }

  // ─── Dashboard & Reports ──────────────────────────────────────────────────

  /**
   * REQ-F-060, REQ-RPT-001, CHECK-ANA-001:
   * Sales performance dashboard with KPIs and pipeline breakdown.
   */
  async getDashboard(companyId = 'default', fromDateStr?: string, toDateStr?: string) {
    const fromDate = fromDateStr ? new Date(fromDateStr) : undefined;
    const toDate = toDateStr ? new Date(toDateStr) : undefined;

    return this.analyticsRepo.getDashboardData(companyId, fromDate, toDate);
  }

  /**
   * REQ-F-062–065, CHECK-ANA-007:
   * Quotation performance report with period, rep, and status filters.
   */
  async getQuotationReport(companyId = 'default', filters: QuotationReportFilters) {
    return this.analyticsRepo.getQuotationReport(companyId, filters);
  }

  async getProductReport(companyId = 'default', filters: { from?: Date; to?: Date }) {
    return this.analyticsRepo.getProductReport(companyId, filters);
  }

  /**
   * REQ-F-061, REQ-RPT-007, CHECK-ANA-006:
   * Export PDF or XLS report.
   */
  async exportReport(
    reportType: string,
    format: 'PDF' | 'XLS',
    filters: QuotationReportFilters = {},
    companyId = 'default',
  ) {
    const result = await this.analyticsRepo.getQuotationReport(companyId, filters);
    const data = result.quotations.map((q) => ({
      ID: q.id,
      Customer: q.customerName,
      Rep: q.repName,
      Status: q.status,
      Amount: Number(q.totalAmount).toFixed(2),
      Margin: `${q.totalMarginPct.toFixed(1)}%`,
      Date: q.createdAt.toISOString().split('T')[0],
    }));

    let file;
    if (format === 'PDF') {
      file = await this.exportService.exportPdf(`${reportType.toUpperCase()} Report`, data);
    } else {
      file = await this.exportService.exportXls(`${reportType.toUpperCase()} Report`, data);
    }

    return {
      downloadUrl: `/analytics/reports/exports/${file.id}`,
      expiresAt: file.expiresAt.toISOString(),
      format,
    };
  }

  getExportFile(id: string) {
    return this.exportService.getFile(id);
  }
}
