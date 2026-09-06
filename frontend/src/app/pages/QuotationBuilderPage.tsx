import { useState, useMemo, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuotation, useQuotationBuilder, useUpsellSuggestions } from '../../api/hooks/useQuotationBuilder';
import { useProducts } from '../../api/hooks/useCatalog';
import { useCustomers } from '../../api/hooks/useQuotations';
import { useAuthStore } from '../../stores/auth.store';
import { LoadingSpinner } from '../../components/feedback/LoadingSpinner';
import { formatCurrency, formatQuotationNumber } from '../../lib/utils';
import {
  Plus,
  Trash2,
  Sparkles,
  ArrowLeft,
  Send,
  ShieldCheck,
  Check,
  Building2,
  FileText,
  ArrowUpRight,
  Copy,
  AlertTriangle,
  Clock,
  Lock,
  MessageSquare,
} from 'lucide-react';
import { toast } from 'sonner';

const STATUS_CONFIG: Record<
  string,
  { label: string; dotColor: string; badgeClass: string }
> = {
  DRAFT: {
    label: 'Draft',
    dotColor: 'bg-zinc-400',
    badgeClass: 'bg-zinc-500/10 text-zinc-300 border-zinc-500/20',
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
    dotColor: 'bg-emerald-400',
    badgeClass: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
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

export function QuotationBuilderPage() {
  const { id = 'quot-000000-0000-0000-0000-000000000001' } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: quote, isLoading: isQuoteLoading } = useQuotation(id);
  const {
    addLine,
    updateLine,
    removeLine,
    submitQuotation,
    sendQuotation,
    updateMetadata,
    isUpdating,
  } = useQuotationBuilder(id);

  const { data: upsellSuggestions = [] } = useUpsellSuggestions(id);
  const { data: catalogProducts = [] } = useProducts();
  const { data: customers = [] } = useCustomers();

  // Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [addQuantity, setAddQuantity] = useState(1);
  const [addUnitPrice, setAddUnitPrice] = useState<number | null>(null);
  const [addDiscount, setAddDiscount] = useState(0);

  // Metadata editing state
  const [notes, setNotes] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [isSavingMetadata, setIsSavingMetadata] = useState(false);
  const [hasCopiedQuoteId, setHasCopiedQuoteId] = useState(false);

  // Inline line items edit tracking
  const [inlineEdits, setInlineEdits] = useState<
    Record<string, { quantity: number; unitPrice: number; discountPct: number; isDirty: boolean }>
  >({});

  // Sync quote data into state
  useEffect(() => {
    if (quote) {
      setNotes((quote as any).notes || '');
      setSelectedCustomerId(quote.customerId || quote.customer?.id || '');
      if (quote.validUntil) {
        try {
          const d = new Date(quote.validUntil);
          if (!isNaN(d.getTime())) {
            setValidUntil(d.toISOString().split('T')[0]);
          }
        } catch {
          // ignore
        }
      }
    }
  }, [quote]);

  // Working lines
  const lines = useMemo(() => {
    return quote?.lines ?? [];
  }, [quote]);

  // Initialize inline edits whenever lines change
  useEffect(() => {
    if (lines.length > 0) {
      setInlineEdits((prev) => {
        const next = { ...prev };
        lines.forEach((l: any) => {
          if (!next[l.id] || !next[l.id].isDirty) {
            next[l.id] = {
              quantity: Number(l.quantity) || 1,
              unitPrice: Number(l.unitPrice) || 0,
              discountPct: Number(l.discountPct) || 0,
              isDirty: false,
            };
          }
        });
        return next;
      });
    }
  }, [lines]);

  // Handle selected product change in add modal to auto-populate base price
  const handleProductSelectChange = (productId: string) => {
    setSelectedProductId(productId);
    const prod = catalogProducts.find((p) => p.id === productId);
    if (prod) {
      setAddUnitPrice(Number(prod.basePrice || 100));
    }
  };

  // Financial calculations
  const subtotal = useMemo(() => {
    return lines.reduce((acc: number, l: any) => {
      const edit = inlineEdits[l.id];
      const qty = edit ? edit.quantity : Number(l.quantity) || 1;
      const price = edit ? edit.unitPrice : Number(l.unitPrice) || 0;
      return acc + qty * price;
    }, 0);
  }, [lines, inlineEdits]);

  const discountTotal = useMemo(() => {
    return lines.reduce((acc: number, l: any) => {
      const edit = inlineEdits[l.id];
      const qty = edit ? edit.quantity : Number(l.quantity) || 1;
      const price = edit ? edit.unitPrice : Number(l.unitPrice) || 0;
      const disc = edit ? edit.discountPct : Number(l.discountPct) || 0;
      return acc + (qty * price * disc) / 100;
    }, 0);
  }, [lines, inlineEdits]);

  const netAfterDiscount = Math.max(0, subtotal - discountTotal);
  const tax = Math.round(netAfterDiscount * 0.1);
  const total = netAfterDiscount + tax;

  const quoteNumber = formatQuotationNumber(quote || id);
  const riskScore = quote?.blendedRiskScore ?? quote?.riskScore ?? 0;
  const statusKey = quote?.status || 'DRAFT';
  const statusConf = STATUS_CONFIG[statusKey] || STATUS_CONFIG.DRAFT;

  // Dynamic cost & margin calculation based on live inline edits
  const totalCost = useMemo(() => {
    return lines.reduce((acc: number, l: any) => {
      const edit = inlineEdits[l.id];
      const qty = edit ? edit.quantity : Number(l.quantity) || 1;
      const unitPrice = edit ? edit.unitPrice : Number(l.unitPrice) || 0;
      const catalogItem = catalogProducts.find((p) => p.id === l.productId);
      const unitCost = Number(l.costPrice) > 0
        ? Number(l.costPrice)
        : (catalogItem && Number(catalogItem.costPrice) > 0
            ? Number(catalogItem.costPrice)
            : (unitPrice > 0 ? Math.round(unitPrice * 0.65 * 100) / 100 : 0));
      return acc + qty * unitCost;
    }, 0);
  }, [lines, inlineEdits, catalogProducts]);

  const marginPct = useMemo(() => {
    if (netAfterDiscount <= 0) return 0;
    if (lines.length === 0) {
      return Math.round(Number((quote as any)?.totalMarginPct || quote?.overallMarginPct || 0));
    }
    const computed = ((netAfterDiscount - totalCost) / netAfterDiscount) * 100;
    return Math.max(0, Math.min(100, Math.round(computed)));
  }, [netAfterDiscount, totalCost, lines.length, quote]);

  const user = useAuthStore((s) => s.user);

  const customerTier = (quote?.customer?.tier || 'GOLD').toUpperCase();
  const tierCeiling = customerTier === 'PLATINUM' ? 20 : customerTier === 'GOLD' ? 15 : customerTier === 'SILVER' ? 10 : 5;

  const latestNegotiation = useMemo(() => {
    if (!quote?.negotiations || quote.negotiations.length === 0) return null;
    return quote.negotiations[0];
  }, [quote?.negotiations]);

  // Check if quotation requires approval based on blended risk score or margin violation
  // IMPORTANT: Requires at least one line item added before initiating governance review warnings
  const hasRiskScore = lines.length > 0 && riskScore > 0;
  const isCFOApprovalRequired = lines.length > 0 && (riskScore > 30 || marginPct < 15);
  const requiresReview = lines.length > 0 && (hasRiskScore || marginPct < 30);

  const reviewTargetName = isCFOApprovalRequired ? 'CFO (Madhab CFO)' : 'Sales Manager (Atharva Manager)';
  const reviewActionLabel = isCFOApprovalRequired ? 'Submit for CFO Review' : 'Submit for Manager Review';

  const handleApplyNegotiatedDiscount = (discount: number) => {
    const nextEdits: Record<string, any> = { ...inlineEdits };
    lines.forEach((l: any) => {
      const current = nextEdits[l.id] || {
        quantity: Number(l.quantity) || 1,
        unitPrice: Number(l.unitPrice) || 0,
        discountPct: Number(l.discountPct) || 0,
      };
      nextEdits[l.id] = {
        ...current,
        discountPct: discount,
        isDirty: true,
      };
    });
    setInlineEdits(nextEdits);
    toast.success(`Applied counter-offer discount (${discount}%) to all lines. Click Save or adjust as needed.`);
  };

  // Save single line item edit
  const handleSaveLine = async (lineId: string) => {
    const edit = inlineEdits[lineId];
    if (!edit) return;
    const l = lines.find((item: any) => item.id === lineId);
    const catalogItem = catalogProducts.find((p) => p.id === l?.productId);
    const costPrice = Number(l?.costPrice) > 0
      ? Number(l?.costPrice)
      : (catalogItem && Number(catalogItem.costPrice) > 0
          ? Number(catalogItem.costPrice)
          : (edit.unitPrice > 0 ? Math.round(edit.unitPrice * 0.65 * 100) / 100 : undefined));

    try {
      await updateLine({
        lineId,
        quantity: edit.quantity,
        unitPrice: edit.unitPrice,
        discountPct: edit.discountPct,
        costPrice,
      });
      setInlineEdits((prev) => ({
        ...prev,
        [lineId]: { ...prev[lineId], isDirty: false },
      }));
      toast.success('Line item updated');
    } catch {
      toast.error('Failed to update line item');
    }
  };

  // Save metadata
  const handleSaveMetadata = async () => {
    setIsSavingMetadata(true);
    try {
      await updateMetadata({
        notes,
        validUntil: validUntil || undefined,
        customerId: selectedCustomerId || undefined,
      });
      toast.success('Quotation details saved');
    } catch {
      toast.error('Failed to save quotation details');
    } finally {
      setIsSavingMetadata(false);
    }
  };

  // Add Product to Quotation
  const handleAddProductSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const product = catalogProducts.find((p) => p.id === selectedProductId);
    if (!product) {
      toast.error('Please select a product');
      return;
    }

    const productCost = Number(product.costPrice) > 0
      ? Number(product.costPrice)
      : Math.round(Number(product.basePrice || 100) * 0.65 * 100) / 100;

    try {
      await addLine({
        productId: product.id,
        productName: product.name,
        categoryName: product.category?.name || 'Hardware',
        categoryId: product.categoryId || product.category?.id,
        quantity: Number(addQuantity) || 1,
        unitPrice: addUnitPrice !== null ? Number(addUnitPrice) : Number(product.basePrice || 100),
        costPrice: productCost,
        discountPct: Number(addDiscount) || 0,
        isRecurring: product.isRecurring,
      });
      setShowAddModal(false);
      setSelectedProductId('');
      setAddQuantity(1);
      setAddUnitPrice(null);
      setAddDiscount(0);
      toast.success(`${product.name} added to quotation`);
    } catch {
      toast.error('Failed to add product');
    }
  };

  // Submit for approval
  const handleSubmitApproval = async () => {
    try {
      await submitQuotation();
      toast.success('Submitted for approval workflow');
      navigate(`/app/quotations/${id}/approval`);
    } catch {
      toast.error('Failed to submit quotation');
    }
  };

  // Send to Customer
  const handleSendToCustomer = async () => {
    if (requiresReview && quote?.status !== 'APPROVED') {
      toast.error('This quotation requires approval before sending to customer. Please submit for approval first.');
      return;
    }
    if (lines.length === 0) {
      toast.error('Cannot send empty quotation. Please add products first.');
      return;
    }
    try {
      await sendQuotation();
      toast.success('Quotation dispatched to customer portal');
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Failed to dispatch quotation';
      toast.error(msg);
    }
  };

  // Copy quote number
  const handleCopyQuoteNumber = () => {
    navigator.clipboard.writeText(quoteNumber);
    setHasCopiedQuoteId(true);
    toast.success(`Copied ${quoteNumber} to clipboard`);
    setTimeout(() => setHasCopiedQuoteId(false), 2000);
  };

  if (isQuoteLoading && !quote) {
    return (
      <div className="py-24 flex justify-center">
        <LoadingSpinner label="Loading quotation details..." />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300 pb-16">
      {/* Top Breadcrumb Navigation */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => navigate('/app/quotations')}
          className="text-xs text-zinc-400 hover:text-white font-medium inline-flex items-center gap-1.5 transition-colors cursor-pointer group"
        >
          <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
          <span>Back to Quotations</span>
        </button>

        <div className="flex items-center gap-2">
          {/* View in Portal */}
          <button
            type="button"
            onClick={() => navigate(`/portal/quotations/${id}`)}
            className="px-3 py-1.5 rounded-xl text-xs font-medium text-zinc-300 hover:text-white bg-[#141414] hover:bg-[#1A1A1A] border border-[#262626] hover:border-zinc-500 transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
          >
            <span>Customer Portal</span>
            <ArrowUpRight className="w-3 h-3 text-zinc-400" />
          </button>

          {/* Workflow Review */}
          <button
            type="button"
            onClick={() => navigate(`/app/quotations/${id}/approval`)}
            className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-[#181818] hover:bg-[#222222] border border-[#2E2E2E] hover:border-zinc-400 text-white transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-zinc-300" />
            <span>Approval Chain</span>
          </button>
        </div>
      </div>

      {/* Header Banner */}
      <div className="bg-[#0A0A0A] border border-[#1F1F1F] rounded-2xl p-6 shadow-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            {/* Quotation Number Pill */}
            <div
              onClick={handleCopyQuoteNumber}
              className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-[#141414] border border-[#282828] hover:border-zinc-400 text-white font-mono font-bold text-sm tracking-wider cursor-pointer transition-colors shadow-inner group"
              title="Click to copy quotation ID"
            >
              <span>{quoteNumber}</span>
              {hasCopiedQuoteId ? (
                <Check className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Copy className="w-3.5 h-3.5 text-zinc-500 group-hover:text-zinc-300" />
              )}
            </div>

            {/* Status Pill */}
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${statusConf.badgeClass}`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${statusConf.dotColor}`} />
              <span>{statusConf.label}</span>
            </span>

            {/* Risk Badge */}
            <span
              className={`px-2.5 py-1 rounded-lg text-xs font-mono font-semibold border ${
                riskScore >= 70
                  ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                  : riskScore >= 35
                  ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                  : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
              }`}
            >
              Risk: {riskScore}
            </span>
          </div>

          <div className="flex items-center gap-2 text-xs text-zinc-400 mt-2">
            <Building2 className="w-3.5 h-3.5 text-zinc-500" />
            <span className="text-white font-medium">
              {quote?.customer?.name || 'Acme Corporation'}
            </span>
            <span>·</span>
            <span className="text-zinc-400">
              Tier: <strong className="text-zinc-300">{quote?.customer?.tier || 'GOLD'}</strong>
            </span>
            <span>·</span>
            <span className="text-zinc-500">{quote?.customer?.email || 'acme@example.com'}</span>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* If quote is APPROVED, Send to Customer is allowed */}
          {quote?.status === 'APPROVED' && (
            <button
              type="button"
              disabled={isUpdating}
              onClick={handleSendToCustomer}
              className="px-5 py-2.5 rounded-xl text-xs font-bold bg-white text-black hover:bg-zinc-200 transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-white/5 flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5 text-black" />
              <span>Send to Customer</span>
            </button>
          )}

          {/* If quote is DRAFT and has NO risk (clean quote), can send directly or submit */}
          {quote?.status === 'DRAFT' && !requiresReview && (
            <>
              <button
                type="button"
                disabled={isUpdating}
                onClick={handleSendToCustomer}
                className="px-5 py-2.5 rounded-xl text-xs font-bold bg-white text-black hover:bg-zinc-200 transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-white/5 flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5 text-black" />
                <span>Send to Customer</span>
              </button>
              {lines.length > 0 && (
                <button
                  type="button"
                  disabled={isUpdating}
                  onClick={handleSubmitApproval}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold bg-[#181818] hover:bg-[#222222] border border-[#2E2E2E] hover:border-zinc-400 text-white transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Submit for Review</span>
                </button>
              )}
            </>
          )}

          {/* If quote is DRAFT and HAS RISK: Send to Customer is BLOCKED with hover tooltip and user MUST submit for review! */}
          {quote?.status === 'DRAFT' && requiresReview && (
            <div className="flex items-center gap-2">
              <div className="relative group inline-block">
                <button
                  type="button"
                  disabled={true}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold bg-[#141414] text-zinc-500 border border-[#262626] flex items-center gap-2 cursor-not-allowed opacity-60 select-none"
                  title="This quotation requires approval before sending to customer. Please submit for approval first."
                >
                  <Lock className="w-3.5 h-3.5 text-zinc-500" />
                  <span>Send to Customer</span>
                </button>
                <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-2.5 rounded-xl bg-[#111111] border border-amber-500/40 text-amber-300 text-[11px] font-medium shadow-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-50 text-center leading-snug">
                  Approval required: Quotation breaches risk thresholds. Submit for approval before sending.
                  <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-[#111111]" />
                </div>
              </div>

              <button
                type="button"
                disabled={isUpdating || lines.length === 0}
                onClick={handleSubmitApproval}
                className="px-5 py-2.5 rounded-xl text-xs font-bold bg-amber-400 hover:bg-amber-300 text-black transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-amber-500/20 flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <ShieldCheck className="w-4 h-4 text-black" />
                <span>{reviewActionLabel}</span>
              </button>
            </div>
          )}

          {/* If quote is UNDER_NEGOTIATION: */}
          {quote?.status === 'UNDER_NEGOTIATION' && (
            <div className="flex items-center gap-2">
              <div className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-amber-500/10 text-amber-300 border border-amber-500/20 flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5 text-amber-400" />
                <span>Client Counter-Offer Active</span>
              </div>
              {requiresReview ? (
                <>
                  <div className="relative group inline-block">
                    <button
                      type="button"
                      disabled={true}
                      className="px-4 py-2 rounded-xl text-xs font-bold bg-[#141414] text-zinc-500 border border-[#262626] flex items-center gap-1.5 cursor-not-allowed opacity-60 select-none"
                      title="This quotation requires approval before sending to customer. Please submit for approval first."
                    >
                      <Lock className="w-3.5 h-3.5 text-zinc-500" />
                      <span>Send to Customer</span>
                    </button>
                    <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-2.5 rounded-xl bg-[#111111] border border-amber-500/40 text-amber-300 text-[11px] font-medium shadow-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-50 text-center leading-snug">
                      Approval required: Quotation breaches risk thresholds. Submit for approval before sending.
                      <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-[#111111]" />
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={isUpdating || lines.length === 0}
                    onClick={handleSubmitApproval}
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-400 hover:bg-amber-300 text-black transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-amber-500/20 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <ShieldCheck className="w-3.5 h-3.5 text-black" />
                    <span>{reviewActionLabel}</span>
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  disabled={isUpdating || lines.length === 0}
                  onClick={handleSendToCustomer}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-white hover:bg-zinc-200 text-black transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-white/5 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5 text-black" />
                  <span>Send Revised Quote to Customer</span>
                </button>
              )}
            </div>
          )}

          {/* If quote is PENDING REVIEW: */}
          {quote?.status === 'PENDING_MANAGER_APPROVAL' && (
            <>
              {user?.role === 'SALES_MANAGER' || user?.role === 'FINANCE' || user?.role === 'ADMIN' ? (
                <button
                  type="button"
                  onClick={() => navigate(`/app/quotations/${id}/approval`)}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold bg-amber-400 hover:bg-amber-300 text-black transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-amber-500/20 flex items-center gap-2 cursor-pointer"
                >
                  <ShieldCheck className="w-4 h-4 text-black" />
                  <span>Review & Approve (Sales Manager)</span>
                </button>
              ) : (
                <div className="px-4 py-2 rounded-xl text-xs font-medium bg-amber-500/10 text-amber-300 border border-amber-500/20 flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                  <span>Awaiting Sales Manager Approval</span>
                </div>
              )}
            </>
          )}

          {quote?.status === 'PENDING_FINANCE_APPROVAL' && (
            <>
              {user?.role === 'FINANCE' || user?.role === 'ADMIN' ? (
                <button
                  type="button"
                  onClick={() => navigate(`/app/quotations/${id}/approval`)}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold bg-orange-400 hover:bg-orange-300 text-black transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-orange-500/20 flex items-center gap-2 cursor-pointer"
                >
                  <ShieldCheck className="w-4 h-4 text-black" />
                  <span>Review & Approve (CFO)</span>
                </button>
              ) : (
                <div className="px-4 py-2 rounded-xl text-xs font-medium bg-orange-500/10 text-orange-300 border border-orange-500/20 flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5 text-orange-400 animate-pulse" />
                  <span>Awaiting CFO Review (Madhab CFO)</span>
                </div>
              )}
            </>
          )}

          {quote?.status === 'SENT' && (
            <div className="px-4 py-2 rounded-xl text-xs font-medium bg-purple-500/10 text-purple-300 border border-purple-500/20 flex items-center gap-2">
              <Send className="w-3.5 h-3.5 text-purple-400" />
              <span>Quotation Dispatched to Client</span>
            </div>
          )}
        </div>
      </div>

      {/* Customer Counter-Offer / Negotiation Banner */}
      {(quote?.status === 'UNDER_NEGOTIATION' || latestNegotiation) && latestNegotiation && (
        <div className="p-5 rounded-2xl bg-[#0E0E0E] border border-amber-500/30 text-xs shadow-xl space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <MessageSquare className="w-4 h-4" />
              </span>
              <div>
                <div className="font-bold text-white flex items-center gap-2">
                  <span>Customer Negotiation & Counter-Offer Received</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                    Requested: {latestNegotiation.proposedDiscount || 0}% Discount
                  </span>
                </div>
                <div className="text-[11px] text-zinc-400 mt-0.5">
                  Submitted {new Date(latestNegotiation.submittedAt || (latestNegotiation as any).createdAt || Date.now()).toLocaleString()}
                </div>
              </div>
            </div>

            {latestNegotiation.proposedDiscount !== undefined && latestNegotiation.proposedDiscount > 0 && (
              <button
                type="button"
                onClick={() => handleApplyNegotiatedDiscount(latestNegotiation.proposedDiscount || 0)}
                className="px-3.5 py-1.5 rounded-xl bg-[#181818] hover:bg-[#222222] border border-[#2E2E2E] hover:border-amber-400/50 text-zinc-200 hover:text-white font-semibold text-xs transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <span>Auto-Apply {latestNegotiation.proposedDiscount}% to Lines</span>
              </button>
            )}
          </div>

          <div className="p-3.5 rounded-xl bg-[#080808] border border-[#1A1A1A] space-y-1">
            <div className="text-[10px] uppercase font-mono text-zinc-400 font-semibold tracking-wider">
              Customer Remark & Rationale:
            </div>
            <p className="text-zinc-200 text-xs italic leading-relaxed">
              "{latestNegotiation.message || 'No written remark provided.'}"
            </p>
          </div>

          <p className="text-[11px] text-zinc-400">
            Readjust product quantities, prices, or discounts inline below. When finalized, send the revised proposal to the customer or submit for governance review if it exceeds tier limits.
          </p>
        </div>
      )}

      {/* Governance Review Required Banner */}
      {(quote?.status === 'DRAFT' || quote?.status === 'UNDER_NEGOTIATION') && requiresReview && lines.length > 0 && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/25 flex items-start gap-3.5 text-xs text-amber-200 shadow-lg">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <div className="font-semibold text-amber-300">
              Governance Review Required — Client Dispatch Blocked
            </div>
            <div className="text-zinc-400 text-[11px] leading-relaxed">
              This quotation has a risk score of <strong className="text-amber-300 font-mono">{riskScore}</strong> (Estimated Margin: <strong className="text-zinc-300 font-mono">{marginPct}%</strong>). Direct client dispatch is disabled until approval is completed by <strong className="text-white">{reviewTargetName}</strong>.
            </div>
          </div>
        </div>
      )}

      {/* Main 2-Column Layout (2/3 Left, 1/3 Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2/3 Width): Line Items & Metadata */}
        <div className="lg:col-span-2 space-y-6">
          {/* Metadata Card: Customer, Valid Until, Notes */}
          <div className="bg-[#0A0A0A] border border-[#1F1F1F] rounded-2xl p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#1A1A1A]">
              <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
                <FileText className="w-3.5 h-3.5 text-zinc-400" />
                <span>Quotation Parameters</span>
              </div>
              <button
                type="button"
                disabled={isSavingMetadata || isUpdating}
                onClick={handleSaveMetadata}
                className="px-3 py-1.5 rounded-xl text-xs font-medium bg-[#141414] hover:bg-[#1C1C1C] border border-[#282828] hover:border-zinc-400 text-white transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
              >
                <Check className="w-3 h-3 text-emerald-400" />
                <span>Save Parameters</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Customer Selector */}
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                  Client / Customer
                </label>
                <select
                  value={selectedCustomerId}
                  onChange={(e) => setSelectedCustomerId(e.target.value)}
                  className="w-full bg-[#121212] border border-[#242424] rounded-xl px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-zinc-400 transition-colors cursor-pointer"
                >
                  {customers.map((c: any) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.tier} Tier · {c.email})
                    </option>
                  ))}
                </select>
              </div>

              {/* Expiration Date */}
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                  Expiration / Valid Until
                </label>
                <div className="relative">
                  <input
                    type="date"
                    value={validUntil}
                    onChange={(e) => setValidUntil(e.target.value)}
                    className="w-full bg-[#121212] border border-[#242424] rounded-xl px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-zinc-400 transition-colors cursor-pointer"
                  />
                </div>
              </div>
            </div>

            {/* Special Terms & Notes */}
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                Contract Terms & Notes
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="Add pricing agreements, delivery commitments, or customer specific notes..."
                className="w-full bg-[#121212] border border-[#242424] rounded-xl p-3 text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-zinc-400 transition-colors resize-none"
              />
            </div>
          </div>

          {/* Line Items Card */}
          <div className="bg-[#0A0A0A] border border-[#1F1F1F] rounded-2xl overflow-hidden shadow-2xl">
            {/* Header info */}
            <div className="px-6 py-4 flex items-center justify-between border-b border-[#1A1A1A]">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                  Line Items & Configured Pricing
                </div>
                <div className="text-xs text-zinc-400 mt-0.5">
                  Pricing reflects customer tier agreements. Edit quantities, discounts, and prices inline.
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(true)}
                className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-white text-black hover:bg-zinc-200 transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 text-black" />
                <span>Add Product</span>
              </button>
            </div>

            {/* Dark Sleek Column Header Bar */}
            <div className="bg-[#111111] border-b border-[#1A1A1A] text-zinc-400 font-semibold text-[11px] uppercase tracking-wider px-6 py-2.5 flex items-center justify-between select-none">
              <span className="flex-1">Product Details</span>
              <div className="flex items-center gap-4 sm:gap-6 shrink-0">
                <span className="w-16 text-center">Qty</span>
                <span className="w-24 text-right">Unit Price</span>
                <span className="w-16 text-right">Disc. %</span>
                <span className="w-28 text-center">Tier Delta</span>
                <span className="w-24 text-right">Total</span>
                <span className="w-14 text-right">Action</span>
              </div>
            </div>

            {/* Line Items List */}
            <div className="divide-y divide-[#161616]">
              {lines.length === 0 ? (
                <div className="px-6 py-12 text-center">
                  <p className="text-sm font-medium text-zinc-400">No line items added yet.</p>
                  <p className="text-xs text-zinc-600 mt-1">
                    Click the <strong className="text-zinc-300">Add Product</strong> button above to populate this quotation from the catalog.
                  </p>
                </div>
              ) : (
                lines.map((line: any) => {
                  const edit = inlineEdits[line.id] || {
                    quantity: Number(line.quantity) || 1,
                    unitPrice: Number(line.unitPrice) || 0,
                    discountPct: Number(line.discountPct) || 0,
                    isDirty: false,
                  };

                  const calculatedTotal =
                    edit.quantity * edit.unitPrice * (1 - edit.discountPct / 100);

                  return (
                    <div
                      key={line.id}
                      className="px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-white/[0.02] transition-colors group"
                    >
                      {/* Product Name & Category */}
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold text-white truncate">
                          {line.productName}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#161616] border border-[#242424] text-zinc-400">
                            {line.categoryName || (line.isRecurring ? 'Recurring Service' : 'Hardware')}
                          </span>
                          {line.isRecurring && (
                            <span className="text-[10px] text-purple-400 font-medium">
                              · Monthly Subscription
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Numeric Columns */}
                      <div className="flex items-center gap-4 sm:gap-6 shrink-0">
                        {/* QTY Input */}
                        <div className="w-16 text-center">
                          <input
                            type="number"
                            min="1"
                            value={edit.quantity}
                            onChange={(e) => {
                              const val = Math.max(1, parseInt(e.target.value, 10) || 1);
                              setInlineEdits((prev) => ({
                                ...prev,
                                [line.id]: {
                                   ...prev[line.id],
                                  quantity: val,
                                  isDirty: true,
                                },
                              }));
                            }}
                            className="w-16 bg-[#141414] border border-[#262626] focus:border-zinc-400 rounded-lg px-2 py-1 text-xs font-mono font-semibold text-white text-center focus:outline-none transition-colors"
                          />
                        </div>

                        {/* Unit Price Input */}
                        <div className="w-24 text-right">
                          <div className="relative">
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={edit.unitPrice}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value) || 0;
                                setInlineEdits((prev) => ({
                                  ...prev,
                                  [line.id]: {
                                    ...prev[line.id],
                                    unitPrice: val,
                                    isDirty: true,
                                  },
                                }));
                              }}
                              className="w-24 bg-[#141414] border border-[#262626] focus:border-zinc-400 rounded-lg px-2 py-1 text-xs font-mono font-medium text-white text-right focus:outline-none transition-colors"
                            />
                          </div>
                        </div>

                        {/* DISC % Input */}
                        <div className="w-16 text-right">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={edit.discountPct}
                            onChange={(e) => {
                              const val = Math.min(100, Math.max(0, parseFloat(e.target.value) || 0));
                              setInlineEdits((prev) => ({
                                ...prev,
                                [line.id]: {
                                  ...prev[line.id],
                                  discountPct: val,
                                  isDirty: true,
                                },
                              }));
                            }}
                            className="w-16 bg-[#141414] border border-[#262626] focus:border-zinc-400 rounded-lg px-2 py-1 text-xs font-mono text-white text-right focus:outline-none transition-colors"
                          />
                        </div>

                        {/* LINE TIER DELTA Column */}
                        <div className="w-28 flex items-center justify-center">
                          {(() => {
                            const delta = edit.discountPct - tierCeiling;
                            if (delta > 0) {
                              return (
                                <span
                                  className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20"
                                  title={`Applied ${edit.discountPct}% vs ${customerTier} allowed ceiling of ${tierCeiling}%`}
                                >
                                  +{delta}% over ceiling
                                </span>
                              );
                            }
                            return (
                              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                Compliant ({edit.discountPct}%)
                              </span>
                            );
                          })()}
                        </div>

                        {/* TOTAL */}
                        <div className="w-24 text-right text-xs font-bold text-white font-mono">
                          {formatCurrency(calculatedTotal)}
                        </div>

                        {/* Actions */}
                        <div className="w-14 flex items-center justify-end gap-2">
                          {edit.isDirty && (
                            <button
                              type="button"
                              onClick={() => handleSaveLine(line.id)}
                              className="p-1 rounded-md text-emerald-400 hover:bg-emerald-500/10 transition-colors cursor-pointer"
                              title="Save line changes"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => removeLine(line.id)}
                            className="p-1 rounded-md text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                            title="Remove product line"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Bottom Card Footer */}
            <div className="px-6 py-3.5 bg-[#0E0E0E] border-t border-[#1A1A1A] flex items-center justify-between text-xs text-zinc-400">
              <span>{lines.length} Line items configured</span>
              <button
                type="button"
                onClick={() => setShowAddModal(true)}
                className="text-white hover:text-emerald-400 font-medium transition-colors flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add another product</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right Column (1/3 Width): Financial Summary, Guardrail & Smart Recs */}
        <div className="space-y-6">
          {/* Financial Breakdown Card */}
          <div className="bg-[#0A0A0A] border border-[#1F1F1F] rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 pb-2 border-b border-[#1A1A1A]">
              Financial Summary
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="flex items-center justify-between text-zinc-400">
                <span>Subtotal Gross</span>
                <span className="font-mono text-zinc-200">{formatCurrency(subtotal)}</span>
              </div>

              <div className="flex items-center justify-between text-zinc-400">
                <span>Tier Discounts</span>
                <span className="font-mono text-rose-400">
                  {discountTotal > 0 ? `-${formatCurrency(discountTotal)}` : '₹0.00'}
                </span>
              </div>

              <div className="flex items-center justify-between text-zinc-400">
                <span>Tax (GST 10%)</span>
                <span className="font-mono text-zinc-300">{formatCurrency(tax)}</span>
              </div>

              <div className="pt-3 border-t border-[#1F1F1F] flex items-center justify-between">
                <div>
                  <span className="text-sm font-bold text-white block">Total Deal Amount</span>
                  <span className="text-[10px] text-zinc-500 font-mono">Includes taxes & duties</span>
                </div>
                <div className="text-xl font-mono font-bold text-white">
                  {formatCurrency(total)}
                </div>
              </div>
            </div>

            {/* Gross Margin Meter */}
            <div className="pt-3 border-t border-[#1F1F1F] space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-400 font-medium">Estimated Margin</span>
                <span
                  className={`font-mono font-bold ${
                    marginPct >= 30
                      ? 'text-emerald-400'
                      : marginPct >= 15
                      ? 'text-amber-400'
                      : 'text-rose-400'
                  }`}
                >
                  {marginPct}%
                </span>
              </div>
              <div className="w-full bg-[#141414] rounded-full h-2 border border-[#222222] overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    marginPct >= 30
                      ? 'bg-emerald-500'
                      : marginPct >= 15
                      ? 'bg-amber-500'
                      : 'bg-rose-500'
                  }`}
                  style={{ width: `${Math.min(100, Math.max(0, marginPct))}%` }}
                />
              </div>
            </div>

            {/* Risk Guardrail */}
            <div className="p-3.5 rounded-xl bg-[#121212] border border-[#242424] text-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-zinc-300">Governance Guardrail</span>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                    riskScore > 50
                      ? 'bg-rose-500/20 text-rose-400'
                      : riskScore > 20
                      ? 'bg-amber-500/20 text-amber-400'
                      : 'bg-emerald-500/20 text-emerald-400'
                  }`}
                >
                  Risk Score: {riskScore}
                </span>
              </div>
              <p className="text-[11px] text-zinc-400 leading-relaxed">
                {riskScore > 30
                  ? 'High discount exception. Requires dual-tier Sales Manager and Finance approval.'
                  : riskScore > 0
                  ? 'Standard discount within tier ceiling. Requires Sales Manager sign-off.'
                  : 'Compliant with enterprise discount matrix. Auto-approval eligible.'}
              </p>
            </div>

            {/* Primary Action Button */}
            <div className="pt-2 space-y-2">
              {quote?.status === 'APPROVED' ? (
                <button
                  type="button"
                  disabled={isUpdating}
                  onClick={handleSendToCustomer}
                  className="w-full py-2.5 px-4 rounded-xl bg-white hover:bg-zinc-200 text-black font-semibold text-xs tracking-wide shadow-lg transition-all text-center focus:outline-none cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <Send className="w-3.5 h-3.5 text-black" />
                  <span>Send to Customer</span>
                </button>
              ) : quote?.status === 'DRAFT' || quote?.status === 'UNDER_NEGOTIATION' ? (
                requiresReview ? (
                  <>
                    <div className="relative group w-full">
                      <button
                        type="button"
                        disabled={true}
                        className="w-full py-2.5 px-4 rounded-xl bg-[#141414] text-zinc-500 border border-[#262626] font-semibold text-xs tracking-wide transition-all text-center focus:outline-none cursor-not-allowed opacity-60 flex items-center justify-center gap-2 select-none"
                        title="This quotation requires approval before sending to customer. Please submit for approval first."
                      >
                        <Lock className="w-3.5 h-3.5 text-zinc-500" />
                        <span>Send to Customer (Locked)</span>
                      </button>
                      <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-2.5 rounded-xl bg-[#111111] border border-amber-500/40 text-amber-300 text-[11px] font-medium shadow-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-50 text-center leading-snug">
                        Approval required: Quotation breaches risk thresholds. Submit for approval before sending.
                        <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-[#111111]" />
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={isUpdating || lines.length === 0}
                      onClick={handleSubmitApproval}
                      className="w-full py-2.5 px-4 rounded-xl bg-amber-400 hover:bg-amber-300 text-black font-semibold text-xs tracking-wide shadow-lg shadow-amber-500/20 transition-all text-center focus:outline-none cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      <ShieldCheck className="w-3.5 h-3.5 text-black" />
                      <span>{reviewActionLabel}</span>
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      disabled={isUpdating || lines.length === 0}
                      onClick={handleSendToCustomer}
                      className="w-full py-2.5 px-4 rounded-xl bg-white hover:bg-zinc-200 text-black font-semibold text-xs tracking-wide shadow-lg transition-all text-center focus:outline-none cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      <Send className="w-3.5 h-3.5 text-black" />
                      <span>Send to Customer</span>
                    </button>

                    {lines.length > 0 && (
                      <button
                        type="button"
                        disabled={isUpdating}
                        onClick={handleSubmitApproval}
                        className="w-full py-2.5 px-4 rounded-xl bg-[#1A1A1A] hover:bg-[#242424] text-white border border-[#2E2E2E] hover:border-zinc-400 font-semibold text-xs tracking-wide transition-all text-center focus:outline-none cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Submit for Review</span>
                      </button>
                    )}
                  </>
                )
              ) : null}

              {(quote?.status === 'PENDING_MANAGER_APPROVAL' ||
                quote?.status === 'PENDING_FINANCE_APPROVAL') && (
                <button
                  type="button"
                  onClick={() => navigate(`/app/quotations/${id}/approval`)}
                  className="w-full py-2.5 px-4 rounded-xl bg-amber-400 hover:bg-amber-300 text-black font-semibold text-xs tracking-wide transition-all text-center focus:outline-none cursor-pointer flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20"
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-black" />
                  <span>Review Approval</span>
                </button>
              )}
            </div>
          </div>

          {/* Upsell / Cross-Sell Recommendations */}
          {upsellSuggestions.length > 0 && (
            <div className="bg-[#0A0A0A] border border-[#1F1F1F] rounded-2xl p-5 space-y-3">
              <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-emerald-400">
                <Sparkles className="w-3.5 h-3.5" />
                <span>AI Revenue Optimizer</span>
              </div>

              <div className="space-y-2.5">
                {upsellSuggestions.slice(0, 2).map((sugg: any) => (
                  <div
                    key={sugg.id}
                    className="p-3.5 rounded-xl bg-[#121212] border border-[#222222] text-xs space-y-1.5"
                  >
                    <div className="flex items-center justify-between font-semibold text-white">
                      <span>{sugg.productName}</span>
                      <span className="text-emerald-400 font-mono">
                        +{sugg.marginDelta || 4.5}% margin
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-400 leading-relaxed">{sugg.reason}</p>
                    <div className="pt-1 flex items-center justify-between">
                      <span className="text-zinc-200 font-medium font-mono">
                        {formatCurrency(sugg.unitPrice || 450)}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          addLine({
                            productId: sugg.productId,
                            productName: sugg.productName,
                            categoryName: sugg.categoryName || 'Hardware',
                            quantity: 1,
                            unitPrice: sugg.unitPrice || 450,
                            discountPct: 0,
                          })
                        }
                        className="px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 text-[10px] font-semibold transition-colors cursor-pointer"
                      >
                        + Add to Quote
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Add Product Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#121212] border border-[#262626] rounded-2xl max-w-md w-full p-6 shadow-2xl animate-in fade-in zoom-in-95">
            <h3 className="text-base font-bold text-white mb-1">Add Product to Quotation</h3>
            <p className="text-xs text-zinc-400 mb-4">
              Select an item from the enterprise product catalog
            </p>

            <form onSubmit={handleAddProductSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                  Product SKU
                </label>
                <select
                  value={selectedProductId}
                  onChange={(e) => handleProductSelectChange(e.target.value)}
                  className="w-full bg-[#181818] border border-[#2E2E2E] focus:border-zinc-400 rounded-xl px-3 py-2 text-xs text-white focus:outline-none cursor-pointer"
                  required
                >
                  <option value="">Select a product...</option>
                  {catalogProducts.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} — {formatCurrency(p.basePrice)} ({p.category?.name || 'Hardware'})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">
                    Quantity
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={addQuantity}
                    onChange={(e) => setAddQuantity(Math.max(1, parseInt(e.target.value, 10) || 1))}
                    className="w-full bg-[#181818] border border-[#2E2E2E] focus:border-zinc-400 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">
                    Unit Price (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={addUnitPrice !== null ? addUnitPrice : ''}
                    placeholder="Auto"
                    onChange={(e) => setAddUnitPrice(parseFloat(e.target.value) || 0)}
                    className="w-full bg-[#181818] border border-[#2E2E2E] focus:border-zinc-400 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">
                    Discount %
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={addDiscount}
                    onChange={(e) => setAddDiscount(parseFloat(e.target.value) || 0)}
                    className="w-full bg-[#181818] border border-[#2E2E2E] focus:border-zinc-400 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-zinc-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-white text-black hover:bg-zinc-200 transition-colors shadow-sm cursor-pointer"
                >
                  Add to Quotation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
