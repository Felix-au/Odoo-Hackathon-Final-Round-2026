import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await signup({ email, password, name, role });
      toast.success('Account created successfully');
      navigate('/app/dashboard');
    } catch {
      toast.error('Failed to create account');
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-slate-100 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Create Account</h1>
          <p className="text-xs text-slate-500 mt-1">Join the DealFlow360 workspace</p>
        </div>

        <Card>
          <CardContent className="p-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                label="Full Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="John Doe"
                required
              />
              <Input
                label="Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="john@dealflow360.com"
                required
              />
              <Input
                label="Password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Role</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as Role)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value={ROLES.SALES_REP}>Sales Representative</option>
                  <option value={ROLES.SALES_MANAGER}>Sales Manager</option>
                  <option value={ROLES.FINANCE}>Finance Approver</option>
                  <option value={ROLES.ADMIN}>Administrator</option>
                </select>
              </div>

              <Button type="submit" variant="primary" className="w-full py-2.5 mt-2" isLoading={isLoading}>
                Register Account
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
