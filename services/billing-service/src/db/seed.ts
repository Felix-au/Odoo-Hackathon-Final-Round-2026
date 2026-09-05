import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function seed() {
  console.log('🌱 Seeding billing_db...');

  // 1. Sample One-time Invoice
  const invoice1 = await prisma.invoice.upsert({
    where: { id: 'inv-000000-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: 'inv-000000-0000-0000-0000-000000000001',
      companyId: 'default',
      orderId: 'quot-000000-0000-0000-0000-000000000001',
      customerId: 'cust-000000-0000-0000-0000-000000000001',
      type: 'ONE_TIME',
      status: 'SENT',
      currency: 'USD',
      subtotal: 5000,
      taxAmount: 0,
      totalAmount: 5000,
      dueDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
      notes: 'Initial order invoice (Net 15)',
      lines: {
        create: [
          {
            productId: 'prod-001',
            description: 'Enterprise Server Rack',
            quantity: 2,
            unitPrice: 2500,
            discountPct: 0,
            lineTotal: 5000,
            taxRate: 0,
            taxAmount: 0,
          },
        ],
      },
    },
  });

  // 2. Sample Subscription Line
  const sub1 = await prisma.subscriptionLine.upsert({
    where: { id: 'sub-000000-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: 'sub-000000-0000-0000-0000-000000000001',
      companyId: 'default',
      orderId: 'quot-000000-0000-0000-0000-000000000001',
      customerId: 'cust-000000-0000-0000-0000-000000000001',
      planId: 'plan-001',
      planName: 'Cloud Support Premium',
      interval: 'MONTHLY',
      unitPrice: 200,
      quantity: 3,
      currency: 'USD',
      status: 'ACTIVE',
      startDate: new Date(),
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      nextBillingDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      cancellationPolicy: 'immediate',
      partialRefundPct: 50,
      billingHistory: {
        create: [
          {
            periodStart: new Date(),
            periodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            amount: 600,
            invoiceId: invoice1.id,
            billedAt: new Date(),
          },
        ],
      },
    },
  });

  console.log(`✅ Seeded 1 invoice (${invoice1.id}) and 1 subscription (${sub1.id})`);
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
