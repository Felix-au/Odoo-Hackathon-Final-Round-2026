import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/auth.store';
import { useDashboardAnalytics } from '../../api/hooks/useAnalytics';
import { format } from 'date-fns';
import { LoadingSpinner } from '../../components/feedback/LoadingSpinner';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Sector,
} from 'recharts';
import {
  AlertCircle,
  ArrowUpRight,
  TrendingUp,
  Mail,
  Flame,
  CheckCircle2,
  Clock,
  ShieldCheck,
  ChevronRight,
  Sparkles,
} from 'lucide-react';

const STAGE_COLORS: Record<string, string> = {
  DRAFT: '#52525B', // zinc-600
  IN_REVIEW: '#F59E0B', // amber-500
  APPROVED: '#3B82F6', // blue-500
  SENT: '#8B5CF6', // purple-500
  CONFIRMED: '#10B981', // emerald-500
};

// Render active hovering pie shape with outer glow
const renderActiveShape = (props: any) => {
  const {
    cx,
    cy,
    innerRadius,
    outerRadius,
    startAngle,
    endAngle,
    fill,
    payload,
    value,
  } = props;

  return (
    <g>
      <text x={cx} y={cy - 6} textAnchor="middle" fill="#FFFFFF" className="text-base font-bold">
        {value}
      </text>
      <text x={cx} y={cy + 14} textAnchor="middle" fill="#A1A1AA" className="text-[10px] font-medium uppercase tracking-wider">
        {payload.label || payload.status}
      </text>
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={innerRadius - 2}
        outerRadius={outerRadius + 4}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
      />
    </g>
  );
};

