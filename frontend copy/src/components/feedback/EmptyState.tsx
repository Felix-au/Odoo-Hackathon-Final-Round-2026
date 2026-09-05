import React from 'react';
import { cn } from '../../lib/utils';
import { FileText } from 'lucide-react';

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  icon = <FileText className="w-10 h-10 text-slate-300" />,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center p-12 text-center bg-white rounded-xl border border-dashed border-slate-300', className)}>
      <div className="p-3 bg-slate-50 rounded-2xl mb-4 text-slate-400">
        {icon}
      </div>
      <h3 className="text-base font-bold text-slate-900 mb-1">{title}</h3>
      <p className="text-xs text-slate-500 max-w-sm mb-6">{description}</p>
      {action && <div>{action}</div>}
    </div>
  );
}
