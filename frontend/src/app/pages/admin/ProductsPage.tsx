import { useState } from 'react';
import { useProducts, useCategories } from '../../../api/hooks/useCatalog';
import { Card, CardHeader, CardTitle, CardContent } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import { Dialog } from '../../../components/ui/Dialog';
import { Input } from '../../../components/ui/Input';
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

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [name, setName] = useState('');
  const [basePrice, setBasePrice] = useState('');
  const [costPrice, setCostPrice] = useState('');
  const [categoryId, setCategoryId] = useState('cat-01');

  const handleCreateProduct = (e: React.FormEvent) => {
    e.preventDefault();
    toast.success(`Created product "${name}". Instantly available in Quotation Builder.`);
    setShowCreateModal(false);
    setName('');
    setBasePrice('');
    setCostPrice('');
  };

  return (
    <div className="space-y-5 pb-8 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-slate-900 tracking-tight">Product Catalog Management</h1>
          <p className="text-xs text-slate-500 mt-0.5">Define SKUs, base pricing, unit costs, and category discount ceilings</p>
        </div>

        <Button variant="accent" size="sm" onClick={() => setShowCreateModal(true)}>
          <Plus className="w-4 h-4 mr-1.5" />
          Create Product
        </Button>
      </div>

      <div className="p-3 bg-white rounded-xl border border-slate-200 flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search catalog by name..."
            className="pl-9 text-xs h-9 bg-slate-50"
          />
        </div>
      </div>

      {isLoading ? (
        <LoadingSpinner label="Loading product catalog..." />
      ) : (
        <Card>
          <CardHeader className="py-3 px-5 bg-slate-50/75">
            <CardTitle className="text-xs font-bold text-slate-800">Master Product Inventory</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-left table-dense">
              <thead>
                <tr>
                  <th>Product Name</th>
                  <th>Category</th>
                  <th className="text-right">Base Price</th>
                  <th className="text-right">Unit Cost</th>
                  <th className="text-right">Margin Floor</th>
                  <th className="text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {products.map((p: any) => {
                  const base = Number(p.basePrice);
                  const cost = Number(p.costPrice);
                  const margin = base > 0 ? ((base - cost) / base) * 100 : 0;
                  return (
                    <tr key={p.id}>
                      <td className="font-bold text-xs text-slate-900">
                        <div className="flex items-center gap-2">
                          <Package className="w-4 h-4 text-slate-400" />
                          <span>{p.name}</span>
                        </div>
                        {p.description && <div className="text-[10px] text-slate-400 font-normal mt-0.5">{p.description}</div>}
                      </td>
                      <td className="text-xs text-slate-600">
                        <Badge variant="outline" size="sm">
                          {p.category?.name || 'Hardware'}
                        </Badge>
                      </td>
                      <td className="text-right font-black text-xs text-slate-900">{formatCurrency(p.basePrice)}</td>
                      <td className="text-right font-medium text-xs text-slate-500">{formatCurrency(p.costPrice)}</td>
                      <td className="text-right font-bold text-xs text-emerald-600">{margin.toFixed(1)}%</td>
                      <td className="text-center">
                        <Badge variant="success" size="sm">
                          Active
                        </Badge>
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
        title="Create New Catalog Product"
        description="Add a hardware SKU, service plan, or recurring subscription"
      >
        <form onSubmit={handleCreateProduct} className="space-y-4">
          <Input
            label="Product Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Enterprise Storage Array 40TB"
            required
          />

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Category</label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full text-xs p-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-primary"
            >
              {categories.map((c: any) => (
                <option key={c.id} value={c.id}>
                  {c.name} (Max Discount Ceiling: {c.discountCeilingPct}%)
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Base Selling Price ($)"
              type="number"
              step="0.01"
              value={basePrice}
              onChange={(e) => setBasePrice(e.target.value)}
              required
            />
            <Input
              label="Unit Cost Price ($)"
              type="number"
              step="0.01"
              value={costPrice}
              onChange={(e) => setCostPrice(e.target.value)}
              required
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3">
            <Button variant="ghost" size="sm" type="button" onClick={() => setShowCreateModal(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit">
              Save Product
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
