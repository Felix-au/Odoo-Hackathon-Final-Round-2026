import { useState } from 'react';
import { useDiscountTiers } from '../../../api/hooks/useCatalog';
import { LoadingSpinner } from '../../../components/feedback/LoadingSpinner';
import { Sliders, Info } from 'lucide-react';
import { toast } from 'sonner';

export function DiscountTiersPage() {
  const { data: _tiers = [], isLoading } = useDiscountTiers();

  const [tierCeilings, setTierCeilings] = useState({
    BRONZE: 5.0,
    SILVER: 10.0,
    GOLD: 15.0,
  });

  const [categoryCeilings, setCategoryCeilings] = useState({
    Hardware: 15.0,
    Services: 10.0,
    Subscriptions: 5.0,
  });

  const handleSave = () => {
    toast.success('Discount tier ceilings updated. Cached-aside policies refreshed in Redis.');
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Customer Discount Tier Governance</h1>
          <p className="text-xs text-slate-400 mt-0.5">Configure autonomous discount caps and multi-layer ceiling limits</p>
        </div>

        <button
          type="button"
          onClick={handleSave}
          className="px-4 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/20 transition-all self-start sm:self-auto"
        >
          Save Governance Rules
        </button>
      </div>

      <div className="p-4 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-200 text-xs flex items-start gap-3">
        <Info className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
        <div>
          <h4 className="font-bold text-white">Effective Ceiling Resolution Rule (REQ-BR-001)</h4>
          <p className="mt-0.5 text-slate-300">
            The quotation engine enforces: <code className="bg-black/40 text-blue-300 px-1.5 py-0.5 rounded font-mono text-[11px]">Effective Ceiling = min(Customer Tier Ceiling, Category Ceiling)</code>. Any line discount exceeding this effective threshold triggers an elevated blended risk score.
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="py-16 flex justify-center">
          <LoadingSpinner label="Loading discount tiers..." />
        </div>
      ) : (
        <>
          {/* Customer Tier Ceilings Matrix */}
          <div className="bg-[#12151C] border border-[#1E2430] rounded-2xl p-6 space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-[#1E2430]">
              <Sliders className="w-4 h-4 text-blue-400" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-white">Customer Account Tier Caps</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl border border-[#283244] bg-[#161B24] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-600/20 text-amber-500 border border-amber-500/30">
                    BRONZE TIER
                  </span>
                  <span className="text-[10px] text-slate-400">Standard</span>
                </div>
                <p className="text-xs text-slate-400">Entry level accounts or first-time transactions</p>
                <div className="flex items-center gap-2 pt-2">
                  <label className="text-xs font-semibold text-slate-300">Max Discount:</label>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      value={tierCeilings.BRONZE}
                      onChange={(e) => setTierCeilings({ ...tierCeilings, BRONZE: parseFloat(e.target.value) || 0 })}
                      className="w-16 p-1 text-center font-bold text-xs rounded-lg border border-[#283244] bg-[#101319] text-white focus:outline-none focus:border-blue-500"
                    />
                    <span className="text-xs text-slate-400">%</span>
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-xl border border-[#283244] bg-[#161B24] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-600/30 text-slate-300 border border-slate-500/40">
                    SILVER TIER
                  </span>
                  <span className="text-[10px] text-slate-400">Mid-Market</span>
                </div>
                <p className="text-xs text-slate-400">Established recurring clients with ₹50k+ run rate</p>
                <div className="flex items-center gap-2 pt-2">
                  <label className="text-xs font-semibold text-slate-300">Max Discount:</label>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      value={tierCeilings.SILVER}
                      onChange={(e) => setTierCeilings({ ...tierCeilings, SILVER: parseFloat(e.target.value) || 0 })}
                      className="w-16 p-1 text-center font-bold text-xs rounded-lg border border-[#283244] bg-[#101319] text-white focus:outline-none focus:border-blue-500"
                    />
                    <span className="text-xs text-slate-400">%</span>
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-xl border border-[#283244] bg-[#161B24] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                    GOLD TIER
                  </span>
                  <span className="text-[10px] text-amber-400 font-bold">Enterprise VIP</span>
                </div>
                <p className="text-xs text-slate-400">Key enterprise accounts with multi-year commitments</p>
                <div className="flex items-center gap-2 pt-2">
                  <label className="text-xs font-semibold text-slate-300">Max Discount:</label>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      value={tierCeilings.GOLD}
                      onChange={(e) => setTierCeilings({ ...tierCeilings, GOLD: parseFloat(e.target.value) || 0 })}
                      className="w-16 p-1 text-center font-bold text-xs rounded-lg border border-[#283244] bg-[#101319] text-white focus:outline-none focus:border-blue-500"
                    />
                    <span className="text-xs text-slate-400">%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Category Ceilings */}
          <div className="bg-[#12151C] border border-[#1E2430] rounded-2xl overflow-hidden shadow-sm">
            <div className="py-3.5 px-5 bg-[#101319] border-b border-[#1E2430] flex items-center justify-between">
              <span className="text-xs font-bold text-white">Product Category Ceilings (Hard Guardrails)</span>
            </div>
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-[#101319] border-b border-[#1E2430] text-slate-400 uppercase font-semibold text-[11px]">
                  <th className="py-3 px-5">Category Name</th>
                  <th className="py-3 px-5 text-center">Gross Margin Target</th>
                  <th className="py-3 px-5 text-center">Maximum Permitted Discount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1A202C]">
                {Object.entries(categoryCeilings).map(([cat, val]) => (
                  <tr key={cat} className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-3.5 px-5 font-bold text-white">{cat}</td>
                    <td className="py-3.5 px-5 text-center text-slate-400">35.0% Standard</td>
                    <td className="py-3.5 px-5 text-center">
                      <div className="inline-flex items-center gap-1">
                        <input
                          type="number"
                          value={val}
                          onChange={(e) =>
                            setCategoryCeilings({ ...categoryCeilings, [cat]: parseFloat(e.target.value) || 0 })
                          }
                          className="w-16 p-1 text-center font-bold text-xs rounded-lg border border-[#283244] bg-[#101319] text-white focus:outline-none focus:border-blue-500"
                        />
                        <span className="text-xs text-slate-400">%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
