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

  // 3. Stalled Deal Alert
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

  console.log('✅ Seeded config, quotation snapshots, and deal alert');
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
