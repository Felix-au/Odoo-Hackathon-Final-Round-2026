import { useState } from 'react';
import { useProducts, useCategories, useCreateProduct } from '../../api/hooks/useCatalog';
import { LoadingSpinner } from '../../components/feedback/LoadingSpinner';
import { formatCurrency } from '../../lib/utils';
import { Plus, Package, Search, RefreshCw, AlertCircle, Layers } from 'lucide-react';
import { toast } from 'sonner';

export function CatalogPage() {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const { data: rawProducts = [], isLoading, isError, error, refetch } = useProducts(search);
  const { data: rawCategories = [] } = useCategories();
  const products = Array.isArray(rawProducts) ? rawProducts : (rawProducts as any)?.data || [];
  const categories = Array.isArray(rawCategories) ? rawCategories : (rawCategories as any)?.data || [];
  const createProductMutation = useCreateProduct();

  // Create Product Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [name, setName] = useState('');
  const [basePrice, setBasePrice] = useState('');
  const [costPrice, setCostPrice] = useState('');
  const [taxRate, setTaxRate] = useState('18');
  const [unit, setUnit] = useState('UNIT');
  const [categoryId, setCategoryId] = useState('');
  const [description, setDescription] = useState('');

  const filteredProducts = products.filter((p: any) => {
    if (selectedCategory === 'ALL') return true;
    return p.categoryId === selectedCategory;
  });

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const targetCatId = categoryId || (categories[0]?.id ?? '');
      await createProductMutation.mutateAsync({
        name,
        categoryId: targetCatId,
        basePrice: parseFloat(basePrice),
        costPrice: costPrice ? parseFloat(costPrice) : undefined,
        taxRate: taxRate ? parseFloat(taxRate) : 18,
        unit,
        description,
      });
      toast.success(`Created product "${name}" in catalog.`);
      setShowCreateModal(false);
      setName('');
      setBasePrice('');
      setCostPrice('');
      setDescription('');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create product';
      toast.error(msg);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Product & Service Catalog</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Hardware SKUs, services, and subscription plans (Catalog Service — Port 3002)
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isLoading}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-[#1C222E] hover:bg-[#252E3E] text-slate-200 border border-[#2A3445] transition-colors flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-blue-400 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/20 transition-all flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Product</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-3 bg-[#12151C] rounded-2xl border border-[#1E2430] flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search catalog by product name..."
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-[#101319] border border-[#1E2430] rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <Layers className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-xs font-semibold text-slate-300">Category:</span>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="text-xs font-semibold bg-[#101319] border border-[#283244] rounded-xl px-3 py-1.5 text-slate-200 focus:outline-none focus:border-blue-500"
          >
            <option value="ALL">All Categories ({categories.length})</option>
            {categories.map((c: any) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Content Rendering */}
      {isLoading ? (
        <div className="py-20 flex justify-center">
          <LoadingSpinner label="Loading products from Catalog database..." />
        </div>
      ) : isError ? (
        <div className="p-8 bg-[#12151C] rounded-2xl border border-red-500/30 text-center space-y-3">
          <AlertCircle className="w-8 h-8 text-red-400 mx-auto" />
          <h3 className="text-base font-bold text-white">Unable to Connect to Catalog Service</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            {error?.message || 'Failed to fetch catalog items from http://localhost:3002/catalog/products.'}
          </p>
          <button
            type="button"
            onClick={() => refetch()}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-[#1C222E] hover:bg-[#252E3E] text-slate-200 border border-[#2A3445]"
          >
            Retry Connection
          </button>
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="py-16 text-center text-xs text-slate-500 bg-[#12151C] rounded-2xl border border-[#1E2430]">
          {search ? 'No products match your search query.' : 'The product catalog database contains no items yet.'}
        </div>
      ) : (
        <div className="bg-[#12151C] border border-[#1E2430] rounded-2xl overflow-hidden shadow-sm">
          <div className="py-3.5 px-5 bg-[#101319] border-b border-[#1E2430] flex items-center justify-between">
            <div className="text-xs font-bold text-white flex items-center gap-2">
              <Package className="w-4 h-4 text-slate-400" />
              <span>Active Catalog Inventory ({filteredProducts.length} items)</span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-[#101319] border-b border-[#1E2430] text-slate-400 uppercase font-semibold text-[11px]">
                  <th className="py-3 px-5">Product SKU</th>
                  <th className="py-3 px-5">Category</th>
                  <th className="py-3 px-5 text-right">Base Price</th>
                  <th className="py-3 px-5 text-right">Unit Cost</th>
                  <th className="py-3 px-5 text-right">Margin</th>
                  <th className="py-3 px-5 text-center">Tax Rate</th>
                  <th className="py-3 px-5 text-center">Unit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1A202C]">
                {filteredProducts.map((p: any) => {
                  const base = Number(p.basePrice) || 0;
                  const cost = Number(p.costPrice) || 0;
                  const margin = base > 0 ? ((base - cost) / base) * 100 : 0;
                  return (
                    <tr key={p.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="py-3.5 px-5 font-bold text-white">
                        <div className="flex items-center gap-2.5">
                          <Package className="w-4 h-4 text-slate-500 shrink-0" />
                          <span>{p.name}</span>
                        </div>
                        {p.description && (
                          <div className="text-[10px] text-slate-400 font-normal mt-0.5 max-w-sm truncate">
                            {p.description}
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-5 text-slate-300">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#1C222E] text-slate-300 border border-[#2A3445]">
                          {p.category?.name || 'General'}
                        </span>
                      </td>
                      <td className="py-3.5 px-5 text-right font-mono font-bold text-white">
                        {formatCurrency(p.basePrice)}
                      </td>
                      <td className="py-3.5 px-5 text-right font-mono text-slate-400">
                        {p.costPrice !== undefined ? formatCurrency(p.costPrice) : '—'}
                      </td>
                      <td className="py-3.5 px-5 text-right font-mono font-bold text-emerald-400">
                        {margin > 0 ? `${margin.toFixed(1)}%` : '—'}
                      </td>
                      <td className="py-3.5 px-5 text-center text-slate-300">
                        {p.taxRate !== undefined ? `${p.taxRate}%` : '18%'}
                      </td>
                      <td className="py-3.5 px-5 text-center text-[10px] font-mono text-slate-400 uppercase">
                        {p.unit || 'UNIT'}
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
            <h3 className="text-base font-bold text-white">Create Real Catalog Product</h3>
            <p className="text-xs text-slate-400">
              Persists directly to the Catalog service PostgreSQL database
            </p>

            <form onSubmit={handleCreateProduct} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-300 mb-1">Product Name *</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Enterprise Storage Array 40TB"
                  className="w-full bg-[#101319] border border-[#283244] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">Category *</label>
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="w-full bg-[#101319] border border-[#283244] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="">Select Category</option>
                  {categories.map((c: any) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Base Price (₹) *</label>
                  <input
                    type="number"
                    step="0.01"
                    value={basePrice}
                    onChange={(e) => setBasePrice(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-[#101319] border border-[#283244] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Unit Cost (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={costPrice}
                    onChange={(e) => setCostPrice(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-[#101319] border border-[#283244] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Tax Rate (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={taxRate}
                    onChange={(e) => setTaxRate(e.target.value)}
                    placeholder="18"
                    className="w-full bg-[#101319] border border-[#283244] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Billing Unit</label>
                  <select
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    className="w-full bg-[#101319] border border-[#283244] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="UNIT">UNIT</option>
                    <option value="HOUR">HOUR</option>
                    <option value="MONTH">MONTH</option>
                    <option value="YEAR">YEAR</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  placeholder="Hardware specs or service description..."
                  className="w-full bg-[#101319] border border-[#283244] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                />
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
                  disabled={createProductMutation.isPending}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white transition-colors disabled:opacity-50"
                >
                  {createProductMutation.isPending ? 'Saving...' : 'Save to Database'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
