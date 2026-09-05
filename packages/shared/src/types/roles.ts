/**
 * Internal user roles — used in JWT payload and RBAC checks
 */
export enum Role {
  ADMIN = 'ADMIN',
  SALES_MANAGER = 'SALES_MANAGER',
  FINANCE = 'FINANCE',
  SALES_REP = 'SALES_REP',
}

/**
 * Customer tier — determines base discount ceilings per REQ-BR-001
 */
export enum CustomerTier {
  BRONZE = 'BRONZE',
  SILVER = 'SILVER',
  GOLD = 'GOLD',
}

/**
 * Billing interval for subscription plans
 */
export enum BillingInterval {
  MONTHLY = 'MONTHLY',
  QUARTERLY = 'QUARTERLY',
  YEARLY = 'YEARLY',
}

/**
 * Proration mode for mid-cycle subscription changes
 */
export enum ProrationMode {
  DAILY = 'DAILY',
  NONE = 'NONE',
}

/**
 * Quotation lifecycle status
 */
export enum QuotationStatus {
  DRAFT = 'DRAFT',
  PENDING_APPROVAL = 'PENDING_APPROVAL',
  PENDING_FINANCE_APPROVAL = 'PENDING_FINANCE_APPROVAL',
  APPROVED = 'APPROVED',
  SENT = 'SENT',
  UNDER_NEGOTIATION = 'UNDER_NEGOTIATION',
  CONFIRMED = 'CONFIRMED',
  LOST = 'LOST',
}

/**
 * Approval actions — immutably logged per REQ-SEC-008
 */
export enum ApprovalAction {
  APPROVE = 'APPROVE',
  REJECT = 'REJECT',
  RETURN_FOR_REVISION = 'RETURN_FOR_REVISION',
}

/**
 * Fulfillment split status
 */
export enum FulfillmentStatus {
  PENDING = 'PENDING',
  RESERVED = 'RESERVED',
  SHIPPED = 'SHIPPED',
  DELIVERED = 'DELIVERED',
  BACKORDERED = 'BACKORDERED',
}

/**
 * Invoice type — one-time products vs recurring billing cycle
 */
export enum InvoiceType {
  ONE_TIME = 'ONE_TIME',
  RECURRING = 'RECURRING',
}

/**
 * Invoice payment status
 */
export enum InvoiceStatus {
  DRAFT = 'DRAFT',
  SENT = 'SENT',
  PAID = 'PAID',
  VOID = 'VOID',
  OVERDUE = 'OVERDUE',
}

/**
 * Subscription line status
 */
export enum SubscriptionStatus {
  ACTIVE = 'ACTIVE',
  CANCELLED = 'CANCELLED',
  PAUSED = 'PAUSED',
}

/**
 * JWT payload structure for internal users
 */
export interface JwtPayload {
  sub: string;         // userId
  email: string;
  role: Role;
  companyId: string;
  iat: number;
  exp: number;
}

/**
 * Portal session data stored in Redis
 */
export interface PortalSession {
  customerId: string;
  email: string;
  createdAt: string;
}

/**
 * RFC 7807 Problem Details — standard error response shape
 */
export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance: string;
}

/**
 * Paginated list response wrapper
 */
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}
