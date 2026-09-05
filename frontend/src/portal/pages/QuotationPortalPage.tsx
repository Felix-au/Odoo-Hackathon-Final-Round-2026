import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { usePortalQuotation } from '../../api/hooks/usePortalQuotation';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Dialog } from '../../components/ui/Dialog';
import { LoadingSpinner } from '../../components/feedback/LoadingSpinner';
import { STATUS_PORTAL_LABELS } from '../../lib/constants';
import { formatCurrency, formatDate, formatDateTime } from '../../lib/utils';
import { CheckCircle2, MessageSquare, History, FileText, Send } from 'lucide-react';
import { toast } from 'sonner';

export function QuotationPortalPage() {
  const { id = 'q-001' } = useParams<{ id: string }>();
  const { quotation, isLoading, submitNegotiation, confirmQuotation, isSubmitting } = usePortalQuotation(id);

  // Confirmation dialog
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // Negotiation form state
  const [proposedDiscount, setProposedDiscount] = useState<string>('');
  const [message, setMessage] = useState('');
  const [lineComments] = useState<Record<string, string>>({});

  if (isLoading || !quotation) {
    return <LoadingSpinner label="Loading quotation details..." />;
  }

  const isConfirmed = quotation.status === 'CONFIRMED';
  const canNegotiate = quotation.status === 'SENT' || quotation.status === 'UNDER_NEGOTIATION';

  const handleConfirmOrder = async () => {
    try {
      await confirmQuotation();
      setShowConfirmModal(false);
      toast.success('Quotation confirmed! Your order is being fulfilled.');
    } catch {
      toast.error('Failed to confirm quotation');
    }
  };

  const handleNegotiateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message && !proposedDiscount) {
      toast.error('Please enter a message or proposed discount');
      return;
    }

    try {
      await submitNegotiation({
        proposedDiscount: proposedDiscount ? parseFloat(proposedDiscount) : undefined,
        message,
        lineComments,
      });
      setMessage('');
      setProposedDiscount('');
      toast.success('Your feedback has been delivered to your sales representative.');
    } catch {
      toast.error('Failed to submit feedback');
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Confirmed Banner */}
      {isConfirmed && (
        <div className="p-5 rounded-2xl bg-emerald-600 text-white shadow-md flex items-center gap-4 animate-in fade-in">
          <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-7 h-7 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-black tracking-tight">Order Confirmed!</h2>
            <p className="text-xs text-white/90 mt-0.5">
              Thank you for confirming your quotation. A digital copy has been sent to your registered email, and your account manager has initiated fulfillment.
            </p>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-xl font-black text-slate-900 tracking-tight">
              Quotation {quotation.quotationNumber}
            </h1>
            <Badge
              variant={isConfirmed ? 'success' : 'primary'}
              size="md"
              className="font-bold"
            >
              {STATUS_PORTAL_LABELS[quotation.status] || quotation.status}
            </Badge>
          </div>
          <p className="text-xs text-slate-500">
            Prepared for <strong className="text-slate-800">{quotation.customer.name}</strong> • Valid until:{' '}
            <strong className="text-slate-800">{formatDate(quotation.validUntil)}</strong>
          </p>
        </div>

        {/* Big Confirmation CTA Button (REQ-F-144) */}
        {!isConfirmed && (
          <Button
            variant="accent"
            size="lg"
            onClick={() => setShowConfirmModal(true)}
            className="shadow-md text-sm font-bold px-6 py-3"
          >
            <CheckCircle2 className="w-5 h-5 mr-2" />
            Confirm This Quotation
          </Button>
        )}
      </div>

      {/* Read-Only Line Items Table */}
      <Card>
        <CardHeader className="py-3 px-6 bg-slate-50/75 flex items-center justify-between">
          <CardTitle className="text-xs font-bold text-slate-800 flex items-center gap-2">
            <FileText className="w-4 h-4 text-primary" />
            Contract Scope & Deliverables
          </CardTitle>
          <span className="text-xs text-slate-400 font-medium">Currency: {quotation.currency}</span>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left table-dense">
              <thead>
                <tr>
                  <th>Product / Service</th>
                  <th className="text-center">Quantity</th>
                  <th className="text-right">Unit Price</th>
                  <th className="text-center">Applied Discount</th>
                  <th className="text-right">Total Price</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {quotation.lines.map((line) => (
                  <tr key={line.id}>
                    <td className="py-3.5 px-4 font-bold text-xs text-slate-900">
                      <div>{line.productName}</div>
                      <div className="text-[10px] font-normal text-slate-400">{line.categoryName}</div>
                    </td>
                    <td className="text-center py-3.5 px-4 font-bold text-xs text-slate-800">{line.quantity}</td>
                    <td className="text-right py-3.5 px-4 text-xs font-medium text-slate-600">
                      {formatCurrency(line.unitPrice)}
                    </td>
                    <td className="text-center py-3.5 px-4 text-xs font-semibold text-emerald-600">
                      {line.discountPct > 0 ? `${line.discountPct}%` : '—'}
                    </td>
                    <td className="text-right py-3.5 px-4 font-black text-xs text-slate-900">
                      {formatCurrency(line.lineTotal)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pricing Totals */}
          <div className="p-6 bg-slate-50/50 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="text-xs text-slate-500 space-y-1">
              <div>Terms: Net 30 Days from date of invoice</div>
              <div>Delivery: Dispatched from optimal localized distribution hubs</div>
            </div>

            <div className="text-right space-y-1">
              <div className="text-xs text-slate-500">
                Subtotal: <span className="font-semibold text-slate-800">{formatCurrency(quotation.subtotalAmount)}</span>
              </div>
              <div className="text-xs text-slate-500">
                Tax (18%): <span className="font-semibold text-slate-800">{formatCurrency(quotation.taxAmount)}</span>
              </div>
              <div className="text-lg font-black text-slate-900 pt-1 border-t border-slate-200">
                Total: {formatCurrency(quotation.totalAmount)}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Negotiation and Counter-Offer Panel (REQ-F-140–143) */}
      {!isConfirmed && canNegotiate && (
        <Card className="border-blue-200 shadow-sm">
          <CardHeader className="py-3 px-6 bg-blue-50/60 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-primary" />
              <CardTitle className="text-xs font-bold text-blue-950">Questions or Counter-Proposal?</CardTitle>
            </div>
          </CardHeader>

          <CardContent className="p-6">
            <form onSubmit={handleNegotiateSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Proposed Target Discount (%) — Optional
                </label>
                <div className="max-w-xs flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.5"
                    value={proposedDiscount}
                    onChange={(e) => setProposedDiscount(e.target.value)}
                    placeholder="e.g. 15"
                    className="w-28 text-xs p-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  <span className="text-xs text-slate-500">% overall discount</span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Substantial discount adjustments will be routed to the sales leadership team for rapid re-evaluation.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Message / Comments for Sales Representative
                </label>
                <textarea
                  rows={3}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Specify any requested quantity adjustments, timeline preferences, or warranty terms..."
                  className="w-full text-xs p-3 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-primary"
                  maxLength={1000}
                />
              </div>

              <div className="flex justify-end">
                <Button type="submit" variant="primary" size="sm" isLoading={isSubmitting}>
                  <Send className="w-3.5 h-3.5 mr-1.5" />
                  Submit Negotiation Request
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Negotiation History */}
      {quotation.negotiations && quotation.negotiations.length > 0 && (
        <Card>
          <CardHeader className="py-3 px-6 bg-slate-50/75 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-slate-500" />
              <CardTitle className="text-xs font-bold text-slate-700">Communication & Negotiation History</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-slate-100">
              {quotation.negotiations.map((neg) => (
                <div key={neg.id} className="p-4 text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800">
                      {neg.proposedDiscount ? `Requested ${neg.proposedDiscount}% discount` : 'Note submitted'}
                    </span>
                    <span className="text-[11px] text-slate-400">{formatDateTime(neg.submittedAt)}</span>
                  </div>
                  {neg.message && <p className="text-slate-600 italic">"{neg.message}"</p>}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Confirm Order Modal */}
      <Dialog
        isOpen={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        title="Confirm Quotation & Authorize Order"
        description="By confirming, you authorize execution under the specified commercial terms."
      >
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-500">Quotation #:</span>
              <span className="font-mono font-bold text-slate-800">{quotation.quotationNumber}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Authorized Total:</span>
              <span className="text-base font-black text-slate-900">{formatCurrency(quotation.totalAmount)}</span>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button variant="ghost" size="sm" onClick={() => setShowConfirmModal(false)}>
              Cancel
            </Button>
            <Button variant="accent" size="sm" onClick={handleConfirmOrder} isLoading={isSubmitting}>
              Yes, Confirm Order
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
