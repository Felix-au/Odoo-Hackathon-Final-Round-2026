import React from 'react';
import { AlertCircle } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface ErrorBannerProps {
  title?: string;
  detail?: string;
  action?: React.ReactNode;
  className?: string;
}

export function ErrorBanner({ title = 'Error', detail, action, className }: ErrorBannerProps) {
  return (
    <div className={cn('p-4 rounded-xl border border-red-200 bg-red-50/70 text-red-800 flex items-start gap-3', className)}>
      <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
      <div className="flex-1">
        <h4 className="text-sm font-semibold text-red-900">{title}</h4>
        {detail && <p className="text-xs text-red-700 mt-0.5">{detail}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
