import { useProducts, useCategories } from '../../api/hooks/useCatalog';
import { useUsers } from '../../api/hooks/useUsers';
import { useQuotations } from '../../api/hooks/useQuotations';
import { useServiceStatus } from '../../api/hooks/useServiceStatus';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { LoadingSpinner } from '../../components/feedback/LoadingSpinner';
import { Package, Users, FileText, Activity, AlertCircle, CheckCircle2, Server } from 'lucide-react';

export function DashboardPage() {
  const { data: products = [], isLoading: loadingProducts, error: productError } = useProducts();
  const { data: categories = [], isLoading: loadingCategories } = useCategories();
  const { data: usersData, isLoading: loadingUsers } = useUsers();
  const { data: quotationsData, isLoading: loadingQuotes } = useQuotations();
  const { data: serviceHealth = [], isLoading: loadingHealth } = useServiceStatus();

  const totalUsers = usersData?.total ?? (usersData?.data?.length ?? null);
  const totalProducts = products?.length ?? null;
  const totalCategories = categories?.length ?? null;
  const totalQuotations = quotationsData?.isLive ? quotationsData.total : null;

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-10">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-slate-900 tracking-tight">System Dashboard</h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Live operational status and metrics reported directly by active backend microservices
        </p>
      </div>

      {/* Real Backend Metrics Grid (Rule 6) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Products Count */}
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
              <span>Catalog Products</span>
              <Package className="w-4 h-4 text-slate-400" />
            </div>
            <div className="text-2xl font-bold text-slate-900 mt-2">
              {loadingProducts ? (
                <span className="text-xs text-slate-400 font-normal">Loading...</span>
              ) : productError ? (
                <span className="text-xs text-red-500 font-normal">Offline</span>
              ) : totalProducts !== null ? (
                `${totalProducts} SKUs`
              ) : (
                <span className="text-xs text-slate-400 font-normal">Data unavailable</span>
              )}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              Source: <code className="font-mono text-slate-600">catalog_db.Product</code>
            </div>
          </CardContent>
        </Card>

        {/* Product Categories */}
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
              <span>Product Categories</span>
              <Server className="w-4 h-4 text-slate-400" />
            </div>
            <div className="text-2xl font-bold text-slate-900 mt-2">
              {loadingCategories ? (
                <span className="text-xs text-slate-400 font-normal">Loading...</span>
              ) : totalCategories !== null ? (
                `${totalCategories} Categories`
              ) : (
                <span className="text-xs text-slate-400 font-normal">Data unavailable</span>
              )}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              Source: <code className="font-mono text-slate-600">catalog_db.ProductCategory</code>
            </div>
          </CardContent>
        </Card>

        {/* Registered Users */}
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
              <span>Internal Users</span>
              <Users className="w-4 h-4 text-slate-400" />
            </div>
            <div className="text-2xl font-bold text-slate-900 mt-2">
              {loadingUsers ? (
                <span className="text-xs text-slate-400 font-normal">Loading...</span>
              ) : totalUsers !== null ? (
                `${totalUsers} Users`
              ) : (
                <span className="text-xs text-slate-400 font-normal">Data unavailable</span>
              )}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              Source: <code className="font-mono text-slate-600">auth_db.User</code>
            </div>
          </CardContent>
        </Card>

        {/* Quotations Count */}
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
              <span>Quotations (Live)</span>
              <FileText className="w-4 h-4 text-slate-400" />
            </div>
            <div className="text-2xl font-bold text-slate-900 mt-2">
              {loadingQuotes ? (
                <span className="text-xs text-slate-400 font-normal">Loading...</span>
              ) : totalQuotations !== null ? (
                `${totalQuotations} Quotations`
              ) : (
                <span className="text-xs text-slate-400 font-normal">0 Quotations</span>
              )}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              Source: <code className="font-mono text-slate-600">quotation_db.Quotation</code>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Backend Service Status Grid (Rule 15) */}
      <Card>
        <CardHeader className="py-3 px-5 bg-slate-50/75 border-b border-slate-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-slate-600" />
              <CardTitle className="text-xs font-bold text-slate-800">Backend Microservice Status</CardTitle>
            </div>
            <span className="text-[11px] text-slate-400 font-medium">Auto-refreshed via /health polling</span>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loadingHealth ? (
            <LoadingSpinner label="Testing live service connectivity..." />
          ) : (
            <table className="w-full text-left table-dense">
              <thead>
                <tr>
                  <th>Microservice Name</th>
                  <th>Configured Endpoint</th>
                  <th>Implementation Status</th>
                  <th className="text-right">Live Connectivity</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {serviceHealth.map((svc) => (
                  <tr key={svc.key}>
                    <td className="font-semibold text-xs text-slate-900">{svc.name}</td>
                    <td className="font-mono text-[11px] text-slate-500">{svc.url}</td>
                    <td>
                      {svc.implemented ? (
                        <span className="text-xs font-semibold text-emerald-700 flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          Implemented (Code Ready)
                        </span>
                      ) : (
                        <span className="text-xs font-semibold text-amber-700 flex items-center gap-1">
                          <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                          Under Development
                        </span>
                      )}
                    </td>
                    <td className="text-right">
                      {svc.status === 'connected' ? (
                        <Badge variant="success" size="sm">
                          ● Connected (Healthy)
                        </Badge>
                      ) : svc.status === 'development' ? (
                        <Badge variant="warning" size="sm">
                          ● In Development
                        </Badge>
                      ) : (
                        <Badge variant="destructive" size="sm" title={svc.error}>
                          ● Offline / Unreachable
                        </Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
