import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuotation, useQuotationBuilder, useUpsellSuggestions } from '../../api/hooks/useQuotationBuilder';
import { useProducts } from '../../api/hooks/useCatalog';
import { LoadingSpinner } from '../../components/feedback/LoadingSpinner';
import { formatCurrency } from '../../lib/utils';
import { Plus, Trash2, Sparkles, AlertTriangle, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';

export function QuotationBuilderPage() {
  const { id = 'q-001' } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: quote, isLoading: isQuoteLoading } = useQuotation(id);
  const { addLine, updateLine, removeLine, submitQuotation, isUpdating } = useQuotationBuilder(id);
  const { data: upsellSuggestions = [] } = useUpsellSuggestions(id);
  const { data: catalogProducts = [] } = useProducts();

  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [addQuantity, setAddQuantity] = useState(1);
  const [addDiscount, setAddDiscount] = useState(0);

  // Debounced/Local edit tracking
  const [editingLineId, setEditingLineId] = useState<string | null>(null);
  const [localQty, setLocalQty] = useState<number>(1);
  const [localDiscount, setLocalDiscount] = useState<number>(0);

  // Working lines
  const lines = useMemo(() => {
    if (quote?.lines && quote.lines.length > 0) {
      return quote.lines;
    }
    // Visual baseline matching Screenshot 2
    return [
      {
        id: 'line-01',
        productId: 'prod-er500',
        productName: 'Enterprise Router',
        categoryName: 'Hardware · ER-500',
        quantity: 10,
        unitPrice: 500,
        discountPct: 8,
        lineTotal: 4600,
        isRecurring: false,
      },
      {
        id: 'line-02',
        productId: 'prod-supp',
        productName: 'Support Plan',
        categoryName: 'Recurring · annual renewal',
        quantity: 1,
        unitPrice: 900,
        discountPct: 5,
        lineTotal: 855,
        isRecurring: true,
      },
    ];
  }, [quote]);

  // Derived financial summary
  const subtotal = lines.reduce((acc, l) => acc + (Number(l.unitPrice) || 0) * (Number(l.quantity) || 1), 0);
  const discountTotal = lines.reduce((acc, l) => acc + ((Number(l.unitPrice) || 0) * (Number(l.quantity) || 1) * (Number(l.discountPct) || 0)) / 100, 0);
  const netAfterDiscount = subtotal - discountTotal;
  const tax = Math.round(netAfterDiscount * 0.1);
  const total = netAfterDiscount + tax;

  const riskScore = quote?.riskScore ?? 82;
  const violationsCount = 3;

  const handleUpdateLine = async (lineId: string, quantity: number, discountPct: number) => {
    try {
      await updateLine({ lineId, quantity, discountPct });
      setEditingLineId(null);
      toast.success('Line item updated');
    } catch {
      toast.error('Failed to update line item');
    }
  };

  const handleAddProductSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const product = catalogProducts.find((p) => p.id === selectedProductId);
    if (!product) {
      toast.error('Please select a product');
      return;
    }

    try {
      await addLine({
        productId: product.id,
        productName: product.name,
        categoryName: product.category?.name || 'Hardware',
        quantity: Number(addQuantity) || 1,
        unitPrice: Number(product.basePrice || 100),
        discountPct: Number(addDiscount) || 0,
        isRecurring: product.isRecurring,
      });
      setShowAddModal(false);
      setSelectedProductId('');
      setAddQuantity(1);
      setAddDiscount(0);
    } catch {
      toast.error('Failed to add product to quotation');
    }
  };

  const handleSubmit = async () => {
    try {
      await submitQuotation();
      navigate(`/app/quotations/${id}/approval`);
    } catch {
      toast.error('Failed to submit quotation');
    }
  };

  if (isQuoteLoading && !quote) {
    return (
      <div className="py-20 flex justify-center">
        <LoadingSpinner label="Loading quotation builder..." />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300 pb-10">
      {/* Top Back Navigation (Screenshot 2) */}
      <div>
        <button
          type="button"
          onClick={() => navigate('/app/quotations')}
          className="text-xs text-blue-400 hover:text-blue-300 font-medium inline-flex items-center gap-1.5 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to quotations</span>
        </button>

        {/* Title Header Row */}
        <div className="flex items-center justify-between mt-2">
          <div>
            <h1 className="text-3xl font-bold text-white tracking-tight">
              Quotation Builder
            </h1>
            <p className="text-xs sm:text-sm text-zinc-400 mt-0.5">
              {quote?.customer?.name || 'Acme Corporation'} · {quote?.customer?.tier || 'Gold'} Tier
            </p>
          </div>
          <div>
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-[#1F1F23] text-zinc-200 border border-[#2E2E33]">
              {quote?.status || 'Draft'}
            </span>
          </div>
        </div>
      </div>

      {/* Main 2-Column Layout (2/3 Left, 1/3 Right) (Screenshot 2) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2/3 Width): Line Items */}
        <div className="lg:col-span-2">
          <div className="border border-blue-500/80 bg-[#0D0D0F] rounded-2xl overflow-hidden shadow-xl">
            {/* Header info */}
            <div className="px-6 pt-5 pb-4">
              <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                Line items
              </div>
              <div className="text-xs sm:text-sm text-zinc-300 mt-1">
                Pricing reflects {quote?.customer?.name || 'Acme Corporation'}'s Gold Tier agreement.
              </div>
            </div>

            {/* Signature White Column Header Bar (Screenshot 2) */}
            <div className="bg-white text-zinc-900 font-bold text-[11px] uppercase tracking-wider px-6 py-2.5 flex items-center justify-between select-none">
              <span>Product</span>
              <div className="flex items-center gap-6 sm:gap-10">
                <span className="w-12 text-center">Qty</span>
                <span className="w-20 text-right">Price</span>
                <span className="w-14 text-right">Disc.</span>
                <span className="w-24 text-right">Total</span>
                <span className="w-5"></span>
              </div>
            </div>

            {/* Line Items List */}
            <div className="divide-y divide-[#1E1E22]">
              {lines.map((line: any) => {
                const isEditing = editingLineId === line.id;
                const lineTotalCalculated = line.lineTotal || (line.unitPrice * line.quantity * (1 - (line.discountPct || 0) / 100));
                return (
                  <div
                    key={line.id}
                    className="px-6 py-4 flex items-center justify-between gap-4 hover:bg-white/[0.02] transition-colors"
                  >
                    {/* Product Name & Category */}
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold text-white truncate">
                        {line.productName}
                      </div>
                      <div className="text-xs text-zinc-400 mt-0.5">
                        {line.categoryName || (line.isRecurring ? 'Recurring' : 'Hardware')}
                      </div>
                    </div>

                    {/* Numeric Columns */}
                    <div className="flex items-center gap-6 sm:gap-10 shrink-0">
                      {/* QTY */}
                      <div className="w-12 text-center">
                        {isEditing ? (
                          <input
                            type="number"
                            min="1"
                            value={localQty}
                            onChange={(e) => setLocalQty(Number(e.target.value))}
                            className="w-12 bg-[#18181B] border border-blue-500 rounded px-1 text-xs text-white text-center focus:outline-none"
                          />
                        ) : (
                          <span
                            onClick={() => {
                              setEditingLineId(line.id);
                              setLocalQty(line.quantity);
                              setLocalDiscount(line.discountPct || 0);
                            }}
                            className="text-xs font-semibold text-zinc-200 cursor-pointer hover:text-blue-400"
                            title="Click to edit quantity"
                          >
                            {line.quantity}
                          </span>
                        )}
                      </div>

                      {/* PRICE */}
                      <div className="w-20 text-right text-xs text-zinc-300 font-medium font-mono">
                        {formatCurrency(line.unitPrice)}
                      </div>

                      {/* DISC */}
                      <div className="w-14 text-right">
                        {isEditing ? (
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={localDiscount}
                            onChange={(e) => setLocalDiscount(Number(e.target.value))}
                            className="w-12 bg-[#18181B] border border-blue-500 rounded px-1 text-xs text-white text-right focus:outline-none"
                          />
                        ) : (
                          <span
                            onClick={() => {
                              setEditingLineId(line.id);
                              setLocalQty(line.quantity);
                              setLocalDiscount(line.discountPct || 0);
                            }}
                            className="text-xs font-semibold text-zinc-200 cursor-pointer hover:text-blue-400"
                            title="Click to edit discount"
                          >
                            {line.discountPct}%
                          </span>
                        )}
                      </div>

                      {/* TOTAL */}
                      <div className="w-24 text-right text-xs font-bold text-white font-mono">
                        {formatCurrency(lineTotalCalculated)}
                      </div>

                      {/* Actions */}
                      <div className="w-5 text-right flex items-center justify-end">
                        {isEditing ? (
                          <button
                            type="button"
                            onClick={() => handleUpdateLine(line.id, localQty, localDiscount)}
                            className="text-xs text-emerald-400 hover:text-emerald-300"
                            title="Save"
                          >
                            ✓
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => removeLine(line.id)}
                            className="text-zinc-500 hover:text-red-400 transition-colors"
                            title="Remove line"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Bottom Add Product Action (Screenshot 2) */}
            <div className="px-6 py-4 border-t border-[#1E1E22]">
              <button
                type="button"
                onClick={() => setShowAddModal(true)}
                className="text-xs font-semibold text-blue-400 hover:text-blue-300 flex items-center gap-1.5 transition-colors focus:outline-none"
              >
                <Plus className="w-4 h-4" />
                <span>Add product</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right Column (1/3 Width): Deal Intelligence & Summary */}
        <div className="space-y-5">
          {/* DEAL INTELLIGENCE CARD (Screenshot 2) */}
          <div className="bg-[#121214] border border-[#27272A] rounded-2xl p-5 space-y-4">
            <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
              Deal intelligence
            </div>

            {/* Risk Score Highlight */}
            <div className="flex items-center gap-3.5">
              <div className="text-4xl font-extrabold text-[#F97316] tracking-tight">
                {riskScore}
              </div>
              <div>
                <div className="text-sm font-bold text-white">
                  High risk
                </div>
                <div className="text-xs text-zinc-400 mt-0.5">
                  Finance approval required
                </div>
              </div>
            </div>

            {/* Violations Detection */}
            <div className="text-xs font-semibold text-[#FB923C] flex items-center gap-1.5 pt-1">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>{violationsCount} pricing violations detected</span>
            </div>

            {/* Violations Breakdown List */}
            <div className="space-y-2 pt-1 text-xs">
              <div className="flex items-center justify-between text-zinc-300">
                <span>Hardware discount</span>
                <span className="font-mono text-[#FB923C] font-semibold">+32</span>
              </div>
              <div className="flex items-center justify-between text-zinc-300">
                <span>Software discount</span>
                <span className="font-mono text-[#FB923C] font-semibold">+18</span>
              </div>
              <div className="flex items-center justify-between text-zinc-300">
                <span>Enterprise tier</span>
                <span className="font-mono text-[#FB923C] font-semibold">+21</span>
              </div>
            </div>
          </div>

          {/* SUMMARY CARD (Screenshot 2) */}
          <div className="bg-[#121214] border border-[#27272A] rounded-2xl p-5 space-y-3.5">
            <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
              Summary
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between text-zinc-300">
                <span>Subtotal</span>
                <span className="font-medium font-mono">{formatCurrency(subtotal)}</span>
              </div>
              <div className="flex items-center justify-between text-zinc-300">
                <span>Discount</span>
                <span className="font-medium text-emerald-400 font-mono">-{formatCurrency(discountTotal)}</span>
              </div>
              <div className="flex items-center justify-between text-zinc-300">
                <span>Tax (10%)</span>
                <span className="font-medium font-mono">{formatCurrency(tax)}</span>
              </div>
            </div>

            <div className="border-t border-[#27272A] pt-3 flex items-center justify-between">
              <span className="text-sm font-bold text-white">Total</span>
              <span className="text-xl font-bold text-white tracking-tight font-mono">
                {formatCurrency(total)}
              </span>
            </div>

            {/* Primary Submit CTA Button (Screenshot 2) */}
            <button
              type="button"
              disabled={isUpdating}
              onClick={handleSubmit}
              className="w-full mt-2 py-2.5 px-4 rounded-xl bg-[#3B82F6] hover:bg-[#2563EB] text-white font-semibold text-xs tracking-wide shadow-lg shadow-blue-500/25 transition-all text-center focus:outline-none disabled:opacity-50"
            >
              {isUpdating ? 'Submitting...' : 'Submit quotation'}
            </button>
          </div>

          {/* Upsell / Cross-Sell Recommendations */}
          {upsellSuggestions.length > 0 && (
            <div className="bg-[#121214] border border-[#27272A] rounded-2xl p-5 space-y-3">
              <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-blue-400">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Smart recommendations</span>
              </div>

              <div className="space-y-2.5">
                {upsellSuggestions.slice(0, 2).map((sugg: any) => (
                  <div
                    key={sugg.id}
                    className="p-3 rounded-xl bg-white/[0.03] border border-[#27272A] text-xs space-y-1.5"
                  >
                    <div className="flex items-center justify-between font-semibold text-white">
                      <span>{sugg.productName}</span>
                      <span className="text-emerald-400 font-mono">+{sugg.marginDelta || 4.5}% margin</span>
                    </div>
                    <p className="text-[11px] text-zinc-400 leading-relaxed">
                      {sugg.reason}
                    </p>
                    <div className="pt-1 flex items-center justify-between">
                      <span className="text-zinc-300 font-medium font-mono">{formatCurrency(sugg.unitPrice || 450)}</span>
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
                        className="px-2.5 py-1 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 text-[10px] font-semibold transition-colors"
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

      {/* Add Product Dialog Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#18181B] border border-[#27272A] rounded-2xl max-w-md w-full p-6 shadow-2xl animate-in fade-in zoom-in-95">
            <h3 className="text-base font-bold text-white mb-1">Add Product to Quotation</h3>
            <p className="text-xs text-zinc-400 mb-4">
              Select an item from the enterprise product catalog
            </p>

            <form onSubmit={handleAddProductSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Product SKU
                </label>
                <select
                  value={selectedProductId}
                  onChange={(e) => setSelectedProductId(e.target.value)}
                  className="w-full bg-[#0D0D0F] border border-[#27272A] rounded-xl px-3 py-2 text-xs text-white focus:border-blue-500 focus:outline-none"
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

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">
                    Quantity
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={addQuantity}
                    onChange={(e) => setAddQuantity(Number(e.target.value))}
                    className="w-full bg-[#0D0D0F] border border-[#27272A] rounded-xl px-3 py-2 text-xs text-white focus:border-blue-500 focus:outline-none"
                    required
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
                    onChange={(e) => setAddDiscount(Number(e.target.value))}
                    className="w-full bg-[#0D0D0F] border border-[#27272A] rounded-xl px-3 py-2 text-xs text-white focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-zinc-400 hover:text-white hover:bg-white/5 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white transition-colors shadow-sm"
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