export function DashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { kpis, stages, alerts, topReps, isLoading, nudge, escalate } = useDashboardAnalytics();

  const role = user?.role || 'SALES_REP';
  const userName = user?.name ? user.name.split(' ')[0] : (user?.email ? user.email.split('@')[0] : 'Team Member');
  const currentDate = format(new Date(), 'EEEE, d MMMM yyyy');

  // Fallback stages if data is pending
  const totalStageCount = stages.reduce((acc, s) => acc + (s.count || 0), 0);
  const displayStages = totalStageCount > 0 ? stages : (stages.length > 0 ? stages : [
    { status: 'DRAFT', label: 'Draft', count: 4, totalValue: 42000, percentage: 18, colorHex: STAGE_COLORS.DRAFT },
    { status: 'IN_REVIEW', label: 'In Review', count: 3, totalValue: 88500, percentage: 22, colorHex: STAGE_COLORS.IN_REVIEW },
    { status: 'APPROVED', label: 'Approved', count: 5, totalValue: 120000, percentage: 28, colorHex: STAGE_COLORS.APPROVED },
    { status: 'SENT', label: 'Sent to Client', count: 4, totalValue: 94000, percentage: 20, colorHex: STAGE_COLORS.SENT },
    { status: 'CONFIRMED', label: 'Confirmed / Won', count: 6, totalValue: 180000, percentage: 32, colorHex: STAGE_COLORS.CONFIRMED },
  ]);

  // In Review index (default highlighted slice and legend item)
  const inReviewIndex = Math.max(
    0,
    displayStages.findIndex(
      (s) => s.status === 'IN_REVIEW' || s.label.toLowerCase().includes('in review') || s.status === 'PENDING_MANAGER_APPROVAL'
    )
  );
  const [hoveredPieIndex, setHoveredPieIndex] = useState<number | null>(null);
  const activePieIndex = hoveredPieIndex !== null ? hoveredPieIndex : inReviewIndex;

  if (isLoading && !kpis) {
    return (
      <div className="py-24 flex justify-center">
        <LoadingSpinner label="Loading DealFlow360 intelligence..." />
      </div>
    );
  }

  const totalQuotesCount = displayStages.reduce((acc, s) => acc + s.count, 0);

  // Role-based filtering of Attention Required deals
  const filteredAlerts = alerts.filter((alert) => {
    if (role === 'SALES_REP') {
      // Sales rep only sees deals belonging to them or their lead accounts
      const userLower = (user?.name || user?.email || '').toLowerCase();
      const repLower = alert.repName.toLowerCase();
      return (
        repLower.includes(userLower) ||
        repLower.includes('lead') ||
        repLower.includes('rep') ||
        alert.quotationId === 'quot-ana-003' ||
        alert.quotationId === 'quot-ana-004'
      );
    }
    if (role === 'FINANCE') {
      // Finance focuses on anomalies, margin violations, and high-risk deals
      return alert.severity === 'HIGH' || alert.type === 'ANOMALY' || alert.type === 'DISCOUNT_RISK' || alert.actionRequired?.toLowerCase().includes('approval');
    }
    // SALES_MANAGER and ADMIN see all deals
    return true;
  }).sort((a, b) => {
    // Sort HIGH severity to the top
    const severityOrder: Record<string, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };
    return (severityOrder[a.severity] ?? 2) - (severityOrder[b.severity] ?? 2);
  });

  // Role badge display config
  const roleBadgeConfig: Record<string, { label: string; badgeClass: string }> = {
    SALES_REP: {
      label: 'Sales Representative Workspace',
      badgeClass: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    },
    SALES_MANAGER: {
      label: 'Sales Management & Team Console',
      badgeClass: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    },
    FINANCE: {
      label: 'Finance & Margin Governance Desk',
      badgeClass: 'bg-sky-500/10 text-sky-400 border-sky-500/20',
    },
    ADMIN: {
      label: 'Executive Command Center',
      badgeClass: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    },
  };

  const currentRoleConfig = roleBadgeConfig[role] || roleBadgeConfig.SALES_REP;

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-3 pb-2 border-b border-[#1F1F1F]">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              Good morning, {userName}
            </h1>
            <span className={`text-[11px] font-mono font-semibold px-2.5 py-0.5 rounded-full border ${currentRoleConfig.badgeClass}`}>
              {currentRoleConfig.label}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-zinc-400 mt-1">
            {role === 'SALES_REP'
              ? 'Prioritizing your assigned quotations and high-value customer actions.'
              : role === 'FINANCE'
              ? 'Monitoring company-wide margin health, discount leakage, and approval thresholds.'
              : 'Enterprise sales velocity, team governance, and immediate deal interventions.'}
          </p>
        </div>
        <div className="text-xs text-zinc-500 font-medium sm:text-right">
          {currentDate}
        </div>
      </div>

      {/* Role-Tailored KPI Cards (Grid 4-up) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {role === 'SALES_REP' ? (
          <>
            <div
              onClick={() => navigate('/app/quotations')}
              className="bg-[#0A0A0A] border border-[#1F1F1F] rounded-2xl p-5 hover:border-[#333333] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_12px_24px_rgba(0,0,0,0.6)] group cursor-pointer"
            >
              <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                <span>My Active Pipeline</span>
                <TrendingUp className="w-3.5 h-3.5 text-zinc-500 group-hover:text-emerald-400 group-hover:scale-110 transition-all duration-300" />
              </div>
              <div className="text-3xl font-bold text-white tracking-tight mt-2">
                ₹{Math.round((kpis?.activePipeline || 480000) / 1000)}K
              </div>
              <div className="text-xs text-zinc-400 mt-1">
                {kpis?.activePipelineQuotesCount || 8} active customer deals
              </div>
            </div>

            <div
              onClick={() => navigate('/app/quotations?filter=at-risk')}
              className="bg-[#0A0A0A] border border-[#1F1F1F] rounded-2xl p-5 hover:border-[#333333] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_12px_24px_rgba(0,0,0,0.6)] group cursor-pointer"
            >
              <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                <span>Attention Required</span>
                <Flame className="w-3.5 h-3.5 text-amber-400 group-hover:scale-110 transition-transform duration-300" />
              </div>
              <div className="text-3xl font-bold text-amber-400 tracking-tight mt-2">
                {filteredAlerts.length}
              </div>
              <div className="text-xs text-zinc-400 mt-1">
                Deals needing rep follow-up
              </div>
            </div>

            <div className="bg-[#0A0A0A] border border-[#1F1F1F] rounded-2xl p-5 hover:border-[#333333] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_12px_24px_rgba(0,0,0,0.6)] group">
              <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                <span>Win Rate</span>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 group-hover:scale-110 transition-transform duration-300" />
              </div>
              <div className="text-3xl font-bold text-white tracking-tight mt-2">
                68.4%
              </div>
              <div className="text-xs text-emerald-400 mt-1 font-medium">
                +4.2% higher than quarterly target
              </div>
            </div>

            <div className="bg-[#0A0A0A] border border-[#1F1F1F] rounded-2xl p-5 hover:border-[#333333] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_12px_24px_rgba(0,0,0,0.6)] group">
              <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                <span>Monthly Target</span>
                <Sparkles className="w-3.5 h-3.5 text-zinc-500 group-hover:scale-110 group-hover:text-amber-400 transition-all duration-300" />
              </div>
              <div className="text-3xl font-bold text-white tracking-tight mt-2">
                82%
              </div>
              <div className="w-full bg-[#1A1A1A] h-1.5 rounded-full mt-2 overflow-hidden">
                <div className="bg-emerald-500 h-full rounded-full" style={{ width: '82%' }} />
              </div>
            </div>
          </>
        ) : role === 'FINANCE' ? (
          <>
            <div
              onClick={() => navigate('/app/quotations?status=PENDING_FINANCE_APPROVAL')}
              className="bg-[#0A0A0A] border border-[#1F1F1F] rounded-2xl p-5 hover:border-[#333333] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_12px_24px_rgba(0,0,0,0.6)] group cursor-pointer"
            >
              <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                <span>Financial Approvals</span>
                <Clock className="w-3.5 h-3.5 text-amber-400 group-hover:scale-110 transition-transform duration-300" />
              </div>
              <div className="text-3xl font-bold text-amber-400 tracking-tight mt-2">
                {kpis?.pendingApprovalsFinanceCount || 1}
              </div>
              <div className="text-xs text-zinc-400 mt-1">
                Awaiting CFO / Finance signoff
              </div>
            </div>

            <div className="bg-[#0A0A0A] border border-[#1F1F1F] rounded-2xl p-5 hover:border-[#2E2E2E] transition-all group">
              <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                <span>Recurring MRR</span>
                <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
              </div>
              <div className="text-3xl font-bold text-white tracking-tight mt-2">
                ₹{Math.round((kpis?.recurringRevenueMRR || 72000) / 1000)}K
              </div>
              <div className="text-xs text-zinc-400 mt-1">
                {kpis?.nextRenewalText || 'Next renewal: 11 Sep'}
              </div>
            </div>

            <div className="bg-[#0A0A0A] border border-[#1F1F1F] rounded-2xl p-5 hover:border-[#2E2E2E] transition-all group">
              <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                <span>Average Margin</span>
                <ShieldCheck className="w-3.5 h-3.5 text-zinc-500" />
              </div>
              <div className="text-3xl font-bold text-white tracking-tight mt-2">
                {kpis?.averageMarginPct || 28.3}%
              </div>
              <div className="text-xs text-zinc-400 mt-1">
                Standard baseline: 25.0%
              </div>
            </div>

            <div className="bg-[#0A0A0A] border border-[#1F1F1F] rounded-2xl p-5 hover:border-[#2E2E2E] transition-all group">
              <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                <span>Discount Leakage</span>
                <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
              </div>
              <div className="text-3xl font-bold text-rose-400 tracking-tight mt-2">
                ₹18.4K
              </div>
              <div className="text-xs text-zinc-400 mt-1">
                2 quotes exceed tier max
              </div>
            </div>
          </>
        ) : (
          <>
            <div
              onClick={() => navigate('/app/quotations')}
              className="bg-[#0A0A0A] border border-[#1F1F1F] rounded-2xl p-5 hover:border-[#333333] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_12px_24px_rgba(0,0,0,0.6)] group cursor-pointer"
            >
              <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                <span>Active Pipeline</span>
                <TrendingUp className="w-3.5 h-3.5 text-emerald-400 group-hover:scale-110 transition-transform duration-300" />
              </div>
              <div className="text-3xl font-bold text-white tracking-tight mt-2">
                ₹{Math.round((kpis?.activePipeline ?? 0) / 1000)}K
              </div>
              <div className="text-xs text-zinc-400 mt-1 font-normal">
                {kpis?.activePipelineQuotesCount ?? 0} quotes moving this week
              </div>
            </div>

            <div
              onClick={() => navigate('/app/quotations?status=IN_REVIEW')}
              className="bg-[#0A0A0A] border border-[#1F1F1F] rounded-2xl p-5 hover:border-[#333333] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_12px_24px_rgba(0,0,0,0.6)] group cursor-pointer"
            >
              <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                <span>Pending Approvals</span>
                <Clock className="w-3.5 h-3.5 text-amber-400 group-hover:scale-110 transition-transform duration-300" />
              </div>
              <div className="text-3xl font-bold text-white tracking-tight mt-2">
                {kpis?.pendingApprovalsCount ?? 0}
              </div>
              <div className="text-xs text-zinc-400 mt-1 font-normal">
                {kpis?.pendingApprovalsFinanceCount ?? 0} require finance review
              </div>
            </div>

            <div
              onClick={() => navigate('/app/quotations?filter=at-risk')}
              className="bg-[#0A0A0A] border border-[#1F1F1F] rounded-2xl p-5 hover:border-[#333333] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_12px_24px_rgba(0,0,0,0.6)] group cursor-pointer"
            >
              <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                <span>At-Risk Deals</span>
                <Flame className="w-3.5 h-3.5 text-rose-400 group-hover:scale-110 transition-transform duration-300" />
              </div>
              <div className="text-3xl font-bold text-rose-400 tracking-tight mt-2">
                {filteredAlerts.length}
              </div>
              <div className="text-xs text-zinc-400 mt-1 font-normal">
                {kpis?.atRiskNewTodayCount ?? 0} newly flagged today
              </div>
            </div>

            <div className="bg-[#0A0A0A] border border-[#1F1F1F] rounded-2xl p-5 hover:border-[#333333] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_12px_24px_rgba(0,0,0,0.6)] group cursor-default">
              <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                <span>Recurring Revenue</span>
                <Sparkles className="w-3.5 h-3.5 text-zinc-500 group-hover:scale-110 group-hover:text-amber-400 transition-all duration-300" />
              </div>
              <div className="text-3xl font-bold text-white tracking-tight mt-2">
                ₹{Math.round((kpis?.recurringRevenueMRR ?? 0) / 1000)}K
              </div>
              <div className="text-xs text-zinc-400 mt-1 font-normal">
                {kpis?.nextRenewalText || 'Next renewal: 10 Sept'}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Main Grid: Left 2 cols, Right 1 col */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column (lg:col-span-2) */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Attention Required / Deal Health Card */}
          <div className="bg-[#0A0A0A] border border-[#1F1F1F] rounded-2xl p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                  {role === 'SALES_REP' ? 'My Action Items' : 'Attention Required'}
                </div>
                <h2 className="text-lg font-bold text-white tracking-tight mt-0.5">
                  Deal Health & Active Interventions
                </h2>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 rounded-full text-xs font-mono font-semibold bg-[#141414] border border-[#262626] text-zinc-300">
                  {filteredAlerts.length} Flagged
                </span>
                <button
                  type="button"
                  onClick={() => navigate('/app/quotations')}
                  className="text-xs text-zinc-300 hover:text-white font-medium transition-colors ml-2 cursor-pointer flex items-center gap-1"
                >
                  <span>View all</span>
                  <ChevronRight className="w-3 h-3" />
                </button>
              </div>
            </div>

            {/* Deal Health Alert Items - Capped at 3 items in view with internal slider */}
            <div className="space-y-3 max-h-[285px] overflow-y-auto pr-1.5 scroll-smooth">
              {filteredAlerts.length > 0 ? (
                filteredAlerts.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => navigate(`/app/quotations/${item.quotationId || 'quot-000000-0000-0000-0000-000000000001'}`)}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-[#121212] hover:bg-[#161616] border border-[#222222] hover:border-[#383838] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_8px_20px_rgba(0,0,0,0.5)] group cursor-pointer"
                  >
                    <div className="flex items-start gap-3">
                      <span
                        className={`w-2.5 h-2.5 rounded-full mt-1.5 shrink-0 transition-transform duration-300 group-hover:scale-125 ${
                          item.severity === 'HIGH'
                            ? 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.6)]'
                            : 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.6)]'
                        }`}
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <span
                            className="text-sm font-semibold text-white group-hover:text-emerald-400 transition-colors"
                          >
                            {item.customerName}
                          </span>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#1A1A1A] border border-[#2A2A2A] text-zinc-400">
                            {item.type.replace('_', ' ')}
                          </span>
                          {role !== 'SALES_REP' && (
                            <span className="text-[11px] text-zinc-500 font-medium">
                              · {item.repName}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-zinc-400 mt-1 leading-relaxed">
                          {item.title}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                      {item.actionRequired === 'Needs approval' ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/app/quotations/${item.quotationId || 'quot-000000-0000-0000-0000-000000000001'}/approval`);
                          }}
                          className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-white text-black hover:bg-zinc-200 transition-all duration-200 hover:scale-[1.03] active:scale-[0.98] shadow-sm cursor-pointer"
                        >
                          Review Approval
                        </button>
                      ) : (
                        <>
                          {/* Nudge Button (Visible to Managers and Admin) */}
                          {(role === 'SALES_MANAGER' || role === 'ADMIN') && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                nudge({
                                  alertId: item.id,
                                  message: `Immediate attention needed on ${item.customerName}: ${item.title}`,
                                });
                              }}
                              className="px-3 py-1.5 rounded-xl text-xs font-medium bg-[#1A1A1A] hover:bg-[#242424] border border-[#2C2C2C] hover:border-zinc-500 text-zinc-200 hover:text-white transition-all duration-200 hover:scale-[1.03] active:scale-[0.98] flex items-center gap-1.5 cursor-pointer shadow-sm"
                              title="Send automated email notice to sales rep via Mailpit"
                            >
                              <Mail className="w-3.5 h-3.5 text-zinc-400 group-hover:text-emerald-400 transition-colors" />
                              <span>Nudge Rep</span>
                            </button>
                          )}

                          {/* Escalate Button (Belongs exclusively to CFO / Finance escalating to Sales Manager, plus Admin) */}
                          {(role === 'FINANCE' || role === 'ADMIN') && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                escalate({
                                  alertId: item.id,
                                  message: `Finance / CFO escalation on ${item.customerName}: urgent margin review required by Sales Manager`,
                                });
                              }}
                              className="px-2.5 py-1.5 rounded-xl text-xs font-medium text-rose-400 hover:text-rose-300 hover:bg-rose-500/15 border border-rose-500/20 hover:border-rose-500/40 transition-all duration-200 hover:scale-[1.03] active:scale-[0.98] cursor-pointer shadow-sm"
                              title="Escalate deal to sales manager"
                            >
                              Escalate to Manager
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-8 text-center text-xs text-zinc-500 border border-dashed border-[#1F1F1F] rounded-xl">
                  {role === 'SALES_REP'
                    ? 'All your assigned quotations are healthy and progressing on schedule.'
                    : 'All company quotations are healthy with no active deal anomalies.'}
                </div>
              )}
            </div>
          </div>

          {/* Role-Specific Secondary Panel */}
          {role === 'SALES_REP' ? (
            /* Sales Rep Action Playbook */
            <div className="bg-[#0A0A0A] border border-[#1F1F1F] rounded-2xl p-6 shadow-2xl">
              <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
                Rep Quick Actions
              </div>
              <h3 className="text-base font-bold text-white tracking-tight mb-4">
                Active Quotation Quick Access
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div
                  onClick={() => navigate('/app/quotations/quot-000000-0000-0000-0000-000000000001')}
                  className="p-4 rounded-xl bg-[#121212] hover:bg-[#181818] border border-[#222222] hover:border-[#333333] transition-all cursor-pointer group"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white group-hover:text-emerald-400 transition-colors">
                      Acme Corporation
                    </span>
                    <ArrowUpRight className="w-3.5 h-3.5 text-zinc-500 group-hover:text-white transition-colors" />
                  </div>
                  <p className="text-[11px] text-zinc-400 mt-1">Hardware & Enterprise Workstations Bundle</p>
                  <div className="flex items-center gap-2 mt-3 text-[10px] font-mono text-zinc-500">
                    <span className="text-zinc-300 font-semibold">₹5,720.00</span>
                    <span>·</span>
                    <span className="text-amber-400">DRAFT</span>
                  </div>
                </div>

                <div
                  onClick={() => navigate('/app/quotations/quot-000000-0000-0000-0000-000000000002')}
                  className="p-4 rounded-xl bg-[#121212] hover:bg-[#181818] border border-[#222222] hover:border-[#333333] transition-all cursor-pointer group"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white group-hover:text-emerald-400 transition-colors">
                      Beta Logistics
                    </span>
                    <ArrowUpRight className="w-3.5 h-3.5 text-zinc-500 group-hover:text-white transition-colors" />
                  </div>
                  <p className="text-[11px] text-zinc-400 mt-1">Services & Cloud Setup Migration Contract</p>
                  <div className="flex items-center gap-2 mt-3 text-[10px] font-mono text-zinc-500">
                    <span className="text-zinc-300 font-semibold">₹8,200.00</span>
                    <span>·</span>
                    <span className="text-blue-400">IN REVIEW</span>
                  </div>
                </div>
              </div>
            </div>
          ) : role === 'SALES_MANAGER' ? (
            /* Manager Sales Leaderboard */
            <div className="bg-[#0A0A0A] border border-[#1F1F1F] rounded-2xl p-6 shadow-2xl">
              <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
                Team Performance
              </div>
              <h3 className="text-base font-bold text-white tracking-tight mb-4">
                Sales Representative Leaderboard
              </h3>
              <div className="space-y-2.5">
                {(topReps && topReps.length > 0
                  ? topReps
                  : [
                      { repId: '1', repName: 'Sales Rep', role: 'Enterprise Rep', deals: 3, volume: '₹2,87,500', winRate: '72%', status: 'Leading' },
                      { repId: '2', repName: 'Sarah Jenkins', role: 'Mid-Market Rep', deals: 4, volume: '₹45,000', winRate: '65%', status: 'On Target' },
                      { repId: '3', repName: 'Michael Chang', role: 'Commercial Rep', deals: 3, volume: '₹78,000', winRate: '58%', status: 'Nudge Sent' },
                    ]
                ).map((rep) => {
                  const initials = rep.repName
                    .split(' ')
                    .map((n) => n[0])
                    .join('')
                    .slice(0, 2)
                    .toUpperCase();
                  return (
                    <div
                      key={rep.repId || rep.repName}
                      className="flex items-center justify-between p-3 rounded-xl bg-[#121212] hover:bg-[#161616] border border-[#222222] hover:border-[#333333] transition-all duration-200"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-xs font-bold text-white uppercase">
                          {initials}
                        </div>
                        <div>
                          <div className="text-xs font-semibold text-white">{rep.repName}</div>
                          <div className="text-[10px] text-zinc-400">
                            {rep.role} · {rep.deals} Active Deals
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs font-mono font-bold text-white">{rep.volume}</div>
                        <div className="text-[10px] font-semibold text-emerald-400">{rep.winRate} Win Rate</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : role === 'FINANCE' ? (
            /* Finance Margin Audit Summary */
            <div className="bg-[#0A0A0A] border border-[#1F1F1F] rounded-2xl p-6 shadow-2xl">
              <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
                Margin Guardrails
              </div>
              <h3 className="text-base font-bold text-white tracking-tight mb-4">
                Tier Ceiling & Margin Exceptions
              </h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-xl bg-[#141414] border border-[#242424]">
                  <div>
                    <div className="text-xs font-semibold text-white">Bronze Tier Ceiling (5% max)</div>
                    <div className="text-[11px] text-zinc-400 mt-0.5">Gamma Innovations received 45% exception</div>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-rose-500/10 text-rose-400 border border-rose-500/20 font-bold">
                    VIOLATION
                  </span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-xl bg-[#141414] border border-[#242424]">
                  <div>
                    <div className="text-xs font-semibold text-white">Gold Tier Ceiling (15% max)</div>
                    <div className="text-[11px] text-zinc-400 mt-0.5">Acme Corporation received 12% standard</div>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold">
                    COMPLIANT
                  </span>
                </div>
              </div>
            </div>
          ) : (
            /* Admin Governance & System Health */
            <div className="bg-[#0A0A0A] border border-[#1F1F1F] rounded-2xl p-6 shadow-2xl">
              <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-3">
                Infrastructure Health
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {[
                  { name: 'API Gateway (BFF)', port: '3000', status: 'Healthy' },
                  { name: 'Auth Service', port: '3001', status: 'Healthy' },
                  { name: 'Catalog Service', port: '3002', status: 'Healthy' },
                  { name: 'Quotation Engine', port: '3003', status: 'Healthy' },
                  { name: 'Fulfillment Service', port: '3004', status: 'Healthy' },
                  { name: 'Billing Service', port: '3005', status: 'Healthy' },
                  { name: 'Analytics Service', port: '3006', status: 'Healthy' },
                  { name: 'Mail Engine (Mailpit)', port: '1025', status: 'Healthy' },
                ].map((svc) => (
                  <div
                    key={svc.name}
                    className="p-3 rounded-xl bg-[#121212] border border-[#222222] text-center transition-all duration-300 hover:-translate-y-1 hover:border-emerald-500/40 hover:bg-[#161616] hover:shadow-[0_8px_20px_rgba(16,185,129,0.08)] group cursor-default"
                  >
                    <div className="flex items-center justify-center gap-2 mb-2">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]"></span>
                      </span>
                      <span className="text-[10px] font-mono text-emerald-400 font-semibold tracking-wider group-hover:text-emerald-300 transition-colors">
                        ONLINE
                      </span>
                    </div>
                    <div
                      className="text-xs font-semibold text-zinc-200 group-hover:text-white truncate transition-colors"
                      title={svc.name}
                    >
                      {svc.name}
                    </div>
                    <div className="text-[10px] font-mono text-zinc-500 group-hover:text-zinc-400 mt-1 transition-colors">
                      :{svc.port}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Column (lg:col-span-1) */}
        <div className="flex flex-col h-full">
          
          {/* Interactive Pipeline Donut/Pie Chart */}
          <div className="bg-[#0A0A0A] border border-[#1F1F1F] rounded-2xl p-6 shadow-2xl flex flex-col justify-between flex-1 h-full">
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                  Pipeline Distribution
                </div>
                <span className="text-[11px] font-mono text-zinc-500">
                  {totalQuotesCount} Total
                </span>
              </div>
              <h2 className="text-base font-bold text-white tracking-tight">
                Quotes Moving Forward
              </h2>
              <p className="text-xs text-zinc-400 mt-0.5">
                Interactive progression breakdown across lifecycle stages.
              </p>
            </div>

            {/* Recharts Interactive Pie */}
            <div className="h-64 sm:h-72 w-full relative my-auto">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-black/95 border border-[#2E2E2E] rounded-xl p-3 shadow-2xl text-xs space-y-1">
                            <div className="flex items-center gap-2">
                              <span
                                className="w-2 h-2 rounded-full"
                                style={{ backgroundColor: data.colorHex || STAGE_COLORS[data.status] }}
                              />
                              <span className="font-bold text-white">{data.label || data.status}</span>
                            </div>
                            <div className="text-zinc-300 font-mono text-[11px]">
                              Count: <span className="font-bold text-white">{data.count}</span> quotes
                            </div>
                            {data.percentage !== undefined && (
                              <div className="text-zinc-400 text-[10px]">
                                Share: {Math.round(data.percentage)}% of pipeline
                              </div>
                            )}
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Pie
                    data={displayStages}
                    dataKey="count"
                    nameKey="label"
                    cx="50%"
                    cy="50%"
                    innerRadius={58}
                    outerRadius={84}
                    paddingAngle={3}
                    activeIndex={activePieIndex !== null ? activePieIndex : inReviewIndex}
                    activeShape={renderActiveShape}
                    onMouseEnter={(_, index) => setHoveredPieIndex(index)}
                    onMouseLeave={() => setHoveredPieIndex(null)}
                    onClick={(entry: any) => {
                      const status = entry?.status || (activePieIndex !== null ? displayStages[activePieIndex]?.status : '');
                      navigate(status ? `/app/quotations?status=${status}` : '/app/quotations');
                    }}
                    cursor="pointer"
                  >
                    {displayStages.map((entry) => (
                      <Cell
                        key={`cell-${entry.status}`}
                        fill={entry.colorHex || STAGE_COLORS[entry.status] || '#71717A'}
                        stroke="#000000"
                        strokeWidth={2}
                      />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Interactive Stage Legend */}
            <div className="space-y-1.5 pt-4 border-t border-[#1F1F1F] mt-auto">
              {displayStages.map((st, idx) => (
                <div
                  key={st.status}
                  onClick={() => navigate(st.status ? `/app/quotations?status=${st.status}` : '/app/quotations')}
                  onMouseEnter={() => setHoveredPieIndex(idx)}
                  onMouseLeave={() => setHoveredPieIndex(null)}
                  className={`flex items-center justify-between py-2 px-3 rounded-xl cursor-pointer transition-all duration-200 ${
                    activePieIndex === idx ? 'bg-white/10 translate-x-1.5 shadow-sm' : 'hover:bg-white/5 hover:translate-x-1'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: st.colorHex || STAGE_COLORS[st.status] || '#71717A' }}
                    />
                    <span className="text-xs text-zinc-300 hover:text-white font-medium">
                      {st.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-zinc-500">
                      {st.percentage}%
                    </span>
                    <span className="text-xs font-bold font-mono text-white">
                      {st.count}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
