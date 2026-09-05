import { useWarehouses } from '../../../api/hooks/useCatalog';
import { Card, CardHeader, CardTitle, CardContent } from '../../../components/ui/Card';
import { Badge } from '../../../components/ui/Badge';
import { LoadingSpinner } from '../../../components/feedback/LoadingSpinner';
import { Truck } from 'lucide-react';

export function WarehousesPage() {
  const { data: warehouses = [], isLoading } = useWarehouses();

  if (isLoading) return <LoadingSpinner label="Loading warehouse nodes..." />;

  return (
    <div className="space-y-5 pb-8 max-w-5xl mx-auto">
      <div>
        <h1 className="text-xl font-black text-slate-900 tracking-tight">Distribution Warehouses</h1>
        <p className="text-xs text-slate-500 mt-0.5">Locations used by the fulfillment split algorithm</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {warehouses.map((wh) => (
          <Card key={wh.id}>
            <CardHeader className="py-3 px-4 bg-slate-50/75 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Truck className="w-4 h-4 text-primary" />
                <CardTitle className="text-xs font-bold text-slate-800">{wh.code}</CardTitle>
              </div>
              {wh.isPrimary && (
                <Badge variant="primary" size="sm" className="text-[10px]">
                  Primary Hub
                </Badge>
              )}
            </CardHeader>
            <CardContent className="p-4 space-y-2 text-xs">
              <div className="font-bold text-slate-800">{wh.name}</div>
              <div className="text-slate-500">Shipping Cost Factor: {wh.shippingCostWeight}x standard rate</div>
              <div className="text-[11px] text-emerald-600 font-semibold">Active & Connected to ERP</div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
