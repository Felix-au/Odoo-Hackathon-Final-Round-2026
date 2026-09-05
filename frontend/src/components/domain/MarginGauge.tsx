import { TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface MarginGaugeProps {
  marginPct: number;
  targetMargin?: number;
  size?: 'sm' | 'md';
}

export function MarginGauge({ marginPct, targetMargin = 30, size = 'md' }: MarginGaugeProps) {
  const isHealthy = marginPct >= targetMargin;
  const isWarning = marginPct < targetMargin && marginPct >= 15;

  let colorClass = 'text-emerald-700 bg-emerald-50 border-emerald-200';
  let progressClass = 'bg-emerald-500';

  if (!isHealthy && !isWarning) {
    colorClass = 'text-red-700 bg-red-50 border-red-200';
    progressClass = 'bg-red-500';
  } else if (isWarning) {
    colorClass = 'text-amber-700 bg-amber-50 border-amber-200';
    progressClass = 'bg-amber-500';
  }

  if (size === 'sm') {
    return (
      <div className={cn('inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-xs font-semibold', colorClass)}>
        {isHealthy ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
        <span>Margin: {marginPct.toFixed(1)}%</span>
      </div>
    );
  }

  return (
    <div className={cn('p-3 rounded-xl border flex flex-col gap-1.5', colorClass)}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-600 flex items-center gap-1">
          Overall Margin
          {isHealthy ? <TrendingUp className="w-3.5 h-3.5 text-emerald-600" /> : <TrendingDown className="w-3.5 h-3.5 text-amber-600" />}
        </span>
        <span className="text-base font-bold">{marginPct.toFixed(1)}%</span>
      </div>
      {/* Visual meter bar */}
      <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
        <div
          className={cn('h-2 rounded-full transition-all duration-300', progressClass)}
          style={{ width: `${Math.min(Math.max(marginPct, 0), 100)}%` }}
        />
      </div>
      <div className="flex justify-between text-[10px] text-slate-500 font-medium">
        <span>0%</span>
        <span>Target: {targetMargin}%</span>
        <span>100%</span>
      </div>
    </div>
  );
}
