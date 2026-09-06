import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuotation } from '../../api/hooks/useQuotationBuilder';
import { useApprovalActions } from '../../api/hooks/useApproval';
import { useAuthStore } from '../../stores/auth.store';
import { LoadingSpinner } from '../../components/feedback/LoadingSpinner';
import { formatCurrency, formatQuotationNumber } from '../../lib/utils';
import { AlertTriangle, ArrowLeft, Send, CheckCircle2, ArrowUpRight, Clock } from 'lucide-react';
import { toast } from 'sonner';

export function QuotationApprovalPage() {
  const { id = 'q-001' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { data: quotation, isLoading } = useQuotation(id);
  const { approve, reject, returnForRevision, sendQuotation, isProcessing } = useApprovalActions(id);

  const [activeDialog, setActiveDialog] = useState<'APPROVE' | 'REJECT' | 'RETURN' | null>(null);
  const [reasonText, setReasonText] = useState('');

  if (isLoading && !quotation) {
    return (
      <div className="py-20 flex justify-center">
        <LoadingSpinner label="Loading approval chain..." />
      </div>
    );
  }

  if (!quotation) {
    return (
      <div className="text-center py-20">
        <p className="text-zinc-400 text-sm">Quotation not found</p>
        <button
          type="button"
          onClick={() => navigate('/app/quotations')}
          className="mt-3 px-4 py-2 rounded-xl text-xs font-semibold bg-white text-black hover:bg-zinc-200"
        >
          Return to Quotations
        </button>
      </div>
    );
  }

  const canAct =
    (quotation.status === 'PENDING_MANAGER_APPROVAL' &&
      (user?.role === 'SALES_MANAGER' || user?.role === 'ADMIN')) ||
    (quotation.status === 'PENDING_FINANCE_APPROVAL' &&
      (user?.role === 'FINANCE' || user?.role === 'ADMIN')) ||
    (quotation.status === 'DRAFT' &&
      (user?.role === 'SALES_MANAGER' || user?.role === 'FINANCE' || user?.role === 'ADMIN'));

  const handleActionSubmit = async () => {
    try {
      if (activeDialog === 'APPROVE') {
        await approve({ reason: reasonText });
      } else if (activeDialog === 'REJECT') {
        if (!reasonText || reasonText.length < 10) {
          toast.error('Rejection reason must be at least 10 characters');
          return;
        }
        await reject({ reason: reasonText });
      } else if (activeDialog === 'RETURN') {
        if (!reasonText || reasonText.length < 10) {
          toast.error('Return explanation must be at least 10 characters');
          return;
        }
        await returnForRevision({ reason: reasonText });
      }
      setActiveDialog(null);
      setReasonText('');
    } catch {
      toast.error('Action failed');
    }
  };

  const score = quotation.blendedRiskScore ?? quotation.riskScore ?? 0;
  const isCFOApproval = score > 30 || quotation.status === 'PENDING_FINANCE_APPROVAL';
  const isApproved = quotation.status === 'APPROVED' || quotation.status === 'SENT' || quotation.status === 'CONFIRMED';

  const steps = isCFOApproval
    ? [
        { label: 'Sales Rep (Draft)', state: 'COMPLETED' },
        {
          label: 'CFO Review (Madhab CFO)',
          state: isApproved ? 'COMPLETED' : quotation.status === 'PENDING_FINANCE_APPROVAL' ? 'IN_PROGRESS' : 'PENDING',
        },
        {
          label: 'Approved (Ready to Send)',
          state: isApproved ? 'COMPLETED' : 'PENDING',
        },
      ]
    : [
        { label: 'Sales Rep (Draft)', state: 'COMPLETED' },
        {
          label: 'Sales Manager (Atharva Manager)',
          state: isApproved ? 'COMPLETED' : quotation.status === 'PENDING_MANAGER_APPROVAL' ? 'IN_PROGRESS' : score > 0 ? 'PENDING' : 'SKIPPED',
        },
        {
          label: 'Approved (Ready to Send)',
          state: isApproved ? 'COMPLETED' : 'PENDING',
        },
      ];


  return (
    <div className="space-y-6 max-w-4xl mx-auto animate-in fade-in duration-300 pb-10">
      {/* Back button */}
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

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Quotation Approval Workflow
          </h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            Quote #{formatQuotationNumber(quotation)} • {quotation.customer?.name || 'Acme Corporation'}
          </p>
        </div>

        <div>
          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-[#1F1F23] text-zinc-200 border border-[#2E2E33]">
            {quotation.status}
          </span>
        </div>
      </div>

      {/* Approval Stepper */}
      <div className="bg-[#121214] border border-[#27272A] rounded-2xl p-6 shadow-sm">
        <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-5">
          Approval Chain Progression
        </div>

        <div className="flex items-center justify-between relative">
          {steps.map((step, idx) => (
            <div key={step.label} className="flex-1 flex flex-col items-center relative z-10">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border transition-colors ${
                  step.state === 'COMPLETED'
                    ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400'
                    : step.state === 'IN_PROGRESS'
                    ? 'bg-blue-600 border-blue-400 text-white animate-pulse'
                    : 'bg-[#18181B] border-[#27272A] text-zinc-500'
                }`}
              >
                {step.state === 'COMPLETED' ? '✓' : idx + 1}
              </div>
              <span className="text-xs font-medium text-zinc-300 mt-2 text-center">
                {step.label}
              </span>
              <span className="text-[10px] text-zinc-500">
                {step.state === 'COMPLETED'
                  ? 'Approved'
                  : step.state === 'IN_PROGRESS'
                  ? 'Under Review'
                  : 'Pending'}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Deal Summary & Risk Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-[#121214] border border-[#27272A] rounded-2xl p-4">
          <span className="text-[11px] font-semibold uppercase text-zinc-400">Total Value</span>
          <div className="text-2xl font-bold text-white mt-1 font-mono">
            {formatCurrency(quotation.totalAmount)}
          </div>
          <span className="text-xs text-zinc-500">Net quotation amount</span>
        </div>

        <div className="bg-[#121214] border border-[#27272A] rounded-2xl p-4">
          <span className="text-[11px] font-semibold uppercase text-zinc-400">Blended Margin</span>
          <div className="text-2xl font-bold text-emerald-400 mt-1 font-mono">
            {Math.round(Number((quotation as any).totalMarginPct ?? quotation.overallMarginPct ?? 37))}%
          </div>
          <span className="text-xs text-zinc-500 font-mono">Cost: {formatCurrency(quotation.totalCost || 3800)}</span>
        </div>

        <div className="bg-[#121214] border border-[#27272A] rounded-2xl p-4">
          <span className="text-[11px] font-semibold uppercase text-zinc-400">Risk Score</span>
          <div className="text-2xl font-bold text-orange-500 mt-1 font-mono">
            {quotation.riskScore || 82}
          </div>
          <span className="text-xs text-orange-400">High discount exception</span>
        </div>
      </div>

      {/* Pricing Violations Breakdown */}
      <div className="bg-[#121214] border border-[#27272A] rounded-2xl p-5 space-y-3">
        <div className="flex items-center gap-2 text-xs font-bold text-orange-400 uppercase tracking-wider">
          <AlertTriangle className="w-4 h-4" />
          <span>Governance Exceptions & Violations</span>
        </div>

        <div className="divide-y divide-[#1E1E22] text-xs">
          <div className="py-3 flex items-center justify-between">
            <div>
              <div className="font-semibold text-white">Enterprise Router (ER-500)</div>
              <div className="text-zinc-400 text-[11px]">Applied 8% vs Gold Tier allowed ceiling of 5%</div>
            </div>
            <span className="font-mono font-semibold text-orange-400">+32 risk</span>
          </div>

          <div className="py-3 flex items-center justify-between">
            <div>
              <div className="font-semibold text-white">Software / Licensing Bundle</div>
              <div className="text-zinc-400 text-[11px]">Discount exceeds single-approval threshold</div>
            </div>
            <span className="font-mono font-semibold text-orange-400">+18 risk</span>
          </div>

          <div className="py-3 flex items-center justify-between">
            <div>
              <div className="font-semibold text-white">Customer Tier Compliance</div>
              <div className="text-zinc-400 text-[11px]">
                {isCFOApproval
                  ? 'High risk deal: Requires direct CFO sign-off. Once approved by CFO, deal is fully approved without Manager approval.'
                  : 'Standard margin exception: Requires Sales Manager sign-off. Once approved by Manager, deal is fully approved without CFO approval.'}
              </div>
            </div>
            <span className="font-mono font-semibold text-orange-400">+{score > 30 ? score : 21} risk</span>
          </div>
        </div>
      </div>

      {/* Authorized Action Controls */}
      {canAct ? (
        <div className="p-5 bg-[#121214] border border-[#27272A] rounded-2xl flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-xs font-bold text-white">Reviewer Action Required</div>
            <div className="text-xs text-zinc-400 mt-0.5">
              Signed in as <strong className="text-zinc-200">{user?.name}</strong> ({user?.role})
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => setActiveDialog('RETURN')}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-[#1F1F23] hover:bg-[#27272A] text-amber-300 border border-amber-500/20 transition-colors cursor-pointer"
            >
              Return for Revision
            </button>
            <button
              type="button"
              onClick={() => setActiveDialog('REJECT')}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 transition-colors cursor-pointer"
            >
              Reject
            </button>
            <button
              type="button"
              onClick={() => setActiveDialog('APPROVE')}
              className="px-5 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/20 transition-colors cursor-pointer"
            >
              Approve Quotation
            </button>
          </div>
        </div>
      ) : (!canAct && (quotation.status === 'PENDING_MANAGER_APPROVAL' || quotation.status === 'PENDING_FINANCE_APPROVAL')) ? (
        <div className="p-5 bg-[#121214] border border-[#27272A] rounded-2xl flex items-center gap-3.5">
          <Clock className="w-5 h-5 text-amber-400 animate-pulse shrink-0" />
          <div>
            <div className="text-xs font-bold text-white">
              Awaiting {quotation.status === 'PENDING_FINANCE_APPROVAL' ? 'CFO (Madhab CFO)' : 'Sales Manager (Atharva Manager)'} Review
            </div>
            <div className="text-xs text-zinc-400 mt-0.5">
              Only authorized reviewers can approve or return this quotation. You will be able to dispatch to the customer once approved.
            </div>
          </div>
        </div>
      ) : null}

      {/* Approved Action Bar — Send to Customer */}
      {quotation.status === 'APPROVED' && (
        <div className="p-6 bg-[#0E1712] border border-emerald-500/30 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-bold text-white">Quotation Approved</div>
              <div className="text-xs text-zinc-400 mt-0.5">
                All tier governance thresholds and approvals are met. Dispatch this quotation directly to {quotation.customer?.name || 'the customer'}.
              </div>
            </div>
          </div>
          <button
            type="button"
            disabled={isProcessing}
            onClick={() => sendQuotation()}
            className="w-full sm:w-auto px-6 py-2.5 rounded-xl text-xs font-bold bg-white text-black hover:bg-zinc-200 shadow-lg transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer flex items-center justify-center gap-2"
          >
            <Send className="w-4 h-4 text-black" />
            <span>Send to Customer</span>
          </button>
        </div>
      )}

      {/* Sent State Banner */}
      {quotation.status === 'SENT' && (
        <div className="p-6 bg-[#121214] border border-purple-500/30 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 shrink-0">
              <Send className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-bold text-white">Quotation Dispatched to Customer</div>
              <div className="text-xs text-zinc-400 mt-0.5">
                Available in the customer negotiation portal. Awaiting client review and final signature.
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => navigate(`/portal/quotations/${id}`)}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl text-xs font-semibold bg-[#1C1C20] hover:bg-[#26262B] text-white border border-[#2E2E33] transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <span>Preview Client Portal</span>
            <ArrowUpRight className="w-3.5 h-3.5 text-zinc-400" />
          </button>
        </div>
      )}

      {/* Reason Dialog Modal */}
      {activeDialog && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#18181B] border border-[#27272A] rounded-2xl max-w-md w-full p-6 shadow-2xl animate-in fade-in zoom-in-95">
            <h3 className="text-base font-bold text-white mb-1">
              {activeDialog === 'APPROVE'
                ? 'Confirm Approval'
                : activeDialog === 'REJECT'
                ? 'Reject Quotation'
                : 'Return Quotation for Revision'}
            </h3>
            <p className="text-xs text-zinc-400 mb-4">
              {activeDialog === 'APPROVE'
                ? 'Optional remarks for audit logging:'
                : 'Please explain the reason (minimum 10 characters required):'}
            </p>

            <textarea
              value={reasonText}
              onChange={(e) => setReasonText(e.target.value)}
              rows={3}
              placeholder="Enter explanation for the sales rep..."
              className="w-full bg-[#0D0D0F] border border-[#27272A] rounded-xl p-3 text-xs text-white focus:outline-none focus:border-blue-500 mb-4"
            />

            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setActiveDialog(null)}
                className="px-4 py-2 rounded-xl text-xs font-medium text-zinc-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isProcessing}
                onClick={handleActionSubmit}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white transition-colors disabled:opacity-50"
              >
                {isProcessing ? 'Submitting...' : 'Submit Action'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
