import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

export async function seed() {
  console.log('🌱 Seeding analytics_db...');

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

  // 2. Quotation Snapshots
  const q1 = await prisma.quotationSnapshot.upsert({
    where: { id: 'quot-ana-001' },
    update: {},
    create: {
      id: 'quot-ana-001',
      companyId: 'default',
      repId: 'rep-001',
      repName: 'Sarah Jenkins',
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

  const q2 = await prisma.quotationSnapshot.upsert({
    where: { id: 'quot-ana-002' },
    update: {},
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
      lastActivityAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), // 10 days ago -> stalled
      createdAt: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000),
    },
  });

  const q3 = await prisma.quotationSnapshot.upsert({
    where: { id: 'quot-ana-003' },
    update: {},
    create: {
      id: 'quot-ana-003',
      companyId: 'default',
      repId: 'rep-000000-0000-0000-0000-000000000001',
      repName: 'Sales Representative Lead',
      customerId: 'cust-003',
      customerName: 'Gamma Innovations',
      customerTier: 'BRONZE',
      status: 'PENDING_APPROVAL',
      totalAmount: new Prisma.Decimal(88500),
      totalMarginPct: 14.2,
      blendedRiskScore: 48.5,
      currency: 'USD',
      lastActivityAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    },
  });

  const q4 = await prisma.quotationSnapshot.upsert({
    where: { id: 'quot-ana-004' },
    update: {},
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
      lastActivityAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      createdAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
    },
  });

  // 3. Deal Alerts
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

  console.log('✅ Seeded config, quotation snapshots, and 3 deal alerts');
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
