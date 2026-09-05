import { useLocation, Link, useSearchParams } from 'react-router-dom';
import { Mail, ArrowLeft } from 'lucide-react';
import dealflowLogo from '../../assets/dealflow360_logo.jpg';

export function MagicLinkSentPage() {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const email = (location.state as any)?.email || searchParams.get('email') || 'your email';

  return (
    <div className="min-h-screen w-full bg-[#000000] text-white flex flex-col items-center justify-center p-4 sm:p-6 relative overflow-hidden font-sans selection:bg-zinc-800 selection:text-white">
      {/* Ambient background glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[350px] bg-white/[0.02] rounded-full blur-[120px] pointer-events-none" />

      <div className="w-full max-w-md flex flex-col items-center relative z-10 animate-in fade-in zoom-in-95 duration-500">
        {/* Pure Black Card */}
        <div className="w-full bg-black border border-[#1F1F1F] rounded-2xl p-6 sm:p-8 shadow-2xl space-y-6">
          
          {/* Header & Logo replacing old email icon */}
          <div className="text-center space-y-4">
            <div className="w-20 h-20 rounded-2xl overflow-hidden flex items-center justify-center bg-black mx-auto">
              <img
                src={dealflowLogo}
                alt="DealFlow360 Logo"
                className="w-full h-full object-cover rotate-90 transform scale-125"
              />
            </div>
            
            <h1 className="text-2xl font-bold tracking-tight text-white">
              Check Your Inbox
            </h1>

            <div className="inline-block">
              <span className="px-3.5 py-1.5 rounded-lg bg-[#141414] border border-[#262626] text-white font-mono text-xs font-semibold tracking-wide shadow-sm">
                {email}
              </span>
            </div>
          </div>

          {/* Open Inbox Button */}
          <a
            href="http://localhost:8025"
            target="_blank"
            rel="noreferrer"
            className="w-full py-3 px-4 rounded-xl bg-white hover:bg-zinc-200 text-black text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-md cursor-pointer"
          >
            <Mail className="w-4 h-4 text-black" />
            <span>Open Inbox</span>
          </a>

          {/* Direct Actions */}
          <div className="space-y-3 pt-2">
            <Link
              to="/portal/auth/login"
              className="w-full py-3 px-4 rounded-xl bg-[#141414] hover:bg-[#1A1A1A] border border-[#262626] hover:border-[#333333] text-zinc-200 hover:text-white text-xs font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Client Sign In</span>
            </Link>
          </div>

          {/* Security footnote */}
          <div className="pt-2 text-center text-[11px] text-zinc-500 border-t border-[#1F1F1F]">
            Magic link expires in 24 hours · Single-use portal token
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
