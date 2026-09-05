import React from 'react';

interface DealFlowLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
  className?: string;
  subtitle?: string;
}

export const DealFlowLogo: React.FC<DealFlowLogoProps> = ({
  size = 'md',
  showText = true,
  className = '',
  subtitle = 'Intelligent CPQ & Sales Operations',
}) => {
  const iconSizes = {
    sm: 'w-8 h-8',
    md: 'w-11 h-11',
    lg: 'w-16 h-16',
    xl: 'w-20 h-20',
  };

  const textSizes = {
    sm: 'text-lg',
    md: 'text-2xl',
    lg: 'text-3xl',
    xl: 'text-4xl',
  };

  return (
    <div className={`inline-flex items-center gap-3.5 ${className}`}>
      {/* Precision Geometric SVG Icon */}
      <div className={`relative ${iconSizes[size]} shrink-0 flex items-center justify-center`}>
        {/* Ambient Glow */}
        <div className="absolute inset-0 bg-gradient-to-tr from-blue-600 to-cyan-400 rounded-2xl blur-md opacity-40 animate-pulse" />
        
        <svg
          viewBox="0 0 48 48"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="relative w-full h-full drop-shadow-[0_4px_12px_rgba(37,99,235,0.45)]"
        >
          <defs>
            <linearGradient id="dfGradientA" x1="6" y1="6" x2="42" y2="42" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#38BDF8" />
              <stop offset="50%" stopColor="#3B82F6" />
              <stop offset="100%" stopColor="#6366F1" />
            </linearGradient>
            <linearGradient id="dfGradientB" x1="42" y1="6" x2="6" y2="42" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#60A5FA" />
              <stop offset="100%" stopColor="#1E3A8A" />
            </linearGradient>
            <linearGradient id="dfCoreGlow" x1="24" y1="12" x2="24" y2="36" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#93C5FD" stopOpacity="0.4" />
            </linearGradient>
          </defs>

          {/* Outer Rounded Hex/Diamond Shield */}
          <rect
            x="4"
            y="4"
            width="40"
            height="40"
            rx="12"
            fill="#0F172A"
            stroke="url(#dfGradientA)"
            strokeWidth="1.5"
          />

          {/* Isometric Flow Loop (Infinity / 360 Angle) */}
          <path
            d="M14 24C14 18.4772 18.4772 14 24 14C29.5228 14 34 18.4772 34 24C34 29.5228 29.5228 34 24 34"
            stroke="url(#dfGradientA)"
            strokeWidth="3.2"
            strokeLinecap="round"
          />
          <path
            d="M24 14L28 10M24 14L28 18"
            stroke="#38BDF8"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          
          {/* Internal Geometric Core: Precision Diamond & Pulse Point */}
          <polygon
            points="24,18 29,24 24,30 19,24"
            fill="url(#dfGradientB)"
            stroke="#60A5FA"
            strokeWidth="1.2"
          />
          <circle cx="24" cy="24" r="2.5" fill="url(#dfCoreGlow)" />
        </svg>
      </div>

      {showText && (
        <div className="flex flex-col text-left">
          <div className={`font-black tracking-tight text-white ${textSizes[size]} flex items-center leading-none`}>
            <span>DealFlow</span>
            <span className="bg-gradient-to-r from-blue-400 via-cyan-400 to-indigo-400 bg-clip-text text-transparent ml-1">
              360
            </span>
          </div>
          {subtitle && (
            <span className="text-[11px] font-medium tracking-wide text-zinc-400 mt-1 uppercase">
              {subtitle}
            </span>
          )}
        </div>
      )}
    </div>
  );
};
