# DealFlow360 — Complete Requirements Inventory

> **Source**: DealFlow360.pdf — Odoo Hackathon Final Round 2026  
> **Status**: BASELINE — All requirements are MANDATORY (bonus/optional treated as required)

---

## Glossary

| Term | Definition |
|------|-----------|
| **Quotation** | A sales document sent to a customer containing line items, discounts, totals |
| **Order** | A confirmed quotation that proceeds to fulfillment and billing |
| **Blended Risk Score** | A composite discount violation score computed across all lines in a quotation |
| **Approval Chain** | Ordered set of approvers (Sales Manager → Finance) triggered by risk score |
| **Customer Tier** | Classification of customer (Bronze, Silver, Gold) that determines base discount ceiling |
| **Discount Ceiling** | Maximum discount percentage allowed per tier and/or per product category |
| **Warehouse Split** | Distributing an order's fulfillment across multiple warehouses |
| **Backorder** | Portion of an order not yet fulfilled, awaiting stock |
| **Recurring Line** | An order line billed on a recurring schedule (monthly/quarterly/yearly) |
| **One-Time Line** | An order line billed once at order confirmation |
| **Proration** | Adjusting recurring charges proportionally for mid-cycle changes |
| **Portal User** | A customer accessing the customer-facing negotiation portal |
| **Internal User** | Sales rep, manager, finance, or admin using the backend workspace |
| **Upsell** | Suggesting a higher-value or complementary product while building a quote |
| **Cross-sell** | Suggesting products historically purchased alongside the current cart items |
| **Deal Health** | Aggregate metric showing stalled, at-risk, or anomalous deals |
| **Magic Link** | A one-time URL sent via email that authenticates a customer without a password |
| **Audit Trail** | Immutable log of all approval actions with user, timestamp, and reason |

---

## A. Functional Requirements

### A1 — Authentication & Access Control

| ID | Requirement | Source |
|----|------------|--------|
| REQ-F-001 | Internal users (Sales Rep, Manager, Finance, Admin) can sign up with email + password | PDF p.3 |
| REQ-F-002 | Internal users can log in with email + password | PDF p.3 |
| REQ-F-003 | Customers access their quotations via a customer portal login | PDF p.4 |
| REQ-F-004 | Customer portal login supports magic link (one-time email URL) | PDF p.4 |
| REQ-F-005 | Customer portal login supports email + password | PDF p.4 |
| REQ-F-006 | After login, internal users can access backend configuration | PDF p.4 |
| REQ-F-007 | After login, internal users can open a sales workspace | PDF p.4 |
| REQ-F-008 | Customer portal is a real, separate, restricted view — not an internal screen with a different label | PDF p.10 |

### A2 — Product & Price List Management

| ID | Requirement | Source |
|----|------------|--------|
| REQ-F-010 | Admin can create/edit/delete products with: Name, Category, Price, Unit, Tax, Description | PDF p.4 |
| REQ-F-011 | Products support variants with Attribute (e.g. Size, Pack), Values, and Extra prices per variant | PDF p.4 |
| REQ-F-012 | Admin can define price lists based on customer tier | PDF p.4 |
| REQ-F-013 | Price lists support currency-specific rules | PDF p.4 |

### A3 — Discount Tier & Approval Chain Setup

| ID | Requirement | Source |
|----|------------|--------|
| REQ-F-020 | Admin can define discount ceilings per customer tier (Bronze ≤5%, Silver ≤10%, Gold ≤15%) | PDF p.4 |
| REQ-F-021 | Admin can define category-specific discount ceilings | PDF p.4 |
| REQ-F-022 | Admin can configure which discount range triggers Sales Manager approval only | PDF p.4 |
| REQ-F-023 | Admin can configure which discount range triggers Sales Manager + Finance approval | PDF p.4 |
| REQ-F-024 | System computes a blended risk score when a quote mixes categories with different ceilings | PDF p.4 |
| REQ-F-025 | System routes to the highest required approval level based on blended risk score | PDF p.4 |
| REQ-F-026 | All approvals, rejections, and edits are logged with user, timestamp, and reason | PDF p.4 |

