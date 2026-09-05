import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuotations, useCreateQuotation } from '../../api/hooks/useQuotations';
import { QuotationStatus, QUOTATION_STATUSES } from '../../lib/constants';
import { formatCurrency } from '../../lib/utils';
import { LoadingSpinner } from '../../components/feedback/LoadingSpinner';
import { Plus, Search, Filter, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';

export function QuotationsPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const viewMode = searchParams.get('view') === 'pipeline' ? 'pipeline' : 'list';

  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const { data: quoteResult, isLoading } = useQuotations({
    status: statusFilter === 'ALL' ? undefined : (statusFilter as QuotationStatus),
    search: searchQuery,
  });

  const quotations = quoteResult?.data || [];
  const createQuotationMutation = useCreateQuotation();

  const handleCreateNew = async () => {
    try {
      const newQuote = await createQuotationMutation.mutateAsync();
      toast.success(`Created draft quotation`);
      navigate(`/app/quotations/${newQuote.id || 'new'}`);
    } catch {
      navigate('/app/quotations/new');
    }
  };

  const PIPELINE_COLUMNS: Array<{ status: QuotationStatus; label: string; dotColor: string }> = [
    { status: QUOTATION_STATUSES.DRAFT, label: 'Draft', dotColor: 'bg-slate-400' },
    { status: QUOTATION_STATUSES.PENDING_MANAGER_APPROVAL, label: 'Pending Approval', dotColor: 'bg-amber-400' },
    { status: QUOTATION_STATUSES.APPROVED, label: 'Approved', dotColor: 'bg-blue-400' },
    { status: QUOTATION_STATUSES.SENT, label: 'Sent to Customer', dotColor: 'bg-purple-400' },
    { status: QUOTATION_STATUSES.CONFIRMED, label: 'Confirmed', dotColor: 'bg-emerald-400' },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header & Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            {viewMode === 'pipeline' ? 'Quotation Pipeline' : 'Quotations'}
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Manage lifecycle, risk evaluation, approvals, and customer confirmations
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center bg-[#161B24] border border-[#222834] rounded-xl p-1">
            <button
              type="button"
              onClick={() => navigate('/app/quotations')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                viewMode === 'list'
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              List
            </button>
            <button
              type="button"
              onClick={() => navigate('/app/quotations?view=pipeline')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                viewMode === 'pipeline'
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Pipeline
            </button>
          </div>

          <button
            type="button"
            onClick={handleCreateNew}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-lg shadow-blue-500/20 transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Quotation</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-3 bg-[#12151C] border border-[#1E2430] rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
        <div className="flex items-center gap-2 flex-1 max-w-md">
          <div className="relative w-full">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by quote #, customer, or rep..."
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-[#101319] border border-[#1E2430] rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-3.5 h-3.5 text-slate-500" />
          <span className="text-xs font-medium text-slate-400">Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs bg-[#101319] border border-[#1E2430] rounded-xl px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-blue-500"
          >
            <option value="ALL">All Statuses</option>
            <option value="DRAFT">Draft</option>
            <option value="PENDING_MANAGER_APPROVAL">Pending Approval</option>
            <option value="APPROVED">Approved</option>
            <option value="SENT">Sent</option>
            <option value="CONFIRMED">Confirmed</option>
            <option value="REJECTED">Rejected</option>
          </select>
        </div>
      </div>

      {/* Loading state */}
      {isLoading ? (
        <div className="py-20 flex justify-center">
          <LoadingSpinner label="Loading quotations..." />
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

            return (
              <div
                key={col.status}
                className="bg-[#12151C] border border-[#1E2430] rounded-2xl p-4 flex flex-col min-w-[220px]"
              >
                <div className="flex items-center justify-between pb-3 mb-3 border-b border-[#1E2430]">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${col.dotColor}`} />
                    <span className="text-xs font-bold text-white">{col.label}</span>
                  </div>
                  <span className="text-xs font-mono text-slate-400">{colQuotes.length}</span>
                </div>

                <div className="space-y-3 flex-1 overflow-y-auto max-h-[600px]">
                  {colQuotes.length > 0 ? (
                    colQuotes.map((q) => (
                      <div
                        key={q.id}
                        onClick={() => navigate(`/app/quotations/${q.id}`)}
                        className="p-3.5 rounded-xl bg-[#161B24] border border-[#202735] hover:border-blue-500/50 cursor-pointer transition-all space-y-2 group"
                      >
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-white group-hover:text-blue-400 transition-colors">
                            {q.quotationNumber}
                          </span>
                          <span className="font-mono font-bold text-white">
                            {formatCurrency(q.totalAmount)}
                          </span>
                        </div>
                        <div className="text-xs text-slate-400 truncate">
                          {q.customer?.name || 'Customer'}
                        </div>
                        <div className="flex items-center justify-between pt-1 text-[11px] text-slate-500">
                          <span>Margin: {Math.round(q.overallMarginPct || 35)}%</span>
                          {q.riskScore ? (
                            <span
                              className={`font-semibold ${
                                q.riskScore >= 70
                                  ? 'text-orange-400'
                                  : q.riskScore >= 30
                                  ? 'text-amber-400'
                                  : 'text-emerald-400'
                              }`}
                            >
                              Risk: {q.riskScore}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="py-8 text-center text-xs text-slate-600">
                      No quotations
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* List View */
        <div className="bg-[#12151C] border border-[#1E2430] rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#1E2430] text-slate-400 uppercase tracking-wider font-semibold text-[11px] bg-[#101319]">
                  <th className="py-3 px-5">Quote #</th>
                  <th className="py-3 px-5">Customer</th>
                  <th className="py-3 px-5">Amount</th>
                  <th className="py-3 px-5">Margin</th>
                  <th className="py-3 px-5">Risk</th>
                  <th className="py-3 px-5">Status</th>
                  <th className="py-3 px-5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1A202C]">
                {quotations.map((quote) => (
                  <tr
                    key={quote.id}
                    onClick={() => navigate(`/app/quotations/${quote.id}`)}
                    className="hover:bg-white/[0.02] cursor-pointer transition-colors"
                  >
                    <td className="py-3.5 px-5 font-bold text-white">
                      {quote.quotationNumber}
                    </td>
                    <td className="py-3.5 px-5 text-slate-300">
                      {quote.customer?.name || 'Customer'}
                    </td>
                    <td className="py-3.5 px-5 font-mono font-bold text-white">
                      {formatCurrency(quote.totalAmount)}
                    </td>
                    <td className="py-3.5 px-5 text-slate-300 font-mono">
                      {Math.round(quote.overallMarginPct || 35)}%
                    </td>
                    <td className="py-3.5 px-5">
                      <span
                        className={`font-semibold ${
                          (quote.riskScore || 0) >= 70
                            ? 'text-orange-400'
                            : (quote.riskScore || 0) >= 30
                            ? 'text-amber-400'
                            : 'text-emerald-400'
                        }`}
                      >
                        {quote.riskScore || 20}
                      </span>
                    </td>
                    <td className="py-3.5 px-5">
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-semibold bg-[#1C222E] text-slate-300 border border-[#2A3445]">
                        {quote.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-5 text-right">
                      <span className="text-blue-400 hover:text-blue-300 inline-flex items-center gap-1 font-semibold">
                        Edit <ArrowRight className="w-3 h-3" />
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
