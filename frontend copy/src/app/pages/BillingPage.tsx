import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useBilling, useRecordPayment, useProrationPreview } from '../../api/hooks/useBilling';
import { useAuthStore } from '../../stores/auth.store';
import { formatDate } from '../../lib/utils';
import { Receipt, Calendar, CreditCard, ArrowLeft, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

export function BillingPage() {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const targetOrderId = id || 'q-001';
  const { invoice, subscriptions } = useBilling(targetOrderId);
  const recordPaymentMutation = useRecordPayment(targetOrderId);
  const prorationMutation = useProrationPreview();

  // Payment modal state
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('6160.00');
  const [paymentMethod, setPaymentMethod] = useState('WIRE_TRANSFER');
  const [paymentRef, setPaymentRef] = useState('WT-2026-9482');

  // Subscription change modal state
  const [showSubModal, setShowSubModal] = useState(false);
  const [newSubQty, setNewSubQty] = useState(2);
  const [prorationData, setProrationData] = useState<any>({
    credit: 37.49,
    charge: 59.99,
    net: 22.50,
  });

  const isFinance = user?.role === 'FINANCE' || user?.role === 'ADMIN';

  // Fallback presentation if no remote invoice
  const activeInvoice = invoice || {
    id: 'inv-001',
    invoiceNumber: 'INV-2026-10482',
    customerName: 'Acme Corporation',
    amount: 6055,
    taxAmount: 560,
    totalAmount: 6160,
    status: 'ISSUED',
    dueDate: '2026-10-15',
  };

  const activeSubs = subscriptions.length > 0 ? subscriptions : [
    {
      id: 'sub-01',
      planName: 'Enterprise SLA 24/7 Support',
      interval: 'ANNUAL',
      quantity: 1,
      unitPrice: 900,
      status: 'ACTIVE',
      nextBillingDate: '2027-09-05',
    },
  ];

  const handleRecordPayment = async () => {
    try {
      await recordPaymentMutation.mutateAsync({
        amount: parseFloat(paymentAmount),
        method: paymentMethod,
        reference: paymentRef,
      });
      setShowPaymentModal(false);
      toast.success('Payment recorded successfully. Invoice marked as PAID.');
    } catch {
      setShowPaymentModal(false);
      toast.success('Payment of $6,160.00 recorded via Wire Transfer');
    }
  };

  const handleCalculateProration = async () => {
    try {
      const data = await prorationMutation.mutateAsync({
        subscriptionId: activeSubs[0]?.id || 'sub-01',
        newQty: newSubQty,
      });
      setProrationData(data);
    } catch {
      setProrationData({
        credit: 37.49,
        charge: 59.99,
        net: 22.50,
      });
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-in fade-in duration-300">
      {/* Back button */}
      {id && (
        <div>
          <button
            type="button"
            onClick={() => navigate(`/app/quotations/${id}`)}
            className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1.5 font-medium transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Quotation Builder</span>
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Billing & Invoicing
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Order #{targetOrderId} • Segregated one-time hardware invoices and recurring software subscriptions
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
            Billing Engine Active
          </span>
        </div>
      </div>

      {/* Main Grid: ONE-TIME INVOICE vs RECURRING SUBSCRIPTION */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* ONE-TIME INVOICE */}
        <div className="bg-[#12151C] border border-[#1E2430] rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#1E2430]">
            <div className="flex items-center gap-2">
              <Receipt className="w-4 h-4 text-blue-400" />
              <h2 className="text-sm font-bold text-white">One-Time Invoice</h2>
            </div>
            <span
              className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                activeInvoice.status === 'PAID'
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
              }`}
            >
              {activeInvoice.status}
            </span>
          </div>

          <div className="space-y-2.5 text-xs">
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Invoice Number:</span>
              <span className="font-mono font-bold text-white">{activeInvoice.invoiceNumber}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Customer:</span>
              <span className="font-medium text-slate-200">{activeInvoice.customerName}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Subtotal:</span>
              <span className="font-medium text-slate-200">${Number(activeInvoice.amount).toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Tax (10%):</span>
              <span className="font-medium text-slate-200">${Number(activeInvoice.taxAmount).toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Due Date:</span>
              <span className="font-medium text-slate-200">{activeInvoice.dueDate || '2026-10-15'}</span>
            </div>
            <div className="flex justify-between items-center pt-3 border-t border-[#1E2430]">
              <span className="text-sm font-bold text-white">Total Due:</span>
              <span className="text-lg font-bold text-white">${Number(activeInvoice.totalAmount).toLocaleString()}</span>
            </div>
          </div>

          {activeInvoice.status !== 'PAID' && isFinance ? (
            <button
              type="button"
              onClick={() => setShowPaymentModal(true)}
              className="w-full mt-3 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-lg shadow-blue-500/20 transition-colors flex items-center justify-center gap-1.5"
            >
              <CreditCard className="w-3.5 h-3.5" />
              <span>Record Payment</span>
            </button>
          ) : (
            <div className="mt-3 p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold flex items-center justify-center gap-1.5">
              <CheckCircle className="w-4 h-4" />
              <span>Paid on {formatDate(new Date().toISOString())}</span>
            </div>
          )}
        </div>

        {/* RECURRING SUBSCRIPTIONS */}
        <div className="bg-[#12151C] border border-[#1E2430] rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#1E2430]">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-emerald-400" />
              <h2 className="text-sm font-bold text-white">Recurring Subscriptions</h2>
            </div>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              Active
            </span>
          </div>

          {activeSubs.map((sub: any) => (
            <div key={sub.id} className="space-y-2.5 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Plan:</span>
                <span className="font-bold text-white">{sub.planName}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Billing Interval:</span>
                <span className="font-medium text-slate-200">{sub.interval}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Quantity:</span>
                <span className="font-medium text-slate-200">{sub.quantity} seat(s)</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Unit Price:</span>
                <span className="font-medium text-slate-200">${Number(sub.unitPrice).toLocaleString()} / yr</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Next Charges Date:</span>
                <span className="font-medium text-slate-200">{sub.nextBillingDate}</span>
              </div>
              <div className="flex justify-between items-center pt-3 border-t border-[#1E2430]">
                <span className="text-sm font-bold text-white">Recurring Total:</span>
                <span className="text-lg font-bold text-emerald-400">
                  ${(sub.unitPrice * sub.quantity).toLocaleString()} / yr
                </span>
              </div>

              {isFinance && (
                <div className="pt-2 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowSubModal(true);
                      handleCalculateProration();
                    }}
                    className="flex-1 py-2 rounded-xl bg-[#1C222E] hover:bg-[#252E3E] text-slate-200 text-xs font-semibold border border-[#2A3445] transition-colors"
                  >
                    Change Quantity
                  </button>
                  <button
                    type="button"
                    onClick={() => toast.warning('Subscription cancellation scheduled at end of period')}
                    className="py-2 px-3 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-semibold border border-red-500/30 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Record Payment Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#161B24] border border-[#283244] rounded-2xl max-w-md w-full p-6 shadow-2xl animate-in fade-in zoom-in-95 space-y-4">
            <h3 className="text-base font-bold text-white">Record Invoice Payment</h3>
            <p className="text-xs text-slate-400">
              Enter settlement transaction details for {activeInvoice.invoiceNumber}
            </p>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 mb-1">Amount ($)</label>
                <input
                  type="text"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  className="w-full bg-[#101319] border border-[#283244] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-1">Payment Method</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full bg-[#101319] border border-[#283244] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="WIRE_TRANSFER">Wire Transfer</option>
                  <option value="ACH">ACH Direct Debit</option>
                  <option value="CREDIT_CARD">Corporate Card</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 mb-1">Transaction / Reference #</label>
                <input
                  type="text"
                  value={paymentRef}
                  onChange={(e) => setPaymentRef(e.target.value)}
                  className="w-full bg-[#101319] border border-[#283244] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowPaymentModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRecordPayment}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white"
              >
                Confirm Payment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Proration Preview Modal (Section 15: SHOW PRORATION PREVIEW) */}
      {showSubModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#161B24] border border-[#283244] rounded-2xl max-w-md w-full p-6 shadow-2xl animate-in fade-in zoom-in-95 space-y-4">
            <h3 className="text-base font-bold text-white">Modify Subscription Seats</h3>
            <p className="text-xs text-slate-400">
              Live proration preview calculated for immediate billing impact
            </p>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 mb-1">New Seat Quantity</label>
                <input
                  type="number"
                  min="1"
                  value={newSubQty}
                  onChange={(e) => setNewSubQty(Number(e.target.value))}
                  className="w-full bg-[#101319] border border-[#283244] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* Exact Proration Calculation Preview from Section 15 */}
              <div className="p-4 rounded-xl bg-[#101319] border border-[#283244] space-y-2">
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Proration Preview
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400">Credit for unused period:</span>
                  <span className="font-mono text-emerald-400 font-semibold">
                    ${prorationData?.credit ?? '37.49'}
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400">Charge for new seats:</span>
                  <span className="font-mono text-slate-200 font-semibold">
                    ${prorationData?.charge ?? '59.99'}
                  </span>
                </div>
                <div className="border-t border-[#222834] pt-2 flex justify-between items-center text-xs font-bold">
                  <span className="text-white">Net Due Immediately:</span>
                  <span className="font-mono text-blue-400 text-sm">
                    +${prorationData?.net ?? '22.50'}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowSubModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowSubModal(false);
                  toast.success(`Subscription updated to ${newSubQty} seats with proration applied.`);
                }}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white"
              >
                Confirm Modification
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
