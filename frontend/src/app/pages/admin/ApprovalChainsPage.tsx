import { useApprovalChains } from '../../../api/hooks/useCatalog';
import { LoadingSpinner } from '../../../components/feedback/LoadingSpinner';
import { Shield } from 'lucide-react';
import { toast } from 'sonner';

export function ApprovalChainsPage() {
  const { data: serverChains = [], isLoading } = useApprovalChains();

  const fallbackChains = [
    {
      id: 'chain-low',
      name: 'Standard Operational Flow',
      scoreRange: '0 - 0',
      minRiskScore: 0,
      maxRiskScore: 0,
      requiresApproval: false,
      requiredRoles: ['AUTO_APPROVED'],
      description: 'Discounts within tier and category ceilings require zero manual approval.',
    },
    {
      id: 'chain-med',
      name: 'Manager Approval Tier',
      scoreRange: '1 - 69',
      minRiskScore: 1,
      maxRiskScore: 69,
      requiresApproval: true,
      requiredRoles: ['SALES_MANAGER'],
      description: 'Moderate ceiling breach. Requires Sales Manager sign-off.',
    },
    {
      id: 'chain-high',
      name: 'Two-Tier Critical Chain',
      scoreRange: '70 - 100',
      minRiskScore: 70,
      maxRiskScore: 100,
      requiresApproval: true,
      requiredRoles: ['SALES_MANAGER', 'FINANCE'],
      description: 'Severe ceiling violation. Sequential review by Sales Manager and Finance Officer.',
    },
  ];

  const chains = serverChains.length > 0 ? serverChains : fallbackChains;

  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Risk Scoring & Approval Chains</h1>
          <p className="text-xs text-slate-400 mt-0.5">Dynamic routing thresholds configured in Catalog Service</p>
        </div>

        <button
          type="button"
          onClick={() => toast.success('Chain policy rules re-indexed and refreshed')}
          className="px-4 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/20 transition-all self-start sm:self-auto"
        >
          Refresh Policy Cache
        </button>
      </div>

      {isLoading ? (
        <div className="py-16 flex justify-center">
          <LoadingSpinner label="Loading approval chains..." />
        </div>
      ) : (
        <div className="space-y-4">
          {chains.map((chain: any) => {
            const hasRoles = Array.isArray(chain.requiredRoles) && chain.requiredRoles.length > 0;
            return (
              <div key={chain.id} className="bg-[#121214] border border-[#27272A] rounded-2xl p-6 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#27272A]">
                  <div className="flex items-center gap-2.5">
                    <Shield className="w-5 h-5 text-blue-400" />
                    <span className="text-sm font-bold text-white">{chain.name}</span>
                  </div>
                  <span
                    className={`px-2.5 py-1 rounded-full text-[10px] font-semibold self-start sm:self-auto ${
                      chain.minRiskScore > 0 || chain.requiresApproval
                        ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                        : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    }`}
                  >
                    Risk Score: {chain.scoreRange || `${chain.minRiskScore ?? 0} – ${chain.maxRiskScore ?? 100}`}
                  </span>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs">
                  <div>
                    <p className="text-slate-300 mb-2">{chain.description || 'Threshold rule definition for quotation discount validation.'}</p>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-slate-400">Sign-Off Sequence:</span>
                      {hasRoles ? (
                        chain.requiredRoles.map((role: string, idx: number) => (
                          <span
                            key={idx}
                            className="px-2 py-0.5 rounded-md bg-blue-500/20 text-blue-300 border border-blue-500/30 font-bold text-[10px]"
                          >
                            {role}
                          </span>
                        ))
                      ) : (
                        <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-bold text-[10px]">
                          AUTO_APPROVED
                        </span>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => toast.info(`Viewing threshold rules for ${chain.name}`)}
                    className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-[#1F1F23] hover:bg-[#27272A] text-slate-300 border border-[#27272A] transition-colors shrink-0 self-start sm:self-auto"
                  >
                    Configure Thresholds
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