### A4 — Warehouse & Fulfillment Setup

| ID | Requirement | Source |
|----|------------|--------|
| REQ-F-030 | Admin can create/edit/delete warehouses (name, location attributes) | PDF p.4 |
| REQ-F-031 | Admin can configure stock levels per warehouse | PDF p.4 |
| REQ-F-032 | Admin can configure replenishment rules per warehouse | PDF p.4 |
| REQ-F-033 | Admin can define shipping cost weighting used by the auto-split logic | PDF p.4 |
| REQ-F-034 | Auto-split logic minimizes number of shipments | PDF p.4 |

### A5 — Subscription / Recurring Plan Setup

| ID | Requirement | Source |
|----|------------|--------|
| REQ-F-040 | Admin can define recurring plans: monthly, quarterly, yearly | PDF p.5 |
| REQ-F-041 | Recurring plans can be attached to specific products or services | PDF p.5 |
| REQ-F-042 | Admin can configure proration rules for mid-cycle quantity or plan changes | PDF p.5 |
| REQ-F-043 | Admin can configure cancellation rules | PDF p.5 |
| REQ-F-044 | Admin can configure partial refund rules | PDF p.5 |

### A6 — Upsell / Cross-Sell Rule Setup (MANDATORY — bonus treated as required)

| ID | Requirement | Source |
|----|------------|--------|
| REQ-F-050 | Admin can define product pairings based on historical co-purchase data | PDF p.5 |
| REQ-F-051 | Admin can mark products as "currently promoted" to rank higher in suggestions | PDF p.5 |
| REQ-F-052 | Admin can set minimum margin thresholds for suggestions | PDF p.5 |

### A7 — Reporting & Dashboard Configuration

| ID | Requirement | Source |
|----|------------|--------|
| REQ-F-060 | Sales performance dashboard visible to managers and admins | PDF p.5 |
| REQ-F-061 | Reports support export to PDF and XLS | PDF p.5 |
| REQ-F-062 | Reports filterable by Period (today, week, custom date range) | PDF p.5 |
| REQ-F-063 | Reports filterable by Sales Team / Rep | PDF p.5 |
| REQ-F-064 | Reports filterable by Approval Status (pending, approved, rejected) | PDF p.5 |
| REQ-F-065 | Reports filterable by Product / Category | PDF p.5 |

### B1 — Sales Workspace Navigation

| ID | Requirement | Source |
|----|------------|--------|
| REQ-F-070 | Top navigation: Quotations tab redirects to list of active and draft quotations | PDF p.5 |
| REQ-F-071 | Top navigation: Pipeline tab opens a Kanban-style deal pipeline view | PDF p.5 |
| REQ-F-072 | Action: Reload Data — refreshes pricing, stock, and approval data | PDF p.6 |
| REQ-F-073 | Action: Go to Back-end — opens configuration/settings screen | PDF p.6 |
| REQ-F-074 | Action: Close Workspace — ends current working session view | PDF p.6 |

### B2 — Quotation List / Pipeline View

| ID | Requirement | Source |
|----|------------|--------|
| REQ-F-080 | Quotations shown as selectable cards with: customer name, amount, stage | PDF p.6 |
| REQ-F-081 | Pipeline shows stages: Draft, Pending Approval, Approved, Confirmed, Lost | PDF p.6 |
| REQ-F-082 | Selecting a quotation card opens the Quotation Builder for that deal | PDF p.6 |

### B3 — Quotation Builder

| ID | Requirement | Source |
|----|------------|--------|
| REQ-F-090 | Rep can pick products across categories: Hardware, Services, Subscriptions | PDF p.6 |
| REQ-F-091 | Rep can adjust quantities with +/- controls | PDF p.6 |
| REQ-F-092 | Rep can apply line-level discounts | PDF p.6 |
| REQ-F-093 | Rep can apply order-level discounts | PDF p.6 |
| REQ-F-094 | Order lines display unit price, quantity, discount, and line total | PDF p.6 |
| REQ-F-095 | Live margin indicator updates as items/discounts are changed | PDF p.6 |
| REQ-F-096 | Rep can confirm quotation and move to approval flow (if required) | PDF p.6 |
| REQ-F-097 | Rep can confirm quotation and move straight to fulfillment if no approval required | PDF p.6 |

