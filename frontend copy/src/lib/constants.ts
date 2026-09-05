export const ROLES = {
  ADMIN: 'ADMIN',
  SALES_MANAGER: 'SALES_MANAGER',
  FINANCE: 'FINANCE',
  SALES_REP: 'SALES_REP',
  PORTAL_USER: 'PORTAL_USER',
} as const;

export type Role = typeof ROLES[keyof typeof ROLES];

export const QUOTATION_STATUSES = {
  DRAFT: 'DRAFT',
  PENDING_MANAGER_APPROVAL: 'PENDING_MANAGER_APPROVAL',
  PENDING_FINANCE_APPROVAL: 'PENDING_FINANCE_APPROVAL',
  APPROVED: 'APPROVED',
  SENT: 'SENT',
  UNDER_NEGOTIATION: 'UNDER_NEGOTIATION',
  CONFIRMED: 'CONFIRMED',
  REJECTED: 'REJECTED',
} as const;

export type QuotationStatus = typeof QUOTATION_STATUSES[keyof typeof QUOTATION_STATUSES];

export const STATUS_LABELS: Record<QuotationStatus, string> = {
  DRAFT: 'Draft',
  PENDING_MANAGER_APPROVAL: 'Pending Manager',
  PENDING_FINANCE_APPROVAL: 'Pending Finance',
  APPROVED: 'Approved',
  SENT: 'Sent to Customer',
  UNDER_NEGOTIATION: 'Under Negotiation',
  CONFIRMED: 'Confirmed',
  REJECTED: 'Rejected',
};

export const STATUS_PORTAL_LABELS: Record<string, string> = {
  SENT: 'Awaiting Your Review',
  UNDER_NEGOTIATION: 'Under Negotiation',
  PENDING_MANAGER_APPROVAL: 'Under Review by Sales Team',
  PENDING_FINANCE_APPROVAL: 'Under Review by Sales Team',
  APPROVED: 'Ready for Confirmation',
  CONFIRMED: 'Order Confirmed ✓',
  REJECTED: 'Declined',
  DRAFT: 'Drafting',
};

export const CUSTOMER_TIERS = {
  BRONZE: 'BRONZE',
  SILVER: 'SILVER',
  GOLD: 'GOLD',
} as const;

export type CustomerTier = typeof CUSTOMER_TIERS[keyof typeof CUSTOMER_TIERS];
