import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/auth.store';
import { toast } from 'sonner';

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
    <div className="min-h-screen w-full flex items-center justify-center bg-[#0B0D11] p-4 text-slate-100 animate-in fade-in duration-300">
      <div className="w-full max-w-md">
        {/* Brand Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-blue-600 text-white font-bold text-xl shadow-lg shadow-blue-500/20 mb-3">
            ◈
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">DealFlow360</h1>
          <p className="text-xs text-slate-400 mt-1 font-medium">Intelligent Sales Operations Platform</p>
        </div>

        {/* Login Card */}
        <div className="bg-[#12151C] border border-[#1E2430] rounded-2xl p-6 shadow-2xl space-y-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Business Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@dealflow360.com"
                required
                className="w-full bg-[#101319] border border-[#222834] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full bg-[#101319] border border-[#222834] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
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
          </form>

          {/* Demo Roles Quick Selection */}
          <div className="pt-4 border-t border-[#1E2430]">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-2">
              Quick Role Test Credentials
            </span>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                type="button"
                onClick={() => setDemoCredentials('admin@dealflow360.com', 'AdminP@ss123')}
                className="p-2 rounded-xl bg-[#161B24] border border-[#202735] hover:border-blue-500/50 text-left text-slate-300 transition-colors"
              >
                <div className="font-semibold text-white">Admin</div>
                <div className="text-[10px] text-slate-500">Full Access</div>
              </button>
              <button
                type="button"
                onClick={() => setDemoCredentials('manager@dealflow360.com', 'ManagerP@ss123')}
                className="p-2 rounded-xl bg-[#161B24] border border-[#202735] hover:border-blue-500/50 text-left text-slate-300 transition-colors"
              >
                <div className="font-semibold text-white">Sales Manager</div>
                <div className="text-[10px] text-slate-500">Approvals</div>
              </button>
              <button
                type="button"
                onClick={() => setDemoCredentials('rep@dealflow360.com', 'RepP@ss123')}
                className="p-2 rounded-xl bg-[#161B24] border border-[#202735] hover:border-blue-500/50 text-left text-slate-300 transition-colors"
              >
                <div className="font-semibold text-white">Sales Rep</div>
                <div className="text-[10px] text-slate-500">Quotes & Deals</div>
              </button>
              <button
                type="button"
                onClick={() => setDemoCredentials('finance@dealflow360.com', 'FinanceP@ss123')}
                className="p-2 rounded-xl bg-[#161B24] border border-[#202735] hover:border-blue-500/50 text-left text-slate-300 transition-colors"
              >
                <div className="font-semibold text-white">Finance</div>
                <div className="text-[10px] text-slate-500">Billing & Overrides</div>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
