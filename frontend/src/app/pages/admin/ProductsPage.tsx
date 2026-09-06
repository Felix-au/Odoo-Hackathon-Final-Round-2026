import { useState } from 'react';
import {
  useProducts,
  useCategories,
  useCreateProduct,
  useUpdateProduct,
  useDeleteProduct,
} from '../../../api/hooks/useCatalog';
import { LoadingSpinner } from '../../../components/feedback/LoadingSpinner';
import { formatCurrency } from '../../../lib/utils';
import { Plus, Package, Search, Pencil, Trash2, AlertTriangle, X } from 'lucide-react';
import { toast } from 'sonner';
import { Product } from '../../../types/catalog.types';

export function ProductsPage() {
  const [search, setSearch] = useState('');
  const { data: rawProducts = [], isLoading } = useProducts(search);
  const { data: rawCategories = [] } = useCategories();
  const products: Product[] = Array.isArray(rawProducts) ? rawProducts : (rawProducts as any)?.data || [];
  const categories = Array.isArray(rawCategories) ? rawCategories : (rawCategories as any)?.data || [];

  const createProductMutation = useCreateProduct();
  const updateProductMutation = useUpdateProduct();
  const deleteProductMutation = useDeleteProduct();

  // Create Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createBasePrice, setCreateBasePrice] = useState('');
  const [createCostPrice, setCreateCostPrice] = useState('');
  const [createCategoryId, setCreateCategoryId] = useState('');
  const [createDescription, setCreateDescription] = useState('');

  // Edit Modal State
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editName, setEditName] = useState('');
  const [editBasePrice, setEditBasePrice] = useState('');
  const [editCostPrice, setEditCostPrice] = useState('');
  const [editCategoryId, setEditCategoryId] = useState('');
  const [editDescription, setEditDescription] = useState('');

  // Delete Modal State
  const [deletingProduct, setDeletingProduct] = useState<Product | null>(null);

  // Handle Create Product
  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createProductMutation.mutateAsync({
        name: createName,
        categoryId: createCategoryId || categories[0]?.id || '',
        basePrice: parseFloat(createBasePrice),
        costPrice: createCostPrice ? parseFloat(createCostPrice) : undefined,
        description: createDescription || undefined,
      });
      toast.success(`Created product "${createName}". Available in Quotation Builder.`);
      setShowCreateModal(false);
      setCreateName('');
      setCreateBasePrice('');
      setCreateCostPrice('');
      setCreateDescription('');
    } catch {
      toast.error('Failed to create product');
    }
  };

  // Open Edit Modal with Pre-populated Product Values
  const handleOpenEdit = (p: Product) => {
    setEditingProduct(p);
    setEditName(p.name);
    setEditBasePrice(String(p.basePrice));
    setEditCostPrice(p.costPrice ? String(p.costPrice) : '');
    setEditCategoryId(p.categoryId || (p.category?.id ?? ''));
    setEditDescription(p.description || '');
  };

  // Handle Update Product
  const handleUpdateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;
    try {
      await updateProductMutation.mutateAsync({
        id: editingProduct.id,
        data: {
          name: editName,
          categoryId: editCategoryId || undefined,
          basePrice: parseFloat(editBasePrice),
          costPrice: editCostPrice ? parseFloat(editCostPrice) : undefined,
          description: editDescription || undefined,
        },
      });
      toast.success(`Updated product "${editName}" successfully.`);
      setEditingProduct(null);
    } catch {
      toast.error('Failed to update product specifications');
    }
  };

  // Handle Confirm Delete
  const handleConfirmDelete = async () => {
    if (!deletingProduct) return;
    try {
      await deleteProductMutation.mutateAsync(deletingProduct.id);
      toast.success(`Product "${deletingProduct.name}" removed from catalog.`);
      setDeletingProduct(null);
    } catch {
      toast.error('Failed to delete product');
    }
  };

  // Margin preview helper for modals
  const calculateMargin = (baseStr: string, costStr: string) => {
    const base = parseFloat(baseStr);
    const cost = parseFloat(costStr);
    if (!base || isNaN(base) || base <= 0) return null;
    if (isNaN(cost) || cost < 0) return null;
    return (((base - cost) / base) * 100).toFixed(1);
  };

  const createMarginPreview = calculateMargin(createBasePrice, createCostPrice);
  const editMarginPreview = calculateMargin(editBasePrice, editCostPrice);

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#1F1F1F]">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              Product Catalog Management
            </h1>
            <span className="text-[11px] font-mono font-semibold px-2.5 py-0.5 rounded-full border bg-blue-500/10 text-blue-400 border-blue-500/20">
              Master SKUs
            </span>
          </div>
          <p className="text-xs sm:text-sm text-zinc-400 mt-1">
            Define SKU items, base selling prices, unit cost baselines, and manage live catalog inventory.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/20 transition-all flex items-center gap-2 cursor-pointer self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Add New Product</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-3 bg-[#0A0A0A] rounded-2xl border border-[#1F1F1F] flex items-center gap-3 shadow-xl">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 top-2.5" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search catalog SKUs by product name or description..."
            className="w-full pl-10 pr-3.5 py-1.5 text-xs bg-[#121212] border border-[#262626] rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-400 font-sans"
          />
        </div>
        <div className="text-[11px] font-mono text-zinc-500 ml-auto hidden sm:block">
          {products.length} catalog items in registry
        </div>
      </div>

      {isLoading ? (
        <div className="py-20 flex justify-center">
          <LoadingSpinner label="Loading product catalog..." />
        </div>
      ) : (
        <div className="bg-[#0A0A0A] border border-[#1F1F1F] rounded-2xl overflow-hidden shadow-2xl">
          <div className="py-3.5 px-5 bg-[#0E0E0E] border-b border-[#1F1F1F] flex items-center justify-between">
            <span className="text-xs font-bold text-zinc-300 uppercase tracking-wider">
              Master Product Registry ({products.length})
            </span>
            <span className="text-[11px] font-mono text-zinc-500">Live Catalog Database</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-[#0A0A0A] border-b border-[#1F1F1F] text-zinc-400 uppercase font-semibold text-[11px]">
                  <th className="py-3.5 px-5">Product Name</th>
                  <th className="py-3.5 px-5">Category</th>
                  <th className="py-3.5 px-5 text-right">Base Price</th>
                  <th className="py-3.5 px-5 text-right">Unit Cost</th>
                  <th className="py-3.5 px-5 text-right">Margin Floor</th>
                  <th className="py-3.5 px-5 text-center">Status</th>
                  <th className="py-3.5 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#181818]">
                {products.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-zinc-500">
                      No products found matching your search.
                    </td>
                  </tr>
                ) : (
                  products.map((p: any) => {
                    const base = Number(p.basePrice || 0);
                    const cost = Number(p.costPrice || 0);
                    const margin = base > 0 ? ((base - cost) / base) * 100 : 0;
                    return (
                      <tr key={p.id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="py-4 px-5 font-bold text-white">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400 shrink-0">
                              <Package className="w-4 h-4 text-blue-400" />
                            </div>
                            <div>
                              <span className="text-zinc-100">{p.name}</span>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-[10px] font-mono text-zinc-500">
                                  SKU: {p.id.slice(0, 8)}
                                </span>
                                {p.description && (
                                  <>
                                    <span className="text-zinc-700">·</span>
                                    <span className="text-[10px] text-zinc-400 line-clamp-1 max-w-xs font-normal">
                                      {p.description}
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-5 text-zinc-300">
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-[#181818] text-zinc-300 border border-[#2B2B2B] font-mono">
                            {p.category?.name || 'Hardware'}
                          </span>
                        </td>
                        <td className="py-4 px-5 text-right font-mono font-bold text-white">
                          {formatCurrency(base)}
                        </td>
                        <td className="py-4 px-5 text-right font-mono text-zinc-400">
                          {formatCurrency(cost)}
                        </td>
                        <td className="py-4 px-5 text-right font-mono font-semibold text-emerald-400">
                          {margin.toFixed(1)}%
                        </td>
                        <td className="py-4 px-5 text-center">
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            Active
                          </span>
                        </td>
                        <td className="py-4 px-5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Edit Button */}
                            <button
                              type="button"
                              onClick={() => handleOpenEdit(p)}
                              title="Edit product SKU"
                              className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 border border-transparent hover:border-zinc-700 transition-all cursor-pointer"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            {/* Delete Button */}
                            <button
                              type="button"
                              onClick={() => setDeletingProduct(p)}
                              title="Delete product SKU"
                              className="p-1.5 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 transition-all cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── CREATE PRODUCT MODAL ─────────────────────────────────────── */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#121212] border border-[#242424] rounded-2xl max-w-md w-full p-6 shadow-2xl animate-in fade-in zoom-in-95 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-[#242424]">
              <div>
                <h3 className="text-base font-bold text-white">Create New Catalog Product</h3>
                <p className="text-xs text-zinc-400 mt-0.5">Add a hardware SKU, service plan, or subscription</p>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="text-zinc-500 hover:text-white p-1 rounded-lg hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateProduct} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-zinc-300 mb-1">Product SKU Name</label>
                <input
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  placeholder="e.g. Enterprise Storage Array 40TB"
                  className="w-full bg-[#0A0A0A] border border-[#2E2E2E] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-zinc-300 mb-1">Category Segment</label>
                <select
                  value={createCategoryId}
                  onChange={(e) => setCreateCategoryId(e.target.value)}
                  className="w-full bg-[#0A0A0A] border border-[#2E2E2E] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-blue-500 cursor-pointer"
                >
                  {categories.map((c: any) => (
                    <option key={c.id} value={c.id}>
                      {c.name} (Max Discount Ceiling: {c.discountCeilingPct}%)
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-zinc-300 mb-1">Base Selling Price (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={createBasePrice}
                    onChange={(e) => setCreateBasePrice(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-[#0A0A0A] border border-[#2E2E2E] rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block font-semibold text-zinc-300 mb-1">Unit Cost Price (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={createCostPrice}
                    onChange={(e) => setCreateCostPrice(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-[#0A0A0A] border border-[#2E2E2E] rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-blue-500"
                    required
                  />
                </div>
              </div>

              {/* Dynamic Live Margin Preview */}
              {createMarginPreview !== null && (
                <div className="p-2.5 rounded-xl bg-[#0D0D0F] border border-[#222222] flex items-center justify-between text-[11px] font-mono">
                  <span className="text-zinc-400">Estimated Gross Margin:</span>
                  <span
                    className={`font-bold ${
                      parseFloat(createMarginPreview) < 20 ? 'text-amber-400' : 'text-emerald-400'
                    }`}
                  >
                    {createMarginPreview}%
                  </span>
                </div>
              )}

              <div>
                <label className="block font-semibold text-zinc-300 mb-1">Description (Optional)</label>
                <textarea
                  value={createDescription}
                  onChange={(e) => setCreateDescription(e.target.value)}
                  placeholder="Provide technical specs, licensing terms, or delivery notes..."
                  rows={2}
                  className="w-full bg-[#0A0A0A] border border-[#2E2E2E] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-blue-500 resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-[#242424]">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-zinc-400 hover:text-white transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createProductMutation.isPending}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white transition-all cursor-pointer"
                >
                  {createProductMutation.isPending ? 'Saving...' : 'Save Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── EDIT PRODUCT MODAL ───────────────────────────────────────── */}
      {editingProduct && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#121212] border border-[#242424] rounded-2xl max-w-md w-full p-6 shadow-2xl animate-in fade-in zoom-in-95 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-[#242424]">
              <div>
                <h3 className="text-base font-bold text-white">Edit Catalog Product</h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Update SKU specifications, base pricing, and unit cost
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingProduct(null)}
                className="text-zinc-500 hover:text-white p-1 rounded-lg hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleUpdateProduct} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-zinc-300 mb-1">Product Name</label>
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full bg-[#0A0A0A] border border-[#2E2E2E] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-zinc-300 mb-1">Category</label>
                <select
                  value={editCategoryId}
                  onChange={(e) => setEditCategoryId(e.target.value)}
                  className="w-full bg-[#0A0A0A] border border-[#2E2E2E] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-blue-500 cursor-pointer"
                >
                  {categories.map((c: any) => (
                    <option key={c.id} value={c.id}>
                      {c.name} (Max Discount Ceiling: {c.discountCeilingPct}%)
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-zinc-300 mb-1">Base Selling Price (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editBasePrice}
                    onChange={(e) => setEditBasePrice(e.target.value)}
                    className="w-full bg-[#0A0A0A] border border-[#2E2E2E] rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block font-semibold text-zinc-300 mb-1">Unit Cost Price (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editCostPrice}
                    onChange={(e) => setEditCostPrice(e.target.value)}
                    className="w-full bg-[#0A0A0A] border border-[#2E2E2E] rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-blue-500"
                    required
                  />
                </div>
              </div>

              {/* Dynamic Live Margin Preview */}
              {editMarginPreview !== null && (
                <div className="p-2.5 rounded-xl bg-[#0D0D0F] border border-[#222222] flex items-center justify-between text-[11px] font-mono">
                  <span className="text-zinc-400">Calculated Margin Floor:</span>
                  <span
                    className={`font-bold ${
                      parseFloat(editMarginPreview) < 20 ? 'text-amber-400' : 'text-emerald-400'
                    }`}
                  >
                    {editMarginPreview}%
                  </span>
                </div>
              )}

              <div>
                <label className="block font-semibold text-zinc-300 mb-1">Description</label>
                <textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  rows={2}
                  className="w-full bg-[#0A0A0A] border border-[#2E2E2E] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-blue-500 resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-[#242424]">
                <button
                  type="button"
                  onClick={() => setEditingProduct(null)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-zinc-400 hover:text-white transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updateProductMutation.isPending}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white transition-all cursor-pointer"
                >
                  {updateProductMutation.isPending ? 'Updating...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── DELETE PRODUCT CONFIRMATION MODAL ───────────────────────── */}
      {deletingProduct && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#121212] border border-[#242424] rounded-2xl max-w-md w-full p-6 shadow-2xl animate-in fade-in zoom-in-95 space-y-4">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="w-9 h-9 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Delete Product SKU</h3>
                <p className="text-xs text-zinc-400">Catalog Registry Archival</p>
              </div>
            </div>

            <p className="text-xs text-zinc-300 leading-relaxed">
              Are you sure you want to remove <strong className="text-white font-semibold">"{deletingProduct.name}"</strong>?
              This SKU will be archived and will no longer appear in future quotation line item selectors.
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-[#242424]">
              <button
                type="button"
                onClick={() => setDeletingProduct(null)}
                className="px-4 py-2 rounded-xl text-xs font-medium text-zinc-400 hover:text-white transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={deleteProductMutation.isPending}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white transition-all cursor-pointer shadow-lg shadow-rose-500/20"
              >
                {deleteProductMutation.isPending ? 'Deleting...' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
