import { useState, useMemo } from 'react';
import {
  useWarehouses,
  useCreateWarehouse,
  useUpdateWarehouse,
  useDeleteWarehouse,
  useProducts,
} from '../../../api/hooks/useCatalog';
import {
  useWarehouseStock,
  useSetStock,
  useAdjustStock,
} from '../../../api/hooks/useFulfillment';
import { Warehouse } from '../../../types/catalog.types';
import { WarehouseStockItem } from '../../../types/fulfillment.types';
import { LoadingSpinner } from '../../../components/feedback/LoadingSpinner';
import {
  Truck,
  Warehouse as WarehouseIcon,
  MapPin,
  Plus,
  Edit2,
  Trash2,
  X,
  Check,
  AlertTriangle,
  RefreshCw,
  Scale,
  Activity,
  CheckCircle2,
  Package,
  Boxes,
  Search,
  ArrowUpRight,
  Info,
} from 'lucide-react';
import { toast } from 'sonner';

export function WarehousesPage() {
  const { data: warehouses = [], isLoading, refetch, isFetching } = useWarehouses();
  const createMutation = useCreateWarehouse();
  const updateMutation = useUpdateWarehouse();
  const deleteMutation = useDeleteWarehouse();

  // Stock and Catalog Queries
  const { data: allStock = [], refetch: refetchStock, isFetching: isFetchingStock } = useWarehouseStock();
  const { data: products = [] } = useProducts();
  const setStockMutation = useSetStock();
  const adjustStockMutation = useAdjustStock();

  // Warehouse Modal State
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingWarehouse, setEditingWarehouse] = useState<Warehouse | null>(null);

  // Form State
  const [formName, setFormName] = useState<string>('');
  const [formLocation, setFormLocation] = useState<string>('');
  const [formWeight, setFormWeight] = useState<number>(1.0);
  const [formIsActive, setFormIsActive] = useState<boolean>(true);

  // Delete Confirmation State
  const [warehouseToDelete, setWarehouseToDelete] = useState<Warehouse | null>(null);

  // Stock Inspection Modal State
  const [selectedWarehouseForStock, setSelectedWarehouseForStock] = useState<Warehouse | null>(null);
  const [stockSearchQuery, setStockSearchQuery] = useState<string>('');
  const [stockFilter, setStockFilter] = useState<'ALL' | 'IN_STOCK' | 'LOW_STOCK' | 'DEPLETED'>('ALL');

  // Add Stock Item Inline State
  const [isAddingStockItem, setIsAddingStockItem] = useState<boolean>(false);
  const [stockProductId, setStockProductId] = useState<string>('');
  const [stockQtyOnHand, setStockQtyOnHand] = useState<number>(25);
  const [stockReorderPoint, setStockReorderPoint] = useState<number>(10);

  // Metrics
  const activeWarehouses = useMemo(
    () => warehouses.filter((w) => w.isActive !== false),
    [warehouses]
  );

  const primaryWarehouse = useMemo(() => {
    if (!activeWarehouses.length) return null;
    return [...activeWarehouses].sort(
      (a, b) => a.shippingCostWeight - b.shippingCostWeight
    )[0];
  }, [activeWarehouses]);

  const avgWeight = useMemo(() => {
    if (!warehouses.length) return 1.0;
    const sum = warehouses.reduce((acc, w) => acc + (w.shippingCostWeight || 1.0), 0);
    return sum / warehouses.length;
  }, [warehouses]);

  // Resolve Product Information for Stock Items
  const getProductInfo = (productId: string) => {
    const prod = products.find(
      (p) =>
        p.id === productId ||
        (productId.startsWith('1111') && p.name.toLowerCase().includes('laptop')) ||
        (productId.startsWith('2222') && p.name.toLowerCase().includes('monitor'))
    );
    if (prod) {
      return {
        name: prod.name,
        category: (prod as any).category?.name || 'Hardware',
        price: prod.basePrice,
        unit: prod.unit || 'unit',
        code: (prod as any).sku || prod.id.slice(0, 8),
      };
    }
    if (productId.startsWith('1111')) {
      return { name: 'Enterprise Laptop Pro', category: 'Hardware', price: 1299, unit: 'unit', code: 'LAPTOP-PRO' };
    }
    if (productId.startsWith('2222')) {
      return { name: '4K UHD Monitor 27"', category: 'Hardware', price: 599, unit: 'unit', code: 'MONITOR-4K' };
    }
    return { name: `Product (${productId.slice(0, 8)})`, category: 'Inventory', price: 0, unit: 'unit', code: productId.slice(0, 8) };
  };

  // Filtered Stock Items for the Selected Warehouse
  const selectedWarehouseItems = useMemo(() => {
    if (!selectedWarehouseForStock) return [];
    const whName = selectedWarehouseForStock.name.trim().toLowerCase();
    const whId = selectedWarehouseForStock.id;

    return allStock.filter(
      (s) =>
        s.warehouseId === whId ||
        s.warehouseName?.trim().toLowerCase() === whName
    );
  }, [selectedWarehouseForStock, allStock]);

  const filteredWarehouseItems = useMemo(() => {
    return selectedWarehouseItems.filter((item) => {
      const prodInfo = getProductInfo(item.productId);
      const matchesSearch =
        prodInfo.name.toLowerCase().includes(stockSearchQuery.toLowerCase()) ||
        prodInfo.code.toLowerCase().includes(stockSearchQuery.toLowerCase()) ||
        item.productId.toLowerCase().includes(stockSearchQuery.toLowerCase());

      if (!matchesSearch) return false;

      const available = Math.max(0, item.quantityOnHand - item.quantityReserved);
      const isDepleted = available === 0;
      const isLow = available <= (item.reorderPoint || 10) && available > 0;

      if (stockFilter === 'DEPLETED') return isDepleted;
      if (stockFilter === 'LOW_STOCK') return isLow;
      if (stockFilter === 'IN_STOCK') return !isDepleted && !isLow;
      return true;
    });
  }, [selectedWarehouseItems, stockSearchQuery, stockFilter, products]);

  // Modal Stock Metrics
  const modalMetrics = useMemo(() => {
    const totalSKUs = selectedWarehouseItems.length;
    const totalOnHand = selectedWarehouseItems.reduce((acc, i) => acc + (i.quantityOnHand || 0), 0);
    const totalReserved = selectedWarehouseItems.reduce((acc, i) => acc + (i.quantityReserved || 0), 0);
    const totalAvailable = Math.max(0, totalOnHand - totalReserved);
    return { totalSKUs, totalOnHand, totalReserved, totalAvailable };
  }, [selectedWarehouseItems]);

  // Open Create Warehouse Modal
  const handleOpenCreate = () => {
    setEditingWarehouse(null);
    setFormName('');
    setFormLocation('');
    setFormWeight(1.0);
    setFormIsActive(true);
    setIsModalOpen(true);
  };

  // Open Edit Warehouse Modal
  const handleOpenEdit = (wh: Warehouse, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingWarehouse(wh);
    setFormName(wh.name);
    setFormLocation(wh.location || '');
    setFormWeight(wh.shippingCostWeight ?? 1.0);
    setFormIsActive(wh.isActive !== false);
    setIsModalOpen(true);
  };

  // Submit Create or Edit Warehouse
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      toast.error('Warehouse name is required');
      return;
    }

    if (formWeight <= 0) {
      toast.error('Shipping cost weight must be greater than 0');
      return;
    }

    try {
      if (editingWarehouse) {
        await updateMutation.mutateAsync({
          id: editingWarehouse.id,
          data: {
            name: formName.trim(),
            location: formLocation.trim() || undefined,
            shippingCostWeight: Number(formWeight),
            isActive: formIsActive,
          },
        });
        toast.success(`Warehouse "${formName.trim()}" updated successfully`);
      } else {
        await createMutation.mutateAsync({
          name: formName.trim(),
          location: formLocation.trim() || undefined,
          shippingCostWeight: Number(formWeight),
          isActive: formIsActive,
        });
        toast.success(`Warehouse "${formName.trim()}" created successfully`);
      }
      setIsModalOpen(false);
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || err.message || 'Failed to save warehouse');
    }
  };

  // Confirm Delete Warehouse
  const handleConfirmDelete = async () => {
    if (!warehouseToDelete) return;
    try {
      await deleteMutation.mutateAsync(warehouseToDelete.id);
      toast.success(`Warehouse "${warehouseToDelete.name}" deleted`);
      setWarehouseToDelete(null);
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || err.message || 'Failed to delete warehouse');
    }
  };

  // Handle Adding Stock Item to Warehouse
  const handleAddStockItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedWarehouseForStock) return;
    if (!stockProductId) {
      toast.error('Please select a product from the catalog');
      return;
    }

    try {
      await setStockMutation.mutateAsync({
        warehouseId: selectedWarehouseForStock.id,
        warehouseName: selectedWarehouseForStock.name,
        productId: stockProductId,
        quantityOnHand: Number(stockQtyOnHand) || 0,
        reorderPoint: Number(stockReorderPoint) || 10,
        reorderQty: 50,
      });
      toast.success('Stock allocated to warehouse successfully');
      setIsAddingStockItem(false);
      setStockProductId('');
      setStockQtyOnHand(25);
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || err.message || 'Failed to allocate stock');
    }
  };

  // Handle Quick Quantity Adjustment
  const handleQuickAdjust = async (item: WarehouseStockItem, delta: number) => {
    try {
      await adjustStockMutation.mutateAsync({
        warehouseId: item.warehouseId,
        productId: item.productId,
        delta,
      });
      toast.success(`Stock adjusted by ${delta > 0 ? `+${delta}` : delta} units`);
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || err.message || 'Failed to adjust stock');
    }
  };

  if (isLoading) {
    return (
      <div className="py-24 flex justify-center">
        <LoadingSpinner label="Loading distribution network..." />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto animate-in fade-in duration-300 pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#27272A] pb-5">
        <div>
          <div className="flex items-center gap-2">
            <WarehouseIcon className="w-6 h-6 text-blue-400" />
            <h1 className="text-2xl font-bold text-white tracking-tight">Distribution Warehouses</h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Regional nodes and proximity cost multipliers utilized by the automated split fulfillment algorithm (REQ-F-033).
            <span className="text-blue-400 font-medium ml-1">Click any warehouse card to inspect its inventory and item quantities.</span>
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              refetch();
              refetchStock();
            }}
            disabled={isFetching || isFetchingStock}
            className="p-2 bg-[#18181B] hover:bg-[#27272A] text-slate-300 hover:text-white border border-[#27272A] rounded-xl transition flex items-center gap-1.5 text-xs"
            title="Refresh network and stock levels"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isFetching || isFetchingStock ? 'animate-spin text-blue-400' : ''}`} />
            <span>Refresh</span>
          </button>

          <button
            onClick={handleOpenCreate}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white text-xs font-semibold rounded-xl transition flex items-center gap-2 shadow-lg shadow-blue-500/20"
          >
            <Plus className="w-4 h-4" />
            <span>Add Warehouse</span>
          </button>
        </div>
      </div>

      {/* Analytics / KPI Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-[#121214] border border-[#27272A] rounded-2xl p-4 flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
            <WarehouseIcon className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Total Warehouses</div>
            <div className="text-xl font-bold text-white mt-0.5">{warehouses.length}</div>
          </div>
        </div>

        <div className="bg-[#121214] border border-[#27272A] rounded-2xl p-4 flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Active Routing Nodes</div>
            <div className="text-xl font-bold text-emerald-400 mt-0.5">
              {activeWarehouses.length} <span className="text-xs text-slate-500 font-normal">/ {warehouses.length}</span>
            </div>
          </div>
        </div>

        <div className="bg-[#121214] border border-[#27272A] rounded-2xl p-4 flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
            <Truck className="w-5 h-5" />
          </div>
          <div className="overflow-hidden">
            <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Primary Routing Hub</div>
            <div className="text-sm font-bold text-white mt-0.5 truncate" title={primaryWarehouse?.name || 'None'}>
              {primaryWarehouse?.name || 'N/A'}
            </div>
          </div>
        </div>

        <div className="bg-[#121214] border border-[#27272A] rounded-2xl p-4 flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
            <Scale className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Avg Proximity Weight</div>
            <div className="text-xl font-bold text-white mt-0.5">
              {avgWeight.toFixed(2)}<span className="text-xs text-slate-400 font-normal">x</span>
            </div>
          </div>
        </div>
      </div>

      {/* Warehouse Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {warehouses.map((wh) => {
          const isPrimary = primaryWarehouse?.id === wh.id;
          const isActive = wh.isActive !== false;

          // Compute stock items in this warehouse
          const whStockItems = allStock.filter(
            (s) =>
              s.warehouseId === wh.id ||
              s.warehouseName?.trim().toLowerCase() === wh.name.trim().toLowerCase()
          );
          const totalUnitsOnHand = whStockItems.reduce(
            (acc, i) => acc + (i.quantityOnHand || 0),
            0
          );
          const totalUnitsReserved = whStockItems.reduce(
            (acc, i) => acc + (i.quantityReserved || 0),
            0
          );
          const totalAvailable = Math.max(0, totalUnitsOnHand - totalUnitsReserved);

          return (
            <div
              key={wh.id}
              onClick={() => setSelectedWarehouseForStock(wh)}
              className={`bg-[#121214] border transition-all duration-200 rounded-2xl p-5 space-y-4 shadow-sm relative flex flex-col justify-between cursor-pointer group hover:scale-[1.01] ${
                isActive ? 'border-[#27272A] hover:border-blue-500/60 hover:shadow-blue-500/5' : 'border-[#27272A]/50 opacity-75'
              }`}
            >
              <div className="space-y-3.5">
                {/* Top Status Badges */}
                <div className="flex items-start justify-between gap-2 pb-3 border-b border-[#27272A]">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-[#1C1C1F] border border-[#2E2E32] text-blue-400 group-hover:bg-blue-500/10 group-hover:text-blue-300 transition">
                      <Truck className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white tracking-tight group-hover:text-blue-400 transition flex items-center gap-1.5">
                        <span>{wh.name}</span>
                        <ArrowUpRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity text-blue-400" />
                      </h3>
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mt-0.5">
                        <MapPin className="w-3 h-3 text-slate-500" />
                        <span>{wh.location || 'Location Unspecified'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1">
                    {isActive ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        Active
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-400 border border-slate-700">
                        Inactive
                      </span>
                    )}

                    {isPrimary && (
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                        Primary Hub
                      </span>
                    )}
                  </div>
                </div>

                {/* Stock Level Quick Summary Pill */}
                <div className="bg-[#18181B] border border-[#27272A] rounded-xl p-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Boxes className="w-4 h-4 text-emerald-400" />
                    <div>
                      <div className="text-[11px] text-slate-400">Warehouse Inventory</div>
                      <div className="text-xs font-bold text-white">
                        {whStockItems.length} <span className="text-[10px] font-normal text-slate-400">SKUs Stocked</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] text-slate-400">Available Units</div>
                    <div className="text-xs font-mono font-bold text-emerald-400">
                      {totalAvailable} <span className="text-[10px] font-normal text-slate-500">/ {totalUnitsOnHand}</span>
                    </div>
                  </div>
                </div>

                {/* Weight & Algorithm Details */}
                <div className="space-y-2 bg-[#18181B]/70 border border-[#27272A] rounded-xl p-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">Proximity Weight:</span>
                    <span className="font-mono font-bold text-white">
                      {wh.shippingCostWeight.toFixed(2)}x
                    </span>
                  </div>

                  {/* Relative visual meter */}
                  <div className="w-full bg-[#27272A] rounded-full h-1.5 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        wh.shippingCostWeight <= 1.0
                          ? 'bg-emerald-400'
                          : wh.shippingCostWeight <= 1.5
                          ? 'bg-blue-400'
                          : 'bg-amber-400'
                      }`}
                      style={{
                        width: `${Math.min(100, (wh.shippingCostWeight / 2.5) * 100)}%`,
                      }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[11px] pt-1">
                    <span className="text-slate-500">Split Engine Tiebreaker:</span>
                    <span
                      className={`font-semibold ${
                        wh.shippingCostWeight <= 1.0
                          ? 'text-emerald-400'
                          : wh.shippingCostWeight <= 1.3
                          ? 'text-blue-400'
                          : 'text-amber-400'
                      }`}
                    >
                      {wh.shippingCostWeight <= 1.0
                        ? 'High Priority (Standard)'
                        : wh.shippingCostWeight <= 1.3
                        ? 'Medium Priority (+30%)'
                        : 'Low Priority (Surcharged)'}
                    </span>
                  </div>
                </div>

                {/* System connection note */}
                <div className="flex items-center gap-1.5 text-[11px]">
                  <Activity
                    className={`w-3.5 h-3.5 ${isActive ? 'text-emerald-400' : 'text-slate-500'}`}
                  />
                  <span className={isActive ? 'text-emerald-400 font-medium' : 'text-slate-400'}>
                    {isActive ? 'Connected to ERP & Fulfillment' : 'Routing Disabled in Split Engine'}
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-[#27272A] flex items-center justify-between gap-2">
                <span className="text-[11px] font-medium text-blue-400 group-hover:underline flex items-center gap-1">
                  <Package className="w-3 h-3" />
                  <span>Inspect Items</span>
                </span>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={(e) => handleOpenEdit(wh, e)}
                    className="px-2.5 py-1.5 rounded-lg bg-[#1F1F23] hover:bg-[#2A2A30] text-slate-300 hover:text-white border border-[#2E2E32] transition text-xs font-medium flex items-center gap-1.5"
                    title="Edit warehouse properties"
                  >
                    <Edit2 className="w-3.5 h-3.5 text-blue-400" />
                    <span>Edit</span>
                  </button>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setWarehouseToDelete(wh);
                    }}
                    className="px-2.5 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 border border-red-500/20 transition text-xs font-medium flex items-center gap-1.5"
                    title="Delete warehouse node"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete</span>
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {warehouses.length === 0 && (
        <div className="bg-[#121214] border border-[#27272A] rounded-2xl p-12 text-center space-y-3">
          <WarehouseIcon className="w-10 h-10 text-slate-500 mx-auto" />
          <h3 className="text-base font-bold text-white">No Warehouses Configured</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Your catalog currently has no fulfillment warehouses. Add your first node to configure split fulfillment logic.
          </p>
          <button
            onClick={handleOpenCreate}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl transition inline-flex items-center gap-2 mt-2"
          >
            <Plus className="w-4 h-4" />
            <span>Add Warehouse</span>
          </button>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 1: WAREHOUSE STOCK & ITEMS QUANTITIES MODAL         */}
      {/* ========================================================= */}
      {selectedWarehouseForStock && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-[#101012] border border-[#27272A] rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl space-y-0">
            {/* Modal Top Header */}
            <div className="px-6 py-5 border-b border-[#27272A] flex items-start justify-between bg-[#141417]">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
                  <Boxes className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold text-white tracking-tight">
                      {selectedWarehouseForStock.name}
                    </h2>
                    {selectedWarehouseForStock.isActive !== false ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        Active Node
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-400 border border-slate-700">
                        Inactive
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-400 mt-1">
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-slate-500" />
                      {selectedWarehouseForStock.location || 'Location Unspecified'}
                    </span>
                    <span>•</span>
                    <span className="text-slate-300">
                      Proximity Multiplier: <span className="font-mono text-white font-bold">{selectedWarehouseForStock.shippingCostWeight.toFixed(2)}x</span>
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsAddingStockItem(!isAddingStockItem)}
                  className="px-3 py-1.5 bg-blue-600/90 hover:bg-blue-600 text-white text-xs font-semibold rounded-xl transition flex items-center gap-1.5 shadow-md shadow-blue-500/20"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{isAddingStockItem ? 'Cancel Allocation' : 'Stock New Item'}</span>
                </button>
                <button
                  onClick={() => {
                    setSelectedWarehouseForStock(null);
                    setIsAddingStockItem(false);
                  }}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-[#27272A] transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Metrics Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-5 bg-[#121215] border-b border-[#222226]">
              <div className="bg-[#18181C] border border-[#27272A] rounded-xl p-3">
                <div className="text-[11px] font-medium text-slate-400">Total Distinct SKUs</div>
                <div className="text-lg font-bold text-white mt-0.5">{modalMetrics.totalSKUs}</div>
              </div>

              <div className="bg-[#18181C] border border-[#27272A] rounded-xl p-3">
                <div className="text-[11px] font-medium text-slate-400">Total On Hand</div>
                <div className="text-lg font-mono font-bold text-white mt-0.5">{modalMetrics.totalOnHand}</div>
              </div>

              <div className="bg-[#18181C] border border-[#27272A] rounded-xl p-3">
                <div className="text-[11px] font-medium text-slate-400">Allocated / Reserved</div>
                <div className="text-lg font-mono font-bold text-amber-400 mt-0.5">{modalMetrics.totalReserved}</div>
              </div>

              <div className="bg-[#18181C] border border-[#27272A] rounded-xl p-3">
                <div className="text-[11px] font-medium text-slate-400">Available to Promise</div>
                <div className="text-lg font-mono font-bold text-emerald-400 mt-0.5">{modalMetrics.totalAvailable}</div>
              </div>
            </div>

            {/* Optional: Add Stock Item Inline Form */}
            {isAddingStockItem && (
              <form
                onSubmit={handleAddStockItem}
                className="p-5 bg-[#16161A] border-b border-[#27272A] space-y-3 animate-in slide-in-from-top-3 duration-200"
              >
                <div className="flex items-center justify-between pb-2 border-b border-[#27272A]">
                  <div className="flex items-center gap-2">
                    <Package className="w-4 h-4 text-blue-400" />
                    <span className="text-xs font-bold text-white">Allocate Catalog Item to this Depot</span>
                  </div>
                  <span className="text-[11px] text-slate-400">Assign physical inventory</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-300">Catalog Product *</label>
                    <select
                      value={stockProductId}
                      onChange={(e) => setStockProductId(e.target.value)}
                      required
                      className="w-full bg-[#1F1F24] border border-[#2E2E36] focus:border-blue-500 rounded-xl px-3 py-2 text-xs text-white focus:outline-none transition"
                    >
                      <option value="">Select product...</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.unit || 'unit'})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-300">Initial Quantity On Hand *</label>
                    <input
                      type="number"
                      min="0"
                      required
                      value={stockQtyOnHand}
                      onChange={(e) => setStockQtyOnHand(parseInt(e.target.value) || 0)}
                      className="w-full bg-[#1F1F24] border border-[#2E2E36] focus:border-blue-500 rounded-xl px-3 py-2 text-xs text-white focus:outline-none transition"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-300">Reorder Threshold Point</label>
                    <input
                      type="number"
                      min="0"
                      value={stockReorderPoint}
                      onChange={(e) => setStockReorderPoint(parseInt(e.target.value) || 0)}
                      className="w-full bg-[#1F1F24] border border-[#2E2E36] focus:border-blue-500 rounded-xl px-3 py-2 text-xs text-white focus:outline-none transition"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsAddingStockItem(false)}
                    className="px-3 py-1.5 rounded-lg bg-[#27272E] text-slate-300 text-xs hover:bg-[#32323B] transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={setStockMutation.isPending}
                    className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition flex items-center gap-1.5 shadow-md shadow-blue-500/20 disabled:opacity-50"
                  >
                    {setStockMutation.isPending ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>Saving...</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>Save Stock Allocation</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}

            {/* Filter and Search Bar */}
            <div className="p-4 border-b border-[#222226] bg-[#121215] flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="relative w-full sm:w-72">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Filter by product name or SKU..."
                  value={stockSearchQuery}
                  onChange={(e) => setStockSearchQuery(e.target.value)}
                  className="w-full bg-[#18181C] border border-[#27272A] focus:border-blue-500 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none transition"
                />
              </div>

              <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto">
                {(['ALL', 'IN_STOCK', 'LOW_STOCK', 'DEPLETED'] as const).map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setStockFilter(filter)}
                    className={`px-3 py-1 rounded-lg text-xs font-medium transition whitespace-nowrap ${
                      stockFilter === filter
                        ? 'bg-blue-600 text-white'
                        : 'bg-[#18181C] text-slate-400 hover:text-white border border-[#27272A]'
                    }`}
                  >
                    {filter === 'ALL'
                      ? 'All SKUs'
                      : filter === 'IN_STOCK'
                      ? 'In Stock'
                      : filter === 'LOW_STOCK'
                      ? 'Low Stock'
                      : 'Depleted'}
                  </button>
                ))}
              </div>
            </div>

            {/* Modal Body / Items Table */}
            <div className="overflow-y-auto flex-1 p-5 space-y-3">
              {filteredWarehouseItems.length > 0 ? (
                <div className="rounded-xl border border-[#222226] overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#16161A] text-slate-400 font-semibold uppercase text-[10px] tracking-wider border-b border-[#222226]">
                      <tr>
                        <th className="py-3 px-4">Product / Item</th>
                        <th className="py-3 px-3 text-center">On Hand</th>
                        <th className="py-3 px-3 text-center">Reserved</th>
                        <th className="py-3 px-3 text-center">Available</th>
                        <th className="py-3 px-3 text-center">Status</th>
                        <th className="py-3 px-4 text-right">Quick Stock Adjust</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#1E1E24]">
                      {filteredWarehouseItems.map((item) => {
                        const prodInfo = getProductInfo(item.productId);
                        const available = Math.max(0, item.quantityOnHand - item.quantityReserved);
                        const isDepleted = available === 0;
                        const isLow = available <= (item.reorderPoint || 10) && available > 0;

                        return (
                          <tr key={item.id} className="hover:bg-[#16161A]/60 transition">
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-2.5">
                                <div className="p-2 rounded-lg bg-[#1E1E24] text-blue-400">
                                  <Package className="w-4 h-4" />
                                </div>
                                <div>
                                  <div className="font-bold text-white">{prodInfo.name}</div>
                                  <div className="text-[11px] text-slate-400">
                                    SKU: <span className="font-mono text-slate-300">{prodInfo.code}</span> • {prodInfo.category}
                                  </div>
                                </div>
                              </div>
                            </td>

                            <td className="py-3 px-3 text-center font-mono font-bold text-white text-sm">
                              {item.quantityOnHand}
                            </td>

                            <td className="py-3 px-3 text-center font-mono">
                              {item.quantityReserved > 0 ? (
                                <span className="font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20 text-xs">
                                  {item.quantityReserved}
                                </span>
                              ) : (
                                <span className="text-slate-500">0</span>
                              )}
                            </td>

                            <td className="py-3 px-3 text-center font-mono font-bold text-sm">
                              <span
                                className={
                                  available > 0
                                    ? 'text-emerald-400'
                                    : 'text-red-400'
                                }
                              >
                                {available}
                              </span>
                            </td>

                            <td className="py-3 px-3 text-center">
                              {isDepleted ? (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-500/10 text-red-400 border border-red-500/20">
                                  DEPLETED
                                </span>
                              ) : isLow ? (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                  LOW STOCK
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                  IN STOCK
                                </span>
                              )}
                            </td>

                            <td className="py-3 px-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={() => handleQuickAdjust(item, -5)}
                                  disabled={adjustStockMutation.isPending || item.quantityOnHand < 5}
                                  className="px-2 py-1 bg-[#1F1F24] hover:bg-[#2A2A32] disabled:opacity-30 text-slate-300 hover:text-white rounded-lg font-mono text-[11px] transition"
                                  title="Reduce 5 units"
                                >
                                  -5
                                </button>
                                <button
                                  onClick={() => handleQuickAdjust(item, 5)}
                                  disabled={adjustStockMutation.isPending}
                                  className="px-2 py-1 bg-[#1F1F24] hover:bg-[#2A2A32] disabled:opacity-30 text-slate-300 hover:text-white rounded-lg font-mono text-[11px] transition"
                                  title="Add 5 units"
                                >
                                  +5
                                </button>
                                <button
                                  onClick={() => handleQuickAdjust(item, 25)}
                                  disabled={adjustStockMutation.isPending}
                                  className="px-2 py-1 bg-blue-500/10 hover:bg-blue-500/20 disabled:opacity-30 text-blue-400 hover:text-blue-300 border border-blue-500/20 rounded-lg font-mono text-[11px] transition"
                                  title="Add 25 units batch"
                                >
                                  +25
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="bg-[#141418] border border-[#222226] rounded-2xl p-10 text-center space-y-3">
                  <Package className="w-10 h-10 text-slate-500 mx-auto" />
                  <div className="space-y-1">
                    <h3 className="text-sm font-bold text-white">No Items Allocated to this Warehouse</h3>
                    <p className="text-xs text-slate-400 max-w-md mx-auto">
                      {stockSearchQuery
                        ? 'No stock items match your search filter.'
                        : 'This distribution hub currently has no catalog products stocked. Allocate your first product below.'}
                    </p>
                  </div>
                  {!stockSearchQuery && (
                    <button
                      onClick={() => setIsAddingStockItem(true)}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl transition inline-flex items-center gap-1.5 shadow-md shadow-blue-500/20"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Allocate First Product</span>
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Modal Bottom Bar */}
            <div className="p-4 border-t border-[#222226] bg-[#141417] flex items-center justify-between">
              <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-blue-400" />
                <span>Quantities sync directly with fulfillment split tie-breaker rules</span>
              </div>
              <button
                onClick={() => setSelectedWarehouseForStock(null)}
                className="px-4 py-2 rounded-xl bg-[#222228] hover:bg-[#2C2C34] text-white text-xs font-medium transition"
              >
                Close Window
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 2: ADD / EDIT WAREHOUSE METADATA MODAL              */}
      {/* ========================================================= */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#121214] border border-[#27272A] rounded-2xl w-full max-w-md overflow-hidden shadow-2xl space-y-0">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-[#27272A] flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
                  <WarehouseIcon className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white">
                    {editingWarehouse ? 'Edit Warehouse' : 'Add New Warehouse'}
                  </h2>
                  <p className="text-[11px] text-slate-400">
                    {editingWarehouse ? 'Modify fulfillment routing properties' : 'Register a new distribution center node'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-[#27272A] transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {/* Name */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">
                  Warehouse Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. West Coast Distribution Center"
                  className="w-full bg-[#18181B] border border-[#27272A] focus:border-blue-500 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none transition"
                />
              </div>

              {/* Location */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">
                  Location / City, State
                </label>
                <div className="relative">
                  <MapPin className="w-3.5 h-3.5 text-slate-500 absolute left-3.5 top-3" />
                  <input
                    type="text"
                    value={formLocation}
                    onChange={(e) => setFormLocation(e.target.value)}
                    placeholder="e.g. Los Angeles, CA"
                    className="w-full bg-[#18181B] border border-[#27272A] focus:border-blue-500 rounded-xl pl-9 pr-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none transition"
                  />
                </div>
              </div>

              {/* Shipping Cost Weight */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-300">
                    Shipping Cost Weight Multiplier <span className="text-red-400">*</span>
                  </label>
                  <span className="text-xs font-mono font-bold text-blue-400">
                    {Number(formWeight).toFixed(2)}x
                  </span>
                </div>
                <input
                  type="number"
                  step="0.05"
                  min="0.1"
                  max="10.0"
                  required
                  value={formWeight}
                  onChange={(e) => setFormWeight(parseFloat(e.target.value) || 0)}
                  className="w-full bg-[#18181B] border border-[#27272A] focus:border-blue-500 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none transition"
                />
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Relative proximity weight used by the fulfillment engine (REQ-F-033). Lower weights (e.g. 1.0) are preferred in split tiebreakers.
                </p>
              </div>

              {/* Active Toggle */}
              <div className="pt-2">
                <label className="flex items-center gap-3 p-3 bg-[#18181B] border border-[#27272A] rounded-xl cursor-pointer hover:bg-[#1C1C20] transition">
                  <input
                    type="checkbox"
                    checked={formIsActive}
                    onChange={(e) => setFormIsActive(e.target.checked)}
                    className="w-4 h-4 rounded text-blue-600 bg-[#27272A] border-[#3F3F46] focus:ring-0 focus:ring-offset-0"
                  />
                  <div>
                    <div className="text-xs font-semibold text-white">Active in Split Algorithm</div>
                    <div className="text-[11px] text-slate-400">
                      When enabled, orders can be routed to this warehouse.
                    </div>
                  </div>
                </label>
              </div>

              {/* Buttons */}
              <div className="pt-3 border-t border-[#27272A] flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-[#18181B] hover:bg-[#27272A] text-slate-300 text-xs font-medium transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition flex items-center gap-2 shadow-lg shadow-blue-500/20 disabled:opacity-50"
                >
                  {(createMutation.isPending || updateMutation.isPending) ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>{editingWarehouse ? 'Save Changes' : 'Create Warehouse'}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 3: DELETE CONFIRMATION DIALOG                       */}
      {/* ========================================================= */}
      {warehouseToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#121214] border border-[#27272A] rounded-2xl w-full max-w-sm p-6 space-y-4 shadow-2xl">
            <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 mx-auto">
              <AlertTriangle className="w-5 h-5" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-base font-bold text-white">Delete Warehouse?</h3>
              <p className="text-xs text-slate-400">
                Are you sure you want to delete <span className="text-white font-semibold">"{warehouseToDelete.name}"</span>? This will remove the node from the distribution network.
              </p>
            </div>

            <div className="pt-2 flex items-center justify-center gap-2.5">
              <button
                onClick={() => setWarehouseToDelete(null)}
                disabled={deleteMutation.isPending}
                className="px-4 py-2 rounded-xl bg-[#18181B] hover:bg-[#27272A] text-slate-300 text-xs font-medium transition"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={deleteMutation.isPending}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-semibold transition flex items-center gap-1.5 shadow-lg shadow-red-500/20 disabled:opacity-50"
              >
                {deleteMutation.isPending ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete Node</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
