export interface OneTimeInvoice {
  id: string;
  invoiceNumber: string;
  orderId: string;
  customerId: string;
  customerName: string;
  currency?: string;
  amount: string | number;
  taxAmount: string | number;
  totalAmount: string | number;
  status: 'DRAFT' | 'ISSUED' | 'PAID' | 'OVERDUE' | 'CANCELLED';
  dueDate: string;
  issuedAt: string;
  paidAt?: string;
  lines?: any[];
  items?: any[];
}

export interface SubscriptionLine {
  id: string;
  orderId: string;
  planName: string;
  interval: 'MONTHLY' | 'ANNUAL';
  quantity: number;
  unitPrice: string | number;
  totalAmount: string | number;
  status: 'ACTIVE' | 'PAUSED' | 'CANCELLED';
  currentPeriodStart: string;
  currentPeriodEnd: string;
  nextBillingDate: string;
}

export interface BillingScheduleItem {
  id: string;
  date: string;
  amount: string | number;
  type: 'ONE_TIME' | 'RECURRING';
  description: string;
  status: 'PENDING' | 'PROCESSED';
}

export interface ProrationPreview {
  currentQty: number;
  newQty: number;
  creditAmount: number;
  chargeAmount: number;
  netDelta: number;
  effectiveDate: string;
}
