import { useState } from 'react';
import { useProducts, useCategories, useCreateProduct } from '../../../api/hooks/useCatalog';
import { LoadingSpinner } from '../../../components/feedback/LoadingSpinner';
import { formatCurrency } from '../../../lib/utils';
import { Plus, Package, Search } from 'lucide-react';
import { toast } from 'sonner';

export function ProductsPage() {
  const [search, setSearch] = useState('');
  const { data: rawProducts = [], isLoading } = useProducts(search);
  const { data: rawCategories = [] } = useCategories();
  const products = Array.isArray(rawProducts) ? rawProducts : (rawProducts as any)?.data || [];
  const categories = Array.isArray(rawCategories) ? rawCategories : (rawCategories as any)?.data || [];
  const createProductMutation = useCreateProduct();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [name, setName] = useState('');
  const [basePrice, setBasePrice] = useState('');
  const [costPrice, setCostPrice] = useState('');
  const [categoryId, setCategoryId] = useState('');

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createProductMutation.mutateAsync({
        name,
        categoryId: categoryId || categories[0]?.id || '',
        basePrice: parseFloat(basePrice),
        costPrice: costPrice ? parseFloat(costPrice) : undefined,
      });
      toast.success(`Created product "${name}". Instantly available in Quotation Builder.`);
      setShowCreateModal(false);
      setName('');
      setBasePrice('');
      setCostPrice('');
    } catch {
      toast.error('Failed to create product');
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Product Catalog Management</h1>
          <p className="text-xs text-slate-400 mt-0.5">Define SKUs, base pricing, unit costs, and category discount ceilings</p>
        </div>

        <button
          type="button"
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/20 transition-all flex items-center gap-1.5 self-start sm:self-auto"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Create Product</span>
        </button>
      </div>

      <div className="p-3 bg-[#12151C] rounded-2xl border border-[#1E2430] flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search catalog by name..."
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-[#101319] border border-[#1E2430] rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="py-20 flex justify-center">
          <LoadingSpinner label="Loading product catalog..." />
        </div>
      ) : (
        <div className="bg-[#12151C] border border-[#1E2430] rounded-2xl overflow-hidden shadow-sm">
          <div className="py-3.5 px-5 bg-[#101319] border-b border-[#1E2430] flex items-center justify-between">
            <span className="text-xs font-bold text-white">Master Product Inventory ({products.length})</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-[#101319] border-b border-[#1E2430] text-slate-400 uppercase font-semibold text-[11px]">
                  <th className="py-3 px-5">Product Name</th>
                  <th className="py-3 px-5">Category</th>
                  <th className="py-3 px-5 text-right">Base Price</th>
                  <th className="py-3 px-5 text-right">Unit Cost</th>
                  <th className="py-3 px-5 text-right">Margin Floor</th>
                  <th className="py-3 px-5 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1A202C]">
                {products.map((p: any) => {
                  const base = Number(p.basePrice);
                  const cost = Number(p.costPrice);
                  const margin = base > 0 ? ((base - cost) / base) * 100 : 0;
                  return (
                    <tr key={p.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="py-3.5 px-5 font-bold text-white">
                        <div className="flex items-center gap-2.5">
                          <Package className="w-4 h-4 text-slate-500" />
                          <span>{p.name}</span>
                        </div>
                        {p.description && <div className="text-[10px] text-slate-400 font-normal mt-0.5">{p.description}</div>}
                      </td>
                      <td className="py-3.5 px-5 text-slate-300">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#1C222E] text-slate-300 border border-[#2A3445]">
                          {p.category?.name || 'Hardware'}
                        </span>
                      </td>
                      <td className="py-3.5 px-5 text-right font-mono font-bold text-white">{formatCurrency(p.basePrice)}</td>
                      <td className="py-3.5 px-5 text-right font-mono text-slate-400">{formatCurrency(p.costPrice)}</td>
                      <td className="py-3.5 px-5 text-right font-mono font-bold text-emerald-400">{margin.toFixed(1)}%</td>
                      <td className="py-3.5 px-5 text-center">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                          Active
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create Product Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#161B24] border border-[#283244] rounded-2xl max-w-md w-full p-6 shadow-2xl animate-in fade-in zoom-in-95 space-y-4">
            <h3 className="text-base font-bold text-white">Create New Catalog Product</h3>
            <p className="text-xs text-slate-400">Add a hardware SKU, service plan, or recurring subscription</p>

            <form onSubmit={handleCreateProduct} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-300 mb-1">Product Name</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Enterprise Storage Array 40TB"
                  className="w-full bg-[#101319] border border-[#283244] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">Category</label>
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="w-full bg-[#101319] border border-[#283244] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-blue-500"
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
                  <label className="block font-semibold text-slate-300 mb-1">Base Selling Price (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={basePrice}
                    onChange={(e) => setBasePrice(e.target.value)}
                    className="w-full bg-[#101319] border border-[#283244] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Unit Cost Price (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={costPrice}
                    onChange={(e) => setCostPrice(e.target.value)}
                    className="w-full bg-[#101319] border border-[#283244] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                    required
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white"
                >
                  Save Product
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
