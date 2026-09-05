import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../../stores/auth.store';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Card, CardContent } from '../../components/ui/Card';
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
    <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-slate-100 via-blue-50/50 to-slate-200 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-primary text-white font-black text-xl shadow-lg mb-3">
            360
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Create Workspace Account</h1>
          <p className="text-xs text-slate-500 mt-1 font-medium">Join the DealFlow360 platform</p>
        </div>

        <Card className="shadow-glass-card border border-white/80 bg-white/95 backdrop-blur-md">
          <CardContent className="p-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Input
                  label="Full Name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. John Doe"
                  required
                />
              </div>

              <div>
                <Input
                  label="Business Email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. name@dealflow360.com"
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
                <p className="text-[11px] text-slate-500 mt-1 font-medium">
                  Requirement: Min 8 chars, 1 uppercase, 1 number, and 1 special char (<code className="font-mono text-slate-700">!@#$%^&*</code>)
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Account Role</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as Role)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary shadow-2xs"
                >
                  <option value={ROLES.SALES_REP}>Sales Representative (Standard)</option>
                  <option value={ROLES.SALES_MANAGER}>Sales Manager (Approver)</option>
                  <option value={ROLES.FINANCE}>Finance Approver</option>
                  <option value={ROLES.ADMIN}>System Administrator</option>
                </select>
              </div>

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 font-medium leading-relaxed">
                  <strong>Registration Error:</strong> {error}
                </div>
              )}

              <Button type="submit" variant="primary" className="w-full py-2.5 mt-2 font-bold shadow-sm" isLoading={isLoading}>
                Register Account
              </Button>

              <div className="text-center pt-2 border-t border-slate-100">
                <span className="text-xs text-slate-500">Already registered? </span>
                <Link to="/login" className="text-xs font-bold text-primary hover:underline">
                  Sign in
                </Link>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
