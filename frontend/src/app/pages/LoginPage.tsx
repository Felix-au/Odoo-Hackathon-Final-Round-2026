import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../../stores/auth.store';
import { toast } from 'sonner';
import { ExternalLink, UserCheck, ShieldCheck } from 'lucide-react';

export function LoginPage() {
  const navigate = useNavigate();
  const { login, isLoading } = useAuthStore();
  const [email, setEmail] = useState('admin@dealflow360.com');
  const [password, setPassword] = useState('AdminP@ss123');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await login(email, password);
      toast.success('Welcome back to DealFlow360');
      navigate('/app/dashboard');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Invalid email or password';
      setError(msg);
      toast.error(msg);
    }
  };

  const setDemoCredentials = (roleEmail: string, rolePass: string) => {
    setEmail(roleEmail);
    setPassword(rolePass);
    setError(null);
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#09090B] p-4 text-slate-100 animate-in fade-in duration-300">
      <div className="w-full max-w-md space-y-4">
        {/* Brand Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-blue-600 text-white font-bold text-xl shadow-lg shadow-blue-500/20 mb-3">
            ◈
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">DealFlow360</h1>
          <p className="text-xs text-zinc-400 mt-1 font-medium">Intelligent Sales Operations & Quotation Governance</p>
        </div>

        {/* Login Card */}
        <div className="bg-[#121214] border border-[#27272A] rounded-2xl p-6 shadow-2xl space-y-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1">
                Business Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@dealflow360.com"
                required
                className="w-full bg-[#0D0D0F] border border-[#27272A] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full bg-[#0D0D0F] border border-[#27272A] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>

            {error && (
              <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-medium">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-lg shadow-blue-500/20 transition-all disabled:opacity-50"
            >
              {isLoading ? 'Signing In...' : 'Sign In to Workspace'}
            </button>

            <div className="pt-2 text-center border-t border-[#27272A]">
              <span className="text-xs text-zinc-400">Need a workspace account? </span>
              <Link to="/signup" className="text-xs font-bold text-blue-400 hover:text-blue-300 underline">
                Register Workspace User →
              </Link>
            </div>
          </form>

          {/* Quick Role Test Credentials */}
          <div className="pt-4 border-t border-[#27272A]">
            <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block mb-2">
              Quick Role Test Credentials
            </span>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                type="button"
                onClick={() => setDemoCredentials('admin@dealflow360.com', 'AdminP@ss123')}
                className="p-2.5 rounded-xl bg-[#18181B] border border-[#27272A] hover:border-blue-500/50 text-left text-zinc-300 transition-colors group"
              >
                <div className="font-semibold text-white group-hover:text-blue-400 transition-colors">Admin</div>
                <div className="text-[10px] text-zinc-500">Full System Access</div>
              </button>
              <button
                type="button"
                onClick={() => setDemoCredentials('manager@dealflow360.com', 'ManagerP@ss123')}
                className="p-2.5 rounded-xl bg-[#18181B] border border-[#27272A] hover:border-blue-500/50 text-left text-zinc-300 transition-colors group"
              >
                <div className="font-semibold text-white group-hover:text-blue-400 transition-colors">Sales Manager</div>
                <div className="text-[10px] text-zinc-500">Approval Workflows</div>
              </button>
              <button
                type="button"
                onClick={() => setDemoCredentials('rep@dealflow360.com', 'RepP@ss123')}
                className="p-2.5 rounded-xl bg-[#18181B] border border-[#27272A] hover:border-blue-500/50 text-left text-zinc-300 transition-colors group"
              >
                <div className="font-semibold text-white group-hover:text-blue-400 transition-colors">Sales Rep</div>
                <div className="text-[10px] text-zinc-500">Quotes & Pricing</div>
              </button>
              <button
                type="button"
                onClick={() => setDemoCredentials('finance@dealflow360.com', 'FinanceP@ss123')}
                className="p-2.5 rounded-xl bg-[#18181B] border border-[#27272A] hover:border-blue-500/50 text-left text-zinc-300 transition-colors group"
              >
                <div className="font-semibold text-white group-hover:text-blue-400 transition-colors">Finance</div>
                <div className="text-[10px] text-zinc-500">Billing & Overrides</div>
              </button>
            </div>
          </div>
        </div>

        {/* Customer Portal Entry Banner */}
        <div className="bg-[#121214] border border-[#27272A] rounded-2xl p-4 shadow-md space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-zinc-300 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              B2B Customer Portal
            </span>
            <span className="text-[10px] font-mono text-zinc-500">External Client Access</span>
          </div>
          <p className="text-[11px] text-zinc-400">
            Review quotation proposals, propose changes, and confirm orders directly.
          </p>
          <div className="grid grid-cols-2 gap-2 pt-1 text-xs">
            <Link
              to="/portal/auth/login"
              className="py-2 px-3 rounded-xl bg-[#18181B] border border-[#27272A] hover:border-emerald-500/40 text-emerald-400 hover:text-emerald-300 font-semibold flex items-center justify-center gap-1.5 transition-colors text-center"
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span>Customer Sign In</span>
            </Link>
            <Link
              to="/portal/auth/signup"
              className="py-2 px-3 rounded-xl bg-[#18181B] border border-[#27272A] hover:border-blue-500/40 text-blue-400 hover:text-blue-300 font-semibold flex items-center justify-center gap-1.5 transition-colors text-center"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Customer Sign Up</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
