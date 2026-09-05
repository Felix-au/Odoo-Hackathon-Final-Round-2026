import { NavLink } from 'react-router-dom';
import { useAuthStore } from '../../stores/auth.store';
import {
  LayoutDashboard,
  Users,
  Package,
  FileText,
  Truck,
  Receipt,
  BarChart3,
  LogOut,
  Shield,
} from 'lucide-react';
import { cn } from '../../lib/utils';

export function Sidebar() {
  const { user, logout } = useAuthStore();

  const navItemClass = ({ isActive }: { isActive: boolean }) =>
    cn(
      'flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-xs font-semibold transition-all duration-150',
      isActive
        ? 'bg-slate-900 text-white shadow-xs'
        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
    );

  const navLinks = [
    { to: '/app/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/app/users', label: 'Auth / Users', icon: Users },
    { to: '/app/catalog', label: 'Catalog', icon: Package },
    { to: '/app/quotations', label: 'Quotations', icon: FileText },
    { to: '/app/fulfillment', label: 'Fulfillment', icon: Truck },
    { to: '/app/billing', label: 'Billing', icon: Receipt },
    { to: '/app/analytics', label: 'Analytics', icon: BarChart3 },
  ];

  return (
    <aside className="w-64 bg-white border-r border-slate-200 flex flex-col h-screen select-none shrink-0">
      {/* Brand Header */}
      <div className="h-16 px-6 flex items-center gap-3 border-b border-slate-100">
        <div className="w-8 h-8 rounded-lg bg-slate-900 flex items-center justify-center text-white font-black text-sm">
          360
        </div>
        <div>
          <div className="text-sm font-bold tracking-tight text-slate-900">
            DealFlow<span className="text-primary">360</span>
          </div>
          <div className="text-[10px] text-slate-400 font-medium">Sales Operations System</div>
        </div>
      </div>

      {/* Navigation List */}
      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-1">
        <div className="px-3 mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
          Platform Navigation
        </div>
        {navLinks.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink key={item.to} to={item.to} className={navItemClass}>
              <Icon className="w-4 h-4 shrink-0" />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </div>

      {/* User Info & Logout Footer */}
      <div className="p-4 border-t border-slate-100 bg-slate-50/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 overflow-hidden">
            <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-xs shrink-0">
              {user?.name ? user.name[0].toUpperCase() : 'U'}
            </div>
            <div className="overflow-hidden">
              <div className="text-xs font-bold text-slate-900 truncate">{user?.name || 'User'}</div>
              <div className="text-[10px] text-slate-400 truncate flex items-center gap-1">
                <Shield className="w-3 h-3 text-slate-400" />
                {user?.role || 'Guest'}
              </div>
            </div>
          </div>
          <button
            onClick={() => logout()}
            className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-slate-100 transition-colors"
            title="Sign out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
