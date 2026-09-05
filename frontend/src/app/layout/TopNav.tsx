import { useState, useRef, useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../stores/auth.store';
import { Badge } from '../../components/ui/Badge';
import {
  Bell,
  ChevronDown,
  LogOut,
  Package,
  Truck,
  Receipt,
  Shield,
  Layers,
} from 'lucide-react';
import { cn } from '../../lib/utils';

export function TopNav() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();

  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showOpsMenu, setShowOpsMenu] = useState(false);
  const [showAdminMenu, setShowAdminMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

  const menuRef = useRef<HTMLDivElement>(null);

  // Close menus on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false);
        setShowOpsMenu(false);
        setShowAdminMenu(false);
        setShowNotifications(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // Nav link style generator
  const getNavLinkClass = (path: string, exact = false) => {
    const isActive = exact
      ? location.pathname === path
      : location.pathname.startsWith(path);
    return cn(
      'text-xs font-medium px-3.5 py-1.5 rounded-lg transition-all duration-150',
      isActive
        ? 'text-blue-400 font-semibold bg-blue-500/10'
        : 'text-slate-400 hover:text-slate-100 hover:bg-white/5'
    );
  };

  const initials = user?.name
    ? user.name
        .split(' ')
        .map((n) => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : user?.email
    ? user.email.slice(0, 2).toUpperCase()
    : 'DF';

  return (
    <div className="sticky top-3 z-40 w-full max-w-7xl mx-auto px-4 sm:px-6 mb-6">
      <header
        ref={menuRef}
        className="h-14 bg-[#12151C]/90 backdrop-blur-md border border-[#222834] rounded-2xl px-5 flex items-center justify-between shadow-xl"
      >
        {/* Brand / Logo */}
        <div className="flex items-center gap-6">
          <NavLink
            to="/app/dashboard"
            className="flex items-center gap-2.5 group transition-opacity hover:opacity-90"
          >
            <div className="w-6 h-6 rounded-md bg-blue-600 flex items-center justify-center text-white shadow-sm shadow-blue-500/30">
              <span className="text-sm font-black leading-none">◈</span>
            </div>
            <span className="text-sm font-bold tracking-tight text-white">
              DealFlow360
            </span>
          </NavLink>

          {/* Primary Navigation Links (Screenshot 2) */}
          <nav className="hidden md:flex items-center gap-1">
            <NavLink to="/app/dashboard" className={getNavLinkClass('/app/dashboard', true)}>
              Dashboard
            </NavLink>
            <NavLink to="/app/quotations" className={getNavLinkClass('/app/quotations', false)}>
              Quotations
            </NavLink>
            <NavLink
              to="/app/quotations?view=pipeline"
              className={cn(
                'text-xs font-medium px-3.5 py-1.5 rounded-lg transition-all duration-150',
                location.search.includes('view=pipeline')
                  ? 'text-blue-400 font-semibold bg-blue-500/10'
                  : 'text-slate-400 hover:text-slate-100 hover:bg-white/5'
              )}
            >
              Pipeline
            </NavLink>
            <NavLink to="/app/reports" className={getNavLinkClass('/app/reports', false)}>
              Reports
            </NavLink>

            {/* Operations Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setShowOpsMenu(!showOpsMenu);
                  setShowAdminMenu(false);
                  setShowUserMenu(false);
                  setShowNotifications(false);
                }}
                className={cn(
                  'flex items-center gap-1 text-xs font-medium px-3.5 py-1.5 rounded-lg transition-all duration-150',
                  location.pathname.startsWith('/app/fulfillment') ||
                    location.pathname.startsWith('/app/billing')
                    ? 'text-blue-400 font-semibold bg-blue-500/10'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-white/5'
                )}
              >
                <span>Operations</span>
                <ChevronDown className="w-3 h-3 text-slate-500" />
              </button>

              {showOpsMenu && (
                <div className="absolute left-0 mt-2 w-48 bg-[#161B24] border border-[#262E3D] rounded-xl shadow-2xl py-1.5 z-50 animate-in fade-in zoom-in-95">
                  <NavLink
                    to="/app/fulfillment"
                    onClick={() => setShowOpsMenu(false)}
                    className="flex items-center gap-2.5 px-3.5 py-2 text-xs text-slate-300 hover:bg-white/5 hover:text-white"
                  >
                    <Truck className="w-4 h-4 text-blue-400" />
                    <span>Fulfillment & Allocation</span>
                  </NavLink>
                  <NavLink
                    to="/app/billing"
                    onClick={() => setShowOpsMenu(false)}
                    className="flex items-center gap-2.5 px-3.5 py-2 text-xs text-slate-300 hover:bg-white/5 hover:text-white"
                  >
                    <Receipt className="w-4 h-4 text-emerald-400" />
                    <span>Billing & Subscriptions</span>
                  </NavLink>
                </div>
              )}
            </div>

            {/* Admin Dropdown */}
            {(user?.role === 'ADMIN' || user?.role === 'SALES_MANAGER') && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setShowAdminMenu(!showAdminMenu);
                    setShowOpsMenu(false);
                    setShowUserMenu(false);
                    setShowNotifications(false);
                  }}
                  className={cn(
                    'flex items-center gap-1 text-xs font-medium px-3.5 py-1.5 rounded-lg transition-all duration-150',
                    location.pathname.startsWith('/app/admin')
                      ? 'text-blue-400 font-semibold bg-blue-500/10'
                      : 'text-slate-400 hover:text-slate-100 hover:bg-white/5'
                  )}
                >
                  <span>Admin</span>
                  <ChevronDown className="w-3 h-3 text-slate-500" />
                </button>

                {showAdminMenu && (
                  <div className="absolute left-0 mt-2 w-52 bg-[#161B24] border border-[#262E3D] rounded-xl shadow-2xl py-1.5 z-50 animate-in fade-in zoom-in-95">
                    <NavLink
                      to="/app/admin/products"
                      onClick={() => setShowAdminMenu(false)}
                      className="flex items-center gap-2.5 px-3.5 py-2 text-xs text-slate-300 hover:bg-white/5 hover:text-white"
                    >
                      <Package className="w-3.5 h-3.5 text-slate-400" />
                      <span>Products & Pricing</span>
                    </NavLink>
                    <NavLink
                      to="/app/admin/discount-tiers"
                      onClick={() => setShowAdminMenu(false)}
                      className="flex items-center gap-2.5 px-3.5 py-2 text-xs text-slate-300 hover:bg-white/5 hover:text-white"
                    >
                      <Layers className="w-3.5 h-3.5 text-slate-400" />
                      <span>Discount Tiers</span>
                    </NavLink>
                    <NavLink
                      to="/app/admin/approval-chains"
                      onClick={() => setShowAdminMenu(false)}
                      className="flex items-center gap-2.5 px-3.5 py-2 text-xs text-slate-300 hover:bg-white/5 hover:text-white"
                    >
                      <Shield className="w-3.5 h-3.5 text-slate-400" />
                      <span>Approval Chains</span>
                    </NavLink>
                    <NavLink
                      to="/app/admin/warehouses"
                      onClick={() => setShowAdminMenu(false)}
                      className="flex items-center gap-2.5 px-3.5 py-2 text-xs text-slate-300 hover:bg-white/5 hover:text-white"
                    >
                      <Truck className="w-3.5 h-3.5 text-slate-400" />
                      <span>Warehouses</span>
                    </NavLink>
                  </div>
                )}
              </div>
            )}
          </nav>
        </div>

        {/* Right Section: Bell Notification + Avatar */}
        <div className="flex items-center gap-3">
          {/* Notifications Bell */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setShowNotifications(!showNotifications);
                setShowUserMenu(false);
                setShowOpsMenu(false);
                setShowAdminMenu(false);
              }}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/5 transition-colors relative"
              aria-label="Notifications"
            >
              <Bell className="w-4 h-4" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-blue-500 ring-2 ring-[#12151C]" />
            </button>

            {showNotifications && (
              <div className="absolute right-0 mt-2 w-80 bg-[#161B24] border border-[#262E3D] rounded-xl shadow-2xl p-4 z-50 animate-in fade-in zoom-in-95">
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#262E3D]">
                  <span className="text-xs font-bold text-white uppercase tracking-wider">
                    Notifications
                  </span>
                  <span className="text-[10px] text-blue-400">2 new</span>
                </div>
                <div className="space-y-2.5">
                  <div className="p-2 rounded-lg bg-white/5 border border-white/5 text-xs">
                    <p className="text-slate-200 font-medium">Acme Corp Quote Approved</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">Finance approved the 8% discount exception</p>
                  </div>
                  <div className="p-2 rounded-lg bg-white/5 border border-white/5 text-xs">
                    <p className="text-slate-200 font-medium">Nova Systems Shipment</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">Warehouse split confirmed for Mumbai & Ahmedabad</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* User Profile Avatar */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setShowUserMenu(!showUserMenu);
                setShowNotifications(false);
                setShowOpsMenu(false);
                setShowAdminMenu(false);
              }}
              className="flex items-center gap-2.5 pl-1 focus:outline-none group"
            >
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-slate-700 to-slate-800 border border-slate-600 flex items-center justify-center text-xs font-bold text-white shadow-sm group-hover:border-blue-400 transition-colors">
                {initials}
              </div>
            </button>

            {showUserMenu && (
              <div className="absolute right-0 mt-2 w-56 bg-[#161B24] border border-[#262E3D] rounded-xl shadow-2xl py-2 z-50 animate-in fade-in zoom-in-95">
                <div className="px-4 py-2 border-b border-[#262E3D]">
                  <p className="text-xs font-semibold text-white truncate">
                    {user?.name || (user?.email ? user.email.split('@')[0] : 'Account')}
                  </p>
                  <p className="text-[11px] text-slate-400 truncate">{user?.email}</p>
                  <div className="mt-1.5">
                    <Badge variant="outline" size="sm" className="font-mono text-[10px] text-blue-400 border-blue-500/30">
                      {user?.role || 'SALES_REP'}
                    </Badge>
                  </div>
                </div>

                <div className="py-1">
                  <NavLink
                    to="/portal/quotations/q-001"
                    target="_blank"
                    className="flex items-center gap-2 px-4 py-2 text-xs text-slate-300 hover:bg-white/5 hover:text-white"
                  >
                    <span>View Customer Portal</span>
                    <span className="text-[10px] text-slate-500 ml-auto">↗</span>
                  </NavLink>
                </div>

                <div className="pt-1 border-t border-[#262E3D]">
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2 px-4 py-2 text-xs text-red-400 hover:bg-red-500/10 transition-colors text-left"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Sign Out</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>
    </div>
  );
}
