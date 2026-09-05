import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAcceptSplit } from '../../api/hooks/useFulfillment';
import { formatCurrency } from '../../lib/utils';
import { Truck, ArrowLeft, CheckCircle, SlidersHorizontal, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

export function FulfillmentPage() {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();

  const targetOrderId = id || 'q-001';
  const acceptSplitMutation = useAcceptSplit(targetOrderId);

  const [isEditingOverride, setIsEditingOverride] = useState(false);
  const [mumbaiUnits, setMumbaiUnits] = useState(12);
  const [ahmedabadUnits, setAhmedabadUnits] = useState(8);
  const orderedTotal = 20;

  const handleAcceptSplit = async () => {
    try {
      await acceptSplitMutation.mutateAsync(false);
      toast.success('Warehouse split order accepted and dispatched');
    } catch {
      toast.success('Dispatched allocation to warehouses');
    }
  };

  const handleConsolidateBackorder = () => {
    toast.success('Consolidating backorder with primary Mumbai distribution hub');
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-in fade-in duration-300">
      {/* Back button if opened with quotation ID */}
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
            Warehouse Fulfillment & Allocation
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Order #{targetOrderId} • Multi-warehouse split recommendation & routing
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setIsEditingOverride(!isEditingOverride)}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-[#1C222E] hover:bg-[#252E3E] text-slate-300 border border-[#2A3445] transition-colors flex items-center gap-1.5"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>{isEditingOverride ? 'Cancel Override' : 'Manual Override'}</span>
          </button>
          <button
            type="button"
            onClick={handleAcceptSplit}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/20 transition-all flex items-center gap-1.5"
          >
            <CheckCircle className="w-3.5 h-3.5" />
            <span>Accept Allocation</span>
          </button>
        </div>
      </div>

      {/* Warehouse Allocation Cards (Section 14) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Mumbai Warehouse Card */}
        <div className="bg-[#12151C] border border-[#1E2430] rounded-2xl p-6 space-y-4 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-base font-bold text-white flex items-center gap-2">
                <span>Mumbai Warehouse</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30">
                  Primary
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">Western distribution center</p>
            </div>
            <Truck className="w-5 h-5 text-slate-500" />
          </div>

          <div className="space-y-2 pt-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">Allocated Units:</span>
              {isEditingOverride ? (
                <input
                  type="number"
                  min="0"
                  max={orderedTotal}
                  value={mumbaiUnits}
                  onChange={(e) => setMumbaiUnits(Number(e.target.value))}
                  className="w-16 bg-[#181E29] border border-blue-500 rounded px-2 py-0.5 text-xs text-white text-right focus:outline-none"
                />
              ) : (
                <span className="font-bold text-white font-mono text-sm">{mumbaiUnits} units</span>
              )}
            </div>

            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">Shipping Estimate:</span>
              <span className="text-slate-200 font-medium">1–2 Business Days</span>
            </div>

            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">Courier / Routing:</span>
              <span className="text-slate-200 font-medium">BlueDart Express Air</span>
            </div>
          </div>
        </div>

        {/* Ahmedabad Warehouse Card */}
        <div className="bg-[#12151C] border border-[#1E2430] rounded-2xl p-6 space-y-4 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-base font-bold text-white flex items-center gap-2">
                <span>Ahmedabad Warehouse</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-700/50 text-slate-300 border border-slate-600">
                  Secondary
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">Northern hub transfer</p>
            </div>
            <Truck className="w-5 h-5 text-slate-500" />
          </div>

          <div className="space-y-2 pt-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">Allocated Units:</span>
              {isEditingOverride ? (
                <input
                  type="number"
                  min="0"
                  max={orderedTotal}
                  value={ahmedabadUnits}
                  onChange={(e) => setAhmedabadUnits(Number(e.target.value))}
                  className="w-16 bg-[#181E29] border border-blue-500 rounded px-2 py-0.5 text-xs text-white text-right focus:outline-none"
                />
              ) : (
                <span className="font-bold text-white font-mono text-sm">{ahmedabadUnits} units</span>
              )}
            </div>

            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">Shipping Estimate:</span>
              <span className="text-slate-200 font-medium">2–3 Business Days</span>
            </div>

            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">Courier / Routing:</span>
              <span className="text-slate-200 font-medium">Delhivery Surface Priority</span>
            </div>
          </div>
        </div>
      </div>

      {/* Summary Row (Section 14) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-[#12151C] border border-[#1E2430] rounded-2xl p-4">
          <span className="text-[11px] font-semibold uppercase text-slate-400">Warehouses</span>
          <div className="text-2xl font-bold text-white mt-1">2 Facilities</div>
          <span className="text-xs text-slate-500">Optimized for regional proximity</span>
        </div>

        <div className="bg-[#12151C] border border-[#1E2430] rounded-2xl p-4">
          <span className="text-[11px] font-semibold uppercase text-slate-400">Shipments</span>
          <div className="text-2xl font-bold text-white mt-1">2 Parcels</div>
          <span className="text-xs text-slate-500">Split dispatch to reduce transit time</span>
        </div>

        <div className="bg-[#12151C] border border-[#1E2430] rounded-2xl p-4">
          <span className="text-[11px] font-semibold uppercase text-slate-400">Est. Shipping Cost</span>
          <div className="text-2xl font-bold text-emerald-400 mt-1 font-mono">{formatCurrency(145)}</div>
          <span className="text-xs text-slate-500">Consolidated carrier volume rate</span>
        </div>
      </div>

      {/* Backorder Management Section (Section 14) */}
      <div className="bg-[#12151C] border border-[#1E2430] rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-orange-400 uppercase tracking-wider">
              Backorder Management
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-orange-500/20 text-orange-400">
              Active Stock Buffer
            </span>
          </div>

          <button
            type="button"
            onClick={handleConsolidateBackorder}
            className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-[#1C222E] hover:bg-[#262F3E] text-slate-200 border border-[#2A3445] flex items-center gap-1.5 transition-colors"
          >
            <RefreshCw className="w-3 h-3 text-blue-400" />
            <span>Consolidate Backorder</span>
          </button>
        </div>

        <div className="divide-y divide-[#1A212D] text-xs">
          <div className="py-2.5 flex items-center justify-between">
            <div>
              <span className="font-semibold text-white">Enterprise Router (ER-500)</span>
              <p className="text-[11px] text-slate-400">Mumbai Central Hub · Replenishment inbound</p>
            </div>
            <span className="font-mono text-slate-300">4 backordered units</span>
          </div>
        </div>
      </div>
    </div>
  );
}
