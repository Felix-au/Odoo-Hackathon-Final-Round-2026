import { Outlet, useNavigate } from 'react-router-dom';
import { usePortalAuthStore } from '../../stores/portal-auth.store';
import { Button } from '../../components/ui/Button';
import { ShieldCheck, LogOut } from 'lucide-react';

export function PortalShell() {
  const navigate = useNavigate();
  const { customer, logout } = usePortalAuthStore();

  const handleSignOut = async () => {
    await logout();
    navigate('/portal/auth/login');
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col selection:bg-blue-100 selection:text-blue-900">
      {/* Customer Header — Strictly isolated, zero internal links (REQ-F-008, REQ-CON-003) */}
      <header className="h-16 bg-white border-b border-slate-200/80 px-4 sm:px-8 flex items-center justify-between sticky top-0 z-30 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-primary to-blue-500 flex items-center justify-center text-white font-black text-sm shadow-xs">
            360
          </div>
          <div>
            <div className="text-sm font-black tracking-tight text-slate-900">
              DealFlow<span className="text-primary">360</span>
            </div>
            <div className="text-[10px] text-slate-400 font-medium">Customer Review Portal</div>
          </div>
        </div>

        {customer ? (
          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <div className="text-xs font-bold text-slate-800">{customer.name || customer.email}</div>
              <div className="text-[10px] text-emerald-600 font-semibold flex items-center justify-end gap-1">
                <ShieldCheck className="w-3 h-3" />
                Verified B2B Session
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSignOut}
              className="text-xs text-slate-500 hover:text-red-600 h-8"
              title="Sign out of customer portal"
            >
              <LogOut className="w-3.5 h-3.5 mr-1" />
              <span className="hidden sm:inline">Sign Out</span>
            </Button>
          </div>
        ) : (
          <a
            href="/portal/auth/login"
            className="text-xs font-semibold text-primary hover:underline"
          >
            Customer Sign In
          </a>
        )}
      </header>

      {/* Main portal content */}
      <main className="flex-1 p-4 sm:p-8 max-w-5xl w-full mx-auto">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="py-6 border-t border-slate-200 text-center text-xs text-slate-400 bg-white">
        DealFlow360 Secure Customer Portal • End-to-End Encrypted Session
      </footer>
    </div>
  );
}
