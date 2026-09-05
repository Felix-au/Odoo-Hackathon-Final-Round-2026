import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuthStore } from '../../stores/auth.store';
import { Role, ROLES } from '../../lib/constants';
import { toast } from 'sonner';
import { AuthSplitLayout } from '../../components/auth/AuthSplitLayout';
import { InternalBrandPanel } from '../../components/auth/InternalBrandPanel';
import { 
  Shield, 
  Users, 
  FileSpreadsheet, 
  Landmark, 
  ArrowRight, 
  ExternalLink,
  Lock,
  Mail,
  User as UserIcon,
  Check
} from 'lucide-react';

interface WorkspaceAuthPageProps {
  initialMode?: 'login' | 'signup';
}

export const WorkspaceAuthPage: React.FC<WorkspaceAuthPageProps> = ({ initialMode }) => {
  const location = useLocation();
  
  // State-driven mode ensures zero-unmount, silky smooth 60fps CSS transitions
  const [mode, setMode] = useState<'login' | 'signup'>(() => {
    if (initialMode) return initialMode;
    return location.pathname === '/signup' ? 'signup' : 'login';
  });

  // Sync mode if location changes externally (e.g. browser back/forward buttons)
  useEffect(() => {
    const isSignupPath = location.pathname === '/signup';
    setMode(isSignupPath ? 'signup' : 'login');
  }, [location.pathname]);

  // Listen to popstate for history navigation
  useEffect(() => {
    const handlePop = () => {
      setMode(window.location.pathname === '/signup' ? 'signup' : 'login');
    };
    window.addEventListener('popstate', handlePop);
    return () => window.removeEventListener('popstate', handlePop);
  }, []);

  const switchMode = (newMode: 'login' | 'signup', e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    setMode(newMode);
    window.history.pushState({}, '', newMode === 'signup' ? '/signup' : '/login');
  };

  const { login, signup, isLoading } = useAuthStore();

  // Login form state
  const [loginEmail, setLoginEmail] = useState('admin@dealflow360.com');
  const [loginPassword, setLoginPassword] = useState('AdminP@ss123');
  const [loginError, setLoginError] = useState<string | null>(null);

  // Signup form state
  const [signupName, setSignupName] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupRole, setSignupRole] = useState<Role>(ROLES.SALES_REP);
  const [signupError, setSignupError] = useState<string | null>(null);

  // Active quick fill highlight feedback
  const [activeRoleKey, setActiveRoleKey] = useState<string>('ADMIN');

  useEffect(() => {
    setLoginError(null);
    setSignupError(null);
  }, [mode]);

  // Handle Login Submit
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    try {
      await login(loginEmail, loginPassword);
      toast.success('Welcome back to DealFlow360');
      window.location.href = '/app/dashboard';
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Invalid email or password';
      setLoginError(msg);
      toast.error(msg);
    }
  };

  // Handle Signup Submit
  const handleSignupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSignupError(null);
    try {
      await signup({ 
        email: signupEmail, 
        password: signupPassword, 
        name: signupName, 
        role: signupRole 
      });
      toast.success('Workspace account created successfully!');
      window.location.href = '/app/dashboard';
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create workspace account';
      setSignupError(msg);
      toast.error(msg);
    }
  };

  // 4 Quick-fill role tiles (Subtext removed, clean minimalist tiles)
  const quickFillRoles = [
    {
      key: 'ADMIN',
      title: 'System Admin',
      email: 'admin@dealflow360.com',
      pass: 'AdminP@ss123',
      icon: Shield,
    },
    {
      key: 'MANAGER',
      title: 'Sales Manager',
      email: 'manager@dealflow360.com',
      pass: 'ManagerP@ss123',
      icon: Users,
    },
    {
      key: 'REP',
      title: 'Sales Rep',
      email: 'rep@dealflow360.com',
      pass: 'RepP@ss123',
      icon: FileSpreadsheet,
    },
    {
      key: 'FINANCE',
      title: 'Finance Lead',
      email: 'finance@dealflow360.com',
      pass: 'FinanceP@ss123',
      icon: Landmark,
    },
  ];

  const handleRoleSelect = (roleKey: string, roleEmail: string, rolePass: string) => {
    setActiveRoleKey(roleKey);
    setLoginEmail(roleEmail);
    setLoginPassword(rolePass);
    setLoginError(null);
    toast.info(`Filled credentials for ${roleEmail}`);
  };

  // Render Login Form Element (Subtext below Sign In removed)
  const renderLoginForm = () => (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header with zero subtext */}
      <div>
        <h1 className="text-3xl font-bold text-white tracking-tight">
          Sign In
        </h1>
      </div>

      {/* Main Login Form */}
      <form onSubmit={handleLoginSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-zinc-300 mb-1.5">
            Business Email
          </label>
          <div className="relative">
            <Mail className="w-4 h-4 text-zinc-500 absolute left-3.5 top-3" />
            <input
              type="email"
              value={loginEmail}
              onChange={(e) => setLoginEmail(e.target.value)}
              placeholder="name@dealflow360.com"
              required
              className="w-full bg-[#0D0D0D] border border-[#222222] focus:border-zinc-400 rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-white placeholder:text-zinc-600 focus:outline-none transition-colors"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-zinc-300 mb-1.5">
            Password
          </label>
          <div className="relative">
            <Lock className="w-4 h-4 text-zinc-500 absolute left-3.5 top-3" />
            <input
              type="password"
              value={loginPassword}
              onChange={(e) => setLoginPassword(e.target.value)}
              placeholder="••••••••"
              required
              className="w-full bg-[#0D0D0D] border border-[#222222] focus:border-zinc-400 rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-white placeholder:text-zinc-600 focus:outline-none transition-colors"
            />
          </div>
        </div>

        {loginError && (
          <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-medium">
            {loginError}
          </div>
        )}

        {/* Primary Login Button */}
        <button
          type="submit"
          disabled={isLoading}
          className="w-full py-3 rounded-xl bg-white hover:bg-zinc-200 text-black text-xs font-bold tracking-wide transition-all disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99]"
        >
          {isLoading ? (
            <span>Signing In...</span>
          ) : (
            <>
              <span>Sign In to Workspace</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </>
          )}
        </button>
      </form>

      {/* 4 Quick Fill Role Tiles (Clean, subtext removed) */}
      <div className="pt-2">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
            Quick Fill
          </span>
          <span className="text-[10px] text-zinc-500 font-mono">1-click</span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {quickFillRoles.map((role) => {
            const Icon = role.icon;
            const isSelected = activeRoleKey === role.key;
            return (
              <button
                key={role.key}
                type="button"
                onClick={() => handleRoleSelect(role.key, role.email, role.pass)}
                className={`py-3 px-3.5 rounded-xl border text-left transition-all relative flex items-center justify-between cursor-pointer ${
                  isSelected
                    ? 'bg-[#141414] border-zinc-400 ring-1 ring-zinc-500/30 text-white'
                    : 'bg-[#0D0D0D] border-[#1F1F1F] hover:border-zinc-600 text-zinc-300 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon className="w-4 h-4 text-zinc-400 shrink-0" />
                  <span className="text-xs font-semibold tracking-tight">
                    {role.title}
                  </span>
                </div>
                {isSelected && (
                  <Check className="w-3.5 h-3.5 text-zinc-200 shrink-0" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Navigation Links */}
      <div className="pt-4 border-t border-[#1C1C1C] space-y-3">
        {/* Link for Register with smooth flip transition */}
        <div className="text-center text-xs">
          <span className="text-zinc-400">Need a workspace account? </span>
          <button
            type="button"
            onClick={(e) => switchMode('signup', e)}
            className="font-semibold text-white hover:underline transition-colors ml-1 inline-flex items-center gap-1 cursor-pointer"
          >
            <span>Register Workspace User</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>

        {/* Link for Customer Portal */}
        <div className="pt-2 border-t border-[#171717] text-center">
          <a
            href="/portal/auth/login"
            className="inline-flex items-center justify-center gap-2 py-2 px-4 rounded-xl bg-[#0D0D0D] hover:bg-[#141414] border border-[#222222] text-zinc-300 hover:text-white text-xs font-medium transition-all w-full group"
          >
            <ExternalLink className="w-3.5 h-3.5 text-zinc-400 group-hover:text-white transition-colors" />
            <span>External Client? Access <strong>Customer Portal</strong></span>
          </a>
        </div>
      </div>
    </div>
  );

  // Render Signup Form Element (Subtext below Create Account removed)
  const renderSignupForm = () => (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header with zero subtext */}
      <div>
        <h1 className="text-3xl font-bold text-white tracking-tight">
          Create Account
        </h1>
      </div>

      {/* Main Signup Form */}
      <form onSubmit={handleSignupSubmit} className="space-y-3.5">
        <div>
          <label className="block text-xs font-medium text-zinc-300 mb-1.5">
            Full Name
          </label>
          <div className="relative">
            <UserIcon className="w-4 h-4 text-zinc-500 absolute left-3.5 top-3" />
            <input
              type="text"
              value={signupName}
              onChange={(e) => setSignupName(e.target.value)}
              placeholder="e.g. Alex Henderson"
              required
              className="w-full bg-[#0D0D0D] border border-[#222222] focus:border-zinc-400 rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-white placeholder:text-zinc-600 focus:outline-none transition-colors"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-zinc-300 mb-1.5">
            Business Email
          </label>
          <div className="relative">
            <Mail className="w-4 h-4 text-zinc-500 absolute left-3.5 top-3" />
            <input
              type="email"
              value={signupEmail}
              onChange={(e) => setSignupEmail(e.target.value)}
              placeholder="name@dealflow360.com"
              required
              className="w-full bg-[#0D0D0D] border border-[#222222] focus:border-zinc-400 rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-white placeholder:text-zinc-600 focus:outline-none transition-colors"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-zinc-300 mb-1.5">
            Password
          </label>
          <div className="relative">
            <Lock className="w-4 h-4 text-zinc-500 absolute left-3.5 top-3" />
            <input
              type="password"
              value={signupPassword}
              onChange={(e) => setSignupPassword(e.target.value)}
              placeholder="Min 8 chars"
              required
              className="w-full bg-[#0D0D0D] border border-[#222222] focus:border-zinc-400 rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-white placeholder:text-zinc-600 focus:outline-none transition-colors"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-zinc-300 mb-1.5">
            Account Role
          </label>
          <select
            value={signupRole}
            onChange={(e) => setSignupRole(e.target.value as Role)}
            className="w-full bg-[#0D0D0D] border border-[#222222] focus:border-zinc-400 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none transition-colors"
          >
            <option value={ROLES.SALES_REP}>Sales Representative</option>
            <option value={ROLES.SALES_MANAGER}>Sales Manager</option>
            <option value={ROLES.FINANCE}>Finance Lead</option>
            <option value={ROLES.ADMIN}>System Administrator</option>
          </select>
        </div>

        {signupError && (
          <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-medium">
            {signupError}
          </div>
        )}

        {/* Submit button */}
        <button
          type="submit"
          disabled={isLoading}
          className="w-full py-3 rounded-xl bg-white hover:bg-zinc-200 text-black text-xs font-bold tracking-wide transition-all disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99] mt-2"
        >
          {isLoading ? (
            <span>Provisioning Account...</span>
          ) : (
            <>
              <span>Create Account</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </>
          )}
        </button>
      </form>

      {/* Navigation Links */}
      <div className="pt-4 border-t border-[#1C1C1C] space-y-3">
        {/* Link back to login with smooth flip transition */}
        <div className="text-center text-xs">
          <span className="text-zinc-400">Already have an account? </span>
          <button
            type="button"
            onClick={(e) => switchMode('login', e)}
            className="font-semibold text-white hover:underline transition-colors ml-1 inline-flex items-center gap-1 cursor-pointer"
          >
            <span>Sign in</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>

        {/* Link for Customer Portal */}
        <div className="pt-2 border-t border-[#171717] text-center">
          <a
            href="/portal/auth/login"
            className="inline-flex items-center justify-center gap-2 py-2 px-4 rounded-xl bg-[#0D0D0D] hover:bg-[#141414] border border-[#222222] text-zinc-300 hover:text-white text-xs font-medium transition-all w-full group"
          >
            <ExternalLink className="w-3.5 h-3.5 text-zinc-400 group-hover:text-white transition-colors" />
            <span>External Client? Access <strong>Customer Portal</strong></span>
          </a>
        </div>
      </div>
    </div>
  );

  return (
    <AuthSplitLayout
      mode={mode}
      brandPanel={<InternalBrandPanel />}
      formContent={mode === 'signup' ? renderSignupForm() : renderLoginForm()}
    />
  );
};
