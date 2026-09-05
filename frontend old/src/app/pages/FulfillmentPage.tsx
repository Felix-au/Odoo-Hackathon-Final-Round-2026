import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useFulfillmentSplit, useAcceptSplit, useUpdateSplit } from '../../api/hooks/useFulfillment';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { LoadingSpinner } from '../../components/feedback/LoadingSpinner';
import { formatCurrency } from '../../lib/utils';
import { Truck, ArrowLeft, CheckCircle, SlidersHorizontal, AlertTriangle, Box } from 'lucide-react';
import { toast } from 'sonner';

export function FulfillmentPage() {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();

  const targetOrderId = id || 'q-001';
  const { data: splitRec, isLoading } = useFulfillmentSplit(targetOrderId);
  const acceptSplitMutation = useAcceptSplit(targetOrderId);
  const updateSplitMutation = useUpdateSplit(targetOrderId);

  const [isEditingOverride, setIsEditingOverride] = useState(false);

  const handleAcceptSplit = async () => {
    try {
      await acceptSplitMutation.mutateAsync(false);
      toast.success('Warehouse split order accepted and dispatched');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Fulfillment service is in development';
      toast.info(msg);
    }
  };

  const handleSaveOverride = async () => {
    if (!splitRec) return;
    try {
      await updateSplitMutation.mutateAsync(splitRec);
      setIsEditingOverride(false);
      toast.success('Manual warehouse allocation override saved');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Fulfillment service is in development';
      toast.info(msg);
    }
  };

  return (
    <div className="space-y-5 pb-8 max-w-5xl mx-auto">
      {/* Back button if opened with quotation ID */}
      {id && (
        <button
          onClick={() => navigate(`/app/quotations/${id}`)}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Quotation Builder
        </button>
      )}

      {/* Header */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-xl font-black text-slate-900 tracking-tight">Fulfillment & Logistics</h1>
            <Badge variant="success" size="sm">
              Live Service
            </Badge>
          </div>
          <p className="text-xs text-slate-500">
            {id
              ? `Order #${id} • Multi-Warehouse Stock Allocation & Shipping Routing`
              : 'Multi-Warehouse Allocation, Parcel Splits & Shipping Routing (Port 3004)'}
          </p>
        </div>

        {splitRec && (
          <div className="flex items-center gap-3">
            <Button
              variant={isEditingOverride ? 'outline' : 'secondary'}
              size="sm"
              onClick={() => setIsEditingOverride(!isEditingOverride)}
            >
              <SlidersHorizontal className="w-3.5 h-3.5 mr-1" />
              {isEditingOverride ? 'Cancel Override' : 'Manual Override'}
            </Button>

            {isEditingOverride ? (
              <Button
                variant="accent"
                size="sm"
                onClick={handleSaveOverride}
                isLoading={updateSplitMutation.isPending}
              >
                Save Override
              </Button>
            ) : (
              <Button
                variant="primary"
                size="sm"
                onClick={handleAcceptSplit}
                isLoading={acceptSplitMutation.isPending}
              >
                <CheckCircle className="w-4 h-4 mr-1.5" />
                Accept Suggested Split
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Loading state */}
      {isLoading ? (
        <LoadingSpinner label="Checking Fulfillment service status..." />
      ) : !splitRec ? (
        /* Graceful Empty State for Incomplete Service */
        <Card className="border-dashed border-2">
          <CardContent className="p-8 text-center space-y-3">
            <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
              <Box className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-800">No Fulfillment Data Available</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Once the fulfillment service is online and an order is confirmed, warehouse split recommendations, inventory
              allocations, and carrier dispatches will appear here.
            </p>
          </CardContent>
        </Card>
      ) : (
        /* Real Split Data (when service is online) */
        <div className="space-y-5">
          {/* Summary KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs">
              <div className="text-xs font-semibold text-slate-400">Total Shipments</div>
              <div className="text-xl font-black text-slate-900 mt-1">{splitRec.totalShipments} Parcels</div>
            </div>

            <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs">
              <div className="text-xs font-semibold text-slate-400">Estimated Shipping Cost</div>
              <div className="text-xl font-black text-slate-900 mt-1">
                {formatCurrency(splitRec.estimatedShippingCost)}
              </div>
            </div>

            <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs">
              <div className="text-xs font-semibold text-slate-400">Backorder Status</div>
              <div className="text-xl font-black text-emerald-600 mt-1">
                {splitRec.hasBackorder ? 'Backorders Pending' : '✓ 100% In Stock'}
              </div>
            </div>
          </div>

          {/* Backorder Alert if active */}
          {splitRec.hasBackorder && (
            <div className="p-4 rounded-xl border border-amber-200 bg-amber-50 text-amber-900 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <h4 className="text-xs font-bold">Backorder Items Identified</h4>
                <p className="text-xs mt-0.5">Some ordered units exceed immediate localized warehouse stock.</p>
              </div>
            </div>
          )}

          {/* Warehouse Allocation Cards */}
          <div className="space-y-4">
            {splitRec.splits.map((split) => (
              <Card key={split.warehouseId}>
                <CardHeader className="py-3 px-5 bg-slate-50/75 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Truck className="w-4 h-4 text-primary" />
                    <CardTitle className="text-xs font-bold text-slate-800">{split.warehouseName}</CardTitle>
                    {split.isPrimary && (
                      <Badge variant="primary" size="sm" className="text-[10px]">
                        Primary Warehouse
                      </Badge>
                    )}
                  </div>
                  <div className="text-xs font-semibold text-slate-600">
                    Shipment Cost: <span className="font-bold text-slate-900">{formatCurrency(split.estimatedCost)}</span>
                  </div>
                </CardHeader>

                <CardContent className="p-0">
                  <table className="w-full text-left table-dense">
                    <thead>
                      <tr>
                        <th>Product Allocated</th>
                        <th className="text-center">Ship Quantity</th>
                        <th className="text-center">Local Stock</th>
                        <th className="text-center">Availability</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {split.items.map((item, idx) => (
                        <tr key={idx}>
                          <td className="font-bold text-xs text-slate-800">{item.productName}</td>
                          <td className="text-center font-bold text-xs text-slate-900">
                            {item.quantity}
                          </td>
                          <td className="text-center text-xs text-slate-500 font-medium">
                            {item.availableStock} units
                          </td>
                          <td className="text-center">
                            <Badge variant="success" size="sm">
                              Ready to Ship
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
