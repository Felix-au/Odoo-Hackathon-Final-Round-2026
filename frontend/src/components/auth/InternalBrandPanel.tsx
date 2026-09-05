import React from 'react';
import dealflowLogo from '../../assets/dealflow360_logo.jpg';
import { Cpu, ShieldCheck, Layers, TrendingUp } from 'lucide-react';

export const InternalBrandPanel: React.FC = () => {
  const features = [
    {
      title: 'Automated CPQ Matrix',
      icon: Cpu,
    },
    {
      title: 'Multi-Tier Approvals',
      icon: ShieldCheck,
    },
    {
      title: 'Smart Stock Split',
      icon: Layers,
    },
    {
      title: 'Real-Time Negotiation',
      icon: TrendingUp,
    },
  ];

  return (
    <div className="relative w-full h-full min-h-screen flex flex-col justify-between items-center p-6 sm:p-10 lg:p-12 bg-[#000000] border-r border-[#171717] text-white select-none">
      {/* Top Bar Minimalist Badges */}
      <div className="w-full flex items-center justify-between z-10">
        <span className="text-[11px] font-mono tracking-widest text-zinc-600 uppercase">
          Workspace v2.4
        </span>
        <span className="text-[11px] font-mono tracking-widest text-zinc-600 uppercase">
          SOC-2 Type II
        </span>
      </div>

      {/* Centered Brand Showcase - Tightly Spaced */}
      <div className="relative z-10 flex flex-col items-center text-center my-auto py-2 space-y-3 max-w-md w-full">
        {/* Prominent Image Logo - Rotated 90deg, Zero Outer Border */}
        <div className="relative w-40 h-40 sm:w-48 sm:h-48 overflow-hidden flex items-center justify-center bg-transparent">
          <img
            src={dealflowLogo}
            alt="DealFlow360 Logo"
            className="w-full h-full object-contain rotate-90 transform transition-transform duration-700 hover:scale-105"
            onError={(e) => {
              (e.target as HTMLImageElement).src = '/dealflow360_logo.jpg';
            }}
          />
        </div>

        {/* Brand Name & Tagline */}
        <div className="space-y-0.5">
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white uppercase leading-none">
            DealFlow<span className="text-zinc-500">360</span>
          </h1>
          <p className="text-[11px] tracking-wider text-zinc-400 font-medium uppercase mt-1">
            Intelligent CPQ & Sales Operations
          </p>
        </div>

        {/* Feature Tiles Directly Below Image with Minimal Space */}
        <div className="grid grid-cols-2 gap-2 w-full pt-1">
          {features.map((feat) => {
            const Icon = feat.icon;
            return (
              <div
                key={feat.title}
                className="p-2.5 rounded-xl bg-[#0D0D0D] border border-[#1F1F1F] hover:border-zinc-600 transition-all flex items-center gap-2.5 text-left group"
              >
                <div className="p-1.5 rounded-lg bg-[#141414] border border-[#262626] text-zinc-400 group-hover:text-white transition-colors">
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                </div>
                <span className="text-xs font-semibold text-zinc-300 group-hover:text-white tracking-tight">
                  {feat.title}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Clean Bottom Minimal Signature */}
      <div className="relative z-10 text-center">
        <p className="text-[11px] tracking-wider text-zinc-600 font-mono uppercase">
          Automated Quotation Governance
        </p>
      </div>
    </div>
  );
};
