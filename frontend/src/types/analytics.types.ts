export interface KPIData {
  totalRevenue: number;
  revenueChangePct: number;
  quotationCount: number;
  quotationCountChangePct: number;
  averageMarginPct: number;
  averageMarginChangePct: number;
  pendingApprovalsCount: number;
  pendingApprovalsChangePct: number;
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
  type: 'STALLED' | 'ANOMALY' | 'SLIPPAGE';
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  title: string;
  description: string;
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
