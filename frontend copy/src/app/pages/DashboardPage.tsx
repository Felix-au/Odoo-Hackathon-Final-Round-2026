import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/auth.store';
import { useDashboardAnalytics } from '../../api/hooks/useAnalytics';
import { format } from 'date-fns';
import { LoadingSpinner } from '../../components/feedback/LoadingSpinner';

export function DashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { kpis, stages, alerts, isLoading, nudge, escalate } = useDashboardAnalytics();

  if (isLoading && !kpis) {
    return (
      <div className="py-20 flex justify-center">
        <LoadingSpinner label="Loading sales intelligence..." />
      </div>
    );
  }

  const userName = user?.name ? user.name.split(' ')[0] : 'Madhab';
  const currentDate = format(new Date(), 'EEEE, d MMMM yyyy');

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Header Section (Screenshot 1) */}
      <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2 border-b border-transparent">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">
            Good morning, {userName}
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Your sales workspace is focused on the next best action.
          </p>
        </div>
        <div className="text-xs text-slate-400 font-medium sm:text-right">
          {currentDate}
        </div>
      </div>

      {/* KPI Section - 4 Metric Cards (Screenshot 1) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* ACTIVE PIPELINE */}
        <div className="bg-[#12151C] border border-[#1E2430] rounded-2xl p-5 transition-all hover:border-[#2A3445]">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Active Pipeline
          </div>
          <div className="text-3xl font-bold text-white tracking-tight mt-2">
            ${Math.round((kpis?.activePipeline || 842000) / 1000)}K
          </div>
          <div className="text-xs text-slate-400 mt-1 font-normal">
            {kpis?.activePipelineQuotesCount || 12} quotes moving this week
          </div>
        </div>

        {/* PENDING APPROVALS */}
        <div className="bg-[#12151C] border border-[#1E2430] rounded-2xl p-5 transition-all hover:border-[#2A3445]">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Pending Approvals
          </div>
          <div className="text-3xl font-bold text-white tracking-tight mt-2">
            {kpis?.pendingApprovalsCount || 18}
          </div>
          <div className="text-xs text-slate-400 mt-1 font-normal">
            {kpis?.pendingApprovalsFinanceCount || 7} require finance review
          </div>
        </div>

        {/* AT-RISK DEALS */}
        <div className="bg-[#12151C] border border-[#1E2430] rounded-2xl p-5 transition-all hover:border-[#2A3445]">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            At-Risk Deals
          </div>
          <div className="text-3xl font-bold text-white tracking-tight mt-2">
            {kpis?.atRiskDealsCount || 6}
          </div>
          <div className="text-xs text-slate-400 mt-1 font-normal">
            {kpis?.atRiskNewTodayCount || 2} newly flagged today
          </div>
        </div>

        {/* RECURRING REVENUE */}
        <div className="bg-[#12151C] border border-[#1E2430] rounded-2xl p-5 transition-all hover:border-[#2A3445]">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Recurring Revenue
          </div>
          <div className="text-3xl font-bold text-white tracking-tight mt-2">
            ${Math.round((kpis?.recurringRevenueMRR || 72000) / 1000)}K
          </div>
          <div className="text-xs text-slate-400 mt-1 font-normal">
            {kpis?.nextRenewalText || 'Next renewal: 11 Sep'}
          </div>
        </div>
      </div>

      {/* Main Intelligence Grid (Screenshot 1) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: ATTENTION REQUIRED / Deal Health */}
        <div className="lg:col-span-2 space-y-3">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Attention Required
          </div>
          <div className="bg-[#12151C] border border-[#1E2430] rounded-2xl p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-bold text-white tracking-tight">
                Deal health
              </h2>
              <button
                type="button"
                onClick={() => navigate('/app/quotations')}
                className="text-xs text-blue-400 hover:text-blue-300 font-medium transition-colors"
              >
                View all
              </button>
            </div>

            {/* Deal Health Alert Items */}
            <div className="space-y-4">
              {alerts.length > 0 ? (
                alerts.map((item) => (
                  <div
                    key={item.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 first:pt-0 border-t border-[#1E2430] first:border-t-0"
                  >
                    <div className="flex items-start gap-3">
                      <span
                        className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                          item.severity === 'HIGH'
                            ? 'bg-orange-500 ring-2 ring-orange-500/20'
                            : 'bg-amber-400 ring-2 ring-amber-400/20'
                        }`}
                      />
                      <div>
                        <div
                          onClick={() => navigate(`/app/quotations/${item.quotationId || 'q-001'}`)}
                          className="text-sm font-semibold text-white hover:text-blue-400 cursor-pointer transition-colors"
                        >
                          {item.customerName}
                        </div>
                        <div className="text-xs text-slate-400 mt-0.5">
                          {item.title}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-center">
                      {item.actionRequired === 'Needs approval' ? (
                        <button
                          type="button"
                          onClick={() =>
                            navigate(`/app/quotations/${item.quotationId || 'q-001'}/approval`)
                          }
                          className="px-4 py-1.5 rounded-full text-xs font-medium bg-[#1E2533] text-slate-200 hover:bg-blue-600 hover:text-white transition-all border border-[#2B3547]"
                        >
                          Needs approval
                        </button>
                      ) : item.isEscalated ? (
                        <span
                          onClick={() => escalate({ alertId: item.id, message: 'Deal critical escalation' })}
                          className="text-xs font-semibold text-amber-400 px-2 cursor-pointer hover:underline"
                          title="Click to re-escalate"
                        >
                          Escalated
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() =>
                            nudge({
                              alertId: item.id,
                              message: `Attention required for ${item.customerName}`,
                            })
                          }
                          className="px-3 py-1 rounded-full text-xs font-medium bg-white/5 hover:bg-white/10 text-slate-300 transition-colors"
                        >
                          Nudge
                        </button>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-6 text-center text-xs text-slate-400">
                  All deals are healthy and moving according to schedule.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: PIPELINE / Quotes moving forward */}
        <div className="space-y-3">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Pipeline
          </div>
          <div className="bg-[#12151C] border border-[#1E2430] rounded-2xl p-6">
            <div className="mb-5">
              <h2 className="text-base font-bold text-white tracking-tight">
                Quotes moving forward
              </h2>
            </div>

            <div className="space-y-3.5">
              {stages.map((st) => (
                <div
                  key={st.status}
                  onClick={() => navigate('/app/quotations?view=pipeline')}
                  className="flex items-center justify-between py-1 px-2 rounded-lg hover:bg-white/5 cursor-pointer transition-colors group"
                >
                  <span className="text-sm text-slate-300 group-hover:text-white transition-colors">
                    {st.label}
                  </span>
                  <span className="text-sm font-bold text-white">
                    {st.count}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
