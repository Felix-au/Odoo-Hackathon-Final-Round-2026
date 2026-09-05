import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../../stores/auth.store';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Card, CardContent } from '../../components/ui/Card';
import { toast } from 'sonner';
import { ShieldCheck } from 'lucide-react';

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
    <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-slate-100 via-blue-50/50 to-slate-200 p-4">
      <div className="w-full max-w-md">
        {/* Brand Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-primary text-white font-black text-xl shadow-lg mb-3">
            360
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">DealFlow360</h1>
          <p className="text-xs text-slate-500 mt-1 font-medium">Intelligent Sales Operations Platform</p>
        </div>

        {/* Login Card */}
        <Card className="shadow-glass-card border border-white/80 bg-white/95 backdrop-blur-md">
          <CardContent className="p-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Input
                  label="Business Email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@dealflow360.com"
                  required
                />
              </div>

              <div>
                <Input
                  label="Password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                />
              </div>

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 font-medium">
                  {error}
                </div>
              )}

              <Button type="submit" variant="primary" className="w-full py-2.5 mt-2 shadow-sm font-bold" isLoading={isLoading}>
                Sign In to Workspace
              </Button>

              <div className="pt-3 pb-1 text-center border-t border-slate-100">
                <p className="text-xs text-slate-500 mb-2 font-medium">Don't have a workspace account?</p>
                <Link
                  to="/signup"
                  className="inline-flex items-center justify-center w-full py-2 px-3 rounded-lg border-2 border-primary/30 text-xs font-bold text-primary bg-blue-50/50 hover:bg-blue-50 hover:border-primary transition-all"
                >
                  Create New Account / Sign Up →
                </Link>
              </div>
            </form>

            {/* Quick Demo Credentials */}
            <div className="mt-6 pt-5 border-t border-slate-100">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-primary" />
                Quick Demo Accounts (1-Click Fill)
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <button
                  type="button"
                  onClick={() => setDemoCredentials('admin@dealflow360.com', 'AdminP@ss123')}
                  className="p-2 text-left rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 transition-colors"
                >
                  <div className="font-bold text-slate-800">Admin</div>
                  <div className="text-slate-500 text-[10px] truncate">admin@dealflow360.com</div>
                </button>

                <button
                  type="button"
                  onClick={() => setDemoCredentials('manager1@dealflow360.com', 'ManagerP@ss123')}
                  className="p-2 text-left rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 transition-colors"
                >
                  <div className="font-bold text-slate-800">Sales Manager</div>
                  <div className="text-slate-500 text-[10px] truncate">manager1@dealflow360.com</div>
                </button>

                <button
                  type="button"
                  onClick={() => setDemoCredentials('finance@dealflow360.com', 'FinanceP@ss123')}
                  className="p-2 text-left rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 transition-colors"
                >
                  <div className="font-bold text-slate-800">Finance</div>
                  <div className="text-slate-500 text-[10px] truncate">finance@dealflow360.com</div>
                </button>

                <button
                  type="button"
                  onClick={() => setDemoCredentials('rep1@dealflow360.com', 'RepP@ss123')}
                  className="p-2 text-left rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 transition-colors"
                >
                  <div className="font-bold text-slate-800">Sales Rep</div>
                  <div className="text-slate-500 text-[10px] truncate">rep1@dealflow360.com</div>
                </button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Customer Portal Link */}
        <div className="text-center mt-6">
          <a
            href="/portal/auth/login"
            className="text-xs text-slate-500 hover:text-primary transition-colors font-medium"
          >
            Are you a B2B customer? Access Customer Portal ↗
          </a>
        </div>
      </div>
    </div>
  );
}
