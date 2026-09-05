import { Outlet } from 'react-router-dom';
import { TopNav } from './TopNav';

export function AppShell() {
  return (
    <div className="min-h-screen bg-[#09090B] text-slate-100 flex flex-col antialiased selection:bg-blue-600 selection:text-white">
      {/* Floating Sticky TopNav */}
      <TopNav />

      {/* Main Workspace Container */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 pb-16">
        <Outlet />
      </main>
    </div>
  );
}
