import { QuotationStatus, CustomerTier } from '../lib/constants';

export interface Customer {
  id: string;
  name: string;
  email: string;
  tier: CustomerTier;
  companyId?: string;
}

export interface QuotationLine {
  id: string;
  quotationId: string;
  productId: string;
  productName: string;
  categoryName: string;
  quantity: number;
  unitPrice: string | number;
  discountPct: number;
  effectiveCeilingPct?: number;
  hasCeilingViolation?: boolean;
  costPrice?: string | number;
  lineTotal: string | number;
  marginPct?: number;
  isRecurring?: boolean;
}

export interface ApprovalStep {
  id?: string;
  role: 'SALES_MANAGER' | 'FINANCE';
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'RETURNED';
  approverName?: string;
  approverEmail?: string;
  actionReason?: string;
  completedAt?: string;
}

export interface AuditTrailEntry {
  id: string;
  timestamp: string;
  actorName: string;
  actorRole: string;
  action: string;
  reason?: string;
}

export interface CustomerNegotiation {
  id: string;
  quotationId: string;
  submittedAt: string;
  proposedDiscount?: number;
  message?: string;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED';
  lineComments?: Record<string, string>;
}

export interface Quotation {
  id: string;
  quotationNumber: string;
  version: number;
  customerId: string;
  customer: Customer;
  repId: string;
  repName: string;
  status: QuotationStatus;
  currency: string;
  subtotalAmount: string | number;
  subtotal?: string | number;
  taxAmount: string | number;
  totalAmount: string | number;
  totalCost?: string | number;
  overallMarginPct: number;
  totalMarginPct?: number;
  notes?: string;
  blendedRiskScore: number;
  riskScore?: number;
  riskLevel?: string;
  requiresApproval: boolean;
  approvalLevelRequired?: string;
  validUntil: string;
  lines: QuotationLine[];
  approvalSteps?: ApprovalStep[];
  auditTrail?: AuditTrailEntry[];
  negotiations?: CustomerNegotiation[];
  createdAt: string;
  updatedAt: string;
  confirmedAt?: string;
  lastActivityAt?: string;
}

export interface QuotationFilters {
  status?: QuotationStatus | 'ALL';
  repId?: string;
  customerId?: string;
  search?: string;
  view?: 'list' | 'pipeline';
  page?: number;
  pageSize?: number;
}
