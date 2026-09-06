import { useState, useMemo, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useFulfillmentSplit, useAcceptSplit, useWarehouseStock, useFulfillmentOrders } from '../../api/hooks/useFulfillment';
import { useQuotations } from '../../api/hooks/useQuotations';
import { fulfillmentApi } from '../../api/fulfillment.api';
import { quotationApi } from '../../api/quotation.api';
import { useAuthStore } from '../../stores/auth.store';
import { formatCurrency, formatDate } from '../../lib/utils';
import {
  Truck,
  ArrowLeft,
  CheckCircle,
  SlidersHorizontal,
  Package,
  AlertCircle,
  Building2,
  Box,
  History,
  ShieldCheck,
  RefreshCw,
  Clock,
} from 'lucide-react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import type { WarehouseSplit } from '../../types/fulfillment.types';

export function FulfillmentPage() {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const token = useAuthStore((s) => s.accessToken) || undefined;

  // Active quotations to select from
  const { data: quotationsData } = useQuotations({ pageSize: 50 });
  const quotations = quotationsData?.data || [];

  // Eligible orders: approved, sent, confirmed, or any draft with lines
  const eligibleOrders = useMemo(() => {
    return quotations.filter((q) =>
      ['CONFIRMED', 'APPROVED', 'SENT', 'PENDING_MANAGER_APPROVAL', 'PENDING_FINANCE_APPROVAL', 'DRAFT'].includes(q.status)
    );
  }, [quotations]);

  // Default selected order
  const defaultOrderId = useMemo(() => {
    if (id) return id;
    const confirmed = eligibleOrders.find((q) => q.status === 'CONFIRMED' || q.status === 'APPROVED' || q.status === 'SENT');
    return confirmed ? confirmed.id : (eligibleOrders[0]?.id || 'quot-000000-0000-0000-0000-000000000001');
  }, [id, eligibleOrders]);

  const [selectedOrderId, setSelectedOrderId] = useState<string>(defaultOrderId);

  useEffect(() => {
    if (id) {
      setSelectedOrderId(id);
    } else if (!selectedOrderId && defaultOrderId) {
      setSelectedOrderId(defaultOrderId);
    }
  }, [id, defaultOrderId]);

  const targetOrderId = selectedOrderId || defaultOrderId;

  // Find currently selected quotation
  const activeQuotation = useMemo(() => {
    return quotations.find((q) => q.id === targetOrderId);
  }, [quotations, targetOrderId]);

  // Split Recommendation query for target order
  const { data: split, isLoading: isLoadingSplit } = useFulfillmentSplit(targetOrderId);
  const acceptSplitMutation = useAcceptSplit(
    targetOrderId,
    split,
    activeQuotation?.customerId,
    activeQuotation?.currency
  );

  // Live Warehouse Stock
  const { data: stockData } = useWarehouseStock();
  const stock = stockData || [];

  // Fulfillment Orders History
  const { data: ordersHistoryData } = useFulfillmentOrders();
  const fulfillmentOrders = ordersHistoryData || [];

  // Check if this quotation has already been allocated
  const isAlreadyAllocated = useMemo(() => {
    return fulfillmentOrders.some((o) => o.orderId === targetOrderId);
  }, [fulfillmentOrders, targetOrderId]);

  // Active view tab
  const [activeTab, setActiveTab] = useState<'allocation' | 'stock' | 'history'>('allocation');

  // Override quantities: keyed by warehouseId -> productId -> qty
  const [isEditingOverride, setIsEditingOverride] = useState(false);
  const [overrides, setOverrides] = useState<Record<string, Record<string, number>>>({});
  const [isDispatching, setIsDispatching] = useState(false);

  const setOverride = (warehouseId: string, productId: string, qty: number) => {
    setOverrides((prev) => ({
      ...prev,
      [warehouseId]: { ...(prev[warehouseId] ?? {}), [productId]: Math.max(0, qty) },
    }));
  };

  const handleAcceptSplit = async () => {
    try {
      setIsDispatching(true);
      const customerId = activeQuotation?.customerId || 'cust-000000-0000-0000-0000-000000000001';
      const currency = activeQuotation?.currency || 'USD';

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
        await fulfillmentApi.acceptSplit(
          {
            orderId: targetOrderId,
            companyId: 'default',
            customerId,
            currency,
            isOverride: true,
            splits: overrideSplits,
          },
          token
        );
      } else {
        await acceptSplitMutation.mutateAsync(false);
      }

      // Automatically transition quotation status to CONFIRMED (Won)
      try {
        await quotationApi.confirmQuotation(targetOrderId, token);
      } catch (confirmErr: any) {
        console.warn('Quotation status confirmation notice:', confirmErr?.response?.data || confirmErr?.message);
      }

      toast.success('Warehouse allocation accepted. Stock reserved and quotation marked as Won (Confirmed)!');
      setIsEditingOverride(false);
      queryClient.invalidateQueries({ queryKey: ['fulfillment-split'] });
      queryClient.invalidateQueries({ queryKey: ['fulfillment-orders'] });
      queryClient.invalidateQueries({ queryKey: ['warehouse-stock'] });
      queryClient.invalidateQueries({ queryKey: ['quotations'] });
      queryClient.invalidateQueries({ queryKey: ['quotation', targetOrderId] });
    } catch (err: any) {
      const msg = err?.response?.data?.detail || err?.response?.data?.message || err?.message || 'Failed to accept split';
      toast.error(msg);
    } finally {
      setIsDispatching(false);
    }
  };

  const warehouses: WarehouseSplit[] = split?.splits ?? [];
  const totalShipments = split?.totalShipments ?? warehouses.length;
  const estimatedShippingCost = split?.estimatedShippingCost ?? 0;
  const hasBackorder = split?.hasBackorder ?? false;
  const backorderItems = split?.backorderItems ?? [];

  // Group warehouse stock by warehouse name
  const stockByWarehouse = useMemo(() => {
    const map: Record<string, typeof stock> = {};
    for (const item of stock) {
      if (!map[item.warehouseName]) map[item.warehouseName] = [];
      map[item.warehouseName].push(item);
    }
    return map;
  }, [stock]);

  // Total inventory stats
  const inventoryStats = useMemo(() => {
    const totalFacilities = Object.keys(stockByWarehouse).length || 3;
    const totalOnHand = stock.reduce((acc, s) => acc + (s.quantityOnHand || 0), 0);
    const totalReserved = stock.reduce((acc, s) => acc + (s.quantityReserved || 0), 0);
    const totalAvailable = Math.max(0, totalOnHand - totalReserved);
    return { totalFacilities, totalOnHand, totalReserved, totalAvailable };
  }, [stock, stockByWarehouse]);


  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-in fade-in duration-300">
      {/* Back button if opened with route parameter */}
      {id && (
        <div>
          <button
            type="button"
            onClick={() => navigate(`/app/quotations/${id}`)}
            className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1.5 font-medium transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Quotation Builder</span>
          </button>
        </div>
      )}

      {/* Header & Order Switcher */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-2 border-b border-[#1F1F1F]">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              Warehouse Fulfillment & Allocation
            </h1>
            <span className="text-[11px] font-mono font-semibold px-2.5 py-0.5 rounded-full border bg-blue-500/10 text-blue-400 border-blue-500/20 flex items-center gap-1">
              <Truck className="w-3 h-3" />
              Multi-Depot Routing
            </span>
          </div>
          <p className="text-xs sm:text-sm text-zinc-400 mt-1">
            Compute optimal multi-warehouse shipment splits, reserve stock, and mitigate shipping freight costs.
          </p>
        </div>

        {/* Order Selector Dropdown */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-[#0E0E0E] border border-[#242424] rounded-xl px-3 py-1.5 text-xs shadow-sm">
            <Package className="w-3.5 h-3.5 text-zinc-500" />
            <span className="text-zinc-400 font-medium whitespace-nowrap">Target Order:</span>
            <select
              value={targetOrderId}
              onChange={(e) => setSelectedOrderId(e.target.value)}
              className="bg-[#181818] border border-[#2E2E2E] rounded-lg px-2.5 py-1 text-white font-mono text-xs focus:outline-none focus:border-blue-500 cursor-pointer max-w-xs truncate"
            >
              {eligibleOrders.map((q) => (
                <option key={q.id} value={q.id}>
                  {q.quotationNumber ? `#${q.quotationNumber}` : q.id.slice(0, 8)} •{' '}
                  {(q as any).dealTitle || q.customer?.name || (q as any).title || 'Deal'} ({q.status})
                </option>
              ))}
            </select>
          </div>

          {activeQuotation && (
            <span
              className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                activeQuotation.status === 'CONFIRMED' || activeQuotation.status === 'APPROVED'
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                  : 'bg-blue-500/10 text-blue-400 border-blue-500/20'
              }`}
            >
              {activeQuotation.status}
            </span>
          )}
        </div>
      </div>

      {/* Top Operations KPI Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Facilities */}
        <div className="bg-[#0A0A0A] border border-[#1F1F1F] rounded-2xl p-4 shadow-xl relative overflow-hidden group hover:border-[#2E2E2E] transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
              Active Depots
            </span>
            <div className="w-8 h-8 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold font-mono text-white mt-2">
            {inventoryStats.totalFacilities} Depots
          </div>
          <span className="text-xs text-zinc-500 mt-0.5 block">
            Main Warehouse, East Depot, West Depot
          </span>
        </div>

        {/* Total Stock Available */}
        <div className="bg-[#0A0A0A] border border-[#1F1F1F] rounded-2xl p-4 shadow-xl relative overflow-hidden group hover:border-[#2E2E2E] transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
              Available Units
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Box className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-400 mt-2">
            {inventoryStats.totalAvailable} Units
          </div>
          <span className="text-xs text-emerald-500/80 mt-0.5 block">
            {inventoryStats.totalOnHand} on hand • {inventoryStats.totalReserved} reserved
          </span>
        </div>

        {/* Selected Order Shipments */}
        <div className="bg-[#0A0A0A] border border-[#1F1F1F] rounded-2xl p-4 shadow-xl relative overflow-hidden group hover:border-[#2E2E2E] transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
              Routing Splits
            </span>
            <div className="w-8 h-8 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
              <Truck className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold font-mono text-purple-400 mt-2">
            {totalShipments} Parcel{totalShipments !== 1 ? 's' : ''}
          </div>
          <span className="text-xs text-zinc-500 mt-0.5 block">
            Across {warehouses.length} physical facilit{warehouses.length !== 1 ? 'ies' : 'y'}
          </span>
        </div>

        {/* Estimated Freight Cost */}
        <div className="bg-[#0A0A0A] border border-[#1F1F1F] rounded-2xl p-4 shadow-xl relative overflow-hidden group hover:border-[#2E2E2E] transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
              Freight Volume Cost
            </span>
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold font-mono text-amber-400 mt-2">
            {formatCurrency(estimatedShippingCost)}
          </div>
          <span className="text-xs text-zinc-500 mt-0.5 block">
            Carrier rate based on weight & distance
          </span>
        </div>
      </div>

      {/* Tabs Switcher */}
      <div className="flex items-center justify-between gap-4 p-2 bg-[#0A0A0A] border border-[#1F1F1F] rounded-2xl">
        <div className="flex items-center gap-1.5 p-1 bg-[#121212] border border-[#242424] rounded-xl">
          <button
            type="button"
            onClick={() => setActiveTab('allocation')}
            className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'allocation'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                : 'text-zinc-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Truck className="w-3.5 h-3.5" />
            <span>Split Allocation & Routing</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('stock')}
            className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'stock'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-500/20'
                : 'text-zinc-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>Warehouse Stock Levels</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white/10 font-mono">
              {inventoryStats.totalFacilities}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'history'
                ? 'bg-purple-600 text-white shadow-md shadow-purple-500/20'
                : 'text-zinc-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Dispatched Orders</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white/10 font-mono">
              {fulfillmentOrders.length}
            </span>
          </button>
        </div>

        {activeTab === 'allocation' && warehouses.length > 0 && (
          <div className="flex items-center gap-2 px-2">
            {isAlreadyAllocated && !isEditingOverride && (
              <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <CheckCircle className="w-3.5 h-3.5" />
                <span>Allocated & Won</span>
              </span>
            )}
            <button
              type="button"
              onClick={() => setIsEditingOverride(!isEditingOverride)}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-[#181818] hover:bg-[#222222] text-zinc-300 border border-[#2E2E2E] transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>{isEditingOverride ? 'Cancel Override' : 'Manual Override'}</span>
            </button>
            <button
              type="button"
              disabled={isDispatching || (isAlreadyAllocated && !isEditingOverride)}
              onClick={handleAcceptSplit}
              className={`px-4 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed ${
                isAlreadyAllocated && !isEditingOverride
                  ? 'bg-emerald-600/80 text-white'
                  : 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/20'
              }`}
            >
              <CheckCircle className="w-3.5 h-3.5" />
              <span>
                {isDispatching
                  ? 'Processing...'
                  : isAlreadyAllocated
                  ? isEditingOverride
                    ? 'Update & Reallocate'
                    : 'Allocation Confirmed'
                  : isEditingOverride
                  ? 'Confirm Override Allocation'
                  : 'Accept Allocation'}
              </span>
            </button>
          </div>
        )}
      </div>

      {/* Tab 1: Split Allocation & Routing */}
      {activeTab === 'allocation' && (
        <div className="space-y-5">
          {isAlreadyAllocated && (
            <div className="p-4 rounded-2xl bg-[#0A0A0A] border border-emerald-500/30 shadow-lg flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-emerald-400">
                    Warehouse Allocation Committed • Deal Won (CONFIRMED)
                  </h4>
                  <p className="text-[11px] text-zinc-400">
                    Inventory has been reserved across designated depots and the quotation is confirmed as Won. To adjust distribution quantities, click &ldquo;Manual Override&rdquo;.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab('history')}
                className="px-3 py-1.5 rounded-xl text-xs font-medium bg-[#141414] hover:bg-[#1E1E1E] text-zinc-300 border border-[#2A2A2A] transition-all whitespace-nowrap cursor-pointer"
              >
                View Dispatched Orders
              </button>
            </div>
          )}
          {isLoadingSplit ? (
            <div className="p-12 text-center text-xs text-zinc-500">
              Calculating multi-depot split recommendation...
            </div>
          ) : warehouses.length === 0 ? (
            <div className="bg-[#0A0A0A] border border-[#1F1F1F] rounded-2xl p-10 text-center space-y-3">
              <Package className="w-10 h-10 text-zinc-600 mx-auto" />
              <div className="space-y-1">
                <p className="text-sm text-zinc-300 font-semibold">
                  No warehouse split recommendation available for this order.
                </p>
                <p className="text-xs text-zinc-500 max-w-md mx-auto">
                  Order #{targetOrderId.slice(0, 8)} does not have physical hardware items needing warehouse dispatch or is awaiting product line item configuration.
                </p>
              </div>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedOrderId('quot-000000-0000-0000-0000-000000000001')}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white transition-all cursor-pointer inline-flex items-center gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Inspect Enterprise Laptop Bundle (Order #quot-000001)</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {warehouses.map((w, idx) => (
                <div
                  key={w.warehouseId}
                  className="bg-[#0A0A0A] border border-[#1F1F1F] rounded-2xl p-6 space-y-4 relative overflow-hidden group hover:border-[#2E2E2E] transition-all shadow-xl"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-base font-bold text-white flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-blue-400" />
                        <span>{w.warehouseName}</span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                            w.isPrimary || idx === 0
                              ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                              : 'bg-zinc-800 text-zinc-300 border-zinc-700'
                          }`}
                        >
                          {w.isPrimary || idx === 0 ? 'Primary Hub' : 'Secondary Depot'}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-400 mt-1">
                        Est. shipping cost weight: {w.shippingCostWeight}× regional proximity
                      </p>
                    </div>
                    <Truck className="w-5 h-5 text-zinc-600" />
                  </div>

                  {/* Product line items */}
                  <div className="space-y-2 pt-2 border-t border-[#1F1F1F]">
                    {w.items.map((item) => (
                      <div
                        key={item.productId}
                        className="flex items-center justify-between text-xs py-1"
                      >
                        <div>
                          <span className="text-zinc-300 font-medium">{item.productName}</span>
                          {item.isBackorder && (
                            <span className="ml-2 text-[10px] text-amber-400 font-semibold px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20">
                              Backorder
                            </span>
                          )}
                        </div>
                        {isEditingOverride ? (
                          <input
                            type="number"
                            min="0"
                            value={overrides[w.warehouseId]?.[item.productId] ?? item.quantity}
                            onChange={(e) =>
                              setOverride(w.warehouseId, item.productId, Number(e.target.value))
                            }
                            className="w-16 bg-[#141414] border border-blue-500 rounded px-2 py-0.5 text-xs text-white text-right focus:outline-none"
                          />
                        ) : (
                          <span className="font-bold text-white font-mono">
                            {item.quantity} units
                          </span>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center justify-between text-xs pt-3 border-t border-[#1F1F1F]">
                    <span className="text-zinc-500">Carrier Allocation Freight:</span>
                    <span className="font-mono text-emerald-400 font-semibold">
                      {formatCurrency(w.estimatedCost)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Backorder Management alert */}
          {hasBackorder && backorderItems.length > 0 && (
            <div className="bg-[#0A0A0A] border border-amber-500/30 rounded-2xl p-5 space-y-3 shadow-xl">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">
                  Automated Backorder Allocation Triggered
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/20 text-amber-400">
                  {backorderItems.length} SKU{backorderItems.length !== 1 ? 's' : ''} Backordered
                </span>
              </div>
              <div className="divide-y divide-[#1F1F1F] text-xs">
                {backorderItems.map((item, i) => (
                  <div key={item.productId || i} className="py-2.5 flex items-center justify-between">
                    <div>
                      <span className="font-semibold text-white">{item.productName}</span>
                      {item.expectedRestockDate && (
                        <p className="text-[11px] text-zinc-400">
                          Expected restock date: {item.expectedRestockDate}
                        </p>
                      )}
                    </div>
                    <span className="font-mono text-amber-400 font-bold">
                      {item.quantity} units scheduled
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Warehouse Stock Levels */}
      {activeTab === 'stock' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {Object.entries(stockByWarehouse).map(([whName, items]) => (
              <div
                key={whName}
                className="bg-[#0A0A0A] border border-[#1F1F1F] rounded-2xl p-5 space-y-4 shadow-xl"
              >
                <div className="flex items-center justify-between pb-3 border-b border-[#1F1F1F]">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-emerald-400" />
                    <h3 className="text-sm font-bold text-white">{whName}</h3>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    {items.length} SKUs
                  </span>
                </div>

                <div className="space-y-3">
                  {items.map((item) => {
                    const available = Math.max(0, item.quantityOnHand - item.quantityReserved);
                    const isLow = available <= (item.reorderPoint || 10);
                    return (
                      <div
                        key={item.id}
                        className="p-3 rounded-xl bg-[#121212] border border-[#222222] space-y-2 text-xs"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-white truncate max-w-[180px]">
                            {item.productId.startsWith('1111')
                              ? 'Enterprise Laptop Pro'
                              : item.productId.startsWith('2222')
                              ? '4K UHD Monitor 27"'
                              : `SKU-${item.productId.slice(0, 6)}`}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                              isLow
                                ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                                : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            }`}
                          >
                            {isLow ? 'LOW STOCK' : 'IN STOCK'}
                          </span>
                        </div>

                        <div className="grid grid-cols-3 gap-2 text-center pt-1 border-t border-[#1C1C1C]">
                          <div>
                            <span className="text-[10px] text-zinc-500 block">On Hand</span>
                            <span className="font-mono font-bold text-white">{item.quantityOnHand}</span>
                          </div>
                          <div>
                            <span className="text-[10px] text-zinc-500 block">Reserved</span>
                            <span className="font-mono font-bold text-amber-400">{item.quantityReserved}</span>
                          </div>
                          <div>
                            <span className="text-[10px] text-zinc-500 block">Available</span>
                            <span className="font-mono font-bold text-emerald-400">{available}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 3: Dispatched Orders History */}
      {activeTab === 'history' && (
        <div className="bg-[#0A0A0A] border border-[#1F1F1F] rounded-2xl overflow-hidden shadow-2xl">
          <div className="py-3.5 px-5 bg-[#0E0E0E] border-b border-[#1F1F1F] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-purple-400" />
              <h2 className="text-xs font-bold text-zinc-300 uppercase tracking-wider">
                Dispatched Fulfillment Orders ({fulfillmentOrders.length})
              </h2>
            </div>
            <span className="text-[11px] font-mono text-zinc-500">
              Live Dispatch Ledger & Multi-Warehouse Routing Records
            </span>
          </div>

          {fulfillmentOrders.length === 0 ? (
            <div className="p-12 text-center space-y-2">
              <Package className="w-8 h-8 text-zinc-600 mx-auto" />
              <p className="text-sm text-zinc-400 font-medium">No dispatched orders yet.</p>
              <p className="text-xs text-zinc-600">
                Accept a split allocation above to dispatch your first fulfillment order.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#1F1F1F] text-zinc-400 uppercase font-semibold text-[11px]">
                    <th className="py-3.5 px-5">Dispatch ID</th>
                    <th className="py-3.5 px-5">Order Reference</th>
                    <th className="py-3.5 px-5">Warehouse Routing</th>
                    <th className="py-3.5 px-5 text-center">Items Dispatched</th>
                    <th className="py-3.5 px-5 text-center">Mode</th>
                    <th className="py-3.5 px-5">Dispatched At</th>
                    <th className="py-3.5 px-5 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#181818]">
                  {fulfillmentOrders.map((ord) => {
                    const totalUnits = ord.splits?.reduce(
                      (acc, s) => acc + (s.quantityRequested || s.quantityFulfilled || 0),
                      0
                    ) || 0;
                    return (
                      <tr
                        key={ord.id}
                        className="hover:bg-white/[0.02] transition-colors group"
                      >
                        <td className="py-4 px-5">
                          <div className="font-mono font-bold text-white">
                            DISP-{ord.id.slice(0, 8).toUpperCase()}
                          </div>
                          <span className="text-[10px] text-zinc-500 font-mono">
                            ID: {ord.id.slice(0, 8)}...
                          </span>
                        </td>
                        <td className="py-4 px-5 font-mono text-zinc-300">
                          #{ord.orderId.slice(0, 8)}
                        </td>
                        <td className="py-4 px-5">
                          <div className="flex flex-wrap gap-1">
                            {ord.splits?.map((s, idx) => (
                              <span
                                key={idx}
                                className="px-2 py-0.5 rounded text-[10px] font-semibold bg-[#181818] border border-[#2B2B2B] text-zinc-300"
                              >
                                {s.warehouseName || 'Main Hub'} ({s.quantityFulfilled || s.quantityRequested}u)
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="py-4 px-5 text-center font-mono font-bold text-white">
                          {totalUnits} units
                        </td>
                        <td className="py-4 px-5 text-center">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                              ord.isOverride
                                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                            }`}
                          >
                            {ord.isOverride ? 'Manual Override' : 'Optimal Split'}
                          </span>
                        </td>
                        <td className="py-4 px-5 text-zinc-300 font-mono">
                          {formatDate(ord.createdAt)}
                        </td>
                        <td className="py-4 px-5 text-center">
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold border bg-emerald-500/10 text-emerald-400 border-emerald-500/20 flex items-center justify-center gap-1 w-fit mx-auto">
                            <ShieldCheck className="w-3 h-3 text-emerald-400" />
                            <span>RESERVED</span>
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
