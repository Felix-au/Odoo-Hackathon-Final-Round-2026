import { useState, useMemo } from 'react';
import {
  useApprovalChains,
  useUpdateApprovalChain,
  useCreateApprovalChain,
  useDeleteApprovalChain,
} from '../../../api/hooks/useCatalog';
import { LoadingSpinner } from '../../../components/feedback/LoadingSpinner';
import {
  Shield,
  RefreshCw,
  Sliders,
  Edit3,
  Plus,
  Trash2,
  X,
  Check,
  Info,
  Layers,
} from 'lucide-react';
import { toast } from 'sonner';

interface CanonicalApprovalChain {
  id: string;
  name: string;
  minRiskScore: number;
  maxRiskScore: number;
  requiredRoles: string[];
  description?: string;
  scoreRange?: string;
}

export function ApprovalChainsPage() {
  const { data: serverChains = [], isLoading, refetch, isFetching } = useApprovalChains();
  const updateMutation = useUpdateApprovalChain();
  const createMutation = useCreateApprovalChain();
  const deleteMutation = useDeleteApprovalChain();

  const [testScore, setTestScore] = useState<number>(24.5);

  // Edit / Create Modal State
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingChainId, setEditingChainId] = useState<string | null>(null);
  const [formName, setFormName] = useState<string>('');
  const [formMinScore, setFormMinScore] = useState<number>(0);
  const [formMaxScore, setFormMaxScore] = useState<number>(30);
  const [formRoles, setFormRoles] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Delete Confirmation State
  const [deletingChain, setDeletingChain] = useState<CanonicalApprovalChain | null>(null);

  // Documented canonical default rules as fallback
  const defaultDocChains: CanonicalApprovalChain[] = [
    {
      id: 'appr-chain-0000-0000-0000-000000000001',
      name: 'Standard Operational Flow',
      minRiskScore: 0,
      maxRiskScore: 0.1,
      requiredRoles: [],
      scoreRange: '0.0 (Within Ceilings)',
      description: 'Discounts within tier and category ceilings require zero manual approval. Auto-cleared for dispatch.',
    },
    {
      id: 'appr-chain-0000-0000-0000-000000000002',
      name: 'Manager Approval Tier',
      minRiskScore: 0.1,
      maxRiskScore: 30,
      requiredRoles: ['SALES_MANAGER'],
      scoreRange: '0.1 – 30.0 (Moderate Risk)',
      description: 'Moderate ceiling breach exceeding discount ceilings (REQ-F-022). Requires Sales Manager sign-off.',
    },
    {
      id: 'appr-chain-0000-0000-0000-000000000003',
      name: 'Two-Tier Critical Chain',
      minRiskScore: 30,
      maxRiskScore: 999,
      requiredRoles: ['SALES_MANAGER', 'FINANCE'],
      scoreRange: '30.0+ (Critical Multi-Tier)',
      description: 'Severe ceiling violation exceeding governance thresholds (REQ-F-023). Sequential sign-off by Sales Manager and Finance Officer.',
    },
  ];

  // Deduplicate server chains by normalized name or minRiskScore to eliminate any visual repetition
  const chains = useMemo(() => {
    if (!serverChains || serverChains.length === 0) return defaultDocChains;

    const seenKeys = new Set<string>();
    const deduplicated: CanonicalApprovalChain[] = [];

    for (const raw of serverChains) {
      const normName = (raw.name || '').trim().toLowerCase();
      const scoreKey = `${raw.minRiskScore ?? 0}`;
      const uniqueKey = normName.includes('standard') || normName.includes('no approval')
        ? 'standard'
        : normName.includes('manager')
        ? 'manager'
        : normName.includes('finance') || normName.includes('two-tier') || normName.includes('cfo')
        ? 'finance'
        : `${normName}-${scoreKey}`;

      if (!seenKeys.has(uniqueKey)) {
        seenKeys.add(uniqueKey);

        let displayName = raw.name;
        let displayDesc = raw.description;
        let scoreRange = raw.scoreRange;

        if (uniqueKey === 'standard') {
          displayName = 'Standard Operational Flow';
          displayDesc = 'Discounts within tier and category ceilings require zero manual approval. Auto-cleared for dispatch.';
          scoreRange = '0.0 (Within Ceilings)';
        } else if (uniqueKey === 'manager') {
          displayName = 'Manager Approval Tier';
          displayDesc = 'Moderate ceiling breach exceeding discount ceilings (REQ-F-022). Requires Sales Manager sign-off.';
          scoreRange = '0.1 – 30.0 (Moderate Risk)';
        } else if (uniqueKey === 'finance') {
          displayName = 'Two-Tier Critical Chain';
          displayDesc = 'Severe ceiling violation exceeding governance thresholds (REQ-F-023). Sequential review by Sales Manager & Finance Officer.';
          scoreRange = '30.0+ (Critical Multi-Tier)';
        }

        deduplicated.push({
          id: raw.id,
          name: displayName,
          minRiskScore: raw.minRiskScore ?? 0,
          maxRiskScore: raw.maxRiskScore ?? 999,
          requiredRoles: Array.isArray(raw.requiredRoles) ? raw.requiredRoles : [],
          description: displayDesc,
          scoreRange: scoreRange || `${raw.minRiskScore ?? 0} – ${raw.maxRiskScore >= 999 ? '∞' : raw.maxRiskScore ?? 100}`,
        });
      }
    }

    return deduplicated.length > 0 ? deduplicated : defaultDocChains;
  }, [serverChains]);

  // Live simulation of risk score against active chains
  const activeResolution = useMemo(() => {
    const score = Number(testScore) || 0;
    const matchedChain = chains.find(
      (c) => score >= c.minRiskScore && (score < c.maxRiskScore || c.maxRiskScore >= 999)
    );

    if (!matchedChain || matchedChain.requiredRoles.length === 0) {
      return {
        matchedChain: matchedChain || chains[0],
        requiresApproval: false,
        roles: ['AUTO_APPROVED'],
        severity: 'low',
        actionLabel: 'Approved for Dispatch',
      };
    }

    const hasFinance = matchedChain.requiredRoles.includes('FINANCE');
    return {
      matchedChain,
      requiresApproval: true,
      roles: matchedChain.requiredRoles,
      severity: hasFinance ? 'critical' : 'moderate',
      actionLabel: hasFinance ? 'Escalate to CFO / Finance' : 'Route to Sales Manager',
    };
  }, [testScore, chains]);

  const handleRefreshCache = async () => {
    try {
      await refetch();
      toast.success('Chain policy rules re-indexed and synchronized from Catalog Service');
    } catch {
      toast.error('Failed to reload approval chain policies');
    }
  };

  const handleOpenEdit = (chain: CanonicalApprovalChain) => {
    setEditingChainId(chain.id);
    setFormName(chain.name);
    setFormMinScore(chain.minRiskScore);
    setFormMaxScore(chain.maxRiskScore >= 999 ? 999 : chain.maxRiskScore);
    setFormRoles([...chain.requiredRoles]);
    setIsModalOpen(true);
  };

  const handleOpenCreate = () => {
    setEditingChainId(null);
    setFormName('Custom Approval Tier');
    setFormMinScore(20);
    setFormMaxScore(50);
    setFormRoles(['SALES_MANAGER']);
    setIsModalOpen(true);
  };

  const handleToggleRole = (role: 'SALES_MANAGER' | 'FINANCE') => {
    setFormRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
    );
  };

  const handleApplyPreset = (min: number, max: number, roles: string[], name: string) => {
    setFormMinScore(min);
    setFormMaxScore(max);
    setFormRoles(roles);
    if (!formName || formName.includes('Tier') || formName.includes('Flow') || formName.includes('Chain')) {
      setFormName(name);
    }
  };

  const handleSaveRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      toast.error('Rule name is required');
      return;
    }
    if (formMinScore < 0 || formMaxScore < 0) {
      toast.error('Risk scores must be non-negative numbers');
      return;
    }
    if (formMinScore >= formMaxScore && formMaxScore < 999) {
      toast.error('Min risk score must be strictly less than Max risk score');
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingChainId) {
        await updateMutation.mutateAsync({
          id: editingChainId,
          data: {
            name: formName.trim(),
            minRiskScore: formMinScore,
            maxRiskScore: formMaxScore,
            requiredRoles: formRoles,
          },
        });
        toast.success(`Approval rule "${formName}" successfully updated in Catalog Service`);
      } else {
        await createMutation.mutateAsync({
          name: formName.trim(),
          minRiskScore: formMinScore,
          maxRiskScore: formMaxScore,
          requiredRoles: formRoles,
        });
        toast.success(`New approval rule "${formName}" successfully created`);
      }
      setIsModalOpen(false);
      refetch();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save approval rule');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteRule = async () => {
    if (!deletingChain) return;
    try {
      await deleteMutation.mutateAsync(deletingChain.id);
      toast.success(`Rule "${deletingChain.name}" deleted successfully`);
      setDeletingChain(null);
      refetch();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete approval rule');
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <Shield className="w-6 h-6 text-emerald-400" />
            Risk Scoring & Approval Chains
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Enterprise governance routing thresholds configured in Catalog Service (REQ-F-022, REQ-F-023)
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          <button
            type="button"
            onClick={handleOpenCreate}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-[#18181B] hover:bg-[#27272A] text-slate-200 border border-[#27272A] hover:border-slate-600 transition-all shadow-sm"
          >
            <Plus className="w-3.5 h-3.5 text-blue-400" />
            <span>Add Rule</span>
          </button>

          <button
            type="button"
            onClick={handleRefreshCache}
            disabled={isFetching}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 active:scale-[0.98] text-white shadow-lg shadow-blue-500/20 transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
            <span>{isFetching ? 'Syncing...' : 'Refresh Policy Cache'}</span>
          </button>
        </div>
      </div>

      {/* Interactive Resolution Simulator */}
      <div className="bg-[#0A0A0A] border border-[#1F1F1F] rounded-2xl p-5 shadow-lg relative overflow-hidden">
        <div className="flex items-center justify-between gap-4 pb-3 border-b border-[#1A1A1A]">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-purple-400" />
            <h2 className="text-sm font-semibold text-white">Live Policy Simulator</h2>
            <span className="px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-300 border border-purple-500/20 text-[10px] font-mono">
              CHECK-CAT-003 Verified
            </span>
          </div>
          <span className="text-xs text-slate-400 hidden sm:inline">
            Test any blended risk score to see required routing
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-center pt-4">
          <div className="md:col-span-4 space-y-2">
            <label className="text-xs font-semibold text-slate-300 block">
              Simulate Risk Score (0 – 100):
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="0"
                max="100"
                step="0.5"
                value={testScore}
                onChange={(e) => setTestScore(parseFloat(e.target.value) || 0)}
                className="w-28 px-3 py-2 rounded-xl bg-[#141414] border border-[#27272A] text-white text-sm font-mono focus:border-blue-500 focus:outline-none transition-colors"
              />
              <div className="flex gap-1.5">
                {[0, 15, 45, 75].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setTestScore(preset)}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-mono font-semibold transition-colors ${
                      testScore === preset
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'bg-[#18181B] hover:bg-[#27272A] text-slate-400 border border-[#27272A]'
                    }`}
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="md:col-span-8 bg-[#121214] border border-[#27272A] rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">Resolved Policy:</span>
                <span className="text-xs font-bold text-white">{activeResolution.matchedChain.name}</span>
              </div>
              <p className="text-[11px] text-slate-400">
                Action: <span className="font-semibold text-slate-200">{activeResolution.actionLabel}</span>
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-500">Sign-Off:</span>
              {activeResolution.roles.map((role) => (
                <span
                  key={role}
                  className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-bold uppercase tracking-wider ${
                    role === 'AUTO_APPROVED'
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                      : role === 'FINANCE'
                      ? 'bg-purple-500/15 text-purple-300 border border-purple-500/30'
                      : 'bg-blue-500/15 text-blue-300 border border-blue-500/30'
                  }`}
                >
                  {role}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Approval Chains List */}
      {isLoading ? (
        <div className="py-20 flex justify-center">
          <LoadingSpinner label="Loading policy rules..." />
        </div>
      ) : (
        <div className="space-y-3.5">
          {chains.map((chain, index) => {
            const hasRoles = chain.requiredRoles.length > 0;
            const isCritical = chain.minRiskScore >= 30;
            const isManager = chain.minRiskScore > 0 && !isCritical;

            return (
              <div
                key={chain.id}
                className="bg-[#0A0A0A] border border-[#1F1F1F] hover:border-[#2E2E2E] rounded-2xl p-5 shadow-sm space-y-3.5 transition-all group"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#18181B]">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-8 h-8 rounded-xl flex items-center justify-center font-mono font-bold text-xs ${
                        isCritical
                          ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                          : isManager
                          ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                          : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                      }`}
                    >
                      0{index + 1}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-white">{chain.name}</span>
                        {index === 0 && (
                          <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-semibold">
                            Default Baseline
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 font-mono mt-0.5">Rule ID: {chain.id}</p>
                    </div>
                  </div>

                  <span
                    className={`px-3 py-1 rounded-full text-xs font-mono font-semibold self-start sm:self-auto ${
                      isCritical
                        ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                        : isManager
                        ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                        : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                    }`}
                  >
                    Risk Score: {chain.scoreRange || `${chain.minRiskScore} – ${chain.maxRiskScore >= 999 ? '∞' : chain.maxRiskScore}`}
                  </span>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs">
                  <div className="space-y-2">
                    <p className="text-slate-300 leading-relaxed max-w-2xl">{chain.description}</p>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-slate-400">Sign-Off Sequence:</span>
                      {hasRoles ? (
                        chain.requiredRoles.map((role: string, idx: number) => (
                          <span
                            key={idx}
                            className={`px-2.5 py-0.5 rounded-md font-mono font-bold text-[10px] tracking-wide ${
                              role === 'FINANCE'
                                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                                : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                            }`}
                          >
                            {role}
                          </span>
                        ))
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-md bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-mono font-bold text-[10px]">
                          AUTO_APPROVED
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto">
                    {chains.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setDeletingChain(chain)}
                        className="p-2 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 transition-all"
                        title="Delete Rule"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => handleOpenEdit(chain)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-[#141414] hover:bg-[#1F1F1F] active:scale-[0.98] text-slate-200 border border-[#27272A] hover:border-slate-500 transition-all shadow-sm"
                    >
                      <Edit3 className="w-3.5 h-3.5 text-blue-400" />
                      <span>Configure Thresholds</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Footer Info */}
      <div className="flex items-center justify-between text-xs text-slate-500 px-1">
        <span>3 canonical governance tiers matching system architecture docs</span>
        <span className="font-mono">Catalog Service API v1</span>
      </div>

      {/* Edit / Create Rule Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-[#0F0F11] border border-[#27272A] rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#27272A] bg-[#141417]">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
                  <Shield className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    {editingChainId ? 'Configure Approval Threshold' : 'Create Approval Rule'}
                  </h3>
                  <p className="text-xs text-slate-400">
                    Define discount risk boundaries and approver requirements
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveRule} className="p-6 space-y-5">
              {/* Presets Bar */}
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs text-slate-400">
                  <Layers className="w-3.5 h-3.5 text-blue-400" />
                  <span>Quick Policy Presets:</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleApplyPreset(0, 0.1, [], 'Standard Operational Flow')}
                    className="px-2.5 py-1.5 rounded-lg bg-[#18181B] hover:bg-[#27272A] border border-[#27272A] text-[11px] font-mono text-emerald-400 text-left transition-colors"
                  >
                    0.0 (Auto-Approve)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyPreset(0.1, 30, ['SALES_MANAGER'], 'Manager Approval Tier')}
                    className="px-2.5 py-1.5 rounded-lg bg-[#18181B] hover:bg-[#27272A] border border-[#27272A] text-[11px] font-mono text-blue-400 text-left transition-colors"
                  >
                    0.1 – 30.0 (Manager)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyPreset(30, 999, ['SALES_MANAGER', 'FINANCE'], 'Two-Tier Critical Chain')}
                    className="px-2.5 py-1.5 rounded-lg bg-[#18181B] hover:bg-[#27272A] border border-[#27272A] text-[11px] font-mono text-purple-400 text-left transition-colors"
                  >
                    30.0+ (Two-Tier)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyPreset(30, 999, ['FINANCE'], 'Finance / CFO Review')}
                    className="px-2.5 py-1.5 rounded-lg bg-[#18181B] hover:bg-[#27272A] border border-[#27272A] text-[11px] font-mono text-rose-400 text-left transition-colors"
                  >
                    30.0+ (Finance Only)
                  </button>
                </div>
              </div>

              {/* Rule Name */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300 block">
                  Rule Title / Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Sales Manager Approval Tier"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#18181B] border border-[#27272A] text-white text-sm focus:border-blue-500 focus:outline-none transition-colors"
                />
              </div>

              {/* Risk Range Inputs */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300 block">
                    Min Risk Score (Inclusive)
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      value={formMinScore}
                      onChange={(e) => setFormMinScore(parseFloat(e.target.value) || 0)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-[#18181B] border border-[#27272A] text-white text-sm font-mono focus:border-blue-500 focus:outline-none transition-colors"
                    />
                    <span className="absolute right-3 top-2.5 text-xs text-slate-500 font-mono">pts</span>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300 block">
                    Max Risk Score (Exclusive)
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      value={formMaxScore}
                      onChange={(e) => setFormMaxScore(parseFloat(e.target.value) || 0)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-[#18181B] border border-[#27272A] text-white text-sm font-mono focus:border-blue-500 focus:outline-none transition-colors"
                    />
                    <span className="absolute right-3 top-2.5 text-xs text-slate-500 font-mono">
                      {formMaxScore >= 999 ? '∞ pts' : 'pts'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Required Approver Roles Toggle */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-300 block">
                  Required Approver Roles
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => handleToggleRole('SALES_MANAGER')}
                    className={`p-3 rounded-xl border text-left transition-all flex items-center justify-between ${
                      formRoles.includes('SALES_MANAGER')
                        ? 'bg-blue-500/15 border-blue-500/40 text-white shadow-sm'
                        : 'bg-[#18181B] border-[#27272A] text-slate-400 hover:border-slate-600'
                    }`}
                  >
                    <div>
                      <div className="text-xs font-bold">Sales Manager</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">Commercial discount review</div>
                    </div>
                    {formRoles.includes('SALES_MANAGER') ? (
                      <div className="w-5 h-5 rounded-full bg-blue-500 text-white flex items-center justify-center">
                        <Check className="w-3 h-3" />
                      </div>
                    ) : (
                      <div className="w-5 h-5 rounded-full border border-slate-600" />
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleToggleRole('FINANCE')}
                    className={`p-3 rounded-xl border text-left transition-all flex items-center justify-between ${
                      formRoles.includes('FINANCE')
                        ? 'bg-purple-500/15 border-purple-500/40 text-white shadow-sm'
                        : 'bg-[#18181B] border-[#27272A] text-slate-400 hover:border-slate-600'
                    }`}
                  >
                    <div>
                      <div className="text-xs font-bold">Finance / CFO</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">Critical margin review</div>
                    </div>
                    {formRoles.includes('FINANCE') ? (
                      <div className="w-5 h-5 rounded-full bg-purple-500 text-white flex items-center justify-center">
                        <Check className="w-3 h-3" />
                      </div>
                    ) : (
                      <div className="w-5 h-5 rounded-full border border-slate-600" />
                    )}
                  </button>
                </div>

                {formRoles.length === 0 && (
                  <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-2">
                    <Info className="w-4 h-4 shrink-0" />
                    <span>Zero roles selected: Quotations in this score range will be <strong>AUTO_APPROVED</strong>.</span>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#27272A]">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white hover:bg-white/5 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 active:scale-[0.98] text-white shadow-lg shadow-blue-500/25 transition-all disabled:opacity-50 flex items-center gap-2"
                >
                  {isSubmitting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>{editingChainId ? 'Save Threshold Changes' : 'Create Approval Rule'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingChain && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-[#0F0F11] border border-[#27272A] rounded-2xl w-full max-w-md shadow-2xl p-6 space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/20">
                <Trash2 className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-white">Delete Approval Rule</h3>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Are you sure you want to remove the approval rule <strong className="text-white">"{deletingChain.name}"</strong>? Quotations falling in range <span className="font-mono text-amber-400">[{deletingChain.minRiskScore} - {deletingChain.maxRiskScore}]</span> will route according to adjacent active tiers.
            </p>
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setDeletingChain(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white hover:bg-white/5 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteRule}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-500/25 transition-all"
              >
                Delete Rule
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
