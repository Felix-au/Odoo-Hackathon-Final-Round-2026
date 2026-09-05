import { ShieldAlert, ShieldCheck, AlertTriangle } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface RiskScoreIndicatorProps {
  score: number;
  violationsCount?: number;
  size?: 'sm' | 'md' | 'lg';
}

export function RiskScoreIndicator({ score, violationsCount = 0, size = 'md' }: RiskScoreIndicatorProps) {
  let color = 'text-emerald-600 bg-emerald-50 border-emerald-200';
  let badgeText = 'Low Risk (Auto-Approve)';
  let Icon = ShieldCheck;

  if (score >= 70) {
    color = 'text-red-600 bg-red-50 border-red-200';
    badgeText = 'High Risk (Two-Tier Approval)';
    Icon = ShieldAlert;
  } else if (score > 0) {
    color = 'text-amber-600 bg-amber-50 border-amber-200';
    badgeText = 'Medium Risk (Manager Approval)';
    Icon = AlertTriangle;
  }

  if (size === 'sm') {
    return (
      <div className={cn('inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-xs font-semibold', color)}>
        <Icon className="w-3.5 h-3.5" />
        <span>Risk: {score.toFixed(0)}</span>
      </div>
    );
  }

  return (
    <div className={cn('flex items-center gap-3 p-3 rounded-xl border', color)}>
      <div className="p-2 rounded-lg bg-white/80 shadow-2xs">
        <Icon className="w-6 h-6" />
      </div>
      <div>
        <div className="flex items-center gap-2">
          <span className="text-xl font-black">{score.toFixed(0)}</span>
          <span className="text-xs font-bold uppercase tracking-wider">{badgeText}</span>
        </div>
        {violationsCount > 0 ? (
          <p className="text-[11px] text-red-700 font-medium mt-0.5">
            ⚠ {violationsCount} line item{violationsCount > 1 ? 's exceed' : ' exceeds'} discount ceiling
          </p>
        ) : (
          <p className="text-[11px] opacity-80 font-medium">All item discounts within allowed tier ceilings</p>
        )}
      </div>
    </div>
  );
}
