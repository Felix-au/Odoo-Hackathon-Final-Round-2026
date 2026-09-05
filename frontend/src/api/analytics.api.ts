import axios from 'axios';
import { KPIData, PipelineStageCount, DealHealthAlert } from '../types/analytics.types';

const GATEWAY_API_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:3000/api/v1';

export const analyticsHttp = axios.create({
  baseURL: GATEWAY_API_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 8000,
});

export const analyticsApi = {
  getKPIs: async (token?: string): Promise<KPIData> => {
    const res = await analyticsHttp.get('/analytics/dashboard', {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    const data = res.data || {};
    const k = data.kpis || {};
    const rec = data.recurringRevenue || {};
    const pb = data.pipelineBreakdown || {};

    // Active pipeline = sum of quote totals for all non-terminal statuses
    const activePipelineQuotes =
      Number(pb.DRAFT || 0) +
      Number(pb.PENDING_MANAGER_APPROVAL || 0) +
      Number(pb.PENDING_FINANCE_APPROVAL || 0) +
      Number(pb.SENT || 0);

    return {
      activePipeline: Number(k.totalRevenue || 0),
      activePipelineQuotesCount: activePipelineQuotes,
      pendingApprovalsCount: Number(k.pendingApprovals ?? pb.PENDING_MANAGER_APPROVAL ?? 0),
      pendingApprovalsFinanceCount: Number(pb.PENDING_FINANCE_APPROVAL ?? 0),
      atRiskDealsCount: Number(data.atRiskCount ?? 0),
      atRiskNewTodayCount: Number(data.atRiskNewToday ?? 0),
      recurringRevenueMRR: Number(rec.mrr || 0),
      nextRenewalText: rec.nextRenewalText || '',
      totalRevenue: Number(k.totalRevenue || 0),
      revenueChangePct: Number(k.revenueChangePct || 0),
      quotationCount: Number(k.totalQuotations || 0),
      averageMarginPct: Number(k.averageMargin || 0),
    };
  },

  getDealHealth: async (token?: string): Promise<DealHealthAlert[]> => {
    const res = await analyticsHttp.get('/analytics/deal-health', {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    const list = res.data?.alerts || (Array.isArray(res.data) ? res.data : []);
    return list.map((a: any) => ({
      id: a.id,
      quotationId: a.quotationId,
      customerName: a.customerName,
      repName: a.repName,
      type: a.type,
      severity: a.severity,
      title: a.title || a.message,
      description: a.message || a.description,
      actionRequired: a.actionRequired,
      isEscalated: a.isEscalated ?? false,
      stalledDays: a.daysSinceActivity ?? a.stalledDays ?? 0,
      createdAt: a.createdAt,
    }));
  },

  getPipelineStages: async (token?: string): Promise<PipelineStageCount[]> => {
    const res = await analyticsHttp.get('/analytics/dashboard', {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    const pb = res.data?.pipelineBreakdown ?? {};
    return [
      { status: 'DRAFT', label: 'Draft', count: Number(pb.DRAFT ?? 0), totalValue: 0, percentage: 0, colorHex: '#94a3b8' },
      { status: 'REVIEW', label: 'Review', count: Number(pb.PENDING_MANAGER_APPROVAL ?? 0), totalValue: 0, percentage: 0, colorHex: '#f59e0b' },
      { status: 'APPROVAL', label: 'Approval', count: Number(pb.PENDING_FINANCE_APPROVAL ?? 0), totalValue: 0, percentage: 0, colorHex: '#3b82f6' },
      { status: 'WON', label: 'Won', count: Number(pb.CONFIRMED ?? pb.WON ?? 0), totalValue: 0, percentage: 0, colorHex: '#10b981' },
    ];
  },

  // Nudge a deal-health alert via email
  triggerNudge: async (alertId: string, type: 'EMAIL_NUDGE' | 'ESCALATION' = 'EMAIL_NUDGE', message: string, token?: string) => {
    return analyticsHttp.post(
      `/analytics/deal-health/alerts/${alertId}/nudge`,
      { type, message },
      { headers: token ? { Authorization: `Bearer ${token}` } : undefined }
    );
  },

  // Escalate a deal-health alert
  triggerEscalate: async (alertId: string, message: string, token?: string) => {
    return analyticsHttp.post(
      `/analytics/deal-health/alerts/${alertId}/escalate`,
      { type: 'ESCALATION', message },
      { headers: token ? { Authorization: `Bearer ${token}` } : undefined }
    );
  },

  // Resolve a deal-health alert
  resolveAlert: async (alertId: string, reason = 'Resolved from dashboard', token?: string) => {
    return analyticsHttp.post(
      `/analytics/deal-health/alerts/${alertId}/resolve`,
      { reason },
      { headers: token ? { Authorization: `Bearer ${token}` } : undefined }
    );
  },
};
