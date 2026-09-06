import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function padId(prefix: string, num: number): string {
  const numStr = String(num).padStart(12, '0');
  return `${prefix}-000000-0000-0000-0000-${numStr}`;
}

export async function seed() {
  console.log('🌱 Seeding billing_db comprehensively...');

  const customers = [
    { id: 'cust-000000-0000-0000-0000-000000000001', name: 'Acme Corporation' },
    { id: 'cust-000000-0000-0000-0000-000000000002', name: 'Beta Logistics' },
    { id: 'cust-000000-0000-0000-0000-000000000003', name: 'Gamma Innovations' },
    { id: 'cust-000000-0000-0000-0000-000000000004', name: 'Delta Financial Services' },
    { id: 'cust-000000-0000-0000-0000-000000000005', name: 'Epsilon Health Network' },
    { id: 'cust-000000-0000-0000-0000-000000000007', name: 'Theta Retail Chains' },
    { id: 'cust-000000-0000-0000-0000-000000000009', name: 'Nexus Technologies Group' },
    { id: 'cust-000000-0000-0000-0000-000000000011', name: 'Vanguard Aerospace Systems' },
    { id: 'cust-000000-0000-0000-0000-000000000017', name: 'Omni Consumer Products' },
    { id: 'cust-000000-0000-0000-0000-000000000020', name: 'Massive Dynamic R&D' },
  ];

  // Clear existing payments, lines, invoices, and subscriptions
  await prisma.payment.deleteMany({});
  await prisma.billingCycle.deleteMany({});
  await prisma.subscriptionLine.deleteMany({});
  await prisma.invoiceLine.deleteMany({});
  await prisma.invoice.deleteMany({});

  // ─── 1. Seed 20 Invoices ────────────────────────────────────
  for (let i = 1; i <= 20; i++) {
    const invId = padId('inv', i);
    const ordId = padId('quot', 240 + (i % 20)); // Match confirmed/sent quotes
    const cust = customers[i % customers.length];
    const isPaid = i <= 10;
    const isOverdue = i > 17;
    const status = isPaid ? 'PAID' : isOverdue ? 'OVERDUE' : 'SENT';

    const amt = 1500 + (i * 350);

    const invoice = await prisma.invoice.create({
      data: {
        id: invId,
        companyId: 'default',
        orderId: ordId,
        customerId: cust.id,
        type: 'ONE_TIME',
        status: status as any,
        currency: 'USD',
        subtotal: amt,
        taxAmount: 0,
        totalAmount: amt,
        dueDate: new Date(Date.now() + (isOverdue ? -5 : 15) * 24 * 60 * 60 * 1000),
        paidAt: isPaid ? new Date(Date.now() - (i * 24 * 3600000)) : null,
        notes: `Enterprise order invoice #${invId.slice(0, 8)} for ${cust.name}`,
        lines: {
          create: [
            {
              productId: padId('prod', 1 + (i % 20)),
              description: `Enterprise Hardware Deployment Unit #${i}`,
              quantity: 1 + (i % 4),
              unitPrice: Math.round((amt / (1 + (i % 4))) * 100) / 100,
              discountPct: 0,
              lineTotal: amt,
              taxRate: 0,
              taxAmount: 0,
            },
          ],
        },
      },
    });

    if (isPaid) {
      await prisma.payment.create({
        data: {
          companyId: 'default',
          invoiceId: invoice.id,
          amount: amt,
          currency: 'USD',
          method: i % 2 === 0 ? 'WIRE_TRANSFER' : 'BANK_TRANSFER',
          reference: `TXN-SEED-${100000 + i}`,
          recordedBy: '71573de6-0203-4f7b-8e01-2a266ec33364',
          recordedAt: new Date(Date.now() - (i * 24 * 3600000)),
        },
      });
    }
  }

  // ─── 2. Seed 10 Active Subscriptions ────────────────────────
  const subPlans = [
    { id: 'plan-0000-0000-0000-0000-000000000001', name: 'DealFlow360 ProSupport Monthly', price: 49.99, interval: 'MONTHLY' },
    { id: 'plan-0000-0000-0000-0000-000000000002', name: 'DealFlow360 ProSupport Annual', price: 499.00, interval: 'YEARLY' },
    { id: 'plan-0000-0000-0000-0000-000000000003', name: 'Cloud Backup 1TB Enterprise', price: 29.99, interval: 'MONTHLY' },
    { id: 'plan-0000-0000-0000-0000-000000000004', name: 'Managed Hosting Pro Cluster', price: 149.00, interval: 'MONTHLY' },
  ];

  for (let s = 1; s <= 10; s++) {
    const subId = padId('sub', s);
    const plan = subPlans[s % subPlans.length];
    const cust = customers[s % customers.length];
    const qty = 1 + (s % 5);
    const unitPrice = plan.price;

    await prisma.subscriptionLine.create({
      data: {
        id: subId,
        companyId: 'default',
        orderId: padId('quot', s),
        customerId: cust.id,
        planId: plan.id,
        planName: plan.name,
        interval: plan.interval,
        unitPrice,
        quantity: qty,
        currency: 'USD',
        status: 'ACTIVE',
        startDate: new Date(Date.now() - 60 * 24 * 3600000),
        currentPeriodStart: new Date(Date.now() - 15 * 24 * 3600000),
        currentPeriodEnd: new Date(Date.now() + 15 * 24 * 3600000),
        nextBillingDate: new Date(Date.now() + 15 * 24 * 3600000),
        cancellationPolicy: 'end_of_period',
        partialRefundPct: 0,
        billingHistory: {
          create: [
            {
              periodStart: new Date(Date.now() - 45 * 24 * 3600000),
              periodEnd: new Date(Date.now() - 15 * 24 * 3600000),
              amount: unitPrice * qty,
              billedAt: new Date(Date.now() - 45 * 24 * 3600000),
            },
          ],
        },
      },
    });
  }

  const invCount = await prisma.invoice.count();
  const subCount = await prisma.subscriptionLine.count();
  console.log(`✅ Seeded ${invCount} invoices and ${subCount} subscriptions!`);
  console.log('✨ billing_db seed complete!');
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