### B4 — Discount Approval Screen

| ID | Requirement | Source |
|----|------------|--------|
| REQ-F-100 | Approval screen displays the blended risk score for the quotation | PDF p.6 |
| REQ-F-101 | Approval screen lists required approval steps (Sales Manager, Finance if needed) | PDF p.6 |
| REQ-F-102 | Each approver can: Approve, Reject, or Return for Revision | PDF p.6 |
| REQ-F-103 | Each approval action creates a full audit trail entry | PDF p.6 |

### B5 — Upsell and Cross-Sell Panel

| ID | Requirement | Source |
|----|------------|--------|
| REQ-F-110 | Panel shown alongside quotation builder cart | PDF p.6 |
| REQ-F-111 | Ranked suggestion list based on co-purchase history and active promotions | PDF p.7 |
| REQ-F-112 | Each suggestion displays: product name, margin delta if added, promotion tag | PDF p.7 |
| REQ-F-113 | Button: Add to Quote — adds suggestion to quotation | PDF p.7 |
| REQ-F-114 | Button: Dismiss — removes suggestion from panel | PDF p.7 |
| REQ-F-115 | After adding a suggestion, margin indicator updates immediately | PDF p.7 |

### B6 — Fulfillment and Warehouse Split Screen

| ID | Requirement | Source |
|----|------------|--------|
| REQ-F-120 | System recommends warehouse split based on live stock levels | PDF p.7 |
| REQ-F-121 | Display: warehouse name, quantity per warehouse, estimated shipment count and cost | PDF p.7 |
| REQ-F-122 | Button: Accept Suggested Split | PDF p.7 |
| REQ-F-123 | Button: Manual Override — rep reassigns quantities across warehouses | PDF p.7 |
| REQ-F-124 | Automatic "Consolidate Remaining Backorder" prompt when mid-fulfillment stock arrives | PDF p.7 |

### B7 — Subscription and Billing Screen

| ID | Requirement | Source |
|----|------------|--------|
| REQ-F-130 | One-time lines and recurring lines shown separately within same order | PDF p.7-8 |
| REQ-F-131 | Upcoming billing schedule displayed for recurring lines | PDF p.8 |
| REQ-F-132 | Mid-cycle proration handled when quantity changes | PDF p.8 |
| REQ-F-133 | Cancel or modify subscription controls available | PDF p.8 |
| REQ-F-134 | Cancellation/modification triggers automatic partial refund or credit note | PDF p.8 |

### B8 — Customer Portal Negotiation

| ID | Requirement | Source |
|----|------------|--------|
| REQ-F-140 | Customer portal shows quotation details and status: Sent, Under Negotiation, Confirmed | PDF p.8 |
| REQ-F-141 | Customer can add line-level comments and change requests | PDF p.8 |
| REQ-F-142 | Customer can submit a counter-discount proposal | PDF p.8 |
| REQ-F-143 | Button: Submit Request — submits customer negotiation | PDF p.8 |
| REQ-F-144 | Button: Confirm Quotation — customer accepts final terms | PDF p.8 |
| REQ-F-145 | If confirmed terms exceed approval thresholds, quotation auto re-enters approval flow | PDF p.8 |
| REQ-F-146 | If confirmed terms are within thresholds, order moves directly to fulfillment | PDF p.8 |

### B9 — Deal Health and Anomaly Dashboard

| ID | Requirement | Source |
|----|------------|--------|
| REQ-F-150 | Dashboard shows stalled deals (inactive > configured days) | PDF p.8 |
| REQ-F-151 | Dashboard shows discount anomaly alerts (discount above rep historical average) | PDF p.8 |
| REQ-F-152 | Dashboard shows delivery promise slippage indicators | PDF p.8 |
| REQ-F-153 | Clicking an alert opens the related quotation directly | PDF p.8 |
| REQ-F-154 | Automated nudge or escalation action can be triggered from an alert | PDF p.8 |

### End-to-End Flow

