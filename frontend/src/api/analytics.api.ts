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
    const activePipelineQuotes = Number(
      k.activePipelineQuotesCount ??
      (Number(pb.DRAFT || 0) +
        Number(pb.PENDING_MANAGER_APPROVAL || 0) +
        Number(pb.PENDING_FINANCE_APPROVAL || 0) +
        Number(pb.APPROVED || 0) +
        Number(pb.SENT || 0))
    );

    return {
      activePipeline: Number(k.activePipelineValue ?? k.totalRevenue ?? 0),
      activePipelineQuotesCount: activePipelineQuotes,
      pendingApprovalsCount: Number(k.pendingApprovals ?? pb.PENDING_MANAGER_APPROVAL ?? 0),
      pendingApprovalsFinanceCount: Number(pb.PENDING_FINANCE_APPROVAL ?? 0),
      atRiskDealsCount: Number(data.atRiskCount ?? 0),
      atRiskNewTodayCount: Number(data.atRiskNewToday ?? 0),
      recurringRevenueMRR: Number(rec.mrr || 0),
      nextRenewalText: rec.nextRenewalText || 'Next renewal: 10 Sept',
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
    const draft = Number(pb.DRAFT ?? 0);
    const review = Number((pb.PENDING_MANAGER_APPROVAL ?? 0) + (pb.PENDING_FINANCE_APPROVAL ?? 0) + (pb.UNDER_NEGOTIATION ?? 0));
    const approved = Number(pb.APPROVED ?? 0);
    const sent = Number(pb.SENT ?? 0);
    const won = Number((pb.CONFIRMED ?? 0) + (pb.WON ?? 0));
    const total = draft + review + approved + sent + won || 1;

    return [
      { status: 'DRAFT', label: 'Draft', count: draft, totalValue: 0, percentage: Math.round((draft / total) * 100), colorHex: '#52525B' },
      { status: 'IN_REVIEW', label: 'In Review', count: review, totalValue: 0, percentage: Math.round((review / total) * 100), colorHex: '#F59E0B' },
      { status: 'APPROVED', label: 'Approved', count: approved, totalValue: 0, percentage: Math.round((approved / total) * 100), colorHex: '#3B82F6' },
      { status: 'SENT', label: 'Sent to Client', count: sent, totalValue: 0, percentage: Math.round((sent / total) * 100), colorHex: '#8B5CF6' },
      { status: 'CONFIRMED', label: 'Confirmed / Won', count: won, totalValue: 0, percentage: Math.round((won / total) * 100), colorHex: '#10B981' },
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
