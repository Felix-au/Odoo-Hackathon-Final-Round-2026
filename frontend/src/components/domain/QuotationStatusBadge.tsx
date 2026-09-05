import { QuotationStatus, STATUS_LABELS } from '../../lib/constants';
import { Badge, BadgeProps } from '../ui/Badge';

export function QuotationStatusBadge({ status }: { status: QuotationStatus }) {
  const variantMap: Record<QuotationStatus, BadgeProps['variant']> = {
    DRAFT: 'default',
    PENDING_MANAGER_APPROVAL: 'warning',
    PENDING_FINANCE_APPROVAL: 'warning',
    APPROVED: 'primary',
    SENT: 'primary',
    UNDER_NEGOTIATION: 'warning',
    CONFIRMED: 'success',
    REJECTED: 'destructive',
  };

  return (
    <Badge variant={variantMap[status] || 'default'}>
      {STATUS_LABELS[status] || status}
    </Badge>
  );
}
