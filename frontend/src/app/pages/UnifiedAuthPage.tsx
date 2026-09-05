import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuthStore } from '../../stores/auth.store';
import { usePortalAuthStore } from '../../stores/portal-auth.store';
import { Role, ROLES } from '../../lib/constants';
import { toast } from 'sonner';
import { AuthSplitLayout } from '../../components/auth/AuthSplitLayout';
import { InternalBrandPanel } from '../../components/auth/InternalBrandPanel';
import { PortalBrandPanel } from '../../components/auth/PortalBrandPanel';
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
  Check,
  CheckCircle2,
  Building2,
  Briefcase,
  KeyRound
} from 'lucide-react';

interface UnifiedAuthPageProps {
  initialScope?: 'workspace' | 'portal';
  initialMode?: 'login' | 'signup';
}

export const UnifiedAuthPage: React.FC<UnifiedAuthPageProps> = ({ 
  initialScope, 
  initialMode 
}) => {
  const location = useLocation();

  const deriveFromUrl = () => {
    const p = window.location.pathname;
    const isPortal = p.startsWith('/portal');
    const isSignup = p.endsWith('/signup');
    return {
      scope: (isPortal ? 'portal' : 'workspace') as 'workspace' | 'portal',
      mode: (isSignup ? 'signup' : 'login') as 'login' | 'signup',
    };
  };

  const initial = deriveFromUrl();
  const [scope, setScope] = useState<'workspace' | 'portal'>(initialScope || initial.scope);
  const [mode, setMode] = useState<'login' | 'signup'>(initialMode || initial.mode);

  // Dynamic side state: whenever any transition is triggered, the side dynamically inverts!
  const [isFormOnLeft, setIsFormOnLeft] = useState<boolean>(false);

  // Sync state if browser URL changes externally
  useEffect(() => {
    const current = deriveFromUrl();
    setScope(current.scope);
    setMode(current.mode);
  }, [location.pathname]);

  // Handle popstate for back/forward buttons
  useEffect(() => {
    const onPop = () => {
      const current = deriveFromUrl();
      setScope(current.scope);
      setMode(current.mode);
      setIsFormOnLeft((prev) => !prev);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  // Every single transition inverts the side so the form dynamically glides to the opposite side!
  const navigateState = (newScope: 'workspace' | 'portal', newMode: 'login' | 'signup', url: string, e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    setScope(newScope);
    setMode(newMode);
    setIsFormOnLeft((prev) => !prev);
    window.history.pushState({}, '', url);
  };

  // Auth stores
  const { login: workspaceLogin, signup: workspaceSignup, isLoading: isWorkspaceLoading } = useAuthStore();
  const { requestMagicLink, loginWithPassword, registerCustomer, isLoading: isPortalLoading } = usePortalAuthStore();

  // Workspace Login state
  const [wsEmail, setWsEmail] = useState('admin@dealflow360.com');
  const [wsPassword, setWsPassword] = useState('AdminP@ss123');
  const [wsLoginError, setWsLoginError] = useState<string | null>(null);
  const [activeWsRole, setActiveWsRole] = useState<string>('ADMIN');

  // Workspace Signup state
  const [wsName, setWsName] = useState('');
  const [wsSignEmail, setWsSignEmail] = useState('');
  const [wsSignPass, setWsSignPass] = useState('');
  const [wsRole, setWsRole] = useState<Role>(ROLES.SALES_REP);
  const [wsSignError, setWsSignError] = useState<string | null>(null);

  // Portal Login state
  const [portalTab, setPortalTab] = useState<'PASSWORD' | 'MAGIC_LINK'>('PASSWORD');
  const [portalEmail, setPortalEmail] = useState('acme@example.com');
  const [portalPassword, setPortalPassword] = useState('CustomerP@ss123');
  const [activePortalProfile, setActivePortalProfile] = useState<string>('ACME');

  // Portal Signup state
  const [companyName, setCompanyName] = useState('');
  const [contactName, setContactName] = useState('');
  const [portalSignEmail, setPortalSignEmail] = useState('');
  const [portalSignPass, setPortalSignPass] = useState('');
  const [isPortalSignSuccess, setIsPortalSignSuccess] = useState(false);
  const [isPortalSigningUp, setIsPortalSigningUp] = useState(false);

  useEffect(() => {
    setWsLoginError(null);
    setWsSignError(null);
    setIsPortalSignSuccess(false);
  }, [mode, scope]);

  // Handle Workspace Login
  const handleWsLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setWsLoginError(null);
    try {
      await workspaceLogin(wsEmail, wsPassword);
      toast.success('Welcome back to DealFlow360');
      window.location.href = '/app/dashboard';
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Invalid credentials';
      setWsLoginError(msg);
      toast.error(msg);
    }
  };

  // Handle Workspace Signup
  const handleWsSignupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setWsSignError(null);
    try {
      await workspaceSignup({
        email: wsSignEmail,
        password: wsSignPass,
        name: wsName,
        role: wsRole,
      });
      toast.success('Workspace account created successfully!');
      window.location.href = '/app/dashboard';
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Registration failed';
      setWsSignError(msg);
      toast.error(msg);
    }
  };

  // Handle Portal Password Login
  const handlePortalPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await loginWithPassword(portalEmail, portalPassword);
      toast.success('Signed in to Customer Portal');
      window.location.href = '/portal/quotations/q-001';
    } catch (err: any) {
      const msg = err.response?.data?.detail || err.message || 'Invalid customer credentials';
      toast.error(msg);
    }
  };

  // Handle Portal Magic Link
  const handlePortalMagicSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await requestMagicLink(portalEmail);
      window.location.href = `/portal/auth/magic-link-sent?email=${encodeURIComponent(portalEmail)}`;
    } catch {
      toast.error('Unable to send magic link');
    }
  };

  // Handle Portal Signup
  const handlePortalSignupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsPortalSigningUp(true);
    try {
      await registerCustomer({
        email: portalSignEmail,
        password: portalSignPass,
        companyName,
        contactName,
      });
      setIsPortalSignSuccess(true);
      toast.success('Customer profile registered! Redirecting to portal...');
      setTimeout(() => {
        window.location.href = '/portal/quotations/q-001';
      }, 600);
    } catch (err: any) {
      const msg = err.response?.data?.detail || err.message || 'Registration failed';
      toast.error(msg);
    } finally {
      setIsPortalSigningUp(false);
    }
  };

  const quickFillRoles = [
    { key: 'ADMIN', title: 'System Admin', email: 'admin@dealflow360.com', pass: 'AdminP@ss123', icon: Shield },
    { key: 'MANAGER', title: 'Sales Manager', email: 'manager@dealflow360.com', pass: 'ManagerP@ss123', icon: Users },
    { key: 'REP', title: 'Sales Rep', email: 'rep@dealflow360.com', pass: 'RepP@ss123', icon: FileSpreadsheet },
    { key: 'FINANCE', title: 'Finance Lead', email: 'finance@dealflow360.com', pass: 'FinanceP@ss123', icon: Landmark },
  ];

  const quickFillProfiles = [
    { key: 'ACME', company: 'Acme Corp', email: 'acme@example.com', pass: 'CustomerP@ss123', icon: Building2 },
    { key: 'BETA', company: 'Beta Industries', email: 'beta@example.com', pass: 'CustomerP@ss123', icon: Briefcase },
  ];

  // 1. Workspace Login Form
  const renderWorkspaceLoginForm = () => (
    <div className="w-full space-y-6 animate-in fade-in duration-300">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-white tracking-tight">
          Sign In
        </h1>
      </div>

      <form onSubmit={handleWsLoginSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-zinc-300 mb-1.5 text-left">
            Business Email
          </label>
          <div className="relative">
            <Mail className="w-4 h-4 text-zinc-500 absolute left-3.5 top-3" />
            <input
              type="email"
              value={wsEmail}
              onChange={(e) => setWsEmail(e.target.value)}
              placeholder="name@dealflow360.com"
              required
              className="w-full bg-[#0D0D0D] border border-[#222222] focus:border-zinc-400 rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-white placeholder:text-zinc-600 focus:outline-none transition-colors"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-zinc-300 mb-1.5 text-left">
            Password
          </label>
          <div className="relative">
            <Lock className="w-4 h-4 text-zinc-500 absolute left-3.5 top-3" />
            <input
              type="password"
              value={wsPassword}
              onChange={(e) => setWsPassword(e.target.value)}
              placeholder="••••••••"
              required
              className="w-full bg-[#0D0D0D] border border-[#222222] focus:border-zinc-400 rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-white placeholder:text-zinc-600 focus:outline-none transition-colors"
            />
          </div>
        </div>

        {wsLoginError && (
          <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-medium text-center">
            {wsLoginError}
          </div>
        )}

        <button
          type="submit"
          disabled={isWorkspaceLoading}
          className="w-full py-3 rounded-xl bg-white hover:bg-zinc-200 text-black text-xs font-bold tracking-wide transition-all disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99]"
        >
          {isWorkspaceLoading ? (
            <span>Signing In...</span>
          ) : (
            <>
              <span>Sign In to Workspace</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </>
          )}
        </button>
      </form>

      {/* Quick Fill Role Tiles */}
      <div className="pt-2">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
            Quick Fill
          </span>
          <span className="text-[10px] text-zinc-500 font-mono">1-click</span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {quickFillRoles.map((r) => {
            const Icon = r.icon;
            const isSelected = activeWsRole === r.key;
            return (
              <button
                key={r.key}
                type="button"
                onClick={() => {
                  setActiveWsRole(r.key);
                  setWsEmail(r.email);
                  setWsPassword(r.pass);
                  setWsLoginError(null);
                  toast.info(`Filled credentials for ${r.email}`);
                }}
                className={`py-3 px-3.5 rounded-xl border text-left transition-all relative flex items-center justify-between cursor-pointer ${
                  isSelected
                    ? 'bg-[#141414] border-zinc-400 ring-1 ring-zinc-500/30 text-white'
                    : 'bg-[#0D0D0D] border-[#1F1F1F] hover:border-zinc-600 text-zinc-300 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon className="w-4 h-4 text-zinc-400 shrink-0" />
                  <span className="text-xs font-semibold tracking-tight">
                    {r.title}
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
      <div className="pt-4 border-t border-[#1C1C1C] space-y-3 text-center">
        <div className="text-xs">
          <span className="text-zinc-400">Need a workspace account? </span>
          <button
            type="button"
            onClick={(e) => navigateState('workspace', 'signup', '/signup', e)}
            className="font-semibold text-white hover:underline transition-colors ml-1 inline-flex items-center gap-1 cursor-pointer"
          >
            <span>Register Workspace User</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>

        <div className="pt-2 border-t border-[#171717]">
          <button
            type="button"
            onClick={(e) => navigateState('portal', 'login', '/portal/auth/login', e)}
            className="inline-flex items-center justify-center gap-2 py-2 px-4 rounded-xl bg-[#0D0D0D] hover:bg-[#141414] border border-[#222222] text-zinc-300 hover:text-white text-xs font-medium transition-all w-full cursor-pointer group"
          >
            <ExternalLink className="w-3.5 h-3.5 text-zinc-400 group-hover:text-white transition-colors" />
            <span>External Client? Access <strong>Customer Portal</strong></span>
          </button>
        </div>
      </div>
    </div>
  );

  // 2. Workspace Signup Form
  const renderWorkspaceSignupForm = () => (
    <div className="w-full space-y-6 animate-in fade-in duration-300">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-white tracking-tight">
          Create Account
        </h1>
      </div>

      <form onSubmit={handleWsSignupSubmit} className="space-y-3.5">
        <div>
          <label className="block text-xs font-medium text-zinc-300 mb-1.5 text-left">
            Full Name
          </label>
          <div className="relative">
            <UserIcon className="w-4 h-4 text-zinc-500 absolute left-3.5 top-3" />
            <input
              type="text"
              value={wsName}
              onChange={(e) => setWsName(e.target.value)}
              placeholder="e.g. Alex Henderson"
              required
              className="w-full bg-[#0D0D0D] border border-[#222222] focus:border-zinc-400 rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-white placeholder:text-zinc-600 focus:outline-none transition-colors"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-zinc-300 mb-1.5 text-left">
            Business Email
          </label>
          <div className="relative">
            <Mail className="w-4 h-4 text-zinc-500 absolute left-3.5 top-3" />
            <input
              type="email"
              value={wsSignEmail}
              onChange={(e) => setWsSignEmail(e.target.value)}
              placeholder="name@dealflow360.com"
              required
              className="w-full bg-[#0D0D0D] border border-[#222222] focus:border-zinc-400 rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-white placeholder:text-zinc-600 focus:outline-none transition-colors"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-zinc-300 mb-1.5 text-left">
            Password
          </label>
          <div className="relative">
            <Lock className="w-4 h-4 text-zinc-500 absolute left-3.5 top-3" />
            <input
              type="password"
              value={wsSignPass}
              onChange={(e) => setWsSignPass(e.target.value)}
              placeholder="Min 8 chars"
              required
              className="w-full bg-[#0D0D0D] border border-[#222222] focus:border-zinc-400 rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-white placeholder:text-zinc-600 focus:outline-none transition-colors"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-zinc-300 mb-1.5 text-left">
            Account Role
          </label>
          <select
            value={wsRole}
            onChange={(e) => setWsRole(e.target.value as Role)}
            className="w-full bg-[#0D0D0D] border border-[#222222] focus:border-zinc-400 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none transition-colors"
          >
            <option value={ROLES.SALES_REP}>Sales Representative</option>
            <option value={ROLES.SALES_MANAGER}>Sales Manager</option>
            <option value={ROLES.FINANCE}>Finance Lead</option>
            <option value={ROLES.ADMIN}>System Administrator</option>
          </select>
        </div>

        {wsSignError && (
          <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-medium text-center">
            {wsSignError}
          </div>
        )}

        <button
          type="submit"
          disabled={isWorkspaceLoading}
          className="w-full py-3 rounded-xl bg-white hover:bg-zinc-200 text-black text-xs font-bold tracking-wide transition-all disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99] mt-2"
        >
          {isWorkspaceLoading ? (
            <span>Provisioning Account...</span>
          ) : (
            <>
              <span>Create Account</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </>
          )}
        </button>
      </form>

      <div className="pt-4 border-t border-[#1C1C1C] space-y-3 text-center">
        <div className="text-xs">
          <span className="text-zinc-400">Already have an account? </span>
          <button
            type="button"
            onClick={(e) => navigateState('workspace', 'login', '/login', e)}
            className="font-semibold text-white hover:underline transition-colors ml-1 inline-flex items-center gap-1 cursor-pointer"
          >
            <span>Sign in</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>

        <div className="pt-2 border-t border-[#171717]">
          <button
            type="button"
            onClick={(e) => navigateState('portal', 'login', '/portal/auth/login', e)}
            className="inline-flex items-center justify-center gap-2 py-2 px-4 rounded-xl bg-[#0D0D0D] hover:bg-[#141414] border border-[#222222] text-zinc-300 hover:text-white text-xs font-medium transition-all w-full cursor-pointer group"
          >
            <ExternalLink className="w-3.5 h-3.5 text-zinc-400 group-hover:text-white transition-colors" />
            <span>External Client? Access <strong>Customer Portal</strong></span>
          </button>
        </div>
      </div>
    </div>
  );

  // 3. Portal Login Form
  const renderPortalLoginForm = () => (
    <div className="w-full space-y-6 animate-in fade-in duration-300">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-white tracking-tight">
          Client Sign In
        </h1>
      </div>

      <div className="grid grid-cols-2 p-1 bg-[#0D0D0D] border border-[#1F1F1F] rounded-xl text-xs font-semibold">
        <button
          type="button"
          onClick={() => setPortalTab('PASSWORD')}
          className={`py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            portalTab === 'PASSWORD'
              ? 'bg-[#1C1C1C] text-white shadow-sm font-bold border border-zinc-700'
              : 'text-zinc-400 hover:text-white'
          }`}
        >
          <KeyRound className="w-3.5 h-3.5 text-zinc-400" />
          <span>Password</span>
        </button>
        <button
          type="button"
          onClick={() => setPortalTab('MAGIC_LINK')}
          className={`py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            portalTab === 'MAGIC_LINK'
              ? 'bg-[#1C1C1C] text-white shadow-sm font-bold border border-zinc-700'
              : 'text-zinc-400 hover:text-white'
          }`}
        >
          <Mail className="w-3.5 h-3.5 text-zinc-400" />
          <span>Magic Link</span>
        </button>
      </div>

      {portalTab === 'PASSWORD' ? (
        <form onSubmit={handlePortalPasswordSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1.5 text-left">
              Authorized Business Email
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-zinc-500 absolute left-3.5 top-3" />
              <input
                type="email"
                value={portalEmail}
                onChange={(e) => setPortalEmail(e.target.value)}
                placeholder="procurement@company.com"
                required
                className="w-full bg-[#0D0D0D] border border-[#222222] focus:border-zinc-400 rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-white placeholder:text-zinc-600 focus:outline-none transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1.5 text-left">
              Portal Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-zinc-500 absolute left-3.5 top-3" />
              <input
                type="password"
                value={portalPassword}
                onChange={(e) => setPortalPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full bg-[#0D0D0D] border border-[#222222] focus:border-zinc-400 rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-white placeholder:text-zinc-600 focus:outline-none transition-colors"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isPortalLoading}
            className="w-full py-3 rounded-xl bg-white hover:bg-zinc-200 text-black text-xs font-bold tracking-wide transition-all disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99]"
          >
            {isPortalLoading ? (
              <span>Authenticating...</span>
            ) : (
              <>
                <span>Sign In to Customer Portal</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        </form>
      ) : (
        <form onSubmit={handlePortalMagicSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1.5 text-left">
              Registered Corporate Email
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-zinc-500 absolute left-3.5 top-3" />
              <input
                type="email"
                value={portalEmail}
                onChange={(e) => setPortalEmail(e.target.value)}
                placeholder="buyer@enterprise.com"
                required
                className="w-full bg-[#0D0D0D] border border-[#222222] focus:border-zinc-400 rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-white placeholder:text-zinc-600 focus:outline-none transition-colors"
              />
            </div>
            <p className="text-[11px] text-zinc-500 mt-1.5 text-left">
              A one-time sign-in link will be dispatched to your corporate inbox.
            </p>
          </div>

          <button
            type="submit"
            disabled={isPortalLoading}
            className="w-full py-3 rounded-xl bg-white hover:bg-zinc-200 text-black text-xs font-bold tracking-wide transition-all disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99]"
          >
            {isPortalLoading ? (
              <span>Dispatching Link...</span>
            ) : (
              <>
                <span>Send One-Time Login Link</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        </form>
      )}

      {/* Quick Fill Profiles */}
      <div className="pt-2">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
            Quick Fill
          </span>
          <span className="text-[10px] text-zinc-500 font-mono">1-click</span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {quickFillProfiles.map((p) => {
            const Icon = p.icon;
            const isSelected = activePortalProfile === p.key;
            return (
              <button
                key={p.key}
                type="button"
                onClick={() => {
                  setActivePortalProfile(p.key);
                  setPortalEmail(p.email);
                  setPortalPassword(p.pass);
                  setPortalTab('PASSWORD');
                  toast.info(`Filled credentials for ${p.email}`);
                }}
                className={`py-3 px-3.5 rounded-xl border text-left transition-all relative flex items-center justify-between cursor-pointer ${
                  isSelected
                    ? 'bg-[#141414] border-zinc-400 ring-1 ring-zinc-500/30 text-white'
                    : 'bg-[#0D0D0D] border-[#1F1F1F] hover:border-zinc-600 text-zinc-300 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon className="w-4 h-4 text-zinc-400 shrink-0" />
                  <span className="text-xs font-semibold tracking-tight">
                    {p.company}
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

      <div className="pt-4 border-t border-[#1C1C1C] space-y-3 text-center">
        <div className="text-xs">
          <span className="text-zinc-400">New corporate customer? </span>
          <button
            type="button"
            onClick={(e) => navigateState('portal', 'signup', '/portal/auth/signup', e)}
            className="font-semibold text-white hover:underline transition-colors ml-1 inline-flex items-center gap-1 cursor-pointer"
          >
            <span>Register for Portal</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>

        <div className="pt-2 border-t border-[#171717]">
          <button
            type="button"
            onClick={(e) => navigateState('workspace', 'login', '/login', e)}
            className="inline-flex items-center justify-center gap-2 py-2 px-4 rounded-xl bg-[#0D0D0D] hover:bg-[#141414] border border-[#222222] text-zinc-300 hover:text-white text-xs font-medium transition-all w-full cursor-pointer group"
          >
            <ExternalLink className="w-3.5 h-3.5 text-zinc-400 group-hover:text-white transition-colors" />
            <span>Internal Team Member? Return to <strong>Workspace Login</strong></span>
          </button>
        </div>
      </div>
    </div>
  );

  // 4. Portal Signup Form
  const renderPortalSignupForm = () => (
    <div className="w-full space-y-6 animate-in fade-in duration-300">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-white tracking-tight">
          Client Registration
        </h1>
      </div>

      {isPortalSignSuccess ? (
        <div className="p-6 rounded-2xl bg-[#0D0D0D] border border-zinc-700 text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-zinc-800 text-white flex items-center justify-center mx-auto border border-zinc-700">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Registration Complete</h3>
            <p className="text-xs text-zinc-400 mt-1 max-w-xs mx-auto">
              Your organization account is ready. Proceed to sign in.
            </p>
          </div>
          <button
            type="button"
            onClick={(e) => navigateState('portal', 'login', '/portal/auth/login', e)}
            className="inline-flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-white text-black text-xs font-bold cursor-pointer"
          >
            <span>Proceed to Sign In</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        <form onSubmit={handlePortalSignupSubmit} className="space-y-3.5">
          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1.5 text-left">
              Company Name
            </label>
            <div className="relative">
              <Building2 className="w-4 h-4 text-zinc-500 absolute left-3.5 top-3" />
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="e.g. Acme Global Industries"
                required
                className="w-full bg-[#0D0D0D] border border-[#222222] focus:border-zinc-400 rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-white placeholder:text-zinc-600 focus:outline-none transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1.5 text-left">
              Representative Name
            </label>
            <div className="relative">
              <UserIcon className="w-4 h-4 text-zinc-500 absolute left-3.5 top-3" />
              <input
                type="text"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                placeholder="e.g. Sarah Jenkins"
                required
                className="w-full bg-[#0D0D0D] border border-[#222222] focus:border-zinc-400 rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-white placeholder:text-zinc-600 focus:outline-none transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1.5 text-left">
              Corporate Work Email
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-zinc-500 absolute left-3.5 top-3" />
              <input
                type="email"
                value={portalSignEmail}
                onChange={(e) => setPortalSignEmail(e.target.value)}
                placeholder="procurement@company.com"
                required
                className="w-full bg-[#0D0D0D] border border-[#222222] focus:border-zinc-400 rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-white placeholder:text-zinc-600 focus:outline-none transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1.5 text-left">
              Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-zinc-500 absolute left-3.5 top-3" />
              <input
                type="password"
                value={portalSignPass}
                onChange={(e) => setPortalSignPass(e.target.value)}
                placeholder="Create a password"
                required
                className="w-full bg-[#0D0D0D] border border-[#222222] focus:border-zinc-400 rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-white placeholder:text-zinc-600 focus:outline-none transition-colors"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isPortalSigningUp}
            className="w-full py-3 rounded-xl bg-white hover:bg-zinc-200 text-black text-xs font-bold tracking-wide transition-all disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99] mt-2"
          >
            {isPortalSigningUp ? (
              <span>Registering Account...</span>
            ) : (
              <>
                <span>Register Customer Account</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        </form>
      )}

      <div className="pt-4 border-t border-[#1C1C1C] space-y-3 text-center">
        <div className="text-xs">
          <span className="text-zinc-400">Already registered? </span>
          <button
            type="button"
            onClick={(e) => navigateState('portal', 'login', '/portal/auth/login', e)}
            className="font-semibold text-white hover:underline transition-colors ml-1 inline-flex items-center gap-1 cursor-pointer"
          >
            <span>Customer Sign In</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>

        <div className="pt-2 border-t border-[#171717]">
          <button
            type="button"
            onClick={(e) => navigateState('workspace', 'login', '/login', e)}
            className="inline-flex items-center justify-center gap-2 py-2 px-4 rounded-xl bg-[#0D0D0D] hover:bg-[#141414] border border-[#222222] text-zinc-300 hover:text-white text-xs font-medium transition-all w-full cursor-pointer group"
          >
            <ExternalLink className="w-3.5 h-3.5 text-zinc-400 group-hover:text-white transition-colors" />
            <span>Internal Team Member? Return to <strong>Workspace Login</strong></span>
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <AuthSplitLayout
      isFormOnLeft={isFormOnLeft}
      brandPanel={
        <div className="relative w-full h-full">
          <div className={`transition-opacity duration-500 ${scope === 'workspace' ? 'opacity-100' : 'opacity-0 pointer-events-none absolute inset-0'}`}>
            <InternalBrandPanel />
          </div>
          <div className={`transition-opacity duration-500 ${scope === 'portal' ? 'opacity-100' : 'opacity-0 pointer-events-none absolute inset-0'}`}>
            <PortalBrandPanel />
          </div>
        </div>
      }
      formContent={
        <div className="relative w-full flex flex-col justify-center items-center">
          {scope === 'workspace' && mode === 'login' && renderWorkspaceLoginForm()}
          {scope === 'workspace' && mode === 'signup' && renderWorkspaceSignupForm()}
          {scope === 'portal' && mode === 'login' && renderPortalLoginForm()}
          {scope === 'portal' && mode === 'signup' && renderPortalSignupForm()}
        </div>
      }
    />
  );
};
