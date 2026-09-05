import { Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';

export function LoadingSpinner({ label = 'Loading...', className }: { label?: string; className?: string }) {
  return (
    <div className={cn('flex flex-col items-center justify-center p-8 text-center', className)} role="status" aria-label={label}>
      <Loader2 className="w-8 h-8 text-primary animate-spin mb-3" />
      <p className="text-xs font-medium text-slate-500">{label}</p>
    </div>
  );
}
