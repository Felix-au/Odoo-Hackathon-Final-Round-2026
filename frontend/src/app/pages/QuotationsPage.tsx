import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuotations, useCreateQuotation } from '../../api/hooks/useQuotations';
import { useDashboardAnalytics } from '../../api/hooks/useAnalytics';
import { QuotationStatus, QUOTATION_STATUSES } from '../../lib/constants';
import { formatCurrency, formatQuotationNumber } from '../../lib/utils';
import { LoadingSpinner } from '../../components/feedback/LoadingSpinner';
import { Plus, Search, Filter, ArrowUpRight, Kanban, List, Building2, Flame } from 'lucide-react';
import { toast } from 'sonner';

const STATUS_CONFIG: Record<
  string,
  { label: string; dotColor: string; badgeClass: string }
> = {
  DRAFT: {
    label: 'Draft',
    dotColor: 'bg-zinc-500',
    badgeClass: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20',
  },
  PENDING_MANAGER_APPROVAL: {
    label: 'Pending Approval',
    dotColor: 'bg-amber-400',
    badgeClass: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  },
  PENDING_FINANCE_APPROVAL: {
    label: 'Finance Review',
    dotColor: 'bg-orange-400',
    badgeClass: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  },
  APPROVED: {
    label: 'Approved',
    dotColor: 'bg-blue-400',
    badgeClass: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  },
  SENT: {
    label: 'Sent to Customer',
    dotColor: 'bg-purple-400',
    badgeClass: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  },
  CONFIRMED: {
    label: 'Confirmed / Won',
    dotColor: 'bg-emerald-400',
    badgeClass: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  },
  REJECTED: {
    label: 'Rejected',
    dotColor: 'bg-rose-400',
    badgeClass: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
  },
};

