import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { usePortalAuthStore } from '../../stores/portal-auth.store';
import { toast } from 'sonner';
import { AuthSplitLayout } from '../../components/auth/AuthSplitLayout';
import { PortalBrandPanel } from '../../components/auth/PortalBrandPanel';
import { 
  Building2, 
  Mail, 
  Lock, 
  User as UserIcon, 
  ArrowRight, 
  KeyRound, 
  ExternalLink,
  Check,
  CheckCircle2,
  Briefcase
} from 'lucide-react';

interface CustomerPortalAuthPageProps {
  initialMode?: 'login' | 'signup';
}

export const CustomerPortalAuthPage: React.FC<CustomerPortalAuthPageProps> = ({ 
  initialMode 
}) => {
  const location = useLocation();

  // State-driven mode ensures zero-unmount, silky smooth 60fps CSS transitions
  const [mode, setMode] = useState<'login' | 'signup'>(() => {
    if (initialMode) return initialMode;
    return location.pathname.includes('signup') ? 'signup' : 'login';
  });

  useEffect(() => {
    const isSignupPath = location.pathname.includes('signup');
    setMode(isSignupPath ? 'signup' : 'login');
  }, [location.pathname]);

  useEffect(() => {
    const handlePop = () => {
      setMode(window.location.pathname.includes('signup') ? 'signup' : 'login');
    };
    window.addEventListener('popstate', handlePop);
    return () => window.removeEventListener('popstate', handlePop);
  }, []);

  const switchMode = (newMode: 'login' | 'signup', e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    setMode(newMode);
    window.history.pushState({}, '', newMode === 'signup' ? '/portal/auth/signup' : '/portal/auth/login');
  };

  const { requestMagicLink, loginWithPassword, registerCustomer, isLoading } = usePortalAuthStore();

  // Login Tabs: PASSWORD vs MAGIC_LINK
  const [activeTab, setActiveTab] = useState<'PASSWORD' | 'MAGIC_LINK'>('PASSWORD');
  const [loginEmail, setLoginEmail] = useState('acme@example.com');
  const [loginPassword, setLoginPassword] = useState('CustomerP@ss123');
  const [activeProfileKey, setActiveProfileKey] = useState<string>('ACME');

  // Signup Fields
  const [companyName, setCompanyName] = useState('');
  const [contactName, setContactName] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [isSignupSuccess, setIsSignupSuccess] = useState(false);
  const [isSigningUp, setIsSigningUp] = useState(false);

  useEffect(() => {
    setIsSignupSuccess(false);
  }, [mode]);

  // Handle Magic Link
  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await requestMagicLink(loginEmail);
      window.location.href = `/portal/auth/magic-link-sent?email=${encodeURIComponent(loginEmail)}`;
    } catch {
      toast.error('Unable to dispatch login link');
    }
  };

  // Handle Password Login
  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await loginWithPassword(loginEmail, loginPassword);
      toast.success('Signed in to Customer Portal');
      window.location.href = '/portal/quotations/q-001';
    } catch (err: any) {
      const msg = err.response?.data?.detail || err.message || 'Invalid customer credentials';
      toast.error(msg);
    }
  };

  // Handle Registration Submit
  const handleSignupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSigningUp(true);
    try {
      await registerCustomer({
        email: signupEmail,
        password: signupPassword,
        companyName,
        contactName,
      });
      setIsSignupSuccess(true);
      toast.success('Registration successful! Redirecting to client portal...');
      setTimeout(() => {
        window.location.href = '/portal/quotations/q-001';
      }, 600);
    } catch (err: any) {
      const msg = err.response?.data?.detail || err.message || 'Registration failed. Please contact your account manager.';
      toast.error(msg);
    } finally {
      setIsSigningUp(false);
    }
  };

  // Quick Client Profile Selection (Clean, no subtext)
  const quickFillProfiles = [
    {
      key: 'ACME',
      company: 'Acme Corp',
      email: 'acme@example.com',
      pass: 'CustomerP@ss123',
      icon: Building2,
    },
    {
      key: 'BETA',
      company: 'Beta Industries',
      email: 'beta@example.com',
      pass: 'CustomerP@ss123',
      icon: Briefcase,
    },
  ];

  const handleProfileSelect = (key: string, email: string, pass: string) => {
    setActiveProfileKey(key);
    setLoginEmail(email);
    setLoginPassword(pass);
    setActiveTab('PASSWORD');
    toast.info(`Filled credentials for ${email}`);
  };

  // Render Login Form Element (Subtext removed)
  const renderLoginForm = () => (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header with zero subtext */}
      <div>
        <h1 className="text-3xl font-bold text-white tracking-tight">
          Client Sign In
        </h1>
      </div>

      {/* Tab Switcher */}
      <div className="grid grid-cols-2 p-1 bg-[#0D0D0D] border border-[#1F1F1F] rounded-xl text-xs font-semibold">
        <button
          type="button"
          onClick={() => setActiveTab('PASSWORD')}
          className={`py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === 'PASSWORD'
              ? 'bg-[#1C1C1C] text-white shadow-sm font-bold border border-zinc-700'
              : 'text-zinc-400 hover:text-white'
          }`}
        >
          <KeyRound className="w-3.5 h-3.5 text-zinc-400" />
          <span>Password</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('MAGIC_LINK')}
          className={`py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === 'MAGIC_LINK'
              ? 'bg-[#1C1C1C] text-white shadow-sm font-bold border border-zinc-700'
              : 'text-zinc-400 hover:text-white'
          }`}
        >
          <Mail className="w-3.5 h-3.5 text-zinc-400" />
          <span>Magic Link</span>
        </button>
      </div>

      {/* Active Tab Form */}
      {activeTab === 'PASSWORD' ? (
        <form onSubmit={handlePasswordLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1.5">
              Authorized Business Email
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-zinc-500 absolute left-3.5 top-3" />
              <input
                type="email"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                placeholder="procurement@company.com"
                required
                className="w-full bg-[#0D0D0D] border border-[#222222] focus:border-zinc-400 rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-white placeholder:text-zinc-600 focus:outline-none transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1.5">
              Portal Password
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

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 rounded-xl bg-white hover:bg-zinc-200 text-black text-xs font-bold tracking-wide transition-all disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99]"
          >
            {isLoading ? (
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
        <form onSubmit={handleMagicLink} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1.5">
              Registered Corporate Email
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-zinc-500 absolute left-3.5 top-3" />
              <input
                type="email"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                placeholder="buyer@enterprise.com"
                required
                className="w-full bg-[#0D0D0D] border border-[#222222] focus:border-zinc-400 rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-white placeholder:text-zinc-600 focus:outline-none transition-colors"
              />
            </div>
            <p className="text-[11px] text-zinc-500 mt-1.5">
              A one-time sign-in link will be dispatched to your corporate inbox.
            </p>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 rounded-xl bg-white hover:bg-zinc-200 text-black text-xs font-bold tracking-wide transition-all disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99]"
          >
            {isLoading ? (
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

      {/* Quick Autofill Profile Tiles (Clean, subtext removed) */}
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
            const isSelected = activeProfileKey === p.key;
            return (
              <button
                key={p.key}
                type="button"
                onClick={() => handleProfileSelect(p.key, p.email, p.pass)}
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

      {/* Navigation Links */}
      <div className="pt-4 border-t border-[#1C1C1C] space-y-3">
        {/* Register for Customer Portal link with smooth flip */}
        <div className="text-center text-xs">
          <span className="text-zinc-400">New corporate customer? </span>
          <button
            type="button"
            onClick={(e) => switchMode('signup', e)}
            className="font-semibold text-white hover:underline transition-colors ml-1 inline-flex items-center gap-1 cursor-pointer"
          >
            <span>Register for Portal</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>

        {/* Link back to internal workspace */}
        <div className="pt-2 border-t border-[#171717] text-center">
          <a
            href="/login"
            className="inline-flex items-center justify-center gap-2 py-2 px-4 rounded-xl bg-[#0D0D0D] hover:bg-[#141414] border border-[#222222] text-zinc-300 hover:text-white text-xs font-medium transition-all w-full group"
          >
            <ExternalLink className="w-3.5 h-3.5 text-zinc-400 group-hover:text-white transition-colors" />
            <span>Internal Team Member? Return to <strong>Workspace Login</strong></span>
          </a>
        </div>
      </div>
    </div>
  );

  // Render Signup Form Element (Subtext removed)
  const renderSignupForm = () => (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header with zero subtext */}
      <div>
        <h1 className="text-3xl font-bold text-white tracking-tight">
          Client Registration
        </h1>
      </div>

      {isSignupSuccess ? (
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
            onClick={(e) => switchMode('login', e)}
            className="inline-flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-white text-black text-xs font-bold cursor-pointer"
          >
            <span>Proceed to Sign In</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        <form onSubmit={handleSignupSubmit} className="space-y-3.5">
          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1.5">
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
            <label className="block text-xs font-medium text-zinc-300 mb-1.5">
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
            <label className="block text-xs font-medium text-zinc-300 mb-1.5">
              Corporate Work Email
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-zinc-500 absolute left-3.5 top-3" />
              <input
                type="email"
                value={signupEmail}
                onChange={(e) => setSignupEmail(e.target.value)}
                placeholder="procurement@company.com"
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
                placeholder="Create a password"
                required
                className="w-full bg-[#0D0D0D] border border-[#222222] focus:border-zinc-400 rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-white placeholder:text-zinc-600 focus:outline-none transition-colors"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSigningUp}
            className="w-full py-3 rounded-xl bg-white hover:bg-zinc-200 text-black text-xs font-bold tracking-wide transition-all disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99] mt-2"
          >
            {isSigningUp ? (
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

      {/* Navigation Links */}
      <div className="pt-4 border-t border-[#1C1C1C] space-y-3">
        {/* Link back to customer portal sign in with smooth flip */}
        <div className="text-center text-xs">
          <span className="text-zinc-400">Already registered? </span>
          <button
            type="button"
            onClick={(e) => switchMode('login', e)}
            className="font-semibold text-white hover:underline transition-colors ml-1 inline-flex items-center gap-1 cursor-pointer"
          >
            <span>Customer Sign In</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>

        {/* Link back to internal workspace */}
        <div className="pt-2 border-t border-[#171717] text-center">
          <a
            href="/login"
            className="inline-flex items-center justify-center gap-2 py-2 px-4 rounded-xl bg-[#0D0D0D] hover:bg-[#141414] border border-[#222222] text-zinc-300 hover:text-white text-xs font-medium transition-all w-full group"
          >
            <ExternalLink className="w-3.5 h-3.5 text-zinc-400 group-hover:text-white transition-colors" />
            <span>Internal Team Member? Return to <strong>Workspace Login</strong></span>
          </a>
        </div>
      </div>
    </div>
  );

  return (
    <AuthSplitLayout
      mode={mode}
      brandPanel={<PortalBrandPanel />}
      formContent={mode === 'signup' ? renderSignupForm() : renderLoginForm()}
    />
  );
};
