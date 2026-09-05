import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { usePortalAuthStore } from '../../stores/portal-auth.store';
import { AlertCircle, ArrowRight, KeyRound, Loader2 } from 'lucide-react';
import dealflowLogo from '../../assets/dealflow360_logo.jpg';

export function MagicLinkVerifyPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { verifyMagicLink } = usePortalAuthStore();
  const [error, setError] = useState<string | null>(null);

  const token = searchParams.get('token');

  useEffect(() => {
    async function verify() {
      if (!token) {
        setError('Missing magic link token parameter.');
        return;
      }
      try {
        await verifyMagicLink(token);
        // Small delay for smooth visual transition
        setTimeout(() => {
          navigate('/portal/quotations/q-001', { replace: true });
        }, 400);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'This link is invalid or has expired.');
      }
    }
    verify();
  }, [token, verifyMagicLink, navigate]);

  return (
    <div className="min-h-screen w-full bg-[#000000] text-white flex flex-col items-center justify-center p-4 sm:p-6 relative overflow-hidden font-sans selection:bg-zinc-800 selection:text-white">
      {/* Ambient background glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[350px] bg-white/[0.02] rounded-full blur-[120px] pointer-events-none" />

      <div className="w-full max-w-md flex flex-col items-center relative z-10 animate-in fade-in zoom-in-95 duration-500">
        {/* Pure Black Card */}
        <div className="w-full bg-black border border-[#1F1F1F] rounded-2xl p-6 sm:p-8 shadow-2xl space-y-6">
          
          {/* Logo inside card */}
          <div className="w-20 h-20 rounded-2xl overflow-hidden flex items-center justify-center bg-black mx-auto">
            <img
              src={dealflowLogo}
              alt="DealFlow360 Logo"
              className="w-full h-full object-cover rotate-90 transform scale-125"
            />
          </div>

          {error ? (
            /* Error State */
            <div className="text-center space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mx-auto shadow-inner">
                <AlertCircle className="w-7 h-7" />
              </div>

              <div className="space-y-1.5">
                <h2 className="text-xl font-bold tracking-tight text-white">
                  Verification Link Invalid
                </h2>
                <p className="text-xs text-zinc-400 leading-relaxed max-w-xs mx-auto">
                  {error}
                </p>
              </div>

              <div className="space-y-3 pt-3">
                <Link
                  to="/portal/auth/login"
                  className="w-full py-3 px-4 rounded-xl bg-white text-black text-xs font-bold hover:bg-zinc-200 transition-all flex items-center justify-center gap-2 shadow-md cursor-pointer"
                >
                  <span>Request a New Link</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>

                <Link
                  to="/portal/auth/login"
                  className="w-full py-2.5 px-4 rounded-xl bg-[#141414] hover:bg-[#1A1A1A] border border-[#262626] hover:border-[#333333] text-zinc-300 hover:text-white text-xs font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>Sign In With Password</span>
                </Link>
              </div>
            </div>
          ) : (
            /* Verifying Loading State */
            <div className="text-center py-6 space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-[#141414] border border-[#262626] text-zinc-300 flex items-center justify-center mx-auto shadow-inner">
                <Loader2 className="w-7 h-7 animate-spin text-white" />
              </div>

              <div className="space-y-1.5">
                <h2 className="text-lg font-bold tracking-tight text-white">
                  Verifying Portal Access
                </h2>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Validating your secure one-time session token...
                </p>
              </div>
            </div>
          )}

          {/* Security Footnote */}
          <div className="pt-2 text-center text-[11px] text-zinc-500 border-t border-[#1F1F1F]">
            DealFlow360 End-to-End Quotation Security
          </div>
        </div>

        {/* Bottom Switcher */}
        <div className="mt-6 text-center text-xs text-zinc-500">
          Internal sales team?{' '}
          <Link to="/login" className="text-zinc-300 hover:text-white font-semibold underline underline-offset-4">
            Workspace Login
          </Link>
        </div>

      </div>
    </div>
  );
}
