import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuotation } from '../../api/hooks/useQuotationBuilder';
import { useApprovalActions } from '../../api/hooks/useApproval';
import { useAuthStore } from '../../stores/auth.store';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Dialog } from '../../components/ui/Dialog';
import { RiskScoreIndicator } from '../../components/domain/RiskScoreIndicator';
import { LoadingSpinner } from '../../components/feedback/LoadingSpinner';
import { formatCurrency, formatDateTime } from '../../lib/utils';
import { CheckCircle, XCircle, RotateCcw, ShieldAlert, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';

export function QuotationApprovalPage() {
  const { id = 'q-002' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const { data: quotation, isLoading } = useQuotation(id);
  const { approve, reject, returnForRevision, isProcessing } = useApprovalActions(id);

  // Dialog states
  const [activeDialog, setActiveDialog] = useState<'APPROVE' | 'REJECT' | 'RETURN' | null>(null);
  const [reasonText, setReasonText] = useState('');

  if (isLoading || !quotation) {
    return <LoadingSpinner label="Loading approval context..." />;
  }

  const isManager = user?.role === 'SALES_MANAGER' || user?.role === 'ADMIN';
  const isFinance = user?.role === 'FINANCE' || user?.role === 'ADMIN';

  const pendingStep = quotation.approvalSteps?.find((s) => s.status === 'PENDING');
  const canAct =
    (pendingStep?.role === 'SALES_MANAGER' && isManager) ||
    (pendingStep?.role === 'FINANCE' && isFinance);

  const handleActionSubmit = async () => {
    if (!activeDialog) return;
    if ((activeDialog === 'REJECT' || activeDialog === 'RETURN') && reasonText.trim().length < 10) {
      toast.error('A detailed reason (at least 10 characters) is required');
      return;
    }

    try {
      const role = pendingStep?.role || user?.role || 'SALES_MANAGER';
      const actor = user?.name || 'Sales Authority';

      if (activeDialog === 'APPROVE') {
        await approve({ role, approverName: actor, reason: reasonText });
        toast.success('Approved quotation discount terms');
      } else if (activeDialog === 'REJECT') {
        await reject({ role, approverName: actor, reason: reasonText });
        toast.error('Quotation rejected');
      } else if (activeDialog === 'RETURN') {
        await returnForRevision({ role, approverName: actor, reason: reasonText });
        toast.warning('Returned quotation to sales rep for revision');
      }

      setActiveDialog(null);
      setReasonText('');
    } catch {
      toast.error('Action failed');
    }
  };

  return (
    <div className="space-y-5 pb-8 max-w-5xl mx-auto">
      {/* Top Breadcrumb */}
      <button
        onClick={() => navigate(`/app/quotations/${id}`)}
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Quotation Builder
      </button>

      {/* Header */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-xl font-black text-slate-900 tracking-tight">
              Approval Chain: {quotation.quotationNumber}
            </h1>
            <Badge variant="warning" size="sm">
              Requires Operational Approval
            </Badge>
          </div>
          <p className="text-xs text-slate-500">
            Customer: <strong className="text-slate-800">{quotation.customer.name}</strong> • Value:{' '}
            <strong className="text-slate-800">{formatCurrency(quotation.totalAmount)}</strong>
          </p>
        </div>

        {/* Risk Score Summary */}
        <RiskScoreIndicator score={quotation.blendedRiskScore} />
      </div>

      {/* Approval Steps Stepper */}
      <Card>
        <CardHeader className="py-3 px-5 bg-slate-50/50">
          <CardTitle className="text-xs font-bold text-slate-700">Approval Steps & Sign-Off Sequence</CardTitle>
        </CardHeader>
        <CardContent className="p-5">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            {(quotation.approvalSteps || [
              { role: 'SALES_MANAGER', status: 'PENDING' },
            ]).map((step, idx) => {
              const isPending = step.status === 'PENDING';
              const isDone = step.status === 'APPROVED';
              const isRejected = step.status === 'REJECTED';

              return (
                <div
                  key={idx}
                  className={`flex-1 p-3.5 rounded-xl border transition-all ${
                    isPending
                      ? 'border-amber-300 bg-amber-50/40 shadow-xs'
                      : isDone
                      ? 'border-emerald-200 bg-emerald-50/30'
                      : isRejected
                      ? 'border-red-200 bg-red-50/30'
                      : 'border-slate-200 bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold text-slate-800">
                      Step {idx + 1}: {step.role === 'SALES_MANAGER' ? 'Sales Manager Review' : 'Finance Review'}
                    </span>
                    <Badge
                      variant={isDone ? 'success' : isPending ? 'warning' : 'destructive'}
                      size="sm"
                    >
                      {step.status}
                    </Badge>
                  </div>
                  {step.approverName && (
                    <div className="text-[11px] text-slate-600">Signed by: {step.approverName}</div>
                  )}
                  {step.actionReason && (
                    <div className="text-[11px] text-slate-500 italic mt-1">"{step.actionReason}"</div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Discount Ceiling Breakdown */}
      <Card>
        <CardHeader className="py-3 px-5 bg-slate-50/50">
          <CardTitle className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
            <ShieldAlert className="w-4 h-4 text-amber-500" />
            Category Ceiling Violations & Line Item Analysis
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-left table-dense">
            <thead>
              <tr>
                <th>Product</th>
                <th>Category</th>
                <th className="text-center">Applied Discount</th>
                <th className="text-center">Allowed Ceiling</th>
                <th className="text-center">Status</th>
                <th className="text-right">Line Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {quotation.lines.map((line) => (
                <tr key={line.id} className={line.hasCeilingViolation ? 'bg-red-50/40' : ''}>
                  <td className="font-bold text-xs text-slate-800">{line.productName}</td>
                  <td className="text-xs text-slate-600">{line.categoryName}</td>
                  <td className="text-center font-bold text-xs text-slate-900">{line.discountPct}%</td>
                  <td className="text-center text-xs text-slate-500 font-semibold">{line.effectiveCeilingPct}%</td>
                  <td className="text-center">
                    {line.hasCeilingViolation ? (
                      <Badge variant="destructive" size="sm">
                        +{(line.discountPct - (line.effectiveCeilingPct || 0)).toFixed(0)}% Violation
                      </Badge>
                    ) : (
                      <Badge variant="success" size="sm">
                        Within Limits
                      </Badge>
                    )}
                  </td>
                  <td className="text-right font-black text-xs text-slate-900">{formatCurrency(line.lineTotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Approver Action Panel */}
      <div className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-sm">
        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Decision Panel</h3>

        {canAct ? (
          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="success"
              size="md"
              onClick={() => setActiveDialog('APPROVE')}
              isLoading={isProcessing}
            >
              <CheckCircle className="w-4 h-4 mr-1.5" />
              Approve Terms
            </Button>

            <Button
              variant="outline"
              size="md"
              className="text-amber-700 border-amber-300 hover:bg-amber-50"
              onClick={() => setActiveDialog('RETURN')}
              isLoading={isProcessing}
            >
              <RotateCcw className="w-4 h-4 mr-1.5" />
              Return for Revision
            </Button>

            <Button
              variant="destructive"
              size="md"
              onClick={() => setActiveDialog('REJECT')}
              isLoading={isProcessing}
            >
              <XCircle className="w-4 h-4 mr-1.5" />
              Reject Quotation
            </Button>
          </div>
        ) : (
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-500">
            You are viewing this approval chain in <strong>read-only mode</strong>. Only users with the pending role (
            <strong>{pendingStep?.role || 'authorized reviewer'}</strong>) can sign off.
          </div>
        )}
      </div>

      {/* Immutable Audit Trail Log */}
      <Card>
        <CardHeader className="py-3 px-5 bg-slate-50/50">
          <CardTitle className="text-xs font-bold text-slate-700">Immutable Audit Trail</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-slate-100">
            {(quotation.auditTrail || []).map((entry) => (
              <div key={entry.id} className="p-3.5 text-xs flex items-center justify-between gap-4">
                <div>
                  <span className="font-bold text-slate-800 mr-2">{entry.actorName}</span>
                  <Badge variant="outline" size="sm" className="mr-2 text-[10px]">
                    {entry.actorRole}
                  </Badge>
                  <span className="text-slate-600">{entry.action}</span>
                  {entry.reason && (
                    <div className="text-[11px] text-slate-500 italic mt-0.5">Reason: "{entry.reason}"</div>
                  )}
                </div>
                <div className="text-[11px] text-slate-400 shrink-0">{formatDateTime(entry.timestamp)}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Action Dialog (Approve, Reject, Return) */}
      <Dialog
        isOpen={activeDialog !== null}
        onClose={() => setActiveDialog(null)}
        title={
          activeDialog === 'APPROVE'
            ? 'Confirm Approval'
            : activeDialog === 'REJECT'
            ? 'Reject Quotation'
            : 'Return for Revision'
        }
        description={
          activeDialog === 'APPROVE'
            ? 'Authorize the applied discounts for this order.'
            : 'A written reason is required for compliance audit trails.'
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Reason / Comments {activeDialog !== 'APPROVE' && <span className="text-red-500">*</span>}
            </label>
            <textarea
              rows={3}
              value={reasonText}
              onChange={(e) => setReasonText(e.target.value)}
              placeholder={
                activeDialog === 'APPROVE'
                  ? 'Optional notes regarding approval rationale...'
                  : 'Specify why this quotation is being rejected or returned (min 10 characters)...'
              }
              className="w-full text-xs p-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button variant="ghost" size="sm" onClick={() => setActiveDialog(null)}>
              Cancel
            </Button>
            <Button
              variant={activeDialog === 'APPROVE' ? 'success' : activeDialog === 'REJECT' ? 'destructive' : 'primary'}
              size="sm"
              onClick={handleActionSubmit}
              isLoading={isProcessing}
            >
              Submit Decision
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
