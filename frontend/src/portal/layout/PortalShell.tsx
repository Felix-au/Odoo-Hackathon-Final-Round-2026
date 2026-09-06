import { Outlet, Link, useNavigate } from 'react-router-dom';
import { usePortalAuthStore } from '../../stores/portal-auth.store';
import { Building2, ShieldCheck, LogOut, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

export function PortalShell() {
  const { customer, logout } = usePortalAuthStore();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await logout();
      toast.success('Signed out of customer portal');
      navigate('/portal/auth/login');
    } catch {
      navigate('/portal/auth/login');
    }
  };

  const customerName = customer?.name || 'Client Partner';
  const customerEmail = customer?.email || 'procurement@company.com';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans antialiased selection:bg-indigo-500 selection:text-white relative overflow-x-hidden">
      {/* Ambient background glow accents */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute -top-40 left-1/4 h-96 w-96 rounded-full bg-indigo-600/10 blur-3xl" />
        <div className="absolute top-1/3 -right-40 h-96 w-96 rounded-full bg-cyan-600/10 blur-3xl" />
        <div className="absolute -bottom-40 left-1/3 h-96 w-96 rounded-full bg-emerald-600/10 blur-3xl" />
      </div>

      {/* Modern Obsidian Header */}
      <header className="sticky top-0 z-40 w-full border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          {/* Brand & Portal Label */}
          <div className="flex items-center gap-3">
            <Link to="/portal" className="flex items-center gap-2.5 group">
              <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-cyan-400 p-[1px] shadow-lg shadow-indigo-500/20 group-hover:shadow-indigo-500/30 transition-all">
                <div className="h-full w-full rounded-[11px] bg-slate-950 flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-cyan-400" />
                </div>
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-bold tracking-tight text-white flex items-center gap-1.5">
                  DealFlow360
                </span>
                <span className="text-[10px] uppercase font-semibold tracking-wider text-slate-400 -mt-0.5">
                  Client Portal
                </span>
              </div>
            </Link>

            <div className="h-5 w-[1px] bg-slate-800 mx-1 hidden sm:block" />

            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-950/40 border border-indigo-500/30 text-indigo-300 text-[11px] font-medium">
              <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
              <span>Verified Enterprise Portal</span>
            </div>
          </div>

          {/* Customer Profile & Actions */}
          <div className="flex items-center gap-3">
            {customer && (
              <div className="hidden md:flex items-center gap-3 px-3 py-1.5 rounded-xl bg-slate-900/80 border border-slate-800">
                <div className="h-7 w-7 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                  <Building2 className="w-3.5 h-3.5" />
                </div>
                <div className="flex flex-col text-left">
                  <div className="text-xs font-semibold text-slate-200 flex items-center gap-1.5 leading-tight">
                    {customerName}
                    <span className="px-1.5 py-0.2 text-[9px] font-bold rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                      GOLD TIER
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400 truncate max-w-[150px] leading-tight mt-0.5">
                    {customerEmail}
                  </span>
                </div>
              </div>
            )}

            {/* Logout Button */}
            <button
              type="button"
              onClick={handleLogout}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-900 border border-transparent hover:border-slate-800 transition-colors"
              title="Sign out of customer portal"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Sign out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="relative z-10 flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <Outlet />
      </main>

      {/* Enterprise Security Footer */}
      <footer className="relative z-10 w-full border-t border-slate-800/80 bg-slate-950/60 backdrop-blur-md py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>256-Bit TLS End-to-End Secure Client Portal</span>
            <span>·</span>
            <span>SOC2 Type II & ISO 27001 Compliant</span>
          </div>
          <div className="text-slate-500">
            Powered by DealFlow360 Enterprise CPQ & Fulfillment Engine
          </div>
        </div>
      </footer>
    </div>
  );
}
