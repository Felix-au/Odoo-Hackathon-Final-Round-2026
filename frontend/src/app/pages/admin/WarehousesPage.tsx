import { useWarehouses } from '../../../api/hooks/useCatalog';
import { LoadingSpinner } from '../../../components/feedback/LoadingSpinner';
import { Truck } from 'lucide-react';

export function WarehousesPage() {
  const { data: warehouses = [], isLoading } = useWarehouses();

  if (isLoading) {
    return (
      <div className="py-20 flex justify-center">
        <LoadingSpinner label="Loading warehouse nodes..." />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-in fade-in duration-300">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Distribution Warehouses</h1>
        <p className="text-xs text-slate-400 mt-0.5">Locations used by the fulfillment split algorithm</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {warehouses.map((wh) => (
          <div key={wh.id} className="bg-[#12151C] border border-[#1E2430] rounded-2xl p-5 space-y-3 shadow-sm">
            <div className="flex items-center justify-between pb-2 border-b border-[#1E2430]">
              <div className="flex items-center gap-2">
                <Truck className="w-4 h-4 text-blue-400" />
                <span className="text-xs font-bold text-white">{wh.code}</span>
              </div>
              {wh.isPrimary && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30">
                  Primary Hub
                </span>
              )}
            </div>
            <div className="space-y-1.5 text-xs">
              <div className="font-bold text-white">{wh.name}</div>
              <div className="text-slate-400">Shipping Cost Factor: {wh.shippingCostWeight}x standard rate</div>
              <div className="text-[11px] text-emerald-400 font-semibold pt-1">Active & Connected to ERP</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
