import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { TopNav } from './TopNav';

export function AppShell() {
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-50">
      <Sidebar />
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        <TopNav />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
