import { Outlet } from 'react-router-dom';

export function PortalShell() {
  return (
    <div className="min-h-screen bg-[#FBFBFC] text-slate-900 flex flex-col font-sans antialiased selection:bg-slate-900 selection:text-white">
      {/* Editorial Proposal Header (Screenshot 3) */}
      <header className="w-full max-w-4xl mx-auto px-6 py-6 flex items-center justify-between border-b border-slate-200/60">
        <div className="flex items-center gap-2.5">
          <div className="w-6 h-6 rounded-md bg-slate-900 flex items-center justify-center text-white text-xs font-black shadow-xs">
            ◈
          </div>
          <span className="text-sm font-bold tracking-tight text-slate-900">
            DealFlow360
          </span>
        </div>

        <div className="text-xs text-slate-400 font-medium tracking-wide">
          Secure proposal
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 w-full max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12 flex items-center justify-center">
        <Outlet />
      </main>
    </div>
  );
}