| ID | Requirement | Source |
|----|------------|--------|
| REQ-F-160 | Complete flow: Quotation to Approval to Fulfillment to Billing to Reporting | PDF p.9 |
| REQ-F-161 | Payment can be recorded and invoice status updates correctly | PDF p.11 |
| REQ-F-162 | One-time product and recurring subscription on same order billed correctly and separately | PDF p.11 |

### Blended Discount Risk Score Logic

| ID | Requirement | Source |
|----|------------|--------|
| REQ-F-170 | Blended risk score evaluates each line against its own category-specific discount limit | PDF p.11-12 |
| REQ-F-171 | A single line exceeding its category limit flags the entire quotation for approval | PDF p.12 |
| REQ-F-172 | Cumulative small violations across many lines aggregate into the blended score | PDF p.12 |
| REQ-F-173 | Blended score determines approval level: none / Sales Manager only / Sales Manager + Finance | PDF p.12 |

---

## B. Non-Functional Requirements

| ID | Requirement |
|----|------------|
| REQ-NF-001 | Business logic must be in application code — not hardcoded or faked |
| REQ-NF-002 | System must support a live 5-minute demo covering >=2 full flows |
| REQ-NF-003 | Sample seed data must be included |
| REQ-NF-004 | Architecture diagram showing data model and module connections |
| REQ-NF-005 | Technology-agnostic implementation |
| REQ-NF-006 | UI refreshes pricing, stock, and approval data from backend on demand |
| REQ-NF-007 | Response time <3s for all key actions |
| REQ-NF-008 | Customer portal must be genuinely isolated with its own access control |

---

## C. User Roles / Personas

| ID | Role | Capabilities |
|----|------|-------------|
| REQ-ROLE-001 | **Sales Rep** | Build quotations, apply discounts, add upsell items, track approval/fulfillment, respond to negotiation |
| REQ-ROLE-002 | **Sales Manager / Approver** | Approve/reject quotations, configure discount tiers and chains, monitor deal health |
| REQ-ROLE-003 | **Finance / Operations User** | Second-level approvals, manage fulfillment splits, reconcile recurring billing |
| REQ-ROLE-004 | **Customer (Portal User)** | View quotation, request changes, counter discount, confirm terms |
| REQ-ROLE-005 | **Admin** | Backend setup (products, price lists, discount tiers, warehouses, plans), platform analytics |

---

## D. User Journeys

| ID | Journey |
|----|---------|
| REQ-UJ-001 | Onboarding: Rep signs up; Admin configures backend |
| REQ-UJ-002 | Quote Creation: Rep builds quotation with products, discounts, upsell suggestions |
| REQ-UJ-003 | Approval Flow: Auto-routed by risk score; Manager and/or Finance review |
| REQ-UJ-004 | Fulfillment: Warehouse split recommended; rep accepts or overrides; backorder handled |
| REQ-UJ-005 | Billing: Mixed order generates one-time invoice + recurring billing schedule |
| REQ-UJ-006 | Customer Negotiation: Customer counters via portal; may re-trigger approval |
| REQ-UJ-007 | Deal Health Monitoring: Manager reviews stalled/risky deals; triggers nudge/escalation |
| REQ-UJ-008 | Reporting: Filters applied; performance viewed; exported PDF/XLS |

---

## E. Business Rules

| ID | Rule |
|----|------|
| REQ-BR-001 | Customer tier defines global discount ceiling (Bronze ≤5%, Silver ≤10%, Gold ≤15%) |
| REQ-BR-002 | Product category has its own discount ceiling independent of tier ceiling |
| REQ-BR-003 | A line's discount exceeding its category ceiling = violation |
| REQ-BR-004 | Blended risk score = function of per-line violations + magnitude + aggregate pattern |
| REQ-BR-005 | Single badly-violating line flags the whole quotation |
| REQ-BR-006 | Cumulative small violations also trigger approval |
| REQ-BR-007 | Approval routing: low = none; medium = Sales Manager; high = Sales Manager + Finance |
| REQ-BR-008 | Customer counter-proposal exceeding thresholds auto re-enters approval flow |
| REQ-BR-009 | Auto warehouse split minimizes shipments considering cost weighting |
| REQ-BR-010 | One-time and recurring lines on same order billed separately |
| REQ-BR-011 | Mid-cycle subscription changes trigger proration |
| REQ-BR-012 | Cancellations trigger credit note or partial refund per configured rules |
| REQ-BR-013 | Upsell/cross-sell only surfaces if meets minimum margin threshold |
| REQ-BR-014 | Deal is stalled when inactive beyond configurable threshold (days) |
| REQ-BR-015 | Discount anomaly fires when rep's discount significantly above historical average |
| REQ-BR-016 | Delivery slippage alert fires when fulfillment is behind expected ship date |
| REQ-BR-017 | All approval actions logged immutably (user, timestamp, reason) |

