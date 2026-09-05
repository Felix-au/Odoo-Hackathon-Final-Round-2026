import { useDashboardAnalytics } from '../../api/hooks/useAnalytics';
import { LoadingSpinner } from '../../components/feedback/LoadingSpinner';
import { formatCurrency } from '../../lib/utils';
import { BarChart3, RefreshCw, AlertTriangle, TrendingUp, DollarSign, Activity } from 'lucide-react';

export function AnalyticsPage() {
  const { kpis, stages, alerts, isLoading } = useDashboardAnalytics();

  return (
    <div className="space-y-6 max-w-6xl mx-auto animate-in fade-in duration-300 pb-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Executive Analytics & Intelligence</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Real-time pipeline metrics, margin analysis, and conversion analytics (Port 3006)
          </p>
        </div>

        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold">
          <Activity className="w-3.5 h-3.5 animate-pulse" />
          <span>Live Analytics Service</span>
        </div>
      </div>

      {isLoading ? (
        <div className="py-20 flex justify-center">
          <LoadingSpinner label="Querying Analytics service for live metrics..." />
        </div>
      ) : !kpis && stages.length === 0 ? (
        /* Graceful Empty State */
        <div className="bg-[#12151C] border border-[#1E2430] rounded-2xl p-10 text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-[#1C222E] border border-[#283244] flex items-center justify-center mx-auto text-blue-400">
            <BarChart3 className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-white">No Analytics Data Available</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            Real-time pipeline analysis, gross margin aggregations, and deal velocity metrics will be visualized once quotations are submitted.
          </p>
          <div className="pt-2">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white transition-colors inline-flex items-center gap-2"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Check Service Again</span>
            </button>
          </div>
        </div>
      ) : (
        /* Real Analytics Data */
        <div className="space-y-6">
          {kpis && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-5 bg-[#12151C] border border-[#1E2430] rounded-2xl transition-all hover:border-[#2A3445]">
                <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
                  <span>Total Revenue</span>
                  <DollarSign className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="text-2xl font-bold text-white tracking-tight mt-2 font-mono">
                  {formatCurrency(kpis.totalRevenue)}
                </div>
                <div className="text-[11px] text-slate-500 mt-1">Confirmed deals aggregate</div>
              </div>

              <div className="p-5 bg-[#12151C] border border-[#1E2430] rounded-2xl transition-all hover:border-[#2A3445]">
                <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
                  <span>Quotation Count</span>
                  <TrendingUp className="w-4 h-4 text-blue-400" />
                </div>
                <div className="text-2xl font-bold text-white tracking-tight mt-2 font-mono">
                  {kpis.quotationCount}
                </div>
                <div className="text-[11px] text-slate-500 mt-1">Total active and closed quotes</div>
              </div>

              <div className="p-5 bg-[#12151C] border border-[#1E2430] rounded-2xl transition-all hover:border-[#2A3445]">
                <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
                  <span>Average Margin Floor</span>
                  <BarChart3 className="w-4 h-4 text-purple-400" />
                </div>
                <div className="text-2xl font-bold text-white tracking-tight mt-2 font-mono text-purple-400">
                  {kpis.averageMarginPct.toFixed(1)}%
                </div>
                <div className="text-[11px] text-slate-500 mt-1">Overall blended gross margin</div>
              </div>
            </div>
          )}

          {stages.length > 0 && (
            <div className="bg-[#12151C] border border-[#1E2430] rounded-2xl overflow-hidden shadow-sm">
              <div className="py-3 px-5 bg-[#101319] border-b border-[#1E2430]">
                <h2 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Pipeline Stages & Volume</h2>
              </div>
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#1E2430] text-slate-400 font-semibold text-[11px]">
                    <th className="py-3 px-5">Stage</th>
                    <th className="py-3 px-5 text-center">Count</th>
                    <th className="py-3 px-5 text-right">Total Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1A212D]">
                  {stages.map((st) => (
                    <tr key={st.status} className="hover:bg-white/[0.02] transition-colors">
                      <td className="py-3 px-5 font-bold text-white">{st.label}</td>
                      <td className="py-3 px-5 text-center font-bold text-slate-300 font-mono">{st.count}</td>
                      <td className="py-3 px-5 text-right font-bold text-emerald-400 font-mono">{formatCurrency(st.totalValue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {alerts.length > 0 && (
            <div className="bg-[#12151C] border border-[#1E2430] rounded-2xl overflow-hidden shadow-sm">
              <div className="py-3 px-5 bg-[#101319] border-b border-[#1E2430] flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                <h2 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Deal Health Exceptions ({alerts.length})</h2>
              </div>
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#1E2430] text-slate-400 font-semibold text-[11px]">
                    <th className="py-3 px-5">Customer</th>
                    <th className="py-3 px-5">Alert Title</th>
                    <th className="py-3 px-5 text-center">Severity</th>
                    <th className="py-3 px-5 text-right">Description</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1A212D]">
                  {alerts.map((al) => (
                    <tr key={al.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="py-3 px-5 font-bold text-white">{al.customerName}</td>
                      <td className="py-3 px-5 text-slate-300">{al.title}</td>
                      <td className="py-3 px-5 text-center">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                            al.severity === 'HIGH'
                              ? 'bg-red-500/10 text-red-400 border-red-500/20'
                              : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                          }`}
                        >
                          {al.severity}
                        </span>
                      </td>
                      <td className="py-3 px-5 text-right text-slate-400">{al.description}</td>
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
