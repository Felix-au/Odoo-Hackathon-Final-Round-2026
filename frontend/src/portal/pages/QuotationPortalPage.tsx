import React, { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { usePortalQuotations, usePortalQuotation } from '../../api/hooks/usePortalQuotation';
import { LoadingSpinner } from '../../components/feedback/LoadingSpinner';
import { formatCurrency } from '../../lib/utils';
import {
  CheckCircle2,
  Clock,
  MessageSquare,
  Search,
  Check,
  X,
  FileText,
  Printer,
  ChevronRight,
  Building2,
  AlertCircle,
  Package,
  Calendar,
  Layers,
  ShieldCheck,
  Send,
  Sliders,
  Loader2
} from 'lucide-react';
import { toast } from 'sonner';

export function QuotationPortalPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // 1. Fetch all quotations available to this portal customer
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const { data: quoteListData, isLoading: isListLoading } = usePortalQuotations();

  const allQuotations = useMemo(() => {
    return quoteListData?.quotations || [];
  }, [quoteListData]);

  // Determine active quotation ID
  const activeQuoteId = useMemo(() => {
    if (id && id !== 'q-001' && id !== 'sample') {
      return id;
    }
    // Default to the first quote that is SENT, or first available
    const sentQuote = allQuotations.find((q) => q.status === 'SENT');
    if (sentQuote) return sentQuote.id;
    if (allQuotations.length > 0) return allQuotations[0].id;
    return id || 'q-001';
  }, [id, allQuotations]);

  // 2. Fetch active quotation details
  const {
    quotation,
    isLoading: isQuoteLoading,
    submitNegotiation,
    confirmQuotation,
    rejectQuotation,
    isSubmitting,
  } = usePortalQuotation(activeQuoteId);

  // Sync URL when picking a quotation from the list
  const handleSelectQuotation = (selectedId: string) => {
    navigate(`/portal/quotations/${selectedId}`);
  };

  // Modals state
  const [showAcceptModal, setShowAcceptModal] = useState(false);
  const [showNegotiateModal, setShowNegotiateModal] = useState(false);
  const [showDeclineModal, setShowDeclineModal] = useState(false);

  // Negotiation form state
  const [proposedDiscount, setProposedDiscount] = useState<number>(20);
  const [negotiationMessage, setNegotiationMessage] = useState<string>(
    'We are ready to move forward if we can get a competitive volume discount.'
  );

  // Decline form state
  const [declineReason, setDeclineReason] = useState<string>('Pricing higher than budget');
  const [declineNotes, setDeclineNotes] = useState<string>('');

  // Filtered quotations for picker sidebar
  const filteredQuotations = useMemo(() => {
    return allQuotations.filter((q) => {
      // Status filter
      if (statusFilter === 'ACTION_REQUIRED' && q.status !== 'SENT') return false;
      if (statusFilter === 'UNDER_NEGOTIATION' && q.status !== 'UNDER_NEGOTIATION') return false;
      if (statusFilter === 'CONFIRMED' && q.status !== 'CONFIRMED') return false;

      // Search filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const num = (q.quotationNumber || q.id || '').toLowerCase();
        const customerName = (q.customer?.name || '').toLowerCase();
        const lineNames = (q.lines || []).map((l: any) => l.productName?.toLowerCase() || '').join(' ');
        return num.includes(query) || customerName.includes(query) || lineNames.includes(query);
      }
      return true;
    });
  }, [allQuotations, statusFilter, searchQuery]);

  // Derived active quote metrics
  const activeQuoteNumber = quotation?.quotationNumber || (quotation?.id ? `DF-${quotation.id.slice(0, 6).toUpperCase()}` : 'DF-10482');
  const activeTotal = Number(quotation?.totalAmount || 0);
  const activeLines = quotation?.lines || [];
  const isConfirmed = quotation?.status === 'CONFIRMED';
  const isUnderNegotiation = quotation?.status === 'UNDER_NEGOTIATION';
  const isRejected = quotation?.status === 'REJECTED';
  const isSent = quotation?.status === 'SENT';
  const canTakeAction = isSent || isUnderNegotiation || quotation?.status === 'APPROVED';

  // Live calculation of counter-proposal
  const counterTotal = useMemo(() => {
    if (!quotation) return activeTotal;
    const effectiveDiscount = proposedDiscount / 100;
    let sum = 0;
    activeLines.forEach((line: any) => {
      const unitPrice = Number(line.unitPrice || 0);
      const qty = Number(line.quantity || 1);
      const discount = Math.max(Number(line.discountPct || 0) / 100, effectiveDiscount);
      sum += unitPrice * qty * (1 - discount);
    });
    return sum > 0 ? sum : activeTotal * (1 - (proposedDiscount / 100));
  }, [quotation, activeLines, activeTotal, proposedDiscount]);

  const counterSavings = Math.max(0, activeTotal - counterTotal);

  // Handle Confirm Submission
  const handleConfirmSubmit = async () => {
    try {
      await confirmQuotation();
      setShowAcceptModal(false);
    } catch {
      // Error handled by hook toast
    }
  };

  // Handle Negotiate Submission
  const handleNegotiateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!negotiationMessage.trim()) {
      toast.error('Please enter a message explaining your counter-proposal');
      return;
    }
    try {
      await submitNegotiation({
        proposedDiscount,
        message: negotiationMessage,
      });
      setShowNegotiateModal(false);
    } catch {
      // Error handled by hook toast
    }
  };

  // Handle Decline Submission
  const handleDeclineSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const fullReason = declineNotes.trim() ? `${declineReason} — ${declineNotes.trim()}` : declineReason;
      await rejectQuotation({ reason: fullReason });
      setShowDeclineModal(false);
    } catch {
      // Error handled by hook toast
    }
  };

  // Print summary
  const handlePrint = () => {
    window.print();
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'CONFIRMED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-[#141414] text-emerald-400 border border-emerald-500/30">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>Accepted & Confirmed</span>
          </span>
        );
      case 'SENT':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-[#161616] text-white border border-[#2E2E2E]">
            <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
            <span>Ready for Review</span>
          </span>
        );
      case 'UNDER_NEGOTIATION':
      case 'PENDING_MANAGER_APPROVAL':
      case 'PENDING_FINANCE_APPROVAL':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-[#141414] text-amber-400 border border-amber-500/30">
            <Clock className="w-3.5 h-3.5 text-amber-400" />
            <span>Under Negotiation</span>
          </span>
        );
      case 'REJECTED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-[#141414] text-rose-400 border border-rose-500/30">
            <X className="w-3.5 h-3.5 text-rose-400" />
            <span>Declined</span>
          </span>
        );
      case 'APPROVED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-[#161616] text-zinc-300 border border-[#2E2E2E]">
            <ShieldCheck className="w-3.5 h-3.5 text-zinc-400" />
            <span>Approved by DealFlow360</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-[#141414] text-zinc-400 border border-[#262626]">
            <span>{status.replace(/_/g, ' ')}</span>
          </span>
        );
    }
  };

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-300">
      {/* Top Banner / Welcome */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-[#1F1F1F]">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <span>Your Proposals & Quotations</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#141414] text-zinc-300 border border-[#262626] font-mono">
              {allQuotations.length} total
            </span>
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            Review commercial proposals, negotiate terms, or confirm quotes for immediate order processing.
          </p>
        </div>

        {/* Global actions */}
        <div className="flex items-center gap-2 self-start md:self-auto">
          <button
            type="button"
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#141414] hover:bg-[#1F1F1F] border border-[#262626] text-xs font-medium text-zinc-300 hover:text-white transition-colors"
          >
            <Printer className="w-3.5 h-3.5 text-zinc-400" />
            <span>Print View</span>
          </button>
        </div>
      </div>

      {/* Main Split Grid: Left = Picker / Quotations List, Right = Detailed Proposal */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* ─── LEFT COLUMN: Quotations Selector (Pick & Choose) ─── */}
        <div className="lg:col-span-4 bg-[#0A0A0A] border border-[#1F1F1F] rounded-2xl p-4 space-y-4 shadow-xl">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold tracking-wider text-zinc-400 uppercase font-mono flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-zinc-400" />
              <span>Select Quotation</span>
            </h2>
            <span className="text-[11px] text-zinc-500 font-mono">
              {filteredQuotations.length} available
            </span>
          </div>

          {/* Search box */}
          <div className="relative">
            <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by quote # or item..."
              className="w-full bg-[#121212] border border-[#222222] rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-400 transition-colors"
            />
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs">
            <button
              type="button"
              onClick={() => setStatusFilter('ALL')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-all shrink-0 ${
                statusFilter === 'ALL'
                  ? 'bg-white text-black font-bold shadow-sm'
                  : 'bg-[#121212] text-zinc-400 hover:text-white border border-[#222222]'
              }`}
            >
              All ({allQuotations.length})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('ACTION_REQUIRED')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-all shrink-0 ${
                statusFilter === 'ACTION_REQUIRED'
                  ? 'bg-white text-black font-bold shadow-sm'
                  : 'bg-[#121212] text-zinc-400 hover:text-white border border-[#222222]'
              }`}
            >
              Action Required
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('UNDER_NEGOTIATION')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-all shrink-0 ${
                statusFilter === 'UNDER_NEGOTIATION'
                  ? 'bg-white text-black font-bold shadow-sm'
                  : 'bg-[#121212] text-zinc-400 hover:text-white border border-[#222222]'
              }`}
            >
              Negotiating
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('CONFIRMED')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-all shrink-0 ${
                statusFilter === 'CONFIRMED'
                  ? 'bg-white text-black font-bold shadow-sm'
                  : 'bg-[#121212] text-zinc-400 hover:text-white border border-[#222222]'
              }`}
            >
              Confirmed
            </button>
          </div>

          {/* Scrollable List of Quotations */}
          <div className="space-y-2 max-h-[580px] overflow-y-auto pr-1">
            {isListLoading ? (
              <div className="py-12 flex justify-center">
                <LoadingSpinner label="Loading proposals..." />
              </div>
            ) : filteredQuotations.length === 0 ? (
              <div className="p-8 text-center bg-[#0D0D0D] rounded-xl border border-[#1F1F1F]">
                <FileText className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
                <p className="text-xs font-medium text-zinc-400">No proposals matching filters</p>
                <button
                  type="button"
                  onClick={() => {
                    setStatusFilter('ALL');
                    setSearchQuery('');
                  }}
                  className="mt-2 text-xs text-zinc-300 hover:underline cursor-pointer"
                >
                  Clear filters
                </button>
              </div>
            ) : (
              filteredQuotations.map((q) => {
                const isSelected = q.id === activeQuoteId;
                const quoteNum = q.quotationNumber || `DF-${q.id.slice(0, 6).toUpperCase()}`;
                const topProduct = q.lines?.[0]?.productName || 'Custom Configuration';
                const linesCount = q.lines?.length || 0;
                const quoteAmount = Number(q.totalAmount || 0);

                return (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() => handleSelectQuotation(q.id)}
                    className={`w-full text-left p-3.5 rounded-xl border transition-all flex flex-col gap-2 relative cursor-pointer ${
                      isSelected
                        ? 'bg-[#171717] border-white/70 shadow-lg ring-1 ring-white/20'
                        : 'bg-[#0D0D0D] border-[#1F1F1F] hover:border-zinc-600 hover:bg-[#121212]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs font-bold text-white flex items-center gap-1.5">
                        <FileText className={`w-3.5 h-3.5 ${isSelected ? 'text-white' : 'text-zinc-500'}`} />
                        <span>{quoteNum}</span>
                      </span>
                      {getStatusBadge(q.status)}
                    </div>

                    <div className="flex items-center justify-between text-xs text-zinc-400">
                      <span className="truncate max-w-[170px] text-zinc-300 font-medium">
                        {topProduct} {linesCount > 1 ? `+${linesCount - 1} more` : ''}
                      </span>
                      <span className="font-mono text-sm font-bold text-white shrink-0">
                        {formatCurrency(quoteAmount)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-zinc-500 pt-1 border-t border-[#1C1C1C]">
                      <span>
                        {q.createdAt ? new Date(q.createdAt).toLocaleDateString() : 'Active deal'}
                      </span>
                      {isSelected ? (
                        <span className="text-white font-semibold flex items-center gap-0.5">
                          Viewing <ChevronRight className="w-3 h-3" />
                        </span>
                      ) : (
                        <span className="hover:text-zinc-300 flex items-center gap-0.5">
                          Click to open
                        </span>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* ─── RIGHT COLUMN: Detailed Proposal View ─── */}
        <div className="lg:col-span-8 space-y-6">
          {isQuoteLoading && !quotation ? (
            <div className="p-20 flex justify-center bg-[#0A0A0A] border border-[#1F1F1F] rounded-3xl">
              <LoadingSpinner label="Loading proposal details..." />
            </div>
          ) : !quotation ? (
            <div className="p-12 text-center bg-[#0A0A0A] border border-[#1F1F1F] rounded-3xl">
              <AlertCircle className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
              <h2 className="text-base font-bold text-white">Quotation not found</h2>
              <p className="text-xs text-zinc-400 mt-1 max-w-sm mx-auto">
                Please select an active proposal from the list on the left to review its commercial terms.
              </p>
            </div>
          ) : (
            <>
              {/* Confirmed Banner Alert */}
              {isConfirmed && (
                <div className="p-5 rounded-2xl bg-[#0D0D0D] border border-emerald-500/40 text-white shadow-lg flex items-start gap-4 animate-in fade-in">
                  <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 shrink-0 mt-0.5 border border-emerald-500/20">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-emerald-300">Proposal Confirmed & Order Initiated</h3>
                    <p className="text-xs text-zinc-300 mt-1 leading-relaxed">
                      Thank you for approving Quote #{activeQuoteNumber}. Our automated orchestration engine has routed this order to Fulfillment & Billing. Your account executive will follow up with shipment tracking.
                    </p>
                  </div>
                </div>
              )}

              {/* Under Negotiation Banner Alert */}
              {isUnderNegotiation && (
                <div className="p-5 rounded-2xl bg-[#0D0D0D] border border-amber-500/40 text-white shadow-lg flex items-start gap-4 animate-in fade-in">
                  <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 shrink-0 mt-0.5 border border-amber-500/20">
                    <Clock className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-amber-300">Counter-Offer Under Review</h3>
                    <p className="text-xs text-zinc-300 mt-1 leading-relaxed">
                      Your negotiation request is currently being reviewed by the account manager and governance team. You will be notified as soon as revised commercial terms are published.
                    </p>
                  </div>
                </div>
              )}

              {/* Declined Banner Alert */}
              {isRejected && (
                <div className="p-5 rounded-2xl bg-[#0D0D0D] border border-rose-500/40 text-white shadow-lg flex items-start gap-4 animate-in fade-in">
                  <div className="p-2 rounded-xl bg-rose-500/10 text-rose-400 shrink-0 mt-0.5 border border-rose-500/20">
                    <X className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-rose-300">Proposal Declined</h3>
                    <p className="text-xs text-zinc-300 mt-1 leading-relaxed">
                      You have declined this proposal. If your project requirements or timeline change, please reach out to your sales representative to request a new proposal.
                    </p>
                  </div>
                </div>
              )}

              {/* Main Proposal Container (Obsidian Pure Black Luxury) */}
              <div className="bg-[#0A0A0A] border border-[#1F1F1F] rounded-3xl p-6 sm:p-10 shadow-2xl relative overflow-hidden">
                {/* Proposal Top Header */}
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-6 border-b border-[#1F1F1F]">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-mono font-bold uppercase tracking-widest text-zinc-400">
                        Enterprise Commercial Proposal
                      </span>
                      <span className="text-zinc-600">·</span>
                      <span className="text-[11px] font-mono text-zinc-400">
                        Quote #{activeQuoteNumber}
                      </span>
                    </div>

                    <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white mt-1.5">
                      {activeLines[0]?.productName
                        ? `${activeLines[0].productName} Enterprise Solution`
                        : 'Enterprise Infrastructure & Licensing'}
                    </h2>

                    <div className="text-xs sm:text-sm text-zinc-400 mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
                      <span className="flex items-center gap-1">
                        <Building2 className="w-3.5 h-3.5 text-zinc-500" />
                        Prepared for <strong className="text-zinc-200 font-semibold">{quotation.customer?.name || 'Valued Client'}</strong>
                      </span>
                      <span className="text-zinc-600">·</span>
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-zinc-500" />
                        Issued on {new Date(quotation.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col items-start sm:items-end gap-1.5 shrink-0">
                    {getStatusBadge(quotation.status)}
                    <span className="text-[11px] text-zinc-500 font-mono">
                      Validity: 30 days from issue
                    </span>
                  </div>
                </div>

                {/* Line Items Table */}
                <div className="mt-6">
                  <h3 className="text-xs font-bold uppercase font-mono tracking-wider text-zinc-400 mb-3 flex items-center gap-1.5">
                    <Package className="w-3.5 h-3.5 text-zinc-400" />
                    <span>Included Products & Services</span>
                  </h3>

                  <div className="overflow-x-auto border border-[#1F1F1F] rounded-2xl bg-[#080808]">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-[#0E0E0E] text-zinc-400 uppercase font-mono tracking-wider text-[10px] border-b border-[#1F1F1F] font-semibold">
                        <tr>
                          <th className="py-3 px-4">Item & Description</th>
                          <th className="py-3 px-3 text-center">Qty</th>
                          <th className="py-3 px-3 text-right">Unit Price</th>
                          <th className="py-3 px-3 text-right">Discount</th>
                          <th className="py-3 px-4 text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#1A1A1A] text-zinc-200">
                        {activeLines.map((line: any, idx: number) => {
                          const unitPrice = Number(line.unitPrice || 0);
                          const qty = Number(line.quantity || 1);
                          const discountPct = Number(line.discountPct || 0);
                          const lineTotal = Number(line.lineTotal || (unitPrice * qty * (1 - discountPct / 100)));

                          return (
                            <tr key={line.id || idx} className="hover:bg-[#121212] transition-colors">
                              <td className="py-3.5 px-4">
                                <div className="font-semibold text-white">
                                  {line.productName}
                                </div>
                                <div className="text-[11px] text-zinc-400 flex items-center gap-2 mt-0.5">
                                  <span className="px-1.5 py-0.2 rounded bg-[#161616] text-zinc-300 font-mono text-[10px] border border-[#262626]">
                                    {line.categoryName || 'Standard Item'}
                                  </span>
                                  {line.isRecurring && (
                                    <span className="text-zinc-300 font-mono text-[10px]">
                                      · Recurring Subscription
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="py-3.5 px-3 text-center font-mono font-medium text-white">
                                {qty}
                              </td>
                              <td className="py-3.5 px-3 text-right font-mono text-zinc-300">
                                {formatCurrency(unitPrice)}
                              </td>
                              <td className="py-3.5 px-3 text-right font-mono">
                                {discountPct > 0 ? (
                                  <span className="text-emerald-400 font-semibold">
                                    {discountPct}% OFF
                                  </span>
                                ) : (
                                  <span className="text-zinc-500">0%</span>
                                )}
                              </td>
                              <td className="py-3.5 px-4 text-right font-mono font-bold text-white text-sm">
                                {formatCurrency(lineTotal)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Financial Summary Calculation */}
                <div className="mt-6 pt-6 border-t border-[#1F1F1F] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
                  <div className="text-xs text-zinc-400 max-w-sm">
                    <p className="font-semibold text-zinc-200 mb-1 flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-emerald-400" />
                      <span>Guaranteed Commercial Price</span>
                    </p>
                    <p className="text-[11px] leading-relaxed text-zinc-500">
                      Prices include enterprise tiered discounts and standard SLA. Acceptance confirms delivery terms and fulfillment allocation.
                    </p>
                  </div>

                  <div className="w-full sm:w-72 bg-[#080808] border border-[#1F1F1F] rounded-2xl p-4 space-y-2">
                    <div className="flex items-center justify-between text-xs text-zinc-400">
                      <span>Subtotal</span>
                      <span className="font-mono text-zinc-200">
                        {formatCurrency(Number(quotation.subtotalAmount || quotation.totalAmount || 0))}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs text-zinc-400">
                      <span>Tax / Duty</span>
                      <span className="font-mono text-zinc-200">₹0.00</span>
                    </div>

                    <div className="pt-2 border-t border-[#1F1F1F] flex items-center justify-between">
                      <span className="text-sm font-bold text-white">Grand Total</span>
                      <span className="text-xl sm:text-2xl font-bold font-mono text-white tracking-tight">
                        {formatCurrency(activeTotal)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Action Buttons Bar */}
                {canTakeAction && !isConfirmed && (
                  <div className="mt-8 pt-6 border-t border-[#1F1F1F] flex flex-wrap items-center justify-end gap-3">
                    {/* Decline Button */}
                    <button
                      type="button"
                      disabled={isSubmitting}
                      onClick={() => setShowDeclineModal(true)}
                      className="px-4 py-2.5 rounded-xl border border-[#222222] hover:border-rose-500/40 bg-transparent text-zinc-400 hover:text-rose-400 text-xs sm:text-sm font-semibold transition-all focus:outline-none disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                      <span>Decline</span>
                    </button>

                    {/* Negotiate Button */}
                    <button
                      type="button"
                      disabled={isSubmitting}
                      onClick={() => setShowNegotiateModal(true)}
                      className="px-5 py-2.5 rounded-xl border border-[#2E2E2E] bg-[#141414] hover:bg-[#1E1E1E] text-zinc-200 hover:text-white text-xs sm:text-sm font-semibold transition-all focus:outline-none disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                    >
                      <MessageSquare className="w-4 h-4 text-zinc-400" />
                      <span>Negotiate Terms</span>
                    </button>

                    {/* Accept Button */}
                    <button
                      type="button"
                      disabled={isSubmitting}
                      onClick={() => setShowAcceptModal(true)}
                      className="px-6 py-2.5 rounded-xl bg-white hover:bg-zinc-200 text-black text-xs sm:text-sm font-bold transition-all shadow-lg shadow-white/5 focus:outline-none disabled:opacity-50 flex items-center gap-2 cursor-pointer"
                    >
                      <Check className="w-4 h-4 text-black" />
                      <span>Accept & Confirm Proposal</span>
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ─── MODAL 1: ACCEPT & CONFIRM MODAL ─── */}
      {showAcceptModal && quotation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in">
          <div className="bg-[#0A0A0A] border border-[#1F1F1F] rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-[#141414] border border-[#262626] text-emerald-400">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Confirm & Sign Proposal</h3>
                  <p className="text-xs text-zinc-400 font-mono">Quote #{activeQuoteNumber}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAcceptModal(false)}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-[#1A1A1A] transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-[#080808] border border-[#1F1F1F] rounded-2xl p-4 space-y-2 text-xs">
              <div className="flex justify-between text-zinc-400">
                <span>Customer</span>
                <span className="font-semibold text-zinc-200">{quotation.customer?.name}</span>
              </div>
              <div className="flex justify-between text-zinc-400">
                <span>Items</span>
                <span className="font-semibold text-zinc-200">{activeLines.length} product(s)</span>
              </div>
              <div className="flex justify-between pt-2 border-t border-[#1F1F1F]">
                <span className="font-bold text-white">Total Order Value</span>
                <span className="font-mono text-base font-bold text-emerald-400">{formatCurrency(activeTotal)}</span>
              </div>
            </div>

            <p className="text-xs text-zinc-400 leading-relaxed">
              By clicking <strong className="text-white">Confirm Order</strong>, you agree to the commercial terms and pricing outlined in this proposal. DealFlow360 will allocate reserved inventory and initiate order fulfillment immediately.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => setShowAcceptModal(false)}
                className="px-4 py-2 rounded-xl border border-[#222222] text-xs font-semibold text-zinc-300 hover:bg-[#141414]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleConfirmSubmit}
                className="px-5 py-2 rounded-xl bg-white hover:bg-zinc-200 text-black text-xs font-bold transition-all shadow-md shadow-white/5 flex items-center gap-2 cursor-pointer"
              >
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin text-black" /> : <Check className="w-4 h-4 text-black" />}
                <span>{isSubmitting ? 'Confirming...' : 'Confirm Order'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL 2: NEGOTIATE / COUNTER-OFFER MODAL ─── */}
      {showNegotiateModal && quotation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in">
          <div className="bg-[#0A0A0A] border border-[#1F1F1F] rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-[#141414] border border-[#262626] text-amber-400">
                  <Sliders className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Negotiate Commercial Terms</h3>
                  <p className="text-xs text-zinc-400">Submit a structured counter-proposal for review</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowNegotiateModal(false)}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-[#1A1A1A] transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleNegotiateSubmit} className="space-y-4 text-xs">
              {/* Counter Discount Slider */}
              <div className="bg-[#080808] border border-[#1F1F1F] rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="font-semibold text-zinc-200">
                    Requested Discount Percentage
                  </label>
                  <span className="font-mono text-sm font-bold text-amber-400 bg-[#141414] px-2 py-0.5 rounded border border-[#2E2E2E]">
                    {proposedDiscount}%
                  </span>
                </div>

                <input
                  type="range"
                  min="0"
                  max="40"
                  step="1"
                  value={proposedDiscount}
                  onChange={(e) => setProposedDiscount(Number(e.target.value))}
                  className="w-full accent-white cursor-pointer"
                />

                <div className="flex items-center justify-between text-[11px] text-zinc-400 pt-2 border-t border-[#1A1A1A]">
                  <span>
                    Current Total: <strong className="text-zinc-200 font-mono">{formatCurrency(activeTotal)}</strong>
                  </span>
                  <span>
                    Proposed Total: <strong className="text-emerald-400 font-mono">{formatCurrency(counterTotal)}</strong>
                  </span>
                </div>
                {counterSavings > 0 && (
                  <div className="text-[11px] text-emerald-400 font-medium text-right">
                    Estimated Savings: {formatCurrency(counterSavings)}
                  </div>
                )}
              </div>

              {/* Message justification */}
              <div>
                <label className="block font-semibold text-zinc-200 mb-1.5">
                  Counter-Proposal Rationale & Comments
                </label>
                <textarea
                  rows={3}
                  value={negotiationMessage}
                  onChange={(e) => setNegotiationMessage(e.target.value)}
                  placeholder="Explain your volume, budget requirements, or desired contract duration..."
                  required
                  className="w-full bg-[#080808] border border-[#1F1F1F] rounded-xl p-3 text-xs text-zinc-200 focus:outline-none focus:border-zinc-400 placeholder-zinc-600"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => setShowNegotiateModal(false)}
                  className="px-4 py-2 rounded-xl border border-[#222222] text-xs font-semibold text-zinc-300 hover:bg-[#141414]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl bg-white hover:bg-zinc-200 text-black text-xs font-bold transition-all shadow-md shadow-white/5 flex items-center gap-2 cursor-pointer"
                >
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin text-black" /> : <Send className="w-3.5 h-3.5 text-black" />}
                  <span>{isSubmitting ? 'Submitting...' : 'Submit Counter-Offer'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL 3: DECLINE PROPOSAL MODAL ─── */}
      {showDeclineModal && quotation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in">
          <div className="bg-[#0A0A0A] border border-[#1F1F1F] rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-[#141414] border border-[#262626] text-rose-400">
                  <X className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Decline Proposal</h3>
                  <p className="text-xs text-zinc-400 font-mono">Quote #{activeQuoteNumber}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowDeclineModal(false)}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-[#1A1A1A] transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleDeclineSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-zinc-200 mb-1.5">
                  Primary Reason for Declining
                </label>
                <select
                  value={declineReason}
                  onChange={(e) => setDeclineReason(e.target.value)}
                  className="w-full bg-[#080808] border border-[#1F1F1F] rounded-xl p-2.5 text-xs text-zinc-200 focus:outline-none focus:border-zinc-400"
                >
                  <option value="Pricing higher than budget">Pricing higher than current budget</option>
                  <option value="Specifications did not meet requirements">Specifications did not meet project requirements</option>
                  <option value="Selected alternative solution">Selected alternative solution or provider</option>
                  <option value="Project postponed or cancelled">Project postponed or cancelled</option>
                  <option value="Other">Other reason</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-zinc-200 mb-1.5">
                  Additional Notes (Optional)
                </label>
                <textarea
                  rows={2}
                  value={declineNotes}
                  onChange={(e) => setDeclineNotes(e.target.value)}
                  placeholder="Provide feedback to help us tailor future proposals..."
                  className="w-full bg-[#080808] border border-[#1F1F1F] rounded-xl p-3 text-xs text-zinc-200 focus:outline-none focus:border-zinc-400 placeholder-zinc-600"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => setShowDeclineModal(false)}
                  className="px-4 py-2 rounded-xl border border-[#222222] text-xs font-semibold text-zinc-300 hover:bg-[#141414]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-all shadow-md shadow-rose-600/30 flex items-center gap-1.5 cursor-pointer"
                >
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin text-white" /> : <X className="w-3.5 h-3.5" />}
                  <span>{isSubmitting ? 'Declining...' : 'Decline Proposal'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