---

## F. Data Requirements

| ID | Entity | Key Attributes |
|----|--------|----------------|
| REQ-D-001 | User | id, email, password_hash, role, name, created_at |
| REQ-D-002 | Customer | id, name, email, tier, currency, portal_access |
| REQ-D-003 | Product | id, name, category, base_price, unit, tax_rate, description |
| REQ-D-004 | ProductVariant | id, product_id, attribute, value, extra_price |
| REQ-D-005 | PriceList | id, name, customer_tier, currency, rules |
| REQ-D-006 | DiscountTier | id, customer_tier, category, ceiling_pct |
| REQ-D-007 | ApprovalChain | id, min_risk_score, max_risk_score, required_roles |
| REQ-D-008 | Quotation | id, customer_id, rep_id, status, blended_risk_score, created_at, updated_at |
| REQ-D-009 | QuotationLine | id, quotation_id, product_id, variant_id, qty, unit_price, discount_pct, line_total, margin_pct |
| REQ-D-010 | ApprovalLog | id, quotation_id, approver_id, role, action, reason, timestamp |
| REQ-D-011 | Warehouse | id, name, location, shipping_cost_weight |
| REQ-D-012 | WarehouseStock | id, warehouse_id, product_id, variant_id, quantity_on_hand |
| REQ-D-013 | FulfillmentSplit | id, order_id, warehouse_id, product_id, quantity, status |
| REQ-D-014 | SubscriptionPlan | id, name, interval, price |
| REQ-D-015 | SubscriptionLine | id, order_id, plan_id, start_date, next_billing_date, quantity, status |
| REQ-D-016 | Invoice | id, order_id, type, amount, status, due_date |
| REQ-D-017 | UpsellRule | id, trigger_product_id, suggested_product_id, min_margin_pct, is_promoted |
| REQ-D-018 | CustomerNegotiation | id, quotation_id, customer_id, message, proposed_discount, status, timestamp |
| REQ-D-019 | DealHealthConfig | id, stall_days_threshold, anomaly_std_dev_threshold |

---

## G. External Integrations

| ID | Integration | Purpose |
|----|------------|---------|
| REQ-EXT-001 | Email Service (SMTP/SendGrid) | Magic links, approval notifications, nudge emails |
| REQ-EXT-002 | PDF Export library | Quotation and report PDF generation |
| REQ-EXT-003 | XLS Export library | Report Excel generation |

---

## H. Security Requirements

| ID | Requirement |
|----|------------|
| REQ-SEC-001 | RBAC: Sales Rep, Sales Manager, Finance, Admin, Customer (Portal) |
| REQ-SEC-002 | Customer portal completely isolated — customers cannot access internal workspace |
| REQ-SEC-003 | Customers can only view/act on their own quotations |
| REQ-SEC-004 | JWT-based authentication for internal users |
| REQ-SEC-005 | Magic link tokens: single-use, time-limited (24 hours) |
| REQ-SEC-006 | Passwords hashed with bcrypt or argon2 |
| REQ-SEC-007 | All API endpoints validate authentication before processing |
| REQ-SEC-008 | Approval log entries are immutable |
| REQ-SEC-009 | Input validation on all user-supplied data |
| REQ-SEC-010 | CORS configured to restrict origins |

---

## I. Performance Requirements

