import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuotations, useCreateQuotation } from '../../api/hooks/useQuotations';
import { QuotationStatus, QUOTATION_STATUSES } from '../../lib/constants';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { Card } from '../../components/ui/Card';
import { QuotationStatusBadge } from '../../components/domain/QuotationStatusBadge';
import { RiskScoreIndicator } from '../../components/domain/RiskScoreIndicator';
import { LoadingSpinner } from '../../components/feedback/LoadingSpinner';
import { EmptyState } from '../../components/feedback/EmptyState';
import { formatCurrency, formatDate } from '../../lib/utils';
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
  const isLive = quoteResult?.isLive ?? false;

  const createQuotationMutation = useCreateQuotation();

  const handleCreateNew = async () => {
    try {
      const newQuote = await createQuotationMutation.mutateAsync('c1000000-0000-0000-0000-000000000001');
      toast.success(`Created draft ${newQuote.quotationNumber}`);
      navigate(`/app/quotations/${newQuote.id}`);
    } catch {
      toast.info('Quotation service is currently in development. New quotations cannot be created yet.');
    }
  };

  const PIPELINE_COLUMNS: Array<{ status: QuotationStatus; label: string; color: string }> = [
    { status: QUOTATION_STATUSES.DRAFT, label: 'Draft', color: 'border-slate-300' },
    { status: QUOTATION_STATUSES.PENDING_MANAGER_APPROVAL, label: 'Pending Approval', color: 'border-amber-400' },
    { status: QUOTATION_STATUSES.APPROVED, label: 'Approved', color: 'border-blue-400' },
    { status: QUOTATION_STATUSES.SENT, label: 'Sent to Customer', color: 'border-purple-400' },
    { status: QUOTATION_STATUSES.CONFIRMED, label: 'Confirmed', color: 'border-emerald-500' },
  ];

  return (
    <div className="space-y-5">
      {/* Header & Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-slate-900 tracking-tight">
            {viewMode === 'pipeline' ? 'Quotation Pipeline' : 'Quotations'}
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage lifecycle, risk evaluation, approvals, and customer confirmations
          </p>
        </div>

        <Button
          variant="accent"
          size="md"
          onClick={handleCreateNew}
          isLoading={createQuotationMutation.isPending}
          className="shadow-sm"
        >
          <Plus className="w-4 h-4 mr-1.5" />
          New Quotation
        </Button>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-3 bg-white rounded-xl border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
        <div className="flex items-center gap-2 flex-1 max-w-md">
          <div className="relative w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by quote #, customer, or rep..."
              className="pl-9 text-xs h-9 bg-slate-50/50"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-xs font-semibold text-slate-600">Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs font-medium border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="ALL">All Statuses</option>
            <option value={QUOTATION_STATUSES.DRAFT}>Draft</option>
            <option value={QUOTATION_STATUSES.PENDING_MANAGER_APPROVAL}>Pending Approval</option>
            <option value={QUOTATION_STATUSES.APPROVED}>Approved</option>
            <option value={QUOTATION_STATUSES.SENT}>Sent</option>
            <option value={QUOTATION_STATUSES.CONFIRMED}>Confirmed</option>
            <option value={QUOTATION_STATUSES.REJECTED}>Rejected</option>
          </select>
        </div>
      </div>


      {/* Content Rendering: List vs Pipeline */}
      {isLoading ? (
        <LoadingSpinner label="Loading quotations..." />
      ) : quotations.length === 0 ? (
        <EmptyState
          title={isLive ? "No quotations found" : "No Quotation Data Available"}
          description={isLive ? "Create your first quotation or adjust filter criteria." : "The quotation backend service has not returned any records."}
        />
      ) : viewMode === 'pipeline' ? (
        /* Kanban Pipeline View */
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3.5 overflow-x-auto pb-4">
          {PIPELINE_COLUMNS.map((col) => {
            const colQuotes = quotations.filter((q) => {
              if (col.status === QUOTATION_STATUSES.PENDING_MANAGER_APPROVAL) {
                return (
                  q.status === QUOTATION_STATUSES.PENDING_MANAGER_APPROVAL ||
                  q.status === QUOTATION_STATUSES.PENDING_FINANCE_APPROVAL
                );
              }
              return q.status === col.status;
            });

            return (
              <div key={col.status} className="bg-slate-100/75 rounded-xl p-3 flex flex-col min-h-[480px]">
                <div className="flex items-center justify-between pb-2 mb-2.5 border-b border-slate-200">
                  <span className="text-xs font-bold text-slate-800">{col.label}</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white text-slate-600 shadow-2xs">
                    {colQuotes.length}
                  </span>
                </div>

                <div className="flex-1 space-y-2.5">
                  {colQuotes.map((quote) => (
                    <Card
                      key={quote.id}
                      onClick={() => navigate(`/app/quotations/${quote.id}`)}
                      className={`p-3 cursor-pointer hover:border-primary/50 transition-all border-l-4 ${col.color}`}
                    >
                      <div className="flex items-start justify-between gap-1 mb-1.5">
                        <span className="text-[11px] font-bold text-slate-800 truncate">
                          {quote.customer.name}
                        </span>
                        <Badge
                          variant={quote.customer.tier === 'GOLD' ? 'tierGold' : quote.customer.tier === 'SILVER' ? 'tierSilver' : 'tierBronze'}
                          size="sm"
                          className="text-[9px]"
                        >
                          {quote.customer.tier}
                        </Badge>
                      </div>

                      <div className="text-sm font-black text-slate-900 mb-2">
                        {formatCurrency(quote.totalAmount)}
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-100">
                        <span className="font-mono text-[10px] text-slate-400">{quote.quotationNumber}</span>
                        <RiskScoreIndicator score={quote.blendedRiskScore} size="sm" />
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Standard List View */
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="divide-y divide-slate-100">
            {quotations.map((quote) => (
              <div
                key={quote.id}
                onClick={() => navigate(`/app/quotations/${quote.id}`)}
                className="p-4 hover:bg-slate-50/70 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer"
              >
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-primary font-bold text-xs shrink-0">
                    QT
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-slate-900">{quote.customer.name}</span>
                      <Badge
                        variant={quote.customer.tier === 'GOLD' ? 'tierGold' : quote.customer.tier === 'SILVER' ? 'tierSilver' : 'tierBronze'}
                        size="sm"
                        className="text-[10px]"
                      >
                        {quote.customer.tier}
                      </Badge>
                      <QuotationStatusBadge status={quote.status} />
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
                      <span className="font-mono font-medium text-slate-600">{quote.quotationNumber}</span>
                      <span>•</span>
                      <span>Rep: {quote.repName}</span>
                      <span>•</span>
                      <span>Valid until: {formatDate(quote.validUntil)}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-5">
                  <div className="text-right">
                    <div className="text-base font-black text-slate-900">{formatCurrency(quote.totalAmount)}</div>
                    <div className="text-[11px] font-semibold text-emerald-600">
                      Margin: {quote.overallMarginPct.toFixed(1)}%
                    </div>
                  </div>

                  <RiskScoreIndicator score={quote.blendedRiskScore} size="sm" />

                  <ArrowRight className="w-4 h-4 text-slate-400" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
