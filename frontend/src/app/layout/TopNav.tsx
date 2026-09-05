import { useAuthStore } from '../../stores/auth.store';
import { useServiceStatus } from '../../api/hooks/useServiceStatus';
import { Badge } from '../../components/ui/Badge';
import { Activity, ShieldCheck } from 'lucide-react';

export function TopNav() {
  const { user, isAuthenticated } = useAuthStore();
  const { data: services = [] } = useServiceStatus();

  const connectedCount = services.filter((s) => s.status === 'connected').length;

  return (
    <header className="h-14 bg-white border-b border-slate-200 px-6 flex items-center justify-between sticky top-0 z-30">
      {/* Service Health Live Ticker */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
          <Activity className="w-3.5 h-3.5 text-slate-400" />
          <span>Services ({connectedCount}/{services.length} live):</span>
        </div>
        <div className="flex items-center gap-2">
          {services.map((svc) => (
            <div
              key={svc.key}
              className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono bg-slate-50 border border-slate-200"
              title={`${svc.name}: ${svc.status.toUpperCase()} (${svc.url})`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  svc.status === 'connected'
                    ? 'bg-emerald-500'
                    : svc.status === 'offline'
                    ? 'bg-red-500'
                    : 'bg-amber-500'
                }`}
              />
              <span className="text-slate-700 capitalize">{svc.key}</span>
            </div>
          ))}
        </div>
      </div>

      {/* User Authentication Status */}
      <div className="flex items-center gap-3">
        {isAuthenticated ? (
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-600 font-medium">
              Signed in as <strong className="text-slate-900">{user?.name || user?.email}</strong>
            </span>
            <Badge variant="outline" size="sm" className="font-mono text-[10px] text-slate-600">
              {user?.role || 'AUTHENTICATED'}
            </Badge>
          </div>
        ) : (
          <div className="flex items-center gap-1 text-xs text-slate-400">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Unauthenticated</span>
          </div>
        )}
      </div>
    </header>
  );
}