| ID | Requirement |
|----|------------|
| REQ-PERF-001 | Margin indicator updates in real time (<500ms) |
| REQ-PERF-002 | Blended risk score computed immediately on discount change |
| REQ-PERF-003 | Warehouse split recommendation within 2s |
| REQ-PERF-004 | Deal health dashboard loads within 3s for up to 1000 quotations |
| REQ-PERF-005 | Concurrent multi-rep usage without data corruption |

---

## J. Reporting / Analytics Requirements

| ID | Requirement |
|----|------------|
| REQ-RPT-001 | Sales performance dashboard with KPIs |
| REQ-RPT-002 | Quotation pipeline status breakdown |
| REQ-RPT-003 | Discount anomaly summary per rep |
| REQ-RPT-004 | Best-selling and most-discounted products |
| REQ-RPT-005 | Approval throughput metrics |
| REQ-RPT-006 | Recurring revenue summary (MRR, upcoming renewals) |
| REQ-RPT-007 | Export: PDF and XLS for all reports |

---

## K. Bonus Requirements (MANDATORY)

| ID | Requirement | Source |
|----|------------|--------|
| REQ-BONUS-001 | Multi-currency support — price lists and invoices in different currencies | PDF p.10 |
| REQ-BONUS-002 | Multi-company support — isolate data by company tenant | PDF p.10 |
| REQ-BONUS-003 | Upsell/cross-sell rule setup (Module A6) fully implemented | PDF p.5 |
| REQ-BONUS-004 | Automated nudge/escalation action triggerable from Deal Health alert | PDF p.8 |
| REQ-BONUS-005 | Consolidate Remaining Backorder automatic prompt when mid-fulfillment stock arrives | PDF p.7 |

---

## L. Constraints

| ID | Constraint |
|----|-----------|
| REQ-CON-001 | Technology stack is free choice |
| REQ-CON-002 | Core business rules must be in application logic — not faked |
| REQ-CON-003 | Customer portal must be genuinely separate and restricted |
| REQ-CON-004 | System must include sample seed data |
| REQ-CON-005 | Must support 5-minute live demo covering >=2 full end-to-end flows |

---

## M. Implied Production-Quality Requirements

| ID | Requirement | Rationale |
|----|------------|-----------|
| REQ-IMP-001 | Structured logging with request IDs | Production-quality traceability |
| REQ-IMP-002 | Health check endpoints on all services | Deployment / monitoring |
| REQ-IMP-003 | Database migrations tracked and versioned | Schema evolution |
| REQ-IMP-004 | Graceful error responses (RFC 7807 Problem Details format) | API quality |
| REQ-IMP-005 | Pagination on all list endpoints | Prevents OOM on large datasets |
| REQ-IMP-006 | Idempotency on confirmation and payment recording | Prevents duplicate processing |
| REQ-IMP-007 | Optimistic concurrency on quotation edits | Multi-rep scenarios |
| REQ-IMP-008 | Environment-based configuration — no secrets in code | Security |
| REQ-IMP-009 | CSRF protection on portal form submissions | Security |
| REQ-IMP-010 | Rate limiting on auth endpoints | Brute-force prevention |

---

## Implementation Checkpoints — Requirements Phase

**CHECK-REQ-001**
- **Covers**: All REQ-F-xxx, REQ-BONUS-xxx
- **Precondition**: Documentation complete
- **Action**: Cross-reference every PDF feature against this requirements list
- **Expected**: Every PDF feature has a REQ identifier
- **Verification**: Manual review of PDF vs this document

**CHECK-REQ-002**
- **Covers**: REQ-BR-001 to REQ-BR-017, REQ-CON-002
- **Precondition**: Application implemented
- **Action**: Execute the 8-step Quick Test Flow from PDF Section 9
- **Expected**: All 8 steps produce correct, visible results
- **Verification**: Automated e2e test + manual demo

**CHECK-REQ-003**
- **Covers**: REQ-SEC-002, REQ-F-008, REQ-CON-003
- **Precondition**: Auth and portal implemented
- **Action**: Log in as Customer portal user; attempt to access internal workspace URL
- **Expected**: HTTP 403 or redirect to portal login — cannot access internal screens
- **Verification**: Automated security test
