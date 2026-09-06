import { useState, useEffect } from 'react';
import { useDiscountTiers, useCategories } from '../../../api/hooks/useCatalog';
import { LoadingSpinner } from '../../../components/feedback/LoadingSpinner';
import { Sliders, Info, TrendingUp, ShieldCheck, Check, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';

const DEFAULT_TIER_CEILINGS = {
  BRONZE: 5.0,
  SILVER: 10.0,
  GOLD: 15.0,
};

const DEFAULT_CATEGORY_CEILINGS: Record<string, number> = {
  Hardware: 15.0,
  Services: 10.0,
  Subscriptions: 5.0,
};

const DEFAULT_MARGIN_TARGETS: Record<string, number> = {
  Hardware: 30.0,
  Services: 65.0,
  Subscriptions: 75.0,
};

export function DiscountTiersPage() {
  const { data: _tiers = [], isLoading: tiersLoading } = useDiscountTiers();
  const { data: rawCategories = [], isLoading: catsLoading } = useCategories();
  const categories = Array.isArray(rawCategories) ? rawCategories : (rawCategories as any)?.data || [];

  const [globalMarginTarget, setGlobalMarginTarget] = useState<number>(25.0);
  const [tierCeilings, setTierCeilings] = useState(DEFAULT_TIER_CEILINGS);
  const [categoryCeilings, setCategoryCeilings] = useState<Record<string, number>>(DEFAULT_CATEGORY_CEILINGS);
  const [marginTargets, setMarginTargets] = useState<Record<string, number>>(DEFAULT_MARGIN_TARGETS);

  // Load persisted governance rules on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('dealflow_governance_rules');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.globalMarginTarget !== undefined) setGlobalMarginTarget(parsed.globalMarginTarget);
        if (parsed.tierCeilings) setTierCeilings(parsed.tierCeilings);
        if (parsed.categoryCeilings) setCategoryCeilings(parsed.categoryCeilings);
        if (parsed.marginTargets) setMarginTargets(parsed.marginTargets);
      }
    } catch {
      // ignore
    }
  }, []);

  // Synchronize category list if backend provides additional categories
  useEffect(() => {
    if (categories && categories.length > 0) {
      setCategoryCeilings((prev) => {
        const next = { ...prev };
        categories.forEach((c: any) => {
          if (next[c.name] === undefined) {
            next[c.name] = c.discountCeilingPct ?? 10.0;
          }
        });
        return next;
      });

      setMarginTargets((prev) => {
        const next = { ...prev };
        categories.forEach((c: any) => {
          if (next[c.name] === undefined) {
            next[c.name] = 35.0;
          }
        });
        return next;
      });
    }
  }, [categories]);

  const handleSave = () => {
    try {
      const payload = {
        globalMarginTarget,
        tierCeilings,
        categoryCeilings,
        marginTargets,
        updatedAt: new Date().toISOString(),
      };
      localStorage.setItem('dealflow_governance_rules', JSON.stringify(payload));
      toast.success('Gross Margin Targets and discount ceilings saved. Active across Quotation Builder & Reports.');
    } catch {
      toast.error('Failed to save governance rules.');
    }
  };

  const handleResetDefaults = () => {
    setGlobalMarginTarget(25.0);
    setTierCeilings(DEFAULT_TIER_CEILINGS);
    setCategoryCeilings(DEFAULT_CATEGORY_CEILINGS);
    setMarginTargets(DEFAULT_MARGIN_TARGETS);
    localStorage.removeItem('dealflow_governance_rules');
    toast.info('Reset to factory governance defaults.');
  };

  const isLoading = tiersLoading || catsLoading;

  return (
    <div className="space-y-6 max-w-6xl mx-auto animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#1F1F1F]">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              Customer Discount Tier & Margin Governance
            </h1>
            <span className="text-[11px] font-mono font-semibold px-2.5 py-0.5 rounded-full border bg-blue-500/10 text-blue-400 border-blue-500/20">
              Guardrails
            </span>
          </div>
          <p className="text-xs sm:text-sm text-zinc-400 mt-1">
            Configure autonomous discount caps, category ceiling limits, and gross margin target baselines.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            type="button"
            onClick={handleResetDefaults}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-[#141414] hover:bg-[#1A1A1A] text-zinc-400 hover:text-white border border-[#242424] transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset</span>
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/20 transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Save Governance Rules</span>
          </button>
        </div>
      </div>

      {/* Resolution Rule Banner */}
      <div className="p-4 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-200 text-xs flex items-start gap-3 shadow-xl">
        <Info className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <h4 className="font-bold text-white">Effective Ceiling & Margin Target Resolution (REQ-BR-001)</h4>
          <p className="text-zinc-300 leading-relaxed">
            The deal engine enforces: <code className="bg-black/50 text-blue-300 px-1.5 py-0.5 rounded font-mono text-[11px]">Effective Ceiling = min(Customer Tier Ceiling, Category Ceiling)</code>.
            Quotations with realized gross margins below the category or global Gross Margin Target require managerial/CFO approval before customer dispatch.
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="py-16 flex justify-center">
          <LoadingSpinner label="Loading discount tier governance..." />
        </div>
      ) : (
        <>
          {/* ─── GLOBAL ENTERPRISE GROSS MARGIN TARGET CARD ──────────────── */}
          <div className="bg-[#0A0A0A] border border-[#1F1F1F] rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#1F1F1F]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                  <TrendingUp className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-200">
                    Global Enterprise Gross Margin Target
                  </h2>
                  <p className="text-[11px] text-zinc-500">
                    Portfolio-wide profitability floor enforced across all quotations
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="inline-flex items-center gap-1.5 bg-[#121212] border border-[#2E2E2E] px-3 py-1.5 rounded-xl">
                  <span className="text-xs text-zinc-400 font-medium">Target Floor:</span>
                  <input
                    type="number"
                    step="0.1"
                    min="5"
                    max="90"
                    value={globalMarginTarget}
                    onChange={(e) => setGlobalMarginTarget(parseFloat(e.target.value) || 0)}
                    className="w-16 text-center font-mono font-bold text-sm bg-transparent text-emerald-400 focus:outline-none"
                  />
                  <span className="text-xs font-bold text-emerald-400 font-mono">%</span>
                </div>
              </div>
            </div>

            {/* Quick Target Presets */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="text-[11px] text-zinc-500 font-medium mr-1">Quick Presets:</span>
              {[
                { label: '20.0% High Velocity', val: 20.0 },
                { label: '25.0% Standard Floor', val: 25.0 },
                { label: '30.0% Growth Tier', val: 30.0 },
                { label: '35.0% Premium Target', val: 35.0 },
              ].map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => setGlobalMarginTarget(p.val)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-mono font-semibold transition-all cursor-pointer border ${
                    globalMarginTarget === p.val
                      ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30 shadow-sm'
                      : 'bg-[#121212] text-zinc-400 border-[#222222] hover:text-white hover:border-[#333333]'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* ─── CUSTOMER TIER CEILINGS MATRIX ───────────────────────────── */}
          <div className="bg-[#0A0A0A] border border-[#1F1F1F] rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-[#1F1F1F]">
              <Sliders className="w-4 h-4 text-blue-400" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-200">
                Customer Account Tier Ceilings
              </h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Bronze Tier */}
              <div className="p-4 rounded-xl border border-[#222222] bg-[#121212] space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-600/15 text-amber-500 border border-amber-500/25">
                    BRONZE TIER
                  </span>
                  <span className="text-[10px] text-zinc-500 font-mono">Standard Accounts</span>
                </div>
                <p className="text-xs text-zinc-400">Entry level accounts or first-time transactions</p>
                <div className="flex items-center justify-between pt-2 border-t border-[#1C1C1C]">
                  <label className="text-xs font-semibold text-zinc-300">Max Discount Ceiling:</label>
                  <div className="flex items-center gap-1 bg-[#0A0A0A] border border-[#2E2E2E] px-2.5 py-1 rounded-lg">
                    <input
                      type="number"
                      step="0.5"
                      value={tierCeilings.BRONZE}
                      onChange={(e) => setTierCeilings({ ...tierCeilings, BRONZE: parseFloat(e.target.value) || 0 })}
                      className="w-12 text-center font-bold font-mono text-xs text-white focus:outline-none"
                    />
                    <span className="text-xs text-zinc-500 font-mono">%</span>
                  </div>
                </div>
              </div>

              {/* Silver Tier */}
              <div className="p-4 rounded-xl border border-[#222222] bg-[#121212] space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-500/15 text-slate-300 border border-slate-500/30">
                    SILVER TIER
                  </span>
                  <span className="text-[10px] text-zinc-500 font-mono">Mid-Market</span>
                </div>
                <p className="text-xs text-zinc-400">Established recurring clients with ₹50k+ volume</p>
                <div className="flex items-center justify-between pt-2 border-t border-[#1C1C1C]">
                  <label className="text-xs font-semibold text-zinc-300">Max Discount Ceiling:</label>
                  <div className="flex items-center gap-1 bg-[#0A0A0A] border border-[#2E2E2E] px-2.5 py-1 rounded-lg">
                    <input
                      type="number"
                      step="0.5"
                      value={tierCeilings.SILVER}
                      onChange={(e) => setTierCeilings({ ...tierCeilings, SILVER: parseFloat(e.target.value) || 0 })}
                      className="w-12 text-center font-bold font-mono text-xs text-white focus:outline-none"
                    />
                    <span className="text-xs text-zinc-500 font-mono">%</span>
                  </div>
                </div>
              </div>

              {/* Gold Tier */}
              <div className="p-4 rounded-xl border border-[#222222] bg-[#121212] space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                    GOLD TIER
                  </span>
                  <span className="text-[10px] text-amber-400/80 font-bold font-mono">Enterprise VIP</span>
                </div>
                <p className="text-xs text-zinc-400">Key enterprise accounts with strategic commitments</p>
                <div className="flex items-center justify-between pt-2 border-t border-[#1C1C1C]">
                  <label className="text-xs font-semibold text-zinc-300">Max Discount Ceiling:</label>
                  <div className="flex items-center gap-1 bg-[#0A0A0A] border border-[#2E2E2E] px-2.5 py-1 rounded-lg">
                    <input
                      type="number"
                      step="0.5"
                      value={tierCeilings.GOLD}
                      onChange={(e) => setTierCeilings({ ...tierCeilings, GOLD: parseFloat(e.target.value) || 0 })}
                      className="w-12 text-center font-bold font-mono text-xs text-white focus:outline-none"
                    />
                    <span className="text-xs text-zinc-500 font-mono">%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ─── CATEGORY CEILINGS & GROSS MARGIN TARGETS TABLE ──────────── */}
          <div className="bg-[#0A0A0A] border border-[#1F1F1F] rounded-2xl overflow-hidden shadow-2xl">
            <div className="py-3.5 px-5 bg-[#0E0E0E] border-b border-[#1F1F1F] flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-zinc-200 uppercase tracking-wider">
                  Product Category Ceilings & Gross Margin Targets
                </span>
                <p className="text-[11px] text-zinc-500 mt-0.5">
                  Set category-specific target profit margins and maximum allowable discount percentages
                </p>
              </div>
              <span className="text-[11px] font-mono text-zinc-500">Hard Guardrails</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-[#0A0A0A] border-b border-[#1F1F1F] text-zinc-400 uppercase font-semibold text-[11px]">
                    <th className="py-3.5 px-5">Category Name</th>
                    <th className="py-3.5 px-5 text-center">Gross Margin Target</th>
                    <th className="py-3.5 px-5 text-center">Maximum Permitted Discount</th>
                    <th className="py-3.5 px-5 text-center">Net Margin Floor</th>
                    <th className="py-3.5 px-5 text-center">Policy Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#181818]">
                  {Object.keys(categoryCeilings).map((cat) => {
                    const discountVal = categoryCeilings[cat] ?? 10.0;
                    const marginVal = marginTargets[cat] ?? 30.0;
                    const netFloor = Math.max(0, marginVal - discountVal);
                    return (
                      <tr key={cat} className="hover:bg-white/[0.02] transition-colors">
                        <td className="py-4 px-5">
                          <div className="font-bold text-white">{cat}</div>
                          <span className="text-[10px] text-zinc-500 font-mono">Product Category</span>
                        </td>

                        {/* Editable Gross Margin Target */}
                        <td className="py-4 px-5 text-center">
                          <div className="inline-flex items-center gap-1 bg-[#121212] border border-[#2E2E2E] px-2.5 py-1 rounded-xl">
                            <input
                              type="number"
                              step="0.5"
                              min="0"
                              max="100"
                              value={marginVal}
                              onChange={(e) =>
                                setMarginTargets({
                                  ...marginTargets,
                                  [cat]: parseFloat(e.target.value) || 0,
                                })
                              }
                              className="w-14 p-0.5 text-center font-bold font-mono text-xs bg-transparent text-emerald-400 focus:outline-none"
                            />
                            <span className="text-xs font-bold text-emerald-400 font-mono">%</span>
                          </div>
                        </td>

                        {/* Editable Maximum Permitted Discount */}
                        <td className="py-4 px-5 text-center">
                          <div className="inline-flex items-center gap-1 bg-[#121212] border border-[#2E2E2E] px-2.5 py-1 rounded-xl">
                            <input
                              type="number"
                              step="0.5"
                              min="0"
                              max="100"
                              value={discountVal}
                              onChange={(e) =>
                                setCategoryCeilings({
                                  ...categoryCeilings,
                                  [cat]: parseFloat(e.target.value) || 0,
                                })
                              }
                              className="w-14 p-0.5 text-center font-bold font-mono text-xs bg-transparent text-blue-400 focus:outline-none"
                            />
                            <span className="text-xs font-bold text-blue-400 font-mono">%</span>
                          </div>
                        </td>

                        {/* Calculated Net Margin Floor */}
                        <td className="py-4 px-5 text-center">
                          <span
                            className={`font-mono font-bold text-xs ${
                              netFloor < 15 ? 'text-amber-400' : 'text-zinc-200'
                            }`}
                          >
                            {netFloor.toFixed(1)}%
                          </span>
                        </td>

                        {/* Status */}
                        <td className="py-4 px-5 text-center">
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            <ShieldCheck className="w-3 h-3" />
                            <span>Enforced</span>
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
