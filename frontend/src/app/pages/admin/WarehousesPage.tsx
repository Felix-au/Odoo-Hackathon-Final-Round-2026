import { useState, useMemo } from 'react';
import {
  useWarehouses,
  useCreateWarehouse,
  useUpdateWarehouse,
  useDeleteWarehouse,
} from '../../../api/hooks/useCatalog';
import { Warehouse } from '../../../types/catalog.types';
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
} from 'lucide-react';
import { toast } from 'sonner';

export function WarehousesPage() {
  const { data: warehouses = [], isLoading, refetch, isFetching } = useWarehouses();
  const createMutation = useCreateWarehouse();
  const updateMutation = useUpdateWarehouse();
  const deleteMutation = useDeleteWarehouse();

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingWarehouse, setEditingWarehouse] = useState<Warehouse | null>(null);

  // Form State
  const [formName, setFormName] = useState<string>('');
  const [formLocation, setFormLocation] = useState<string>('');
  const [formWeight, setFormWeight] = useState<number>(1.0);
  const [formIsActive, setFormIsActive] = useState<boolean>(true);

  // Delete Confirmation State
  const [warehouseToDelete, setWarehouseToDelete] = useState<Warehouse | null>(null);

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

  // Open Create Modal
  const handleOpenCreate = () => {
    setEditingWarehouse(null);
    setFormName('');
    setFormLocation('');
    setFormWeight(1.0);
    setFormIsActive(true);
    setIsModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (wh: Warehouse) => {
    setEditingWarehouse(wh);
    setFormName(wh.name);
    setFormLocation(wh.location || '');
    setFormWeight(wh.shippingCostWeight ?? 1.0);
    setFormIsActive(wh.isActive !== false);
    setIsModalOpen(true);
  };

  // Submit Create or Edit
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

  // Confirm Delete
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
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="p-2 bg-[#18181B] hover:bg-[#27272A] text-slate-300 hover:text-white border border-[#27272A] rounded-xl transition flex items-center gap-1.5 text-xs"
            title="Refresh network"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin text-blue-400' : ''}`} />
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

          return (
            <div
              key={wh.id}
              className={`bg-[#121214] border transition-all duration-200 rounded-2xl p-5 space-y-4 shadow-sm relative flex flex-col justify-between ${
                isActive ? 'border-[#27272A] hover:border-slate-600' : 'border-[#27272A]/50 opacity-75'
              }`}
            >
              <div className="space-y-3.5">
                {/* Top Status Badges */}
                <div className="flex items-start justify-between gap-2 pb-3 border-b border-[#27272A]">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-[#1C1C1F] border border-[#2E2E32] text-blue-400">
                      <Truck className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white tracking-tight">{wh.name}</h3>
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
                    <span className="text-slate-500">Split Algorithm Tiebreaker:</span>
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
              <div className="pt-3 border-t border-[#27272A] flex items-center justify-end gap-2">
                <button
                  onClick={() => handleOpenEdit(wh)}
                  className="px-2.5 py-1.5 rounded-lg bg-[#1F1F23] hover:bg-[#2A2A30] text-slate-300 hover:text-white border border-[#2E2E32] transition text-xs font-medium flex items-center gap-1.5"
                >
                  <Edit2 className="w-3.5 h-3.5 text-blue-400" />
                  <span>Edit</span>
                </button>

                <button
                  onClick={() => setWarehouseToDelete(wh)}
                  className="px-2.5 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 border border-red-500/20 transition text-xs font-medium flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete</span>
                </button>
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

      {/* Add / Edit Modal */}
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

      {/* Delete Confirmation Dialog */}
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
