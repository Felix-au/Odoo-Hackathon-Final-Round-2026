import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuotation, useQuotationBuilder, useUpsellSuggestions } from '../../api/hooks/useQuotationBuilder';
import { useProducts } from '../../api/hooks/useCatalog';
import { QuotationStatusBadge } from '../../components/domain/QuotationStatusBadge';
import { RiskScoreIndicator } from '../../components/domain/RiskScoreIndicator';
import { MarginGauge } from '../../components/domain/MarginGauge';
import { UpsellPanel } from '../../components/domain/UpsellPanel';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { LoadingSpinner } from '../../components/feedback/LoadingSpinner';
import { formatCurrency } from '../../lib/utils';
import {
  Trash2,
  Send,
  CheckCircle,
  Truck,
  Receipt,
  FileCheck,
  AlertCircle,
  Search,
} from 'lucide-react';
import { toast } from 'sonner';

export function QuotationBuilderPage() {
  const { id = 'q-001' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isNew = id === 'new';

  const { data: fetchedQuotation, isLoading } = useQuotation(id);
  const { addLine, updateLine, removeLine, submitQuotation, sendToCustomer, isUpdating } = useQuotationBuilder(id);
  const { data: upsellSuggestions = [] } = useUpsellSuggestions(id);
  const { data: rawProducts = [] } = useProducts();
  const allProducts = Array.isArray(rawProducts) ? rawProducts : (rawProducts as any)?.data || [];

  const [productSearch, setProductSearch] = useState('');
  const [showProductDropdown, setShowProductDropdown] = useState(false);

  // Local draft state for new quotations or offline fallback
  const [localLines, setLocalLines] = useState<any[]>([
    {
      id: 'line-01',
      productId: 'prod-000000-0000-0000-0000-000000000001',
      productName: 'Enterprise Laptop Pro',
      category: 'Hardware',
      quantity: 2,
      unitPrice: 1299.0,
      costPrice: 900.0,
      discountPct: 5,
      taxRate: 18,
      effectivePrice: 1234.05,
      lineTotal: 2468.1,
      lineMarginPct: 27.1,
      hasCeilingViolation: false,
    },
    {
      id: 'line-02',
      productId: 'prod-000000-0000-0000-0000-000000000004',
      productName: 'ProSupport 24/7 SLA',
      category: 'Services',
      quantity: 1,
      unitPrice: 999.0,
      costPrice: 350.0,
      discountPct: 0,
      taxRate: 18,
      effectivePrice: 999.0,
      lineTotal: 999.0,
      lineMarginPct: 65.0,
      hasCeilingViolation: false,
    },
  ]);

  if (isLoading && !isNew) {
    return <LoadingSpinner label="Loading quotation details..." />;
  }

  // Calculate live financial summary for local draft
  const draftSubtotal = localLines.reduce((acc, l) => acc + l.lineTotal, 0);
  const draftTax = draftSubtotal * 0.18;
  const draftTotal = draftSubtotal + draftTax;
  const draftCost = localLines.reduce((acc, l) => acc + (l.costPrice || 0) * l.quantity, 0);
  const draftMargin = draftSubtotal > 0 ? ((draftSubtotal - draftCost) / draftSubtotal) * 100 : 0;

  // Active quotation representation
  const activeQuotation: any = (isNew || !fetchedQuotation) ? {
    id: isNew ? 'QT-NEW' : id,
    quotationNumber: isNew ? 'QT-2026-0042' : `QT-${id}`,
    customer: { name: 'Acme Global Enterprises', tier: 'GOLD' },
    customerName: 'Acme Global Enterprises',
    companyId: 'default',
    repName: 'Dave Sales',
    version: 1,
    status: 'DRAFT',
    currency: 'USD',
    subtotal: draftSubtotal,
    taxAmount: draftTax,
    totalAmount: draftTotal,
    overallMarginPct: draftMargin,
    blendedMarginPct: draftMargin,
    blendedRiskScore: draftMargin < 30 ? 0.45 : 0.15,
    approvalRequired: draftMargin < 25,
    lines: localLines,
    metadata: { validUntil: '2026-10-31' },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  } : {
    ...fetchedQuotation,
    customer: fetchedQuotation.customer || { name: (fetchedQuotation as any).customerName || 'Acme Global Enterprises', tier: 'GOLD' },
    repName: (fetchedQuotation as any).repName || 'Dave Sales',
    version: fetchedQuotation.version || 1,
    overallMarginPct: (fetchedQuotation as any).overallMarginPct || (fetchedQuotation as any).blendedMarginPct || 0,
    lines: fetchedQuotation.lines || (fetchedQuotation as any).items || [],
  };

  const quotation = activeQuotation;
  const currentQuotation = activeQuotation;
  const isDraft = quotation.status === 'DRAFT';
  const isApproved = quotation.status === 'APPROVED';
  const isConfirmed = currentQuotation.status === 'CONFIRMED';
  const isPendingApproval = currentQuotation.status.includes('PENDING');

  const filteredProducts = allProducts.filter((p: any) =>
    p.name?.toLowerCase().includes(productSearch.toLowerCase())
  );

  const handleAddProduct = async (product: (typeof allProducts)[0]) => {
    try {
      if (!isNew && quotation) {
        await addLine(product);
      } else {
        const base = Number(product.basePrice) || 0;
        const cost = Number(product.costPrice) || 0;
        const newLine = {
          id: `line-${Date.now()}`,
          productId: product.id,
          productName: product.name,
          category: product.category?.name || 'Hardware',
          quantity: 1,
          unitPrice: base,
          costPrice: cost,
          discountPct: 0,
          taxRate: product.taxRate || 18,
          effectivePrice: base,
          lineTotal: base,
          lineMarginPct: base > 0 ? ((base - cost) / base) * 100 : 0,
          hasCeilingViolation: false,
        };
        setLocalLines((prev) => [...prev, newLine]);
      }
      setProductSearch('');
      setShowProductDropdown(false);
      toast.success(`Added ${product.name} to quotation`);
    } catch {
      toast.error('Failed to add line item');
    }
  };

  const handleQtyChange = async (lineId: string, currentQty: number, delta: number) => {
    const newQty = Math.max(1, currentQty + delta);
    if (!isNew && quotation) {
      await updateLine({ lineId, quantity: newQty });
    } else {
      setLocalLines((prev) =>
        prev.map((l) => {
          if (l.id !== lineId) return l;
          const eff = l.unitPrice * (1 - (l.discountPct || 0) / 100);
          return {
            ...l,
            quantity: newQty,
            lineTotal: eff * newQty,
          };
        })
      );
    }
  };

  const handleDiscountChange = async (lineId: string, discountVal: number) => {
    if (!isNew && quotation) {
      await updateLine({ lineId, discountPct: discountVal });
    } else {
      setLocalLines((prev) =>
        prev.map((l) => {
          if (l.id !== lineId) return l;
          const disc = Math.min(100, Math.max(0, discountVal));
          const eff = l.unitPrice * (1 - disc / 100);
          const margin = eff > 0 ? ((eff - (l.costPrice || 0)) / eff) * 100 : 0;
          return {
            ...l,
            discountPct: disc,
            effectivePrice: eff,
            lineTotal: eff * l.quantity,
            lineMarginPct: margin,
            hasCeilingViolation: disc > 15,
          };
        })
      );
    }
  };

  const handleRemoveLine = async (lineId: string) => {
    if (!isNew && quotation) {
      await removeLine(lineId);
    } else {
      setLocalLines((prev) => prev.filter((l) => l.id !== lineId));
    }
    toast.info('Item removed from quotation');
  };

  const handleSubmit = async () => {
    try {
      if (!isNew && quotation) {
        await submitQuotation();
      }
      if (currentQuotation.blendedRiskScore > 0.3) {
        toast.warning('Quotation discount exceeds ceiling — submitted for management approval');
        navigate(`/app/quotations/${id}/approval`);
      } else {
        toast.success('Terms within approved boundaries — quotation ready!');
      }
    } catch {
      toast.error('Submission failed');
    }
  };

  const handleSendToCustomer = async () => {
    try {
      if (!isNew && quotation) {
        await sendToCustomer();
      }
      toast.success('Quotation sent to Customer Portal. Secure link dispatched to Mailpit.');
    } catch {
      toast.error('Failed to send quotation');
    }
  };

  const violationsCount = quotation.lines.filter((l: any) => l.hasCeilingViolation).length;

  return (
    <div className="space-y-5 pb-8">
      {/* Quotation Header */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-xl font-black text-slate-900 tracking-tight">
                {quotation.quotationNumber}
              </h1>
              <QuotationStatusBadge status={quotation.status} />
              <Badge variant="outline" size="sm" className="font-mono text-[10px] text-slate-400">
                v{quotation.version}
              </Badge>
            </div>
            <div className="flex items-center gap-3 text-xs text-slate-500">
              <span className="font-bold text-slate-800">{quotation.customer.name}</span>
              <span>•</span>
              <Badge
                variant={quotation.customer.tier === 'GOLD' ? 'tierGold' : quotation.customer.tier === 'SILVER' ? 'tierSilver' : 'tierBronze'}
                size="sm"
                className="text-[10px]"
              >
                {quotation.customer.tier} TIER
              </Badge>
              <span>•</span>
              <span>Sales Rep: {quotation.repName}</span>
            </div>
          </div>

          {/* Quick Screen Navigators */}
          <div className="flex items-center gap-2">
            {isPendingApproval && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate(`/app/quotations/${id}/approval`)}
                className="text-amber-700 border-amber-300 bg-amber-50 hover:bg-amber-100"
              >
                <FileCheck className="w-3.5 h-3.5 mr-1" />
                Approval Steps
              </Button>
            )}

            {(isApproved || isConfirmed) && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate(`/app/quotations/${id}/fulfillment`)}
                >
                  <Truck className="w-3.5 h-3.5 mr-1 text-slate-500" />
                  Warehouse Split
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate(`/app/quotations/${id}/billing`)}
                >
                  <Receipt className="w-3.5 h-3.5 mr-1 text-slate-500" />
                  Billing & Schedule
                </Button>
              </>
            )}

            {/* Portal Link */}
            <a
              href={`/portal/quotations/${id}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 transition-colors"
            >
              Open in Customer Portal ↗
            </a>
          </div>
        </div>

        {/* Real-time Risk and Margin Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4 pt-4 border-t border-slate-100">
          <RiskScoreIndicator score={quotation.blendedRiskScore} violationsCount={violationsCount} />
          <MarginGauge marginPct={quotation.overallMarginPct} targetMargin={30} />
        </div>
      </div>

      {/* Main Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left 2/3: Cart & Line Items */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader className="py-3 px-5 flex items-center justify-between bg-slate-50/50">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <span>Quotation Line Items</span>
                <span className="text-xs font-normal text-slate-400">({quotation.lines.length} items)</span>
              </CardTitle>

              {/* Product Combobox */}
              {isDraft && (
                <div className="relative w-64">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                    <input
                      type="text"
                      value={productSearch}
                      onChange={(e) => {
                        setProductSearch(e.target.value);
                        setShowProductDropdown(true);
                      }}
                      onFocus={() => setShowProductDropdown(true)}
                      placeholder="+ Search to add product..."
                      className="w-full text-xs pl-8 pr-3 py-1.5 rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>

                  {showProductDropdown && productSearch && (
                    <div className="absolute right-0 top-9 w-80 bg-white rounded-xl shadow-elevated border border-slate-200 z-50 max-h-64 overflow-y-auto p-1">
                      {filteredProducts.length === 0 ? (
                        <div className="p-3 text-xs text-slate-400 text-center">No products matching</div>
                      ) : (
                        filteredProducts.map((prod: any) => (
                          <button
                            key={prod.id}
                            type="button"
                            onClick={() => handleAddProduct(prod)}
                            className="w-full text-left p-2 hover:bg-blue-50 rounded-lg text-xs transition-colors flex items-center justify-between"
                          >
                            <div>
                              <div className="font-bold text-slate-800">{prod.name}</div>
                              <div className="text-[10px] text-slate-400">{prod.category?.name || 'Hardware'}</div>
                            </div>
                            <div className="font-black text-slate-900">{formatCurrency(prod.basePrice)}</div>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )}
            </CardHeader>

            <CardContent className="p-0">
              {quotation.lines.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400">
                  Your cart is empty. Use the product search above or select from upsell recommendations.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left table-dense">
                    <thead>
                      <tr>
                        <th>Product & Category</th>
                        <th className="text-center">Qty</th>
                        <th className="text-right">Unit Price</th>
                        <th className="text-center">Discount %</th>
                        <th className="text-right">Line Total</th>
                        <th className="text-right">Margin</th>
                        {isDraft && <th className="text-center">Actions</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {quotation.lines.map((line: any) => (
                        <tr
                          key={line.id}
                          className={line.hasCeilingViolation ? 'bg-red-50/40' : 'hover:bg-slate-50/40'}
                        >
                          <td className="font-medium text-slate-800">
                            <div className="font-bold text-xs">{line.productName}</div>
                            <div className="text-[10px] text-slate-400 flex items-center gap-1">
                              <span>{line.categoryName}</span>
                              <span>•</span>
                              <span>Ceiling: {line.effectiveCeilingPct}%</span>
                              {line.hasCeilingViolation && (
                                <span className="text-red-600 font-bold flex items-center gap-0.5">
                                  <AlertCircle className="w-3 h-3" />
                                  Ceiling Exceeded!
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Qty +/- Controls */}
                          <td className="text-center">
                            {isDraft ? (
                              <div className="inline-flex items-center border border-slate-200 rounded-lg bg-white overflow-hidden shadow-2xs">
                                <button
                                  type="button"
                                  onClick={() => handleQtyChange(line.id, line.quantity, -1)}
                                  className="px-2 py-0.5 text-xs text-slate-600 hover:bg-slate-100"
                                >
                                  -
                                </button>
                                <span className="px-2 text-xs font-bold text-slate-800">{line.quantity}</span>
                                <button
                                  type="button"
                                  onClick={() => handleQtyChange(line.id, line.quantity, 1)}
                                  className="px-2 py-0.5 text-xs text-slate-600 hover:bg-slate-100"
                                >
                                  +
                                </button>
                              </div>
                            ) : (
                              <span className="font-bold text-xs">{line.quantity}</span>
                            )}
                          </td>

                          <td className="text-right font-medium text-xs text-slate-700">
                            {formatCurrency(line.unitPrice)}
                          </td>

                          {/* Discount input */}
                          <td className="text-center">
                            {isDraft ? (
                              <div className="inline-flex items-center gap-1">
                                <input
                                  type="number"
                                  min="0"
                                  max="100"
                                  value={line.discountPct}
                                  onChange={(e) =>
                                    handleDiscountChange(line.id, parseFloat(e.target.value) || 0)
                                  }
                                  className={`w-14 text-center text-xs py-1 rounded border font-semibold focus:outline-none focus:ring-1 ${
                                    line.hasCeilingViolation
                                      ? 'border-red-500 bg-red-50 text-red-700 focus:ring-red-500'
                                      : 'border-slate-300 bg-white text-slate-800 focus:ring-primary'
                                  }`}
                                />
                                <span className="text-xs text-slate-400">%</span>
                              </div>
                            ) : (
                              <span className="text-xs font-semibold">{line.discountPct}%</span>
                            )}
                          </td>

                          <td className="text-right font-bold text-xs text-slate-900">
                            {formatCurrency(line.lineTotal)}
                          </td>

                          <td className="text-right text-xs font-semibold text-emerald-600">
                            {line.marginPct?.toFixed(1)}%
                          </td>

                          {isDraft && (
                            <td className="text-center">
                              <button
                                type="button"
                                onClick={() => handleRemoveLine(line.id)}
                                className="p-1 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                                title="Remove line item"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Totals Summary */}
          <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1 text-xs text-slate-600">
                <div className="flex justify-between sm:justify-start sm:gap-6">
                  <span className="text-slate-500">Subtotal:</span>
                  <span className="font-semibold text-slate-800">{formatCurrency(quotation.subtotalAmount)}</span>
                </div>
                <div className="flex justify-between sm:justify-start sm:gap-6">
                  <span className="text-slate-500">Tax (18% Standard):</span>
                  <span className="font-semibold text-slate-800">{formatCurrency(quotation.taxAmount)}</span>
                </div>
              </div>

              <div className="sm:text-right border-t sm:border-t-0 pt-3 sm:pt-0">
                <div className="text-xs text-slate-400 font-bold uppercase tracking-wider">Total Contract Value</div>
                <div className="text-2xl font-black text-slate-900">{formatCurrency(quotation.totalAmount)}</div>
                <div className="text-xs font-semibold text-emerald-600">
                  Overall Margin: {quotation.overallMarginPct.toFixed(1)}%
                </div>
              </div>
            </div>

            {/* Action Bar (REQ-F-090-097) */}
            <div className="flex flex-wrap items-center justify-end gap-3 mt-5 pt-4 border-t border-slate-100">
              {isDraft && (
                <Button
                  variant="accent"
                  size="md"
                  onClick={handleSubmit}
                  isLoading={isUpdating}
                  className="shadow-sm"
                >
                  <CheckCircle className="w-4 h-4 mr-1.5" />
                  Submit Quotation
                </Button>
              )}

              {isApproved && (
                <Button
                  variant="primary"
                  size="md"
                  onClick={handleSendToCustomer}
                  isLoading={isUpdating}
                  className="shadow-sm"
                >
                  <Send className="w-4 h-4 mr-1.5" />
                  Send to Customer Portal
                </Button>
              )}

              {isConfirmed && (
                <div className="flex items-center gap-2 text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200">
                  <CheckCircle className="w-4 h-4 text-emerald-600" />
                  Quotation Confirmed by Customer
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right 1/3: Smart Upsell & Recommendations Panel */}
        <div className="space-y-4">
          <UpsellPanel
            suggestions={upsellSuggestions}
            onAddSuggestion={(suggestion) =>
              handleAddProduct({
                id: suggestion.suggestedProduct.id,
                name: suggestion.suggestedProduct.name,
                basePrice: suggestion.suggestedProduct.basePrice,
                costPrice: Number(suggestion.suggestedProduct.basePrice) * 0.4,
                categoryId: 'cat-02',
                unit: 'unit',
                taxRate: 18,
              })
            }
          />
        </div>
      </div>
    </div>
  );
}
