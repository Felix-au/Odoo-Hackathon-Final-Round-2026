import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../../stores/auth.store';
import { Role, ROLES } from '../../lib/constants';
import { toast } from 'sonner';

export function SignupPage() {
  const navigate = useNavigate();
  const { signup, isLoading } = useAuthStore();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>(ROLES.SALES_REP);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await signup({ email, password, name, role });
      toast.success('Account created successfully! Welcome to DealFlow360.');
      navigate('/app/dashboard');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create account';
      setError(msg);
      toast.error(msg);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#0B0D11] p-4 text-slate-100 animate-in fade-in duration-300">
      <div className="w-full max-w-md">
        {/* Brand Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-blue-600 text-white font-bold text-xl shadow-lg shadow-blue-500/20 mb-3">
            ◈
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Create Workspace Account</h1>
          <p className="text-xs text-slate-400 mt-1 font-medium">Join the DealFlow360 platform</p>
        </div>

        {/* Signup Card */}
        <div className="bg-[#12151C] border border-[#1E2430] rounded-2xl p-6 shadow-2xl space-y-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Full Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. John Doe"
                required
                className="w-full bg-[#101319] border border-[#222834] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
              />
            </div>

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
                placeholder="••••••••"
                required
                className="w-full bg-[#101319] border border-[#222834] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Requirement: Min 8 chars, 1 uppercase, 1 number, and 1 special char (<code className="font-mono text-blue-400">!@#$%^&*</code>)
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Account Role
              </label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as Role)}
                className="w-full bg-[#101319] border border-[#222834] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
              >
                <option value={ROLES.SALES_REP}>Sales Representative (Standard)</option>
                <option value={ROLES.SALES_MANAGER}>Sales Manager (Approver)</option>
                <option value={ROLES.FINANCE}>Finance Approver</option>
                <option value={ROLES.ADMIN}>System Administrator</option>
              </select>
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-medium leading-relaxed">
                <strong>Registration Error:</strong> {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-lg shadow-blue-500/20 transition-all disabled:opacity-50"
            >
              {isLoading ? 'Creating Account...' : 'Register Workspace Account'}
            </button>

            <div className="pt-2 text-center border-t border-[#1E2430]">
              <span className="text-xs text-slate-400">Already registered? </span>
              <Link to="/login" className="text-xs font-bold text-blue-400 hover:text-blue-300 underline">
                Sign in
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
