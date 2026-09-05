import React from 'react';
import { cn } from '../../lib/utils';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'destructive' | 'outline' | 'tierGold' | 'tierSilver' | 'tierBronze';
  size?: 'sm' | 'md';
}

export function Badge({ className, variant = 'default', size = 'md', children, ...props }: BadgeProps) {
  const baseStyles = 'inline-flex items-center font-medium rounded-full select-none';

  const variants = {
    default: 'bg-slate-100 text-slate-700',
    primary: 'bg-blue-50 text-blue-700 border border-blue-200/60',
    success: 'bg-emerald-50 text-emerald-700 border border-emerald-200/60',
    warning: 'bg-amber-50 text-amber-800 border border-amber-200/60',
    destructive: 'bg-red-50 text-red-700 border border-red-200/60',
    outline: 'border border-slate-300 text-slate-700 bg-white',
    tierGold: 'bg-amber-100 text-amber-900 border border-amber-300 font-bold',
    tierSilver: 'bg-slate-200 text-slate-800 border border-slate-400 font-bold',
    tierBronze: 'bg-amber-800/15 text-amber-950 border border-amber-700/30 font-bold',
  };

  const sizes = {
    sm: 'px-2 py-0.5 text-[11px]',
    md: 'px-2.5 py-0.5 text-xs',
  };

  return (
    <span className={cn(baseStyles, variants[variant], sizes[size], className)} {...props}>
      {children}
    </span>
  );
}