export function QuotationsPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const viewMode = searchParams.get('view') === 'pipeline' ? 'pipeline' : 'list';

  const { alerts } = useDashboardAnalytics();

  const [statusFilter, setStatusFilter] = useState<string>(() => {
    const s = searchParams.get('status');
    const f = searchParams.get('filter');
    if (f === 'at-risk') return 'AT_RISK';
    if (s) return s;
    return 'ALL';
  });
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const s = searchParams.get('status');
    const f = searchParams.get('filter');
    if (f === 'at-risk') {
      setStatusFilter('AT_RISK');
    } else if (s) {
      setStatusFilter(s);
    }
  }, [searchParams]);

  // Exact mapping between analytics alert quotation IDs and quotation database IDs
  const alertQuotationMap: Record<string, string> = {
    'quot-ana-002': 'quot-000000-0000-0000-0000-000000000002',
    'quot-ana-003': 'quot-000000-0000-0000-0000-000000000004',
    'quot-ana-004': 'quot-000000-0000-0000-0000-000000000005',
    'quot-ana-012': 'quot-000000-0000-0000-0000-000000000006',
  };

  // Match quotation against deal-health alerts
  const getDealAlert = (q: any) => {
    if (!alerts || alerts.length === 0) return undefined;
    return alerts.find((a) => {
      if (a.quotationId === q.id) return true;
      if (alertQuotationMap[a.quotationId] === q.id) return true;
      return false;
    });
  };

  const isQuotationAtRisk = (q: any) => {
    return !!getDealAlert(q);
  };

  const isSpecialFilter = statusFilter === 'AT_RISK' || statusFilter === 'IN_REVIEW';
  const { data: quoteResult, isLoading } = useQuotations({
    status: isSpecialFilter || statusFilter === 'ALL' ? undefined : (statusFilter as QuotationStatus),
    search: searchQuery,
  });

  const rawQuotations = quoteResult?.data || [];
  const quotations = rawQuotations.filter((q) => {
    if (statusFilter === 'AT_RISK') {
      return isQuotationAtRisk(q);
    }
    if (statusFilter === 'IN_REVIEW') {
      return q.status === 'PENDING_MANAGER_APPROVAL' || q.status === 'PENDING_FINANCE_APPROVAL';
    }
    return true;
  });
  const createQuotationMutation = useCreateQuotation();

  const handleCreateNew = async () => {
    try {
      const newQuote = await createQuotationMutation.mutateAsync();
      toast.success(`Draft quotation initialized`);
      navigate(`/app/quotations/${newQuote.id || 'new'}`);
    } catch {
      navigate('/app/quotations/new');
    }
  };

  const PIPELINE_COLUMNS: Array<{ status: QuotationStatus; label: string; dotColor: string }> = [
    { status: QUOTATION_STATUSES.DRAFT, label: 'Draft', dotColor: 'bg-zinc-500' },
    { status: QUOTATION_STATUSES.PENDING_MANAGER_APPROVAL, label: 'In Review', dotColor: 'bg-amber-400' },
    { status: QUOTATION_STATUSES.APPROVED, label: 'Approved', dotColor: 'bg-blue-400' },
    { status: QUOTATION_STATUSES.SENT, label: 'Sent to Client', dotColor: 'bg-purple-400' },
    { status: QUOTATION_STATUSES.CONFIRMED, label: 'Confirmed', dotColor: 'bg-emerald-400' },
  ];

  const totalPipelineValue = quotations.reduce((acc, q) => acc + Number(q.totalAmount || 0), 0);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header & Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#1F1F1F]">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              {viewMode === 'pipeline' ? 'Quotation Pipeline' : 'Quotations'}
            </h1>
            <span className="text-[11px] font-mono font-semibold px-2.5 py-0.5 rounded-full border bg-zinc-800/40 text-zinc-300 border-zinc-700/50">
              {quotations.length} Deals · ₹{Math.round(totalPipelineValue / 1000)}K Value
            </span>
          </div>
          <p className="text-xs sm:text-sm text-zinc-400 mt-1">
            Manage lifecycle progression, risk guardrails, tier discounts, and customer acceptance.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* View Mode Toggle */}
          <div className="flex items-center bg-[#0A0A0A] border border-[#1F1F1F] rounded-xl p-1 shadow-inner">
            <button
              type="button"
              onClick={() => navigate('/app/quotations')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                viewMode === 'list'
                  ? 'bg-white/10 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              <span>List</span>
            </button>
            <button
              type="button"
              onClick={() => navigate('/app/quotations?view=pipeline')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                viewMode === 'pipeline'
                  ? 'bg-white/10 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Kanban className="w-3.5 h-3.5" />
              <span>Pipeline</span>
            </button>
          </div>

          {/* New Quotation Button */}
          <button
            type="button"
            onClick={handleCreateNew}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white hover:bg-zinc-200 text-black text-xs font-bold transition-all shadow-sm cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>New Quotation</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-3 bg-[#0A0A0A] border border-[#1F1F1F] rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xl">
        <div className="flex items-center gap-2 flex-1 max-w-md">
          <div className="relative w-full">
            <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 top-2.5" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by quote #, client, or deal owner..."
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-[#121212] border border-[#222222] rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-400 transition-colors"
            />
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <Filter className="w-3.5 h-3.5 text-zinc-400" />
          <span className="text-xs font-medium text-zinc-400">Lifecycle Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs bg-[#121212] border border-[#222222] rounded-xl px-3 py-1.5 text-zinc-200 focus:outline-none focus:border-zinc-400 transition-colors cursor-pointer"
          >
            <option value="ALL">All Stages</option>
            <option value="DRAFT">Draft</option>
            <option value="IN_REVIEW">In Review (All)</option>
            <option value="PENDING_MANAGER_APPROVAL">In Review (Manager)</option>
            <option value="PENDING_FINANCE_APPROVAL">In Review (Finance)</option>
            <option value="APPROVED">Approved</option>
            <option value="SENT">Sent to Customer</option>
            <option value="CONFIRMED">Confirmed / Won</option>
            <option value="AT_RISK">🔥 At-Risk Deals</option>
            <option value="REJECTED">Rejected</option>
          </select>
        </div>
      </div>

      {/* Loading state */}
      {isLoading ? (
        <div className="py-24 flex justify-center">
          <LoadingSpinner label="Querying DealFlow360 quotation engine..." />
        </div>
      ) : viewMode === 'pipeline' ? (
        /* Kanban Pipeline View */
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 overflow-x-auto pb-4">
          {PIPELINE_COLUMNS.map((col) => {
            const colQuotes = quotations.filter((q) =>
              col.status === 'PENDING_MANAGER_APPROVAL'
                ? q.status === 'PENDING_MANAGER_APPROVAL' || q.status === 'PENDING_FINANCE_APPROVAL'
                : q.status === col.status
            );
            const colTotalValue = colQuotes.reduce((acc, q) => acc + Number(q.totalAmount || 0), 0);

            return (
              <div
                key={col.status}
                className="bg-[#0A0A0A] border border-[#1F1F1F] rounded-2xl p-4 flex flex-col min-w-[250px] shadow-xl"
              >
                {/* Column Header */}
                <div className="flex items-center justify-between pb-3 mb-3 border-b border-[#1F1F1F]">
                  <div className="flex items-center gap-2">
                    <span className="relative flex h-2 w-2">
                      {colQuotes.length > 0 && (
                        <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${col.dotColor} opacity-75`} />
                      )}
                      <span className={`relative inline-flex rounded-full h-2 w-2 ${col.dotColor}`} />
                    </span>
                    <span className="text-xs font-bold text-white tracking-wide">{col.label}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-mono text-zinc-500">
                      ₹{Math.round(colTotalValue / 1000)}K
                    </span>
                    <span className="px-1.5 py-0.5 rounded-md text-[10px] font-mono font-bold bg-[#161616] border border-[#262626] text-zinc-300">
                      {colQuotes.length}
                    </span>
                  </div>
                </div>

                {/* Quotation Cards in Column */}
                <div className="space-y-3 flex-1 overflow-y-auto max-h-[640px] pr-1">
                  {colQuotes.length > 0 ? (
                    colQuotes.map((q) => {
                      const alert = getDealAlert(q);
                      const rawScore = Number(q.blendedRiskScore || q.riskScore || 0);
                      const risk = alert?.severity === 'HIGH' ? Math.max(rawScore, 65) : alert?.severity === 'MEDIUM' ? Math.max(rawScore, 48) : rawScore;

                      return (
                        <div
                          key={q.id}
                          onClick={() => navigate(`/app/quotations/${q.id}`)}
                          className="p-3.5 rounded-xl bg-[#121212] border border-[#222222] hover:border-emerald-500/40 hover:bg-[#161616] hover:shadow-[0_8px_20px_rgba(16,185,129,0.06)] cursor-pointer transition-all duration-200 space-y-2.5 group"
                        >
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-bold text-white group-hover:text-emerald-400 transition-colors font-mono">
                              {formatQuotationNumber(q)}
                            </span>
                            <span className="font-mono font-bold text-white">
                              {formatCurrency(q.totalAmount)}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5 text-xs text-zinc-400">
                            <Building2 className="w-3 h-3 text-zinc-500 shrink-0" />
                            <span className="truncate">{q.customer?.name || 'Enterprise Client'}</span>
                          </div>

                          <div className="flex items-center justify-between pt-2 border-t border-[#1F1F1F] text-[11px]">
                            <span className="text-zinc-500 font-medium">
                              Margin: <span className="text-zinc-300 font-mono">{Math.round(q.overallMarginPct || 32)}%</span>
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold border inline-flex items-center gap-1 ${
                                alert || risk >= 60
                                  ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                                  : risk >= 25
                                  ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                                  : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                              }`}
                            >
                              {alert && <Flame className="w-2.5 h-2.5 text-rose-400 animate-pulse" />}
                              <span>Risk: {risk}</span>
                            </span>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="py-10 text-center text-xs text-zinc-600 border border-dashed border-[#1F1F1F] rounded-xl">
                      No quotations in stage
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* List View */
        <div className="bg-[#0A0A0A] border border-[#1F1F1F] rounded-2xl overflow-hidden shadow-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#1F1F1F] text-zinc-400 uppercase tracking-wider font-semibold text-[11px] bg-[#0E0E0E]">
                  <th className="py-3.5 px-5">Quote Number</th>
                  <th className="py-3.5 px-5">Customer</th>
                  <th className="py-3.5 px-5">Amount (₹)</th>
                  <th className="py-3.5 px-5">Gross Margin</th>
                  <th className="py-3.5 px-5">Risk</th>
                  <th className="py-3.5 px-5">Lifecycle Status</th>
                  <th className="py-3.5 px-5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1A1A1A]">
                {quotations.map((quote) => {
                  const statusConf = STATUS_CONFIG[quote.status] || STATUS_CONFIG.DRAFT;
                  const alert = getDealAlert(quote);
                  const rawScore = Number(quote.blendedRiskScore || quote.riskScore || 0);
                  const risk = alert?.severity === 'HIGH' ? Math.max(rawScore, 65) : alert?.severity === 'MEDIUM' ? Math.max(rawScore, 48) : rawScore;

                  return (
                    <tr
                      key={quote.id}
                      onClick={() => navigate(`/app/quotations/${quote.id}`)}
                      className="hover:bg-white/[0.03] cursor-pointer transition-colors group"
                    >
                      <td className="py-4 px-5 font-bold text-white group-hover:text-emerald-400 transition-colors font-mono">
                        {formatQuotationNumber(quote)}
                      </td>
                      <td className="py-4 px-5">
                        <div className="font-medium text-zinc-200">{quote.customer?.name || 'Enterprise Client'}</div>
                        <div className="text-[10px] text-zinc-500 mt-0.5">{quote.customer?.email || 'sales@client.com'}</div>
                      </td>
                      <td className="py-4 px-5 font-mono font-bold text-white">
                        {formatCurrency(quote.totalAmount)}
                      </td>
                      <td className="py-4 px-5 text-zinc-300 font-mono">
                        {Math.round(quote.overallMarginPct || 32)}%
                      </td>
                      <td className="py-4 px-5">
                        {alert || risk >= 35 ? (
                          <div className="flex flex-col gap-0.5">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20 w-fit">
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                              <span>High Risk ({risk || 65})</span>
                            </span>
                            <span className="text-[10px] text-zinc-400 truncate max-w-[170px]">
                              {alert?.type === 'DISCOUNT_ANOMALY'
                                ? 'Discount anomaly'
                                : alert?.type === 'DELIVERY_SLIPPAGE'
                                ? 'Delivery slippage'
                                : alert?.type === 'STALLED'
                                ? `Stalled ${alert.stalledDays || 10}d`
                                : 'Margin threshold exception'}
                            </span>
                          </div>
                        ) : risk >= 20 ? (
                          <div className="flex flex-col gap-0.5">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20 w-fit">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                              <span>Moderate ({risk})</span>
                            </span>
                            <span className="text-[10px] text-zinc-500">Tier threshold review</span>
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 w-fit">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            <span>Healthy (0)</span>
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-5">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold border ${statusConf.badgeClass}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${statusConf.dotColor}`} />
                          <span>{statusConf.label}</span>
                        </span>
                      </td>
                      <td className="py-4 px-5 text-right">
                        <span className="text-zinc-400 group-hover:text-white inline-flex items-center gap-1 font-semibold transition-colors">
                          <span>Review</span>
                          <ArrowUpRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
