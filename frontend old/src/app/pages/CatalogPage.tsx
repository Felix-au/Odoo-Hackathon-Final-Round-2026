import { useState } from 'react';
import { useProducts, useCategories, useCreateProduct } from '../../api/hooks/useCatalog';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Dialog } from '../../components/ui/Dialog';
import { Input } from '../../components/ui/Input';
import { LoadingSpinner } from '../../components/feedback/LoadingSpinner';
import { EmptyState } from '../../components/feedback/EmptyState';
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
    <div className="space-y-5 pb-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-slate-900 tracking-tight">Product & Service Catalog</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Hardware SKUs, services, and subscription plans (Catalog Service — Port 3002)
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()} isLoading={isLoading}>
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
            Refresh
          </Button>

          <Button variant="accent" size="sm" onClick={() => setShowCreateModal(true)}>
            <Plus className="w-4 h-4 mr-1.5" />
            Add Product
          </Button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-3 bg-white rounded-xl border border-slate-200/80 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search catalog by product name..."
            className="pl-9 text-xs h-9 bg-slate-50"
          />
        </div>

        <div className="flex items-center gap-2">
          <Layers className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-xs font-semibold text-slate-600">Category:</span>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="text-xs font-medium border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-primary"
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
        <LoadingSpinner label="Loading products from Catalog database..." />
      ) : isError ? (
        <div className="p-6 bg-white rounded-xl border border-red-200 text-center space-y-3">
          <AlertCircle className="w-8 h-8 text-red-500 mx-auto" />
          <h3 className="text-sm font-bold text-red-800">Unable to Connect to Catalog Service</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            {error?.message || 'Failed to fetch catalog items from http://localhost:3002/catalog/products.'}
          </p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            Retry Connection
          </Button>
        </div>
      ) : filteredProducts.length === 0 ? (
        <EmptyState
          title="No products in catalog"
          description={
            search
              ? 'No products match your search query.'
              : 'The product catalog database contains no items yet. Use "Add Product" to add real records.'
          }
          action={
            <Button variant="primary" size="sm" onClick={() => setShowCreateModal(true)}>
              <Plus className="w-3.5 h-3.5 mr-1" />
              Add First Product
            </Button>
          }
        />
      ) : (
        <Card>
          <CardHeader className="py-3 px-5 bg-slate-50/75 flex items-center justify-between">
            <CardTitle className="text-xs font-bold text-slate-800 flex items-center gap-2">
              <Package className="w-4 h-4 text-slate-500" />
              Active Catalog Inventory ({filteredProducts.length} items)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-left table-dense">
              <thead>
                <tr>
                  <th>Product Name & Description</th>
                  <th>Category</th>
                  <th className="text-right">Base Price</th>
                  <th className="text-right">Unit Cost</th>
                  <th className="text-right">Margin</th>
                  <th className="text-center">Tax Rate</th>
                  <th className="text-center">Unit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredProducts.map((p: any) => {
                  const base = Number(p.basePrice) || 0;
                  const cost = Number(p.costPrice) || 0;
                  const margin = base > 0 ? ((base - cost) / base) * 100 : 0;
                  return (
                    <tr key={p.id}>
                      <td className="font-bold text-xs text-slate-900">
                        <div className="flex items-center gap-2">
                          <Package className="w-4 h-4 text-slate-400 shrink-0" />
                          <span>{p.name}</span>
                        </div>
                        {p.description && (
                          <div className="text-[10px] text-slate-400 font-normal mt-0.5 max-w-sm truncate">
                            {p.description}
                          </div>
                        )}
                      </td>
                      <td className="text-xs text-slate-600">
                        <Badge variant="outline" size="sm">
                          {p.category?.name || 'General'}
                        </Badge>
                      </td>
                      <td className="text-right font-black text-xs text-slate-900">
                        {formatCurrency(p.basePrice)}
                      </td>
                      <td className="text-right font-medium text-xs text-slate-500">
                        {p.costPrice !== undefined ? formatCurrency(p.costPrice) : '—'}
                      </td>
                      <td className="text-right font-bold text-xs text-emerald-600">
                        {margin > 0 ? `${margin.toFixed(1)}%` : '—'}
                      </td>
                      <td className="text-center text-xs text-slate-600">
                        {p.taxRate !== undefined ? `${p.taxRate}%` : '18%'}
                      </td>
                      <td className="text-center text-[10px] font-mono text-slate-500 uppercase">
                        {p.unit || 'UNIT'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* Create Product Modal */}
      <Dialog
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Create Real Catalog Product"
        description="Persists directly to the Catalog service PostgreSQL database"
      >
        <form onSubmit={handleCreateProduct} className="space-y-4">
          <Input
            label="Product Name *"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Enterprise Storage Array 40TB"
            required
          />

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Category *</label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full text-xs p-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-primary"
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
            <Input
              label="Base Selling Price (₹) *"
              type="number"
              step="0.01"
              value={basePrice}
              onChange={(e) => setBasePrice(e.target.value)}
              placeholder="0.00"
              required
            />
            <Input
              label="Unit Cost Price (₹)"
              type="number"
              step="0.01"
              value={costPrice}
              onChange={(e) => setCostPrice(e.target.value)}
              placeholder="0.00"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Tax Rate (%)"
              type="number"
              step="0.1"
              value={taxRate}
              onChange={(e) => setTaxRate(e.target.value)}
              placeholder="18"
            />
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Billing Unit</label>
              <select
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className="w-full text-xs p-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="UNIT">UNIT</option>
                <option value="HOUR">HOUR</option>
                <option value="MONTH">MONTH</option>
                <option value="YEAR">YEAR</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="Hardware specs or service description..."
              className="w-full text-xs p-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3">
            <Button variant="ghost" size="sm" type="button" onClick={() => setShowCreateModal(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit" isLoading={createProductMutation.isPending}>
              Save to Database
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
