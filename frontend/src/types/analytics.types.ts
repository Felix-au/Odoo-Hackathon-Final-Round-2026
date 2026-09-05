export interface KPIData {
  activePipeline: number;
  activePipelineQuotesCount: number;
  pendingApprovalsCount: number;
  pendingApprovalsFinanceCount: number;
  atRiskDealsCount: number;
  atRiskNewTodayCount: number;
  recurringRevenueMRR: number;
  nextRenewalText: string;
  totalRevenue: number;
  revenueChangePct: number;
  quotationCount: number;
  averageMarginPct: number;
}

export interface PipelineStageCount {
  status: string;
  label: string;
  count: number;
  totalValue: number;
  percentage: number;
  colorHex: string;
}

export interface DealHealthAlert {
  id: string;
  quotationId: string;
  customerName: string;
  repName: string;
  type: 'STALLED' | 'ANOMALY' | 'SLIPPAGE' | 'DISCOUNT_RISK';
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  title: string;
  description: string;
  actionRequired?: string;
  isEscalated?: boolean;
  stalledDays?: number;
  createdAt: string;
}

export interface ReportFilter {
  period: 'TODAY' | 'THIS_WEEK' | 'THIS_MONTH' | 'CUSTOM';
  from?: string;
  to?: string;
  repId?: string;
  status?: string;
}

export interface TopRepPerformance {
  repId: string;
  repName: string;
  role: string;
  deals: number;
  volume: string;
  winRate: string;
  status: string;
}

