import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useFulfillmentSplit, useAcceptSplit } from '../../api/hooks/useFulfillment';
import { fulfillmentApi } from '../../api/fulfillment.api';
import { useAuthStore } from '../../stores/auth.store';
import { LoadingSpinner } from '../../components/feedback/LoadingSpinner';
import { formatCurrency } from '../../lib/utils';
import { Truck, ArrowLeft, CheckCircle, SlidersHorizontal, Package, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import type { WarehouseSplit } from '../../types/fulfillment.types';

export function FulfillmentPage() {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const token = useAuthStore((s) => s.accessToken) || undefined;

  const targetOrderId = id || '';
  const { data: split, isLoading, error } = useFulfillmentSplit(targetOrderId);
  const acceptSplitMutation = useAcceptSplit(targetOrderId, split);

  const [isEditingOverride, setIsEditingOverride] = useState(false);
  // Override quantities: keyed by warehouseId -> productId -> qty
  const [overrides, setOverrides] = useState<Record<string, Record<string, number>>>({});

  const setOverride = (warehouseId: string, productId: string, qty: number) => {
    setOverrides((prev) => ({
      ...prev,
      [warehouseId]: { ...(prev[warehouseId] ?? {}), [productId]: qty },
    }));
  };

  const handleAcceptSplit = async () => {
    try {
      if (isEditingOverride && split) {
        const overrideSplits = split.splits.flatMap((w) =>
          w.items.map((item) => ({
            warehouseId: w.warehouseId,
            warehouseName: w.warehouseName,
            productId: item.productId,
            productName: item.productName,
            quantity: overrides[w.warehouseId]?.[item.productId] ?? item.quantity,
          }))
        );
        await fulfillmentApi.acceptSplit({
          orderId: targetOrderId,
          companyId: 'default',
          customerId: 'cust-000000-0000-0000-0000-000000000001',
          currency: 'USD',
          isOverride: true,
          splits: overrideSplits,
        }, token);
      } else {
        await acceptSplitMutation.mutateAsync(false);
      }
      toast.success('Warehouse allocation accepted and dispatched.');
      setIsEditingOverride(false);
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Failed to accept split';
      toast.error(msg);
    }
  };

  if (isLoading) {
    return (
      <div className="py-20 flex justify-center">
        <LoadingSpinner label="Loading fulfillment data..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-20 flex flex-col items-center gap-3 text-center">
        <AlertCircle className="w-8 h-8 text-red-400" />
        <p className="text-sm text-red-400 font-semibold">Failed to load split recommendation</p>
        <p className="text-xs text-slate-500">{(error as any)?.message || 'Service unavailable'}</p>
      </div>
    );
  }

  const warehouses: WarehouseSplit[] = split?.splits ?? [];
  const totalShipments = split?.totalShipments ?? warehouses.length;
  const estimatedShippingCost = split?.estimatedShippingCost ?? 0;
  const hasBackorder = split?.hasBackorder ?? false;
  const backorderItems = split?.backorderItems ?? [];

  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-in fade-in duration-300">
      {/* Back button */}
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
            Order #{targetOrderId || '—'} • Multi-warehouse split recommendation & routing
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setIsEditingOverride(!isEditingOverride)}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-[#1F1F23] hover:bg-[#27272A] text-slate-300 border border-[#27272A] transition-colors flex items-center gap-1.5"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>{isEditingOverride ? 'Cancel Override' : 'Manual Override'}</span>
          </button>
          <button
            type="button"
            onClick={handleAcceptSplit}
            disabled={warehouses.length === 0}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/20 transition-all flex items-center gap-1.5 disabled:opacity-50"
          >
            <CheckCircle className="w-3.5 h-3.5" />
            <span>Accept Allocation</span>
          </button>
        </div>
      </div>

      {/* Empty state */}
      {warehouses.length === 0 && (
        <div className="bg-[#121214] border border-[#27272A] rounded-2xl p-10 text-center space-y-2">
          <Package className="w-8 h-8 text-slate-600 mx-auto" />
          <p className="text-sm text-slate-400">No warehouse split recommendation available for this order.</p>
          <p className="text-xs text-slate-500">This order may not yet have confirmed line items or inventory allocated.</p>
        </div>
      )}

      {/* Warehouse Allocation Cards */}
      {warehouses.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {warehouses.map((w, idx) => (
            <div
              key={w.warehouseId}
              className="bg-[#121214] border border-[#27272A] rounded-2xl p-6 space-y-4 relative overflow-hidden"
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-base font-bold text-white flex items-center gap-2">
                    <span>{w.warehouseName}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      w.isPrimary || idx === 0
                        ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                        : 'bg-slate-700/50 text-slate-300 border border-slate-600'
                    }`}>
                      {w.isPrimary || idx === 0 ? 'Primary' : 'Secondary'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">Est. shipping cost weight: {w.shippingCostWeight}×</p>
                </div>
                <Truck className="w-5 h-5 text-slate-500" />
              </div>

              {/* Product line items */}
              <div className="space-y-2 pt-2 border-t border-[#27272A]">
                {w.items.map((item) => (
                  <div key={item.productId} className="flex items-center justify-between text-xs">
                    <div>
                      <span className="text-slate-300 font-medium">{item.productName}</span>
                      {item.isBackorder && (
                        <span className="ml-2 text-[10px] text-orange-400 font-semibold">Backorder</span>
                      )}
                    </div>
                    {isEditingOverride ? (
                      <input
                        type="number"
                        min="0"
                        value={overrides[w.warehouseId]?.[item.productId] ?? item.quantity}
                        onChange={(e) => setOverride(w.warehouseId, item.productId, Number(e.target.value))}
                        className="w-16 bg-[#18181B] border border-blue-500 rounded px-2 py-0.5 text-xs text-white text-right focus:outline-none"
                      />
                    ) : (
                      <span className="font-bold text-white font-mono">{item.quantity} units</span>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between text-xs pt-2 border-t border-[#27272A]">
                <span className="text-slate-400">Estimated Cost:</span>
                <span className="font-mono text-emerald-400 font-semibold">{formatCurrency(w.estimatedCost)}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Summary Row */}
      {warehouses.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-[#121214] border border-[#27272A] rounded-2xl p-4">
            <span className="text-[11px] font-semibold uppercase text-slate-400">Warehouses</span>
            <div className="text-2xl font-bold text-white mt-1">{warehouses.length} Facilit{warehouses.length !== 1 ? 'ies' : 'y'}</div>
            <span className="text-xs text-slate-500">Optimized for regional proximity</span>
          </div>

          <div className="bg-[#121214] border border-[#27272A] rounded-2xl p-4">
            <span className="text-[11px] font-semibold uppercase text-slate-400">Shipments</span>
            <div className="text-2xl font-bold text-white mt-1">{totalShipments} Parcel{totalShipments !== 1 ? 's' : ''}</div>
            <span className="text-xs text-slate-500">Split dispatch to reduce transit time</span>
          </div>

          <div className="bg-[#121214] border border-[#27272A] rounded-2xl p-4">
            <span className="text-[11px] font-semibold uppercase text-slate-400">Est. Shipping Cost</span>
            <div className="text-2xl font-bold text-emerald-400 mt-1 font-mono">{formatCurrency(estimatedShippingCost)}</div>
            <span className="text-xs text-slate-500">Consolidated carrier volume rate</span>
          </div>
        </div>
      )}

      {/* Backorder Section */}
      {hasBackorder && backorderItems.length > 0 && (
        <div className="bg-[#121214] border border-orange-500/30 rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-orange-400 uppercase tracking-wider">
              Backorder Management
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-orange-500/20 text-orange-400">
              {backorderItems.length} Item{backorderItems.length !== 1 ? 's' : ''} Backordered
            </span>
          </div>

          <div className="divide-y divide-[#1E1E22] text-xs">
            {backorderItems.map((item, i) => (
              <div key={item.productId || i} className="py-2.5 flex items-center justify-between">
                <div>
                  <span className="font-semibold text-white">{item.productName}</span>
                  {item.expectedRestockDate && (
                    <p className="text-[11px] text-slate-400">Expected restock: {item.expectedRestockDate}</p>
                  )}
                </div>
                <span className="font-mono text-slate-300">{item.quantity} backordered units</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
