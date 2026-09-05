import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { usePortalQuotation } from '../../api/hooks/usePortalQuotation';
import { LoadingSpinner } from '../../components/feedback/LoadingSpinner';
import { CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

export function QuotationPortalPage() {
  const { id = 'q-001' } = useParams<{ id: string }>();
  const { quotation, isLoading, submitNegotiation, confirmQuotation, isSubmitting } = usePortalQuotation(id);

  const [isEditingComments, setIsEditingComments] = useState(false);
  const [commentText, setCommentText] = useState(
    'Can we increase the router quantity and receive a better discount?'
  );
  const [isConfirmed, setIsConfirmed] = useState(false);

  if (isLoading && !quotation) {
    return (
      <div className="py-20 flex justify-center">
        <LoadingSpinner label="Loading proposal..." />
      </div>
    );
  }

  const handleConfirm = async () => {
    try {
      if (confirmQuotation) {
        await confirmQuotation();
      }
      setIsConfirmed(true);
      toast.success('Proposal accepted! Your order is now being processed.');
    } catch {
      toast.error('Failed to confirm proposal');
    }
  };

  const handleRequestChanges = async () => {
    if (!commentText.trim()) {
      toast.error('Please enter your feedback before requesting changes');
      return;
    }
    try {
      if (submitNegotiation) {
        await submitNegotiation({
          message: commentText,
        });
      }
      setIsEditingComments(false);
      toast.success('Your feedback has been delivered to your sales representative.');
    } catch {
      toast.error('Failed to submit feedback');
    }
  };

  // Lines representation matching Screenshot 3
  const lines = quotation?.lines && quotation.lines.length > 0 ? quotation.lines : [
    {
      id: 'line-01',
      productName: 'Enterprise Router',
      quantity: 10,
      unitPrice: 500,
      total: 5000,
      subtext: '10 × $500',
    },
    {
      id: 'line-02',
      productName: 'Support Plan',
      quantity: 1,
      unitPrice: 900,
      total: 900,
      subtext: '1 × $900 · annual renewal',
    },
  ];

  const totalAmount = quotation?.totalAmount || 6500;
  const quoteNumber = quotation?.quotationNumber || 'DF-10482';
  const customerName = quotation?.customer?.name || 'Acme Corporation';

  return (
    <div className="w-full max-w-2xl mx-auto animate-in fade-in duration-300">
      {/* Confirmed Banner */}
      {isConfirmed && (
        <div className="mb-6 p-5 rounded-2xl bg-slate-900 text-white shadow-lg flex items-center gap-3.5">
          <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" />
          <div>
            <h3 className="text-sm font-bold tracking-tight">Proposal Accepted</h3>
            <p className="text-xs text-slate-300 mt-0.5">
              Thank you for approving Quote #{quoteNumber}. Fulfillment and delivery coordination have been initiated.
            </p>
          </div>
        </div>
      )}

      {/* Main Proposal Card (Screenshot 3) */}
      <div className="bg-white border border-slate-200/90 rounded-3xl p-8 sm:p-12 shadow-sm">
        {/* Eyebrow */}
        <div className="text-[11px] font-bold tracking-widest text-slate-400 uppercase">
          Proposal
        </div>

        {/* Title */}
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 mt-1.5">
          Enterprise Network Infrastructure
        </h1>

        {/* Subtitle */}
        <div className="text-xs sm:text-sm text-slate-500 mt-2 pb-6 border-b border-slate-100">
          Prepared for {customerName} · Quote #{quoteNumber}
        </div>

        {/* Line Items List */}
        <div className="divide-y divide-slate-100">
          {lines.map((item: any) => (
            <div key={item.id} className="py-5 flex items-baseline justify-between gap-4">
              <div>
                <div className="text-sm sm:text-base font-semibold text-slate-900">
                  {item.productName}
                </div>
                <div className="text-xs text-slate-500 mt-0.5">
                  {item.subtext || `${item.quantity} × $${item.unitPrice}`}
                </div>
              </div>
              <div className="text-sm sm:text-base font-bold text-slate-900 shrink-0">
                ${(item.total || (item.unitPrice * item.quantity)).toLocaleString()}
              </div>
            </div>
          ))}
        </div>

        {/* Total Row */}
        <div className="pt-6 pb-6 border-t border-slate-100 flex items-center justify-between">
          <span className="text-base font-bold text-slate-900">Total</span>
          <span className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
            ${totalAmount.toLocaleString()}
          </span>
        </div>

        {/* Comments Section (Screenshot 3) */}
        <div className="bg-[#F8FAFC] border border-slate-100 rounded-2xl p-5 mt-2">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">
              Comments
            </span>
            {!isEditingComments && (
              <button
                type="button"
                onClick={() => setIsEditingComments(true)}
                className="text-[11px] font-medium text-slate-400 hover:text-slate-700"
              >
                Edit
              </button>
            )}
          </div>

          {isEditingComments ? (
            <div className="space-y-3">
              <textarea
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                rows={2}
                maxLength={1000}
                className="w-full bg-white border border-slate-200 rounded-xl p-3 text-xs sm:text-sm text-slate-800 focus:outline-none focus:border-slate-400"
                placeholder="Add counter discount or specific requirements..."
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsEditingComments(false)}
                  className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-800 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleRequestChanges}
                  className="px-3.5 py-1.5 bg-slate-900 text-white rounded-lg text-xs font-semibold hover:bg-slate-800"
                >
                  Save Feedback
                </button>
              </div>
            </div>
          ) : (
            <p className="text-xs sm:text-sm text-slate-700 italic">
              "{commentText}"
            </p>
          )}
        </div>

        {/* Action Buttons Row (Screenshot 3) */}
        {!isConfirmed && (
          <div className="flex items-center justify-end gap-3 mt-8">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => {
                if (!isEditingComments) {
                  setIsEditingComments(true);
                } else {
                  handleRequestChanges();
                }
              }}
              className="px-5 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 text-xs sm:text-sm font-semibold transition-colors focus:outline-none disabled:opacity-50"
            >
              Request changes
            </button>

            <button
              type="button"
              disabled={isSubmitting}
              onClick={handleConfirm}
              className="px-6 py-2.5 rounded-xl bg-slate-950 text-white hover:bg-slate-800 text-xs sm:text-sm font-semibold transition-colors shadow-xs focus:outline-none disabled:opacity-50"
            >
              {isSubmitting ? 'Processing...' : 'Accept proposal'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
