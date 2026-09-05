import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Building2, Mail, User, Lock, ArrowRight, ShieldCheck, CheckCircle2 } from 'lucide-react';

export function PortalSignupPage() {
  const navigate = useNavigate();
  const [companyName, setCompanyName] = useState('');
  const [contactName, setContactName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // In B2B Portal, registration records customer or dispatches verification magic link
      await new Promise((r) => setTimeout(r, 600));
      setIsSuccess(true);
      toast.success('Registration submitted! You can now sign in to your customer portal.');
    } catch {
      toast.error('Registration failed. Please contact your sales representative.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto animate-in fade-in duration-300">
      {/* Brand Header */}
      <div className="text-center mb-6">
        <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center mx-auto mb-3 font-bold text-lg shadow-sm">
          ◈
        </div>
        <h1 className="text-xl font-bold text-slate-900 tracking-tight">Customer Portal Registration</h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Access your B2B quotations, invoices, and negotiation terms
        </p>
      </div>

      {/* Main Card */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm space-y-4">
        {isSuccess ? (
          <div className="text-center py-6 space-y-4">
            <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto border border-emerald-100">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Registration Complete!</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
                Your customer portal profile has been created. You can now access your proposal dashboard.
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigate('/portal/auth/login')}
              className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition-all flex items-center justify-center gap-1.5 shadow-sm"
            >
              <span>Proceed to Customer Sign In</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3.5">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Company / Organization</label>
              <div className="relative">
                <Building2 className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="e.g. Acme Global Industries"
                  required
                  className="w-full bg-slate-50/50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-blue-600 focus:bg-white transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Contact Name</label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  placeholder="e.g. Sarah Jenkins"
                  required
                  className="w-full bg-slate-50/50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-blue-600 focus:bg-white transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Work Email</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="procurement@company.com"
                  required
                  className="w-full bg-slate-50/50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-blue-600 focus:bg-white transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Create a secure password"
                  required
                  className="w-full bg-slate-50/50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-blue-600 focus:bg-white transition-all"
                />
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/60 flex items-start gap-2.5 text-[11px] text-slate-500">
              <ShieldCheck className="w-4 h-4 text-slate-600 shrink-0 mt-0.5" />
              <span>
                By registering, you confirm you are an authorized representative of your organization for proposal review.
              </span>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition-all disabled:opacity-50 shadow-sm"
            >
              {isLoading ? 'Creating Account...' : 'Register Customer Account'}
            </button>

            <div className="pt-2 text-center border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <span>Already have an account?</span>
              <Link to="/portal/auth/login" className="font-semibold text-blue-600 hover:text-blue-500">
                Customer Sign In →
              </Link>
            </div>
          </form>
        )}
      </div>

      {/* Footer link to internal workspace */}
      <div className="mt-6 text-center text-xs text-slate-400">
        <span>Are you an internal team member? </span>
        <Link to="/login" className="font-semibold text-slate-600 hover:text-slate-800 underline">
          Workspace Login
        </Link>
      </div>
    </div>
  );
}
