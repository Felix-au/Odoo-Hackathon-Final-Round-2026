import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePortalAuthStore } from '../../stores/portal-auth.store';
import { Card, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Mail, KeyRound, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

export function PortalLoginPage() {
  const navigate = useNavigate();
  const { requestMagicLink, loginWithPassword, isLoading } = usePortalAuthStore();

  const [activeTab, setActiveTab] = useState<'MAGIC_LINK' | 'PASSWORD'>('MAGIC_LINK');
  const [email, setEmail] = useState('acme@example.com');
  const [password, setPassword] = useState('CustomerP@ss123');

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await requestMagicLink(email);
      navigate('/portal/auth/magic-link-sent', { state: { email } });
    } catch {
      toast.error('Unable to send login link');
    }
  };

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await loginWithPassword(email, password);
      toast.success('Signed in to Customer Portal');
      navigate('/portal/quotations/q-001');
    } catch {
      toast.error('Invalid customer credentials');
    }
  };

  return (
    <div className="max-w-md mx-auto py-12">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-primary text-white font-black text-xl shadow-md mb-3">
          360
        </div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">Customer Portal Access</h1>
        <p className="text-xs text-slate-500 mt-1">Review quotations, propose adjustments, and confirm orders</p>
      </div>

      <Card className="shadow-glass-card border border-slate-200/80 bg-white">
        {/* Tab switch */}
        <div className="grid grid-cols-2 p-1.5 bg-slate-100/80 border-b border-slate-200/60 rounded-t-xl text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab('MAGIC_LINK')}
            className={`py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'MAGIC_LINK' ? 'bg-white text-primary shadow-xs font-bold' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Mail className="w-3.5 h-3.5" />
            Magic Link
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('PASSWORD')}
            className={`py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'PASSWORD' ? 'bg-white text-primary shadow-xs font-bold' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <KeyRound className="w-3.5 h-3.5" />
            Password
          </button>
        </div>

        <CardContent className="p-6">
          {activeTab === 'MAGIC_LINK' ? (
            <form onSubmit={handleMagicLink} className="space-y-4">
              <Input
                label="Registered Business Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="procurement@acme.com"
                helperText="We will send a one-time secure link to this email."
                required
              />

              <Button type="submit" variant="primary" className="w-full py-2.5 mt-2" isLoading={isLoading}>
                Send Secure Login Link
              </Button>
            </form>
          ) : (
            <form onSubmit={handlePasswordLogin} className="space-y-4">
              <Input
                label="Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <Input
                label="Password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />

              <Button type="submit" variant="primary" className="w-full py-2.5 mt-2" isLoading={isLoading}>
                Sign In
              </Button>
            </form>
          )}

          {/* Quick Demo Test Credential */}
          <div className="mt-6 pt-4 border-t border-slate-100 text-center">
            <button
              type="button"
              onClick={() => {
                setEmail('acme@example.com');
                setPassword('CustomerP@ss123');
                setActiveTab('PASSWORD');
              }}
              className="text-[11px] text-primary hover:underline font-semibold inline-flex items-center gap-1"
            >
              <Sparkles className="w-3 h-3" />
              Use Seeded Demo Customer (Acme Corp)
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
