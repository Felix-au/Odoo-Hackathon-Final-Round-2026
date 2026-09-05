import { useDashboardAnalytics } from '../../api/hooks/useAnalytics';
import { LoadingSpinner } from '../../components/feedback/LoadingSpinner';
import { formatCurrency } from '../../lib/utils';
import { BarChart3, RefreshCw, AlertTriangle, TrendingUp, DollarSign, ArrowUpRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function AnalyticsPage() {
  const navigate = useNavigate();
  const { kpis, stages, alerts, isLoading } = useDashboardAnalytics();

  return (
    <div className="space-y-6 animate-in fade-in duration-300 pb-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#1F1F1F]">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              Executive Analytics & Intelligence
            </h1>
            <span className="text-[11px] font-mono font-semibold px-2.5 py-0.5 rounded-full border bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
              Analytics Engine :3006
            </span>
          </div>
          <p className="text-xs sm:text-sm text-zinc-400 mt-1">
            Real-time pipeline metrics, gross margin floor analysis, and active deal velocity telemetry.
          </p>
        </div>

        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#0A0A0A] border border-[#1F1F1F] text-emerald-400 text-xs font-semibold shadow-sm">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400 shadow-[0_0_8px_#34d399]" />
          </span>
          <span className="font-mono text-[11px]">TELEMETRY ACTIVE</span>
        </div>
      </div>

      {isLoading ? (
        <div className="py-24 flex justify-center">
          <LoadingSpinner label="Querying Analytics service for live telemetry..." />
        </div>
      ) : !kpis && stages.length === 0 ? (
        /* Graceful Empty State */
        <div className="bg-[#0A0A0A] border border-[#1F1F1F] rounded-2xl p-12 text-center space-y-4 shadow-2xl">
          <div className="w-12 h-12 rounded-2xl bg-[#141414] border border-[#242424] flex items-center justify-center mx-auto text-emerald-400">
            <BarChart3 className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-white">No Analytics Data Available</h3>
          <p className="text-xs text-zinc-400 max-w-md mx-auto">
            Real-time pipeline analysis, gross margin aggregations, and deal velocity metrics will populate once quotations progress through review.
          </p>
          <div className="pt-2">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-white text-black hover:bg-zinc-200 transition-colors inline-flex items-center gap-2 cursor-pointer shadow-sm"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Poll Service Again</span>
            </button>
          </div>
        </div>
      ) : (
        /* Real Analytics Data */
        <div className="space-y-6">
          {kpis && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-5 bg-[#0A0A0A] border border-[#1F1F1F] rounded-2xl transition-all hover:border-[#2E2E2E] shadow-xl">
                <div className="flex items-center justify-between text-xs text-zinc-400 font-semibold uppercase tracking-wider">
                  <span>Total Won Revenue</span>
                  <DollarSign className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="text-2xl sm:text-3xl font-bold text-white tracking-tight mt-2 font-mono">
                  {formatCurrency(kpis.totalRevenue)}
                </div>
                <div className="text-[11px] text-zinc-500 mt-1">Confirmed deals aggregate across accounts</div>
              </div>

              <div className="p-5 bg-[#0A0A0A] border border-[#1F1F1F] rounded-2xl transition-all hover:border-[#2E2E2E] shadow-xl">
                <div className="flex items-center justify-between text-xs text-zinc-400 font-semibold uppercase tracking-wider">
                  <span>Active Quotations</span>
                  <TrendingUp className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="text-2xl sm:text-3xl font-bold text-white tracking-tight mt-2 font-mono">
                  {kpis.quotationCount} Deals
                </div>
                <div className="text-[11px] text-zinc-500 mt-1">Total active and progressing lifecycle quotes</div>
              </div>

              <div className="p-5 bg-[#0A0A0A] border border-[#1F1F1F] rounded-2xl transition-all hover:border-[#2E2E2E] shadow-xl">
                <div className="flex items-center justify-between text-xs text-zinc-400 font-semibold uppercase tracking-wider">
                  <span>Average Margin Floor</span>
                  <BarChart3 className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="text-2xl sm:text-3xl font-bold text-emerald-400 tracking-tight mt-2 font-mono">
                  {kpis.averageMarginPct.toFixed(1)}%
                </div>
                <div className="text-[11px] text-zinc-500 mt-1">Overall blended gross company margin</div>
              </div>
            </div>
          )}

          {stages.length > 0 && (
            <div className="bg-[#0A0A0A] border border-[#1F1F1F] rounded-2xl overflow-hidden shadow-2xl">
              <div className="py-3.5 px-5 bg-[#0E0E0E] border-b border-[#1F1F1F] flex items-center justify-between">
                <h2 className="text-xs font-bold text-zinc-300 uppercase tracking-wider">
                  Pipeline Stages & Active Breakdown
                </h2>
                <button
                  type="button"
                  onClick={() => navigate('/app/quotations?view=pipeline')}
                  className="text-xs text-zinc-400 hover:text-white flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <span>Open Kanban</span>
                  <ArrowUpRight className="w-3 h-3" />
                </button>
              </div>
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#1F1F1F] text-zinc-400 font-semibold text-[11px] uppercase">
                    <th className="py-3.5 px-5">Stage</th>
                    <th className="py-3.5 px-5 text-center">Quote Count</th>
                    <th className="py-3.5 px-5 text-center">Share</th>
                    <th className="py-3.5 px-5 text-right">Stage Color</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1A1A1A]">
                  {stages.map((st) => (
                    <tr key={st.status} className="hover:bg-white/[0.03] transition-colors">
                      <td className="py-4 px-5">
                        <div className="flex items-center gap-2.5">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: st.colorHex || '#10B981' }}
                          />
                          <span className="font-bold text-white">{st.label}</span>
                        </div>
                      </td>
                      <td className="py-4 px-5 text-center font-bold text-zinc-200 font-mono">{st.count}</td>
                      <td className="py-4 px-5 text-center font-mono text-zinc-400">{st.percentage}%</td>
                      <td className="py-4 px-5 text-right font-mono text-xs text-zinc-500">
                        {st.colorHex}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {alerts.length > 0 && (
            <div className="bg-[#0A0A0A] border border-[#1F1F1F] rounded-2xl overflow-hidden shadow-2xl">
              <div className="py-3.5 px-5 bg-[#0E0E0E] border-b border-[#1F1F1F] flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                <h2 className="text-xs font-bold text-zinc-300 uppercase tracking-wider">
                  Active Deal Health Exceptions ({alerts.length})
                </h2>
              </div>
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#1F1F1F] text-zinc-400 font-semibold text-[11px] uppercase">
                    <th className="py-3.5 px-5">Customer Account</th>
                    <th className="py-3.5 px-5">Alert Type</th>
                    <th className="py-3.5 px-5 text-center">Severity</th>
                    <th className="py-3.5 px-5 text-right">Root Cause & Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1A1A1A]">
                  {alerts.map((al) => (
                    <tr key={al.id} className="hover:bg-white/[0.03] transition-colors">
                      <td className="py-4 px-5 font-bold text-white">{al.customerName}</td>
                      <td className="py-4 px-5 text-zinc-300">{al.title}</td>
                      <td className="py-4 px-5 text-center">
                        <span
                          className={`px-2.5 py-0.5 rounded text-[10px] font-mono font-bold border ${
                            al.severity === 'HIGH'
                              ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                              : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                          }`}
                        >
                          {al.severity}
                        </span>
                      </td>
                      <td className="py-4 px-5 text-right text-zinc-400">{al.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
