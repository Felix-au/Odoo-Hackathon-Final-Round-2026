import { useLocation, Link, useSearchParams } from 'react-router-dom';
import { ExternalLink, ArrowLeft } from 'lucide-react';
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
        <div className="w-full bg-[#0A0A0A] border border-[#1F1F1F] rounded-2xl p-6 sm:p-8 shadow-2xl space-y-6">
          
          {/* Header & Logo replacing old email icon */}
          <div className="text-center space-y-4">
            <div className="w-16 h-16 rounded-2xl overflow-hidden shadow-2xl flex items-center justify-center p-0.5 border border-white/10 bg-black mx-auto">
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

          {/* Dev / Mailpit Quick Access Tile */}
          <a
            href="http://localhost:8025"
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-between p-4 bg-[#121212] hover:bg-[#181818] border border-[#262626] hover:border-[#383838] rounded-xl transition-all duration-200 group cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <div className="absolute inset-0 w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping opacity-75" />
              </div>
              <div className="text-left">
                <div className="text-xs font-bold text-zinc-200 group-hover:text-white transition-colors">
                  Open Local Mailpit Inbox
                </div>
                <div className="text-[11px] text-zinc-500 font-mono">
                  http://localhost:8025
                </div>
              </div>
            </div>
            <ExternalLink className="w-4 h-4 text-zinc-400 group-hover:text-white transition-colors" />
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
