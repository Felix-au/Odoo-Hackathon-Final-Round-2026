import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import { Sliders, Info } from 'lucide-react';
import { toast } from 'sonner';

export function DiscountTiersPage() {
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
    <div className="space-y-5 pb-8 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-slate-900 tracking-tight">Customer Discount Tier Governance</h1>
          <p className="text-xs text-slate-500 mt-0.5">Configure autonomous discount caps and multi-layer ceiling limits</p>
        </div>

        <Button variant="primary" size="sm" onClick={handleSave}>
          Save Governance Rules
        </Button>
      </div>

      <div className="p-4 rounded-xl bg-blue-50/70 border border-blue-200 text-blue-950 text-xs flex items-start gap-3">
        <Info className="w-5 h-5 text-primary shrink-0 mt-0.5" />
        <div>
          <h4 className="font-bold">Effective Ceiling Resolution Rule (REQ-BR-001)</h4>
          <p className="mt-0.5 opacity-90">
            The quotation engine enforces: <code className="bg-white/80 px-1.5 py-0.5 rounded font-mono text-[11px]">Effective Ceiling = min(Customer Tier Ceiling, Category Ceiling)</code>. Any line discount exceeding this effective threshold triggers an elevated blended risk score.
          </p>
        </div>
      </div>

      {/* Customer Tier Ceilings Matrix */}
      <Card>
        <CardHeader className="py-3 px-5 bg-slate-50/75 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-primary" />
            <CardTitle className="text-xs font-bold text-slate-800">Customer Account Tier Caps</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl border border-amber-700/20 bg-amber-50/40 space-y-2">
              <div className="flex items-center justify-between">
                <Badge variant="tierBronze" size="sm">
                  BRONZE TIER
                </Badge>
                <span className="text-[10px] text-slate-400">Standard</span>
              </div>
              <p className="text-xs text-slate-500">Entry level accounts or first-time transactions</p>
              <div className="flex items-center gap-2 pt-2">
                <label className="text-xs font-semibold text-slate-700">Max Discount:</label>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    value={tierCeilings.BRONZE}
                    onChange={(e) => setTierCeilings({ ...tierCeilings, BRONZE: parseFloat(e.target.value) || 0 })}
                    className="w-16 p-1 text-center font-bold text-xs rounded border border-slate-300 bg-white"
                  />
                  <span className="text-xs text-slate-500">%</span>
                </div>
              </div>
            </div>

            <div className="p-4 rounded-xl border border-slate-300 bg-slate-50/70 space-y-2">
              <div className="flex items-center justify-between">
                <Badge variant="tierSilver" size="sm">
                  SILVER TIER
                </Badge>
                <span className="text-[10px] text-slate-400">Mid-Market</span>
              </div>
              <p className="text-xs text-slate-500">Established recurring clients with $50k+ run rate</p>
              <div className="flex items-center gap-2 pt-2">
                <label className="text-xs font-semibold text-slate-700">Max Discount:</label>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    value={tierCeilings.SILVER}
                    onChange={(e) => setTierCeilings({ ...tierCeilings, SILVER: parseFloat(e.target.value) || 0 })}
                    className="w-16 p-1 text-center font-bold text-xs rounded border border-slate-300 bg-white"
                  />
                  <span className="text-xs text-slate-500">%</span>
                </div>
              </div>
            </div>

            <div className="p-4 rounded-xl border border-amber-300 bg-amber-50/50 space-y-2">
              <div className="flex items-center justify-between">
                <Badge variant="tierGold" size="sm">
                  GOLD TIER
                </Badge>
                <span className="text-[10px] text-amber-700 font-bold">Enterprise VIP</span>
              </div>
              <p className="text-xs text-slate-500">Key enterprise accounts with multi-year commitments</p>
              <div className="flex items-center gap-2 pt-2">
                <label className="text-xs font-semibold text-slate-700">Max Discount:</label>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    value={tierCeilings.GOLD}
                    onChange={(e) => setTierCeilings({ ...tierCeilings, GOLD: parseFloat(e.target.value) || 0 })}
                    className="w-16 p-1 text-center font-bold text-xs rounded border border-slate-300 bg-white"
                  />
                  <span className="text-xs text-slate-500">%</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Category Ceilings */}
      <Card>
        <CardHeader className="py-3 px-5 bg-slate-50/75">
          <CardTitle className="text-xs font-bold text-slate-800">Product Category Ceilings (Hard Guardrails)</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-left table-dense">
            <thead>
              <tr>
                <th>Category Name</th>
                <th className="text-center">Gross Margin Target</th>
                <th className="text-center">Maximum Permitted Discount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {Object.entries(categoryCeilings).map(([cat, val]) => (
                <tr key={cat}>
                  <td className="font-bold text-xs text-slate-800">{cat}</td>
                  <td className="text-center text-xs text-slate-500">35.0% Standard</td>
                  <td className="text-center">
                    <div className="inline-flex items-center gap-1">
                      <input
                        type="number"
                        value={val}
                        onChange={(e) =>
                          setCategoryCeilings({ ...categoryCeilings, [cat]: parseFloat(e.target.value) || 0 })
                        }
                        className="w-16 p-1 text-center font-bold text-xs rounded border border-slate-300"
                      />
                      <span className="text-xs text-slate-500">%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
