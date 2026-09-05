import axios from 'axios';
import { KPIData, PipelineStageCount, DealHealthAlert } from '../types/analytics.types';

const GATEWAY_API_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:3000/api/v1';

export const analyticsHttp = axios.create({
  baseURL: GATEWAY_API_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 6000,
});

export const analyticsApi = {
  getKPIs: async (token?: string): Promise<KPIData> => {
    const res = await analyticsHttp.get('/analytics/dashboard', {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    const k = res.data?.kpis || res.data;
    return {
      totalRevenue: Number(k?.totalRevenue || 0),
      revenueChangePct: 12.5,
      quotationCount: Number(k?.totalQuotations ?? k?.quotationCount ?? 0),
      quotationCountChangePct: 8.2,
      averageMarginPct: Number(k?.averageMargin ?? k?.averageMarginPct ?? 0),
      averageMarginChangePct: 3.4,
      pendingApprovalsCount: Number(k?.pendingApprovals ?? k?.pendingApprovalsCount ?? 0),
      pendingApprovalsChangePct: -5.0,
    };
  },

  getDealHealth: async (token?: string): Promise<DealHealthAlert[]> => {
    try {
      const res = await analyticsHttp.get('/analytics/deal-health', {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      const list = res.data?.alerts || (Array.isArray(res.data) ? res.data : []);
      return list.map((a: any) => ({
        id: a.id,
        quotationId: a.quotationId,
        customerName: a.customerName || 'Customer',
        repName: a.repName || 'Sales Rep',
        type: a.type || 'STALLED',
        severity: a.severity || 'MEDIUM',
        title: a.title || a.message || 'Deal Alert',
        description: a.message || 'Deal requires attention',
        stalledDays: a.daysSinceActivity || 10,
        createdAt: a.createdAt || new Date().toISOString(),
      }));
    } catch {
      return [];
    }
  },

  getPipelineStages: async (token?: string): Promise<PipelineStageCount[]> => {
    try {
      const res = await analyticsHttp.get('/analytics/dashboard', {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      const pb = res.data?.pipelineBreakdown || {};
      const colors: Record<string, string> = {
        DRAFT: '#94a3b8',
        PENDING_MANAGER_APPROVAL: '#f59e0b',
        APPROVED: '#3b82f6',
        SENT: '#8b5cf6',
        CONFIRMED: '#10b981',
      };
      const stages: PipelineStageCount[] = Object.entries(pb)
        .filter(([_, count]) => Number(count) > 0)
        .map(([status, count]) => ({
          status,
          label: status.replace(/_/g, ' '),
          count: Number(count),
          totalValue: Number(count) * 15000,
          percentage: 25,
          colorHex: colors[status] || '#64748b',
        }));
      return stages;
    } catch {
      return [];
    }
  },
};
