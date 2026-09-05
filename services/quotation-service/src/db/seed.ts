import { PrismaClient, QuotationStatus, ApprovalAction } from '@prisma/client';

const prisma = new PrismaClient();

export async function seed() {
  console.log('🌱 Seeding quotation_db...');

  // ─── 1. Customers ──────────────────────────────────────────
  const acme = await prisma.customer.upsert({
    where: { companyId_email: { companyId: 'default', email: 'acme@example.com' } },
    update: {},
    create: {
      id: 'cust-000000-0000-0000-0000-000000000001',
      companyId: 'default',
      name: 'Acme Corporation',
      email: 'acme@example.com',
      tier: 'GOLD',
      currency: 'USD',
      hasPortalAccess: true,
    },
  });

  const beta = await prisma.customer.upsert({
    where: { companyId_email: { companyId: 'default', email: 'beta@example.com' } },
    update: {},
    create: {
      id: 'cust-000000-0000-0000-0000-000000000002',
      companyId: 'default',
      name: 'Beta Logistics',
      email: 'beta@example.com',
      tier: 'SILVER',
      currency: 'USD',
      hasPortalAccess: true,
    },
  });

  const gamma = await prisma.customer.upsert({
    where: { companyId_email: { companyId: 'default', email: 'gamma@example.com' } },
    update: {},
    create: {
      id: 'cust-000000-0000-0000-0000-000000000003',
      companyId: 'default',
      name: 'Gamma Innovations',
      email: 'gamma@example.com',
      tier: 'BRONZE',
      currency: 'USD',
      hasPortalAccess: false,
    },
  });

  console.log('✅ Seeded 3 customers');

  // ─── 2. Sample Quotations ─────────────────────────────────
  const quote1 = await prisma.quotation.upsert({
    where: { id: 'quot-000000-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: 'quot-000000-0000-0000-0000-000000000001',
      companyId: 'default',
      customerId: acme.id,
      repId: 'rep-000000-0000-0000-0000-000000000001',
      status: QuotationStatus.DRAFT,
      blendedRiskScore: 0,
      totalAmount: 5720.00,
      totalMarginPct: 28.3,
      currency: 'USD',
      notes: 'Initial enterprise hardware bundle',
      version: 1,
      lines: {
        create: [
          {
            productId: 'prod-000000-0000-0000-0000-000000000001',
            productName: 'Enterprise Laptop Pro',
            categoryId: 'cat-hardware',
            categoryName: 'Hardware',
            quantity: 5,
            unitPrice: 1299.00,
            costPrice: 900.00,
            discountPct: 12.0,
            lineTotal: 5715.60,
            taxAmount: 1028.80,
            marginPct: 21.2,
          },
        ],
      },
    },
  });

  const quote2 = await prisma.quotation.upsert({
    where: { id: 'quot-000000-0000-0000-0000-000000000002' },
    update: {},
    create: {
      id: 'quot-000000-0000-0000-0000-000000000002',
      companyId: 'default',
      customerId: acme.id,
      repId: 'rep-000000-0000-0000-0000-000000000001',
      status: QuotationStatus.PENDING_MANAGER_APPROVAL,
      blendedRiskScore: 24.5,
      totalAmount: 8200.00,
      totalMarginPct: 18.5,
      currency: 'USD',
      notes: 'High discount service contract',
      version: 1,
      lines: {
        create: [
          {
            productId: 'prod-000000-0000-0000-0000-000000000004',
            productName: 'Enterprise Setup & Migration',
            categoryId: 'cat-service',
            categoryName: 'Services',
            quantity: 2,
            unitPrice: 2500.00,
            costPrice: 1200.00,
            discountPct: 18.0, // Exceeds 10% ceiling
            lineTotal: 4100.00,
            marginPct: 41.4,
          },
        ],
      },
    },
  });

  const quote3 = await prisma.quotation.upsert({
    where: { id: 'quot-000000-0000-0000-0000-000000000003' },
    update: {},
    create: {
      id: 'quot-000000-0000-0000-0000-000000000003',
      companyId: 'default',
      customerId: beta.id,
      repId: 'rep-000000-0000-0000-0000-000000000001',
      status: QuotationStatus.APPROVED,
      blendedRiskScore: 0,
      totalAmount: 2999.00,
      totalMarginPct: 35.0,
      currency: 'USD',
      version: 2,
      approvalLogs: {
        create: [
          {
            approverId: 'mgr-000000-0000-0000-0000-000000000001',
            approverName: 'Jane Manager',
            approverRole: 'SALES_MANAGER',
            action: ApprovalAction.APPROVE,
            reason: 'Standard tier compliance',
            riskScore: 0,
          },
        ],
      },
    },
  });

  console.log('✅ Seeded 3 sample quotations with lines and approval log');
  console.log('✨ quotation_db seed complete');
}

if (require.main === module) {
  seed()
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
