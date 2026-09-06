import { PrismaClient, QuotationStatus, ApprovalAction, NegotiationStatus } from '@prisma/client';

const prisma = new PrismaClient();

function padId(prefix: string, num: number): string {
  const numStr = String(num).padStart(12, '0');
  return `${prefix}-000000-0000-0000-0000-${numStr}`;
}

export async function seed() {
  console.log('🌱 Seeding quotation_db comprehensively (25 customers, 260 quotations)...');

  // ─── 1. 25 Enterprise Customers ─────────────────────────────
  const customerSeeds = [
    { id: 'cust-000000-0000-0000-0000-000000000001', name: 'Acme Corporation', email: 'acme@example.com', tier: 'GOLD', hasPortalAccess: true },
    { id: 'cust-000000-0000-0000-0000-000000000002', name: 'Beta Logistics', email: 'beta@example.com', tier: 'SILVER', hasPortalAccess: true },
    { id: 'cust-000000-0000-0000-0000-000000000003', name: 'Gamma Innovations', email: 'gamma@example.com', tier: 'BRONZE', hasPortalAccess: true },
    { id: 'cust-000000-0000-0000-0000-000000000004', name: 'Delta Financial Services', email: 'delta@example.com', tier: 'GOLD', hasPortalAccess: true },
    { id: 'cust-000000-0000-0000-0000-000000000005', name: 'Epsilon Health Network', email: 'epsilon@example.com', tier: 'SILVER', hasPortalAccess: true },
    { id: 'cust-000000-0000-0000-0000-000000000006', name: 'Zeta Media & Broadcast', email: 'zeta@example.com', tier: 'BRONZE', hasPortalAccess: true },
    { id: 'cust-000000-0000-0000-0000-000000000007', name: 'Theta Retail Chains', email: 'theta@example.com', tier: 'GOLD', hasPortalAccess: true },
    { id: 'cust-000000-0000-0000-0000-000000000008', name: 'Apex Global Logistics', email: 'apex@example.com', tier: 'SILVER', hasPortalAccess: true },
    { id: 'cust-000000-0000-0000-0000-000000000009', name: 'Nexus Technologies Group', email: 'nexus@example.com', tier: 'GOLD', hasPortalAccess: true },
    { id: 'cust-000000-0000-0000-0000-000000000010', name: 'Horizon Energy Corp', email: 'horizon@example.com', tier: 'BRONZE', hasPortalAccess: true },
    { id: 'cust-000000-0000-0000-0000-000000000011', name: 'Vanguard Aerospace Systems', email: 'vanguard@example.com', tier: 'GOLD', hasPortalAccess: true },
    { id: 'cust-000000-0000-0000-0000-000000000012', name: 'Summit Dynamics Engineering', email: 'summit@example.com', tier: 'SILVER', hasPortalAccess: true },
    { id: 'cust-000000-0000-0000-0000-000000000013', name: 'Pinnacle Telecom International', email: 'pinnacle@example.com', tier: 'GOLD', hasPortalAccess: true },
    { id: 'cust-000000-0000-0000-0000-000000000014', name: 'Aegis BioTech Labs', email: 'aegis@example.com', tier: 'BRONZE', hasPortalAccess: false },
    { id: 'cust-000000-0000-0000-0000-000000000015', name: 'Starlight Supply Chain LLC', email: 'starlight@example.com', tier: 'SILVER', hasPortalAccess: true },
    { id: 'cust-000000-0000-0000-0000-000000000016', name: 'Cyberdyne Advanced Systems', email: 'cyberdyne@example.com', tier: 'GOLD', hasPortalAccess: false },
    { id: 'cust-000000-0000-0000-0000-000000000017', name: 'Omni Consumer Products', email: 'omni@example.com', tier: 'GOLD', hasPortalAccess: true },
    { id: 'cust-000000-0000-0000-0000-000000000018', name: 'Initech Software Solutions', email: 'initech@example.com', tier: 'BRONZE', hasPortalAccess: false },
    { id: 'cust-000000-0000-0000-0000-000000000019', name: 'Umbrella Life Sciences', email: 'umbrella@example.com', tier: 'SILVER', hasPortalAccess: true },
    { id: 'cust-000000-0000-0000-0000-000000000020', name: 'Massive Dynamic R&D', email: 'massive@example.com', tier: 'GOLD', hasPortalAccess: true },
    { id: 'cust-000000-0000-0000-0000-000000000021', name: 'Soylent AgriTech Group', email: 'soylent@example.com', tier: 'BRONZE', hasPortalAccess: false },
    { id: 'cust-000000-0000-0000-0000-000000000022', name: 'Hooli Cloud Services', email: 'hooli@example.com', tier: 'GOLD', hasPortalAccess: true },
    { id: 'cust-000000-0000-0000-0000-000000000023', name: 'Pied Piper Compression', email: 'piedpiper@example.com', tier: 'SILVER', hasPortalAccess: true },
    { id: 'cust-000000-0000-0000-0000-000000000024', name: 'Stark Industries Defense', email: 'stark@example.com', tier: 'GOLD', hasPortalAccess: true },
    { id: 'cust-000000-0000-0000-0000-000000000025', name: 'Wayne Enterprises Global', email: 'wayne@example.com', tier: 'GOLD', hasPortalAccess: true },
  ];

  for (const c of customerSeeds) {
    await prisma.customer.upsert({
      where: { companyId_email: { companyId: 'default', email: c.email } },
      update: c,
      create: { ...c, companyId: 'default', currency: 'USD' },
    });
  }
  console.log(`✅ Seeded ${customerSeeds.length} enterprise customers!`);

  // ─── 2. Catalog Products Pool for Quotations ────────────────
  const catalogPool = [
    { id: 'prod-000000-0000-0000-0000-000000000001', name: 'Enterprise Laptop Pro', category: 'Hardware', price: 1299, cost: 900 },
    { id: 'prod-000000-0000-0000-0000-000000000002', name: '4K UHD Monitor 27"', category: 'Peripherals', price: 599, cost: 380 },
    { id: 'prod-000000-0000-0000-0000-000000000003', name: 'Dell PowerEdge Server', category: 'Hardware', price: 4999, cost: 3200 },
    { id: 'prod-000000-0000-0000-0000-000000000004', name: 'Managed Network Switch 24-port', category: 'Networking', price: 899, cost: 580 },
    { id: 'prod-000000-0000-0000-0000-000000000005', name: 'Enterprise Onboarding Pack', category: 'Services', price: 2500, cost: 800 },
    { id: 'prod-000000-0000-0000-0000-000000000006', name: 'Dedicated Support (Annual)', category: 'Services', price: 5000, cost: 1500 },
    { id: 'prod-000000-0000-0000-0000-000000000007', name: 'Technical Training (8h)', category: 'Services', price: 1200, cost: 350 },
    { id: 'prod-000000-0000-0000-0000-000000000008', name: 'Cloud Backup 1TB', category: 'Subscriptions', price: 29.99, cost: 5, isRecurring: true },
    { id: 'prod-000000-0000-0000-0000-000000000009', name: 'Enterprise Security Suite', category: 'Security', price: 49.99, cost: 12, isRecurring: true },
    { id: 'prod-000000-0000-0000-0000-000000000010', name: 'Managed Hosting Pro', category: 'Subscriptions', price: 149, cost: 40, isRecurring: true },
    { id: 'prod-000000-0000-0000-0000-000000000011', name: 'ThinkPad Workstation T16', category: 'Hardware', price: 1750, cost: 1200 },
    { id: 'prod-000000-0000-0000-0000-000000000012', name: 'Dell Latitude 7440 Ultralight', category: 'Hardware', price: 1420, cost: 980 },
    { id: 'prod-000000-0000-0000-0000-000000000013', name: 'MacBook Pro 16" M3 Pro', category: 'Hardware', price: 2499, cost: 1850 },
    { id: 'prod-000000-0000-0000-0000-000000000014', name: 'HP EliteBook 840 G10', category: 'Hardware', price: 1350, cost: 920 },
    { id: 'prod-000000-0000-0000-0000-000000000015', name: 'Cisco Catalyst 9300 48-Port', category: 'Networking', price: 3800, cost: 2400 },
    { id: 'prod-000000-0000-0000-0000-000000000016', name: 'Fortinet FortiGate 100F', category: 'Networking', price: 2950, cost: 1900 },
    { id: 'prod-000000-0000-0000-0000-000000000017', name: 'Dell UltraSharp 32" 4K Monitor', category: 'Peripherals', price: 799, cost: 520 },
    { id: 'prod-000000-0000-0000-0000-000000000018', name: 'CalDigit TS4 Thunderbolt 4 Dock', category: 'Peripherals', price: 399, cost: 250 },
    { id: 'prod-000000-0000-0000-0000-000000000019', name: 'CrowdStrike Falcon Endpoint', category: 'Security', price: 85, cost: 25, isRecurring: true },
    { id: 'prod-000000-0000-0000-0000-000000000020', name: 'Okta Adaptive MFA Seat', category: 'Security', price: 36, cost: 10, isRecurring: true },
  ];

  const salesReps = [
    'rep-000000-0000-0000-0000-000000000001',
    'rep-000000-0000-0000-0000-000000000002',
    'rep-000000-0000-0000-0000-000000000003',
  ];

  // ─── 3. 260 Quotations Distribution ─────────────────────────
  // Mostly in DRAFT state (~180 DRAFT)
  // ~25 PENDING_MANAGER_APPROVAL, ~15 PENDING_FINANCE_APPROVAL
  // ~12 APPROVED, ~10 SENT, ~8 UNDER_NEGOTIATION, ~10 CONFIRMED
  const quotationSpecs: { id: string; status: QuotationStatus; riskScore: number }[] = [];

  for (let i = 1; i <= 260; i++) {
    const qid = padId('quot', i);
    let status: QuotationStatus = QuotationStatus.DRAFT;
    let risk = 0;

    if (i <= 180) {
      status = QuotationStatus.DRAFT;
      risk = Math.round(((i * 3) % 15) * 10) / 10;
    } else if (i <= 205) {
      status = QuotationStatus.PENDING_MANAGER_APPROVAL;
      risk = Math.round((12 + ((i * 5) % 16)) * 10) / 10; // 12.0 - 27.0
    } else if (i <= 220) {
      status = QuotationStatus.PENDING_FINANCE_APPROVAL;
      risk = Math.round((35 + ((i * 7) % 40)) * 10) / 10; // 35.0 - 74.0 (requires finance)
    } else if (i <= 232) {
      status = QuotationStatus.APPROVED;
      risk = Math.round(((i * 2) % 25) * 10) / 10;
    } else if (i <= 242) {
      status = QuotationStatus.SENT;
      risk = Math.round(((i * 4) % 20) * 10) / 10;
    } else if (i <= 250) {
      status = QuotationStatus.UNDER_NEGOTIATION;
      risk = Math.round((18 + ((i * 3) % 20)) * 10) / 10;
    } else {
      status = QuotationStatus.CONFIRMED;
      risk = Math.round(((i * 2) % 15) * 10) / 10;
    }

    quotationSpecs.push({ id: qid, status, riskScore: risk });
  }

  // Clear existing quotations to avoid unique key conflicts
  await prisma.approvalLog.deleteMany({});
  await prisma.customerNegotiation.deleteMany({});
  await prisma.quotationLine.deleteMany({});
  await prisma.quotation.deleteMany({});

  console.log('Generating 260 quotations with line items and approval structures...');

  for (let qIdx = 0; qIdx < quotationSpecs.length; qIdx++) {
    const spec = quotationSpecs[qIdx];
    const customer = customerSeeds[qIdx % customerSeeds.length];
    const repId = salesReps[qIdx % salesReps.length];

    // Pick 1 to 3 products
    const lineCount = 1 + (qIdx % 3);
    const linesToInsert: any[] = [];
    let totalAmt = 0;
    let totalCost = 0;

    for (let l = 0; l < lineCount; l++) {
      const prod = catalogPool[(qIdx * 3 + l) % catalogPool.length];
      const qty = 1 + ((qIdx + l) % 5);
      // High discount for pending finance approval
      const discount = spec.status === QuotationStatus.PENDING_FINANCE_APPROVAL
        ? 22.0
        : spec.status === QuotationStatus.PENDING_MANAGER_APPROVAL
        ? 14.0
        : (qIdx % 4 === 0) ? 8.0 : 0.0;

      const lineTotal = Math.round(prod.price * qty * (1 - discount / 100) * 100) / 100;
      const costTotal = prod.cost * qty;
      const margin = lineTotal > 0 ? Math.round(((lineTotal - costTotal) / lineTotal) * 1000) / 10 : 0;
      const tax = Math.round(lineTotal * 0.18 * 100) / 100;

      totalAmt += lineTotal;
      totalCost += costTotal;

      linesToInsert.push({
        productId: prod.id,
        variantId: null,
        productName: prod.name,
        categoryId: `cat-${prod.category.toLowerCase()}`,
        categoryName: prod.category,
        quantity: qty,
        unitPrice: prod.price,
        costPrice: prod.cost,
        discountPct: discount,
        lineTotal,
        taxAmount: tax,
        marginPct: margin,
        isRecurring: !!prod.isRecurring,
        sortOrder: l,
      });
    }

    const blendedMargin = totalAmt > 0 ? Math.round(((totalAmt - totalCost) / totalAmt) * 1000) / 10 : 25.0;

    const createdQuote = await prisma.quotation.create({
      data: {
        id: spec.id,
        companyId: 'default',
        customerId: customer.id,
        repId,
        status: spec.status,
        blendedRiskScore: spec.riskScore,
        totalAmount: Math.round(totalAmt * 100) / 100,
        totalMarginPct: blendedMargin,
        currency: 'USD',
        notes: `Enterprise order proposal for ${customer.name} - Fleet replenishment`,
        version: 1,
        lastActivityAt: new Date(Date.now() - (qIdx * 3600000)),
        confirmedAt: spec.status === QuotationStatus.CONFIRMED ? new Date(Date.now() - (qIdx * 1800000)) : null,
        lines: {
          create: linesToInsert,
        },
      },
    });

    // If pending finance review, create approval log showing sales manager approved, waiting on finance
    if (spec.status === QuotationStatus.PENDING_FINANCE_APPROVAL) {
      await prisma.approvalLog.create({
        data: {
          quotationId: createdQuote.id,
          approverId: 'mgr-000000-0000-0000-0000-000000000001',
          approverName: 'Alice Manager',
          approverRole: 'SALES_MANAGER',
          action: ApprovalAction.APPROVE,
          reason: 'Discount exceeds manager threshold, routed to Finance Controller for Tier-2 approval',
          riskScore: spec.riskScore,
          createdAt: new Date(Date.now() - 3600000),
        },
      });
    }

    // If under negotiation, create negotiation ticket
    if (spec.status === QuotationStatus.UNDER_NEGOTIATION) {
      await prisma.customerNegotiation.create({
        data: {
          quotationId: createdQuote.id,
          customerId: customer.id,
          message: `Requesting a volume rebate on hardware units due to multi-year commitment.`,
          proposedDiscount: 18.0,
          status: NegotiationStatus.PENDING,
          createdAt: new Date(Date.now() - 7200000),
        },
      });
    }
  }

  const qCount = await prisma.quotation.count({ where: { companyId: 'default' } });
  const draftCount = await prisma.quotation.count({ where: { companyId: 'default', status: QuotationStatus.DRAFT } });
  const linesCount = await prisma.quotationLine.count();

  console.log(`✅ Seeded ${qCount} quotations (${draftCount} in DRAFT state) with ${linesCount} lines across 25 customers!`);
  console.log('✨ quotation_db seed complete!');
}

seed()
  .catch((err) => {
    console.error('❌ Quotation seed failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
