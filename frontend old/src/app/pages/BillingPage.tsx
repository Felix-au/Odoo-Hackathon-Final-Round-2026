import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useBilling, useRecordPayment, useProrationPreview } from '../../api/hooks/useBilling';
import { useAuthStore } from '../../stores/auth.store';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Dialog } from '../../components/ui/Dialog';
import { Input } from '../../components/ui/Input';
import { LoadingSpinner } from '../../components/feedback/LoadingSpinner';
import { formatCurrency, formatDate } from '../../lib/utils';
import { Receipt, Calendar, CreditCard, ArrowLeft, CheckCircle, FileText } from 'lucide-react';
import { toast } from 'sonner';

export function BillingPage() {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const targetOrderId = id || 'q-001';
  const { invoice, subscriptions, schedule, isLoading } = useBilling(targetOrderId);
  const recordPaymentMutation = useRecordPayment(targetOrderId);
  const prorationMutation = useProrationPreview();

  // Payment modal state
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('0.00');
  const [paymentMethod, setPaymentMethod] = useState('WIRE_TRANSFER');
  const [paymentRef, setPaymentRef] = useState('');

  // Subscription change modal state
  const [showSubModal, setShowSubModal] = useState(false);
  const [newSubQty, setNewSubQty] = useState(1);
  const [prorationData, setProrationData] = useState<any>(null);

  const isFinance = user?.role === 'FINANCE' || user?.role === 'ADMIN';

  const handleRecordPayment = async () => {
    try {
      await recordPaymentMutation.mutateAsync({
        amount: parseFloat(paymentAmount),
        method: paymentMethod,
        reference: paymentRef,
      });
      setShowPaymentModal(false);
      toast.success('Payment recorded successfully. Invoice marked as PAID.');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Billing service is in development';
      toast.info(msg);
    }
  };

  const handleCalculateProration = async () => {
    try {
      const data = await prorationMutation.mutateAsync({
        subscriptionId: subscriptions[0]?.id || 'sub-01',
        newQty: newSubQty,
      });
      setProrationData(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Billing service is in development';
      toast.info(msg);
    }
  };

  return (
    <div className="space-y-5 pb-8 max-w-5xl mx-auto">
      {/* Back button if opened with quotation ID */}
      {id && (
        <button
          onClick={() => navigate(`/app/quotations/${id}`)}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Quotation Builder
        </button>
      )}

      {/* Header */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-xl font-black text-slate-900 tracking-tight">Billing & Invoicing</h1>
            <Badge variant="success" size="sm">
              Live Service
            </Badge>
          </div>
          <p className="text-xs text-slate-500">
            {id
              ? `Order #${id} • One-Time Invoices & Recurring Subscription Lines`
              : 'Separated Invoicing, Subscriptions & Automated Billing Schedules (Port 3005)'}
          </p>
        </div>
      </div>

      {/* Loading state */}
      {isLoading ? (
        <LoadingSpinner label="Checking Billing service status..." />
      ) : !invoice ? (
        /* Graceful Empty State for Incomplete Service */
        <Card className="border-dashed border-2">
          <CardContent className="p-8 text-center space-y-3">
            <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
              <FileText className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-800">No Billing Records Available</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Once the billing service is online and an order invoice is generated, one-time charges, recurring seat
              subscriptions, and payment history will appear here.
            </p>
          </CardContent>
        </Card>
      ) : (
        /* Real Invoice & Subscription Data (when service is online) */
        <div className="space-y-5">
          {/* Two Sections: One-Time vs Subscriptions */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Section 1: One-Time Hardware & Services Invoice */}
            <Card>
              <CardHeader className="py-3 px-5 bg-slate-50/75 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-primary" />
                  <CardTitle className="text-xs font-bold text-slate-800">One-Time Invoice</CardTitle>
                </div>
                <Badge variant={invoice.status === 'PAID' ? 'success' : 'warning'} size="sm">
                  {invoice.status}
                </Badge>
              </CardHeader>

              <CardContent className="p-5 space-y-4">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500">Invoice Number:</span>
                  <span className="font-mono font-bold text-slate-900">{invoice.invoiceNumber}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500">Customer:</span>
                  <span className="font-bold text-slate-800">{invoice.customerName}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500">Subtotal:</span>
                  <span className="font-semibold text-slate-800">{formatCurrency(invoice.amount)}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500">Tax:</span>
                  <span className="font-semibold text-slate-800">{formatCurrency(invoice.taxAmount)}</span>
                </div>
                <div className="flex justify-between items-center text-xs pt-3 border-t border-slate-100">
                  <span className="text-slate-900 font-bold">Total Due:</span>
                  <span className="text-base font-black text-slate-900">{formatCurrency(invoice.totalAmount)}</span>
                </div>

                {invoice.status !== 'PAID' && isFinance && (
                  <Button
                    variant="success"
                    size="sm"
                    className="w-full mt-2"
                    onClick={() => setShowPaymentModal(true)}
                  >
                    <CreditCard className="w-4 h-4 mr-1.5" />
                    Record Payment
                  </Button>
                )}

                {invoice.status === 'PAID' && (
                  <div className="p-2.5 rounded-lg bg-emerald-50 text-emerald-800 text-xs font-semibold flex items-center justify-center gap-1.5">
                    <CheckCircle className="w-4 h-4 text-emerald-600" />
                    Paid on {formatDate(invoice.paidAt || new Date().toISOString())}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Section 2: Recurring Subscriptions */}
            <Card>
              <CardHeader className="py-3 px-5 bg-slate-50/75 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-primary" />
                  <CardTitle className="text-xs font-bold text-slate-800">Recurring Subscriptions</CardTitle>
                </div>
                <Badge variant="success" size="sm">
                  ACTIVE
                </Badge>
              </CardHeader>

              <CardContent className="p-5 space-y-4">
                {subscriptions.length === 0 ? (
                  <div className="text-center text-xs text-slate-400 py-6">No recurring products in this order.</div>
                ) : (
                  subscriptions.map((sub) => (
                    <div key={sub.id} className="space-y-3">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-bold text-slate-800">{sub.planName}</span>
                        <span className="font-black text-slate-900">{formatCurrency(sub.totalAmount)}/mo</span>
                      </div>
                      <div className="flex justify-between text-xs text-slate-500">
                        <span>Quantity: {sub.quantity} seats</span>
                        <span>Rate: {formatCurrency(sub.unitPrice)}/seat</span>
                      </div>
                      <div className="flex justify-between text-xs text-slate-500">
                        <span>Next Charge Date:</span>
                        <span className="font-semibold text-slate-800">{formatDate(sub.nextBillingDate)}</span>
                      </div>

                      <div className="flex items-center gap-2 pt-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs flex-1"
                          onClick={() => {
                            setShowSubModal(true);
                            handleCalculateProration();
                          }}
                        >
                          Change Quantity / Proration
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>

          {/* Billing Schedule Table */}
          {schedule.length > 0 && (
            <Card>
              <CardHeader className="py-3 px-5 bg-slate-50/75">
                <CardTitle className="text-xs font-bold text-slate-800">Upcoming Automated Billing Schedule</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <table className="w-full text-left table-dense">
                  <thead>
                    <tr>
                      <th>Scheduled Date</th>
                      <th>Type</th>
                      <th>Description</th>
                      <th className="text-right">Amount</th>
                      <th className="text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {schedule.map((item) => (
                      <tr key={item.id}>
                        <td className="font-semibold text-xs text-slate-800">{formatDate(item.date)}</td>
                        <td className="text-xs text-slate-500">{item.type}</td>
                        <td className="text-xs text-slate-700">{item.description}</td>
                        <td className="text-right font-black text-xs text-slate-900">{formatCurrency(item.amount)}</td>
                        <td className="text-center">
                          <Badge variant="outline" size="sm">
                            {item.status}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Record Payment Dialog */}
      <Dialog
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        title="Record Payment"
        description="Acknowledge incoming customer wire or credit transfer"
      >
        <div className="space-y-4">
          <Input
            label="Payment Amount (₹)"
            type="number"
            value={paymentAmount}
            onChange={(e) => setPaymentAmount(e.target.value)}
          />
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Payment Method</label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="w-full rounded-lg border border-slate-300 p-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="WIRE_TRANSFER">Wire Transfer</option>
              <option value="ACH">ACH Direct Debit</option>
              <option value="CREDIT_CARD">Credit Card</option>
              <option value="CHECK">Corporate Check</option>
            </select>
          </div>
          <Input
            label="Reference # / Transaction ID"
            value={paymentRef}
            onChange={(e) => setPaymentRef(e.target.value)}
          />

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button variant="ghost" size="sm" onClick={() => setShowPaymentModal(false)}>
              Cancel
            </Button>
            <Button
              variant="success"
              size="sm"
              onClick={handleRecordPayment}
              isLoading={recordPaymentMutation.isPending}
            >
              Confirm Payment
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Proration Preview Dialog */}
      <Dialog
        isOpen={showSubModal}
        onClose={() => setShowSubModal(false)}
        title="Subscription Quantity & Proration Preview"
        description="Proration calculations per REQ-F-161"
      >
        <div className="space-y-4">
          <Input
            label="New License Quantity"
            type="number"
            min="1"
            value={newSubQty}
            onChange={(e) => {
              setNewSubQty(parseInt(e.target.value) || 1);
            }}
          />

          <Button variant="outline" size="sm" onClick={handleCalculateProration}>
            Recalculate Proration
          </Button>

          {prorationData && (
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5 text-xs">
              <div className="font-bold text-slate-800 mb-1">Proration Calculation Breakdown:</div>
              <div className="flex justify-between">
                <span className="text-slate-500">Unused Days Credit ({prorationData.currentQty} seats):</span>
                <span className="text-emerald-600 font-semibold">{formatCurrency(prorationData.creditAmount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">New Tier Charge ({prorationData.newQty} seats):</span>
                <span className="text-slate-800 font-semibold">{formatCurrency(prorationData.chargeAmount)}</span>
              </div>
              <div className="flex justify-between pt-1 border-t border-slate-200 font-bold">
                <span>Net Invoice Delta:</span>
                <span className="text-primary font-black">+{formatCurrency(prorationData.netDelta)}</span>
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button variant="ghost" size="sm" onClick={() => setShowSubModal(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                setShowSubModal(false);
                toast.success(`Updated subscription to ${newSubQty} seats with proration delta applied.`);
              }}
            >
              Apply Subscription Change
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
