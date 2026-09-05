import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

export async function seed() {
  console.log('🌱 Seeding analytics_db with comprehensive pipeline snapshots...');

  // 1. Deal Health Config
  await prisma.dealHealthConfig.upsert({
    where: { companyId: 'default' },
    update: {},
    create: {
      companyId: 'default',
      stallDaysThreshold: 7,
      anomalyStdDevFactor: 2.0,
      deliverySlippageDays: 3,
    },
  });

  // 2. Comprehensive Quotation Snapshots Across All 5 Stages
  
  // ─── DRAFT STAGE (2 quotes) ───
  await prisma.quotationSnapshot.upsert({
    where: { id: 'quot-ana-005' },
    update: { status: 'DRAFT' },
    create: {
      id: 'quot-ana-005',
      companyId: 'default',
      repId: 'rep-000000-0000-0000-0000-000000000001',
      repName: 'Sales Representative Lead',
      customerId: 'cust-001',
      customerName: 'Acme Corporation',
      customerTier: 'GOLD',
      status: 'DRAFT',
      totalAmount: new Prisma.Decimal(12500),
      totalMarginPct: 28.5,
      blendedRiskScore: 0,
      currency: 'USD',
      lastActivityAt: new Date(),
      createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    },
  });

  await prisma.quotationSnapshot.upsert({
    where: { id: 'quot-ana-006' },
    update: { status: 'DRAFT' },
    create: {
      id: 'quot-ana-006',
      companyId: 'default',
      repId: 'rep-002',
      repName: 'Michael Chang',
      customerId: 'cust-004',
      customerName: 'Cyberdyne Systems',
      customerTier: 'SILVER',
      status: 'DRAFT',
      totalAmount: new Prisma.Decimal(28000),
      totalMarginPct: 31.0,
      blendedRiskScore: 0,
      currency: 'USD',
      lastActivityAt: new Date(),
      createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
    },
  });

  // ─── IN REVIEW / PENDING APPROVAL (2 quotes) ───
  const q3 = await prisma.quotationSnapshot.upsert({
    where: { id: 'quot-ana-003' },
    update: { status: 'PENDING_MANAGER_APPROVAL' },
    create: {
      id: 'quot-ana-003',
      companyId: 'default',
      repId: 'rep-000000-0000-0000-0000-000000000001',
      repName: 'Sales Representative Lead',
      customerId: 'cust-003',
      customerName: 'Gamma Innovations',
      customerTier: 'BRONZE',
      status: 'PENDING_MANAGER_APPROVAL',
      totalAmount: new Prisma.Decimal(88500),
      totalMarginPct: 14.2,
      blendedRiskScore: 48.5,
      currency: 'USD',
      lastActivityAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    },
  });

  await prisma.quotationSnapshot.upsert({
    where: { id: 'quot-ana-007' },
    update: { status: 'PENDING_MANAGER_APPROVAL' },
    create: {
      id: 'quot-ana-007',
      companyId: 'default',
      repId: 'rep-000000-0000-0000-0000-000000000001',
      repName: 'Sales Representative Lead',
      customerId: 'cust-005',
      customerName: 'Wayne Enterprises',
      customerTier: 'GOLD',
      status: 'PENDING_MANAGER_APPROVAL',
      totalAmount: new Prisma.Decimal(54000),
      totalMarginPct: 24.0,
      blendedRiskScore: 24.0,
      currency: 'USD',
      lastActivityAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    },
  });

  // ─── APPROVED STAGE (2 quotes) ───
  await prisma.quotationSnapshot.upsert({
    where: { id: 'quot-ana-008' },
    update: { status: 'APPROVED' },
    create: {
      id: 'quot-ana-008',
      companyId: 'default',
      repId: 'rep-002',
      repName: 'Michael Chang',
      customerId: 'cust-006',
      customerName: 'Stark Industries',
      customerTier: 'GOLD',
      status: 'APPROVED',
      totalAmount: new Prisma.Decimal(62000),
      totalMarginPct: 35.0,
      blendedRiskScore: 0,
      currency: 'USD',
      lastActivityAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      createdAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
    },
  });

  await prisma.quotationSnapshot.upsert({
    where: { id: 'quot-ana-009' },
    update: { status: 'APPROVED' },
    create: {
      id: 'quot-ana-009',
      companyId: 'default',
      repId: 'rep-000000-0000-0000-0000-000000000001',
      repName: 'Sales Representative Lead',
      customerId: 'cust-007',
      customerName: 'Initech Systems',
      customerTier: 'SILVER',
      status: 'APPROVED',
      totalAmount: new Prisma.Decimal(39500),
      totalMarginPct: 30.0,
      blendedRiskScore: 0,
      currency: 'USD',
      lastActivityAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    },
  });

  // ─── SENT TO CLIENT (3 quotes) ───
  const q2 = await prisma.quotationSnapshot.upsert({
    where: { id: 'quot-ana-002' },
    update: { status: 'SENT' },
    create: {
      id: 'quot-ana-002',
      companyId: 'default',
      repId: 'rep-002',
      repName: 'Michael Chang',
      customerId: 'cust-002',
      customerName: 'Beta Industries',
      customerTier: 'SILVER',
      status: 'SENT',
      totalAmount: new Prisma.Decimal(18500),
      totalMarginPct: 28.0,
      blendedRiskScore: 14.5,
      currency: 'USD',
      lastActivityAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), // Stalled
      createdAt: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000),
    },
  });

  const q4 = await prisma.quotationSnapshot.upsert({
    where: { id: 'quot-ana-004' },
    update: { status: 'SENT' },
    create: {
      id: 'quot-ana-004',
      companyId: 'default',
      repId: 'rep-000000-0000-0000-0000-000000000001',
      repName: 'Sales Representative Lead',
      customerId: 'cust-002',
      customerName: 'Beta Logistics',
      customerTier: 'SILVER',
      status: 'SENT',
      totalAmount: new Prisma.Decimal(34200),
      totalMarginPct: 24.5,
      blendedRiskScore: 28.0,
      currency: 'USD',
      lastActivityAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // Slippage
      createdAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
    },
  });

  await prisma.quotationSnapshot.upsert({
    where: { id: 'quot-ana-010' },
    update: { status: 'SENT' },
    create: {
      id: 'quot-ana-010',
      companyId: 'default',
      repId: 'rep-000000-0000-0000-0000-000000000001',
      repName: 'Sales Representative Lead',
      customerId: 'cust-008',
      customerName: 'Hooli Cloud Services',
      customerTier: 'GOLD',
      status: 'SENT',
      totalAmount: new Prisma.Decimal(47000),
      totalMarginPct: 33.0,
      blendedRiskScore: 0,
      currency: 'USD',
      lastActivityAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
    },
  });

  // ─── CONFIRMED / WON (2 quotes) ───
  await prisma.quotationSnapshot.upsert({
    where: { id: 'quot-ana-001' },
    update: { status: 'CONFIRMED' },
    create: {
      id: 'quot-ana-001',
      companyId: 'default',
      repId: 'rep-000000-0000-0000-0000-000000000001',
      repName: 'Sales Representative Lead',
      customerId: 'cust-001',
      customerName: 'Acme Corporation',
      customerTier: 'GOLD',
      status: 'CONFIRMED',
      totalAmount: new Prisma.Decimal(45000),
      totalMarginPct: 32.5,
      blendedRiskScore: 12.0,
      currency: 'USD',
      lastActivityAt: new Date(),
      createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      confirmedAt: new Date(),
    },
  });

  await prisma.quotationSnapshot.upsert({
    where: { id: 'quot-ana-011' },
    update: { status: 'CONFIRMED' },
    create: {
      id: 'quot-ana-011',
      companyId: 'default',
      repId: 'rep-002',
      repName: 'Michael Chang',
      customerId: 'cust-009',
      customerName: 'Massive Dynamic Corp',
      customerTier: 'GOLD',
      status: 'CONFIRMED',
      totalAmount: new Prisma.Decimal(78000),
      totalMarginPct: 36.0,
      blendedRiskScore: 0,
      currency: 'USD',
      lastActivityAt: new Date(),
      createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      confirmedAt: new Date(),
    },
  });

  // 3. Deal Health Alerts (3 Attention Required items)
  await prisma.dealAlert.upsert({
    where: { id: 'alert-001' },
    update: {},
    create: {
      id: 'alert-001',
      companyId: 'default',
      quotationId: q2.id,
      type: 'STALLED',
      severity: 'MEDIUM',
      message: 'Quotation for Beta Industries has been inactive for 10 days',
      isResolved: false,
    },
  });

  await prisma.dealAlert.upsert({
    where: { id: 'alert-002' },
    update: {},
    create: {
      id: 'alert-002',
      companyId: 'default',
      quotationId: q3.id,
      type: 'DISCOUNT_ANOMALY',
      severity: 'HIGH',
      message: 'Discount anomaly: 45% applied to Enterprise Server cluster, exceeding Gold tier margin floor',
      isResolved: false,
    },
  });

  await prisma.dealAlert.upsert({
    where: { id: 'alert-003' },
    update: {},
    create: {
      id: 'alert-003',
      companyId: 'default',
      quotationId: q4.id,
      type: 'DELIVERY_SLIPPAGE',
      severity: 'HIGH',
      message: 'Delivery commitment slipping by 6 days due to Dallas Hub warehouse backorder',
      isResolved: false,
    },
  });

  // 4. Subscriptions (Real Recurring Revenue MRR)
  await prisma.subscriptionSnapshot.upsert({
    where: { id: 'sub-001' },
    update: {},
    create: {
      id: 'sub-001',
      companyId: 'default',
      orderId: 'ord-001',
      customerId: 'cust-001',
      planName: 'Enterprise SLA & Infrastructure Support',
      interval: 'MONTHLY',
      quantity: 1,
      unitPrice: new Prisma.Decimal(42000),
      status: 'ACTIVE',
      nextBillingDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), // Next renewal in 5 days
    },
  });

  await prisma.subscriptionSnapshot.upsert({
    where: { id: 'sub-002' },
    update: {},
    create: {
      id: 'sub-002',
      companyId: 'default',
      orderId: 'ord-002',
      customerId: 'cust-002',
      planName: 'Cloud Workstations Maintenance Tier',
      interval: 'MONTHLY',
      quantity: 1,
      unitPrice: new Prisma.Decimal(20000),
      status: 'ACTIVE',
      nextBillingDate: new Date(Date.now() + 12 * 24 * 60 * 60 * 1000),
    },
  });

  await prisma.subscriptionSnapshot.upsert({
    where: { id: 'sub-003' },
    update: {},
    create: {
      id: 'sub-003',
      companyId: 'default',
      orderId: 'ord-003',
      customerId: 'cust-003',
      planName: 'Managed Security & Compliance Package',
      interval: 'QUARTERLY',
      quantity: 1,
      unitPrice: new Prisma.Decimal(30000), // 30000/3 = 10000 MRR
      status: 'ACTIVE',
      nextBillingDate: new Date(Date.now() + 19 * 24 * 60 * 60 * 1000),
    },
  });

  console.log('✅ Seeded config, 11 quotations, 3 deal alerts, and 3 active subscriptions');
}

if (process.env.NODE_ENV !== 'test') {
  seed()
    .catch((err) => {
      console.error('❌ Seeding failed:', err);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
