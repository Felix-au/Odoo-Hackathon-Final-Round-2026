import { Outlet, Link, useNavigate } from 'react-router-dom';
import { usePortalAuthStore } from '../../stores/portal-auth.store';
import { Building2, ShieldCheck, LogOut } from 'lucide-react';
import dealflowLogo from '../../assets/dealflow360_logo.jpg';
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
    <div className="min-h-screen bg-[#000000] text-zinc-100 flex flex-col font-sans antialiased selection:bg-zinc-800 selection:text-white relative overflow-x-hidden">
      {/* Subtle monochrome ambient backdrop */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 h-96 w-full max-w-4xl bg-white/[0.015] blur-[140px]" />
      </div>

      {/* Pure Black Header */}
      <header className="sticky top-0 z-40 w-full border-b border-[#1A1A1A] bg-[#000000]/95 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          {/* Brand & Portal Label */}
          <div className="flex items-center gap-3">
            <Link to="/portal" className="flex items-center gap-2.5 group">
              {/* Official 3D infinity logo emblem */}
              <div className="h-9 w-9 rounded-xl overflow-hidden bg-black border border-[#262626] group-hover:border-zinc-500 transition-all flex items-center justify-center">
                <img
                  src={dealflowLogo}
                  alt="DealFlow360 Logo"
                  className="w-full h-full object-cover rotate-90 transform scale-125"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = '/dealflow360_logo.jpg';
                  }}
                />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-bold tracking-tight text-white flex items-center gap-1.5">
                  DealFlow<span className="text-zinc-500">360</span>
                </span>
                <span className="text-[10px] uppercase font-mono tracking-widest text-zinc-400 -mt-0.5">
                  Client Portal
                </span>
              </div>
            </Link>

            <div className="h-5 w-[1px] bg-[#222222] mx-1 hidden sm:block" />

            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#121212] border border-[#262626] text-zinc-300 text-[11px] font-medium">
              <ShieldCheck className="w-3.5 h-3.5 text-zinc-400" />
              <span>Verified Enterprise Portal</span>
            </div>
          </div>

          {/* Customer Profile & Actions */}
          <div className="flex items-center gap-3">
            {customer && (
              <div className="hidden md:flex items-center gap-3 px-3 py-1.5 rounded-xl bg-[#0D0D0D] border border-[#1F1F1F]">
                <div className="h-7 w-7 rounded-lg bg-[#181818] border border-[#2B2B2B] flex items-center justify-center text-zinc-300">
                  <Building2 className="w-3.5 h-3.5" />
                </div>
                <div className="flex flex-col text-left">
                  <div className="text-xs font-semibold text-zinc-200 flex items-center gap-1.5 leading-tight">
                    {customerName}
                    <span className="px-1.5 py-0.2 text-[9px] font-bold rounded bg-[#1C1C1C] text-zinc-300 border border-[#2E2E2E]">
                      GOLD TIER
                    </span>
                  </div>
                  <span className="text-[10px] text-zinc-500 truncate max-w-[150px] leading-tight mt-0.5">
                    {customerEmail}
                  </span>
                </div>
              </div>
            )}

            {/* Logout Button */}
            <button
              type="button"
              onClick={handleLogout}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-zinc-400 hover:text-white hover:bg-[#141414] border border-transparent hover:border-[#262626] transition-colors"
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
      <footer className="relative z-10 w-full border-t border-[#1A1A1A] bg-[#000000] py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-zinc-500">
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>256-Bit TLS End-to-End Secure Client Portal</span>
            <span>·</span>
            <span>SOC2 Type II & ISO 27001 Compliant</span>
          </div>
          <div className="text-zinc-600 font-mono text-[11px]">
            Powered by DealFlow360 Enterprise CPQ & Fulfillment Engine
          </div>
        </div>
      </footer>
    </div>
  );
}
