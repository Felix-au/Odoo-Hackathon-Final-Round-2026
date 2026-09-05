import { useDashboardAnalytics } from '../../api/hooks/useAnalytics';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { LoadingSpinner } from '../../components/feedback/LoadingSpinner';
import { formatCurrency } from '../../lib/utils';
import { BarChart3, RefreshCw, AlertTriangle, TrendingUp, DollarSign } from 'lucide-react';

export function AnalyticsPage() {
  const { kpis, stages, alerts, isLoading } = useDashboardAnalytics();

  return (
    <div className="space-y-5 pb-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-slate-900 tracking-tight">Executive Analytics & Intelligence</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time pipeline metrics, margin analysis, and conversion analytics (Analytics Service — Port 3006)
          </p>
        </div>

        <Badge variant="success" size="sm">
          Live Service
        </Badge>
      </div>

      {isLoading ? (
        <LoadingSpinner label="Querying Analytics service for live metrics..." />
      ) : !kpis && stages.length === 0 ? (
        /* Graceful Empty State for Incomplete Service */
        <Card className="border-dashed border-2">
          <CardContent className="p-8 text-center space-y-3">
            <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
              <BarChart3 className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-800">No Analytics Data Available</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Real-time pipeline analysis, gross margin aggregations, and deal velocity metrics will be visualized once the
              analytics data pipeline is running.
            </p>
            <div className="pt-2">
              <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
                <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                Check Service Again
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        /* Real Analytics Data (when service is online) */
        <div className="space-y-5">
          {kpis && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>Total Revenue</span>
                  <DollarSign className="w-4 h-4 text-emerald-600" />
                </div>
                <div className="text-2xl font-black text-slate-900 mt-2">
                  {formatCurrency(kpis.totalRevenue)}
                </div>
              </div>

              <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>Quotation Count</span>
                  <TrendingUp className="w-4 h-4 text-primary" />
                </div>
                <div className="text-2xl font-black text-slate-900 mt-2">
                  {kpis.quotationCount}
                </div>
              </div>

              <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>Average Margin Floor</span>
                  <BarChart3 className="w-4 h-4 text-purple-600" />
                </div>
                <div className="text-2xl font-black text-slate-900 mt-2">
                  {kpis.averageMarginPct.toFixed(1)}%
                </div>
              </div>
            </div>
          )}

          {stages.length > 0 && (
            <Card>
              <CardHeader className="py-3 px-5 bg-slate-50/75">
                <CardTitle className="text-xs font-bold text-slate-800">Pipeline Stages & Volume</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <table className="w-full text-left table-dense">
                  <thead>
                    <tr>
                      <th>Stage</th>
                      <th className="text-center">Count</th>
                      <th className="text-right">Total Value</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {stages.map((st) => (
                      <tr key={st.status}>
                        <td className="font-bold text-xs text-slate-800">{st.label}</td>
                        <td className="text-center text-xs font-bold text-slate-900">{st.count}</td>
                        <td className="text-right text-xs font-black text-slate-900">{formatCurrency(st.totalValue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}

          {alerts.length > 0 && (
            <Card>
              <CardHeader className="py-3 px-5 bg-slate-50/75">
                <CardTitle className="text-xs font-bold text-slate-800 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                  Deal Health Exceptions ({alerts.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <table className="w-full text-left table-dense">
                  <thead>
                    <tr>
                      <th>Customer</th>
                      <th>Alert Title</th>
                      <th className="text-center">Severity</th>
                      <th className="text-right">Description</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {alerts.map((al) => (
                      <tr key={al.id}>
                        <td className="font-bold text-xs text-slate-800">{al.customerName}</td>
                        <td className="text-xs text-slate-700">{al.title}</td>
                        <td className="text-center">
                          <Badge variant={al.severity === 'HIGH' ? 'destructive' : 'warning'} size="sm">
                            {al.severity}
                          </Badge>
                        </td>
                        <td className="text-right text-xs text-slate-500">{al.description}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
