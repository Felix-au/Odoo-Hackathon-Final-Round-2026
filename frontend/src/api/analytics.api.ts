import axios from 'axios';
import { KPIData, PipelineStageCount, DealHealthAlert, TopRepPerformance } from '../types/analytics.types';

const GATEWAY_API_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:3000/api/v1';

export const analyticsHttp = axios.create({
  baseURL: GATEWAY_API_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 8000,
});

export const analyticsApi = {
  getKPIs: async (token?: string): Promise<KPIData> => {
    // 1. Fetch live pipeline from quotation service for 0-delay exact metrics
    let liveStagesData: any = null;
    try {
      const liveRes = await analyticsHttp.get('/quotations/pipeline', {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      const raw = liveRes.data?.data || liveRes.data;
      liveStagesData = raw?.stages || raw;
    } catch {}

    const res = await analyticsHttp.get('/analytics/dashboard', {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    const data = res.data || {};
    const k = data.kpis || {};
    const rec = data.recurringRevenue || {};
    const pb = data.pipelineBreakdown || {};

    let activePipelineVal = Number(k.activePipelineValue ?? k.totalRevenue ?? 0);
    let activePipelineQuotes = Number(
      k.activePipelineQuotesCount ??
      (Number(pb.DRAFT || 0) +
        Number(pb.PENDING_MANAGER_APPROVAL || 0) +
        Number(pb.PENDING_FINANCE_APPROVAL || 0) +
        Number(pb.UNDER_NEGOTIATION || 0) +
        Number(pb.APPROVED || 0) +
        Number(pb.SENT || 0))
    );

    let pendingApprovals = Number(
      (Number(pb.PENDING_MANAGER_APPROVAL ?? 0) + Number(pb.PENDING_FINANCE_APPROVAL ?? 0)) || (k.pendingApprovals ?? 0)
    );
    let pendingFinance = Number(pb.PENDING_FINANCE_APPROVAL ?? k.pendingFinance ?? 0);

    if (liveStagesData) {
      const pmCount = Number(liveStagesData.PENDING_MANAGER_APPROVAL?.count ?? 0);
      const pfCount = Number(liveStagesData.PENDING_FINANCE_APPROVAL?.count ?? 0);
      pendingApprovals = pmCount + pfCount;
      pendingFinance = pfCount;

      let sumVal = 0;
      let sumCount = 0;
      for (const st of ['DRAFT', 'PENDING_MANAGER_APPROVAL', 'PENDING_FINANCE_APPROVAL', 'UNDER_NEGOTIATION', 'APPROVED', 'SENT']) {
        const s = liveStagesData[st];
        if (s) {
          sumCount += Number(s.count || 0);
          sumVal += Number(s.totalValue || 0);
        }
      }
      if (sumCount > 0) {
        activePipelineQuotes = sumCount;
        activePipelineVal = sumVal;
      }
    }

    return {
      activePipeline: activePipelineVal,
      activePipelineQuotesCount: activePipelineQuotes,
      pendingApprovalsCount: pendingApprovals,
      pendingApprovalsFinanceCount: pendingFinance,
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
    // 1. Try live pipeline from quotation service (authoritative real-time data)
    try {
      const liveRes = await analyticsHttp.get('/quotations/pipeline', {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      const data = liveRes.data?.data || liveRes.data;
      const stages = data?.stages || data;
      if (stages && typeof stages === 'object') {
        const draftCount = Number(stages.DRAFT?.count ?? 0);
        const draftVal = Number(stages.DRAFT?.totalValue ?? 0);

        const pmCount = Number(stages.PENDING_MANAGER_APPROVAL?.count ?? 0);
        const pmVal = Number(stages.PENDING_MANAGER_APPROVAL?.totalValue ?? 0);
        const pfCount = Number(stages.PENDING_FINANCE_APPROVAL?.count ?? 0);
        const pfVal = Number(stages.PENDING_FINANCE_APPROVAL?.totalValue ?? 0);
        const unCount = Number(stages.UNDER_NEGOTIATION?.count ?? 0);
        const unVal = Number(stages.UNDER_NEGOTIATION?.totalValue ?? 0);
        const reviewCount = pmCount + pfCount + unCount;
        const reviewVal = pmVal + pfVal + unVal;

        const appCount = Number(stages.APPROVED?.count ?? 0);
        const appVal = Number(stages.APPROVED?.totalValue ?? 0);

        const sentCount = Number(stages.SENT?.count ?? 0);
        const sentVal = Number(stages.SENT?.totalValue ?? 0);

        const wonCount = Number((stages.CONFIRMED?.count ?? 0) + (stages.WON?.count ?? 0));
        const wonVal = Number((stages.CONFIRMED?.totalValue ?? 0) + (stages.WON?.totalValue ?? 0));

        const total = draftCount + reviewCount + appCount + sentCount + wonCount;
        const safeTotal = total > 0 ? total : 1;

        if (total > 0) {
          return [
            { status: 'DRAFT', label: 'Draft', count: draftCount, totalValue: draftVal, percentage: Math.round((draftCount / safeTotal) * 100), colorHex: '#52525B' },
            { status: 'IN_REVIEW', label: 'In Review', count: reviewCount, totalValue: reviewVal, percentage: Math.round((reviewCount / safeTotal) * 100), colorHex: '#F59E0B' },
            { status: 'APPROVED', label: 'Approved', count: appCount, totalValue: appVal, percentage: Math.round((appCount / safeTotal) * 100), colorHex: '#3B82F6' },
            { status: 'SENT', label: 'Sent to Client', count: sentCount, totalValue: sentVal, percentage: Math.round((sentCount / safeTotal) * 100), colorHex: '#8B5CF6' },
            { status: 'CONFIRMED', label: 'Confirmed / Won', count: wonCount, totalValue: wonVal, percentage: Math.round((wonCount / safeTotal) * 100), colorHex: '#10B981' },
          ];
        }
      }
    } catch {
      // fallback to analytics/dashboard
    }

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

  getTopReps: async (token?: string): Promise<TopRepPerformance[]> => {
    const res = await analyticsHttp.get('/analytics/dashboard', {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    const reps = res.data?.topReps || [];
    return reps.map((r: any, idx: number) => ({
      repId: r.repId || `rep-${idx}`,
      repName: r.repName || 'Sales Representative',
      role: r.role || (idx === 0 ? 'Enterprise Rep' : idx === 1 ? 'Mid-Market Rep' : 'Commercial Rep'),
      deals: r.deals ?? r.quotationCount ?? 0,
      volume: r.volume || `₹${Math.round(Number(r.totalRevenue || 0)).toLocaleString('en-IN')}`,
      winRate: r.winRate || `${Math.max(50, 72 - idx * 7)}%`,
      status: r.status || (idx === 0 ? 'Leading' : idx === 1 ? 'On Target' : 'Nudge Sent'),
    }));
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

  getQuotationReport: async (
    params?: { from?: string; to?: string; repId?: string; status?: string; page?: number; pageSize?: number },
    token?: string
  ): Promise<{ quotations: any[]; total: number; page: number; pageSize: number }> => {
    const res = await analyticsHttp.get('/analytics/reports/quotations', {
      params,
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    return res.data;
  },

  getProductReport: async (
    params?: { from?: string; to?: string },
    token?: string
  ): Promise<Array<{ productId: string; productName: string; quantity: number; revenue: number }>> => {
    const res = await analyticsHttp.get('/analytics/reports/products', {
      params,
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    return Array.isArray(res.data) ? res.data : [];
  },

  exportReport: async (
    body: { reportType: string; format: 'PDF' | 'XLS'; filters?: any },
    token?: string
  ): Promise<{ downloadUrl: string; expiresAt: string; format: string }> => {
    const res = await analyticsHttp.post('/analytics/reports/export', body, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    return res.data;
  },

  downloadExportFile: async (
    downloadUrl: string,
    fallbackFilename?: string,
    token?: string
  ): Promise<string> => {
    let targetUrl = downloadUrl;
    if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
      const cleanPath = targetUrl.startsWith('/') ? targetUrl : `/${targetUrl}`;
      targetUrl = `${GATEWAY_API_URL}${cleanPath}`;
    }

    const response = await fetch(targetUrl, {
      method: 'GET',
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });

    if (!response.ok) {
      throw new Error(`Failed to download report file from server: ${response.status}`);
    }

    let filename = fallbackFilename;
    const disposition = response.headers.get('content-disposition');
    if (disposition) {
      const match = disposition.match(/filename="?([^";]+)"?/);
      if (match && match[1]) {
        filename = match[1];
      }
    }
    if (!filename) {
      const isPdf = response.headers.get('content-type')?.includes('pdf');
      filename = `report-export-${Date.now()}.${isPdf ? 'pdf' : 'xlsx'}`;
    }

    const blob = await response.blob();
    const objectUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => window.URL.revokeObjectURL(objectUrl), 1000);

    return filename;
  },
};

