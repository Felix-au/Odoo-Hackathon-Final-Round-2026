import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function seed() {
  console.log('🌱 Seeding auth_db...');

  await prisma.$transaction(async (tx) => {
    // ─── Internal Users ───────────────────────────────────
    const adminHash = await bcrypt.hash('AdminP@ss123', 12);
    const managerHash = await bcrypt.hash('ManagerP@ss123', 12);
    const financeHash = await bcrypt.hash('FinanceP@ss123', 12);
    const repHash = await bcrypt.hash('RepP@ss123', 12);

    const admin = await tx.user.upsert({
      where: { email: 'admin@dealflow360.com' },
      update: {},
      create: {
        email: 'admin@dealflow360.com',
        passwordHash: adminHash,
        name: 'Platform Admin',
        role: 'ADMIN',
        companyId: 'default',
      },
    });

    await tx.user.upsert({
      where: { email: 'manager1@dealflow360.com' },
      update: {},
      create: {
        email: 'manager1@dealflow360.com',
        passwordHash: managerHash,
        name: 'Alice Johnson',
        role: 'SALES_MANAGER',
        companyId: 'default',
      },
    });

    await tx.user.upsert({
      where: { email: 'manager2@dealflow360.com' },
      update: {},
      create: {
        email: 'manager2@dealflow360.com',
        passwordHash: managerHash,
        name: 'Bob Chen',
        role: 'SALES_MANAGER',
        companyId: 'default',
      },
    });

    await tx.user.upsert({
      where: { email: 'finance@dealflow360.com' },
      update: {},
      create: {
        email: 'finance@dealflow360.com',
        passwordHash: financeHash,
        name: 'Carol Finance',
        role: 'FINANCE',
        companyId: 'default',
      },
    });

    await tx.user.upsert({
      where: { email: 'rep1@dealflow360.com' },
      update: {},
      create: {
        email: 'rep1@dealflow360.com',
        passwordHash: repHash,
        name: 'Dave Sales',
        role: 'SALES_REP',
        companyId: 'default',
      },
    });

    await tx.user.upsert({
      where: { email: 'rep2@dealflow360.com' },
      update: {},
      create: {
        email: 'rep2@dealflow360.com',
        passwordHash: repHash,
        name: 'Eve Martinez',
        role: 'SALES_REP',
        companyId: 'default',
      },
    });

    await tx.user.upsert({
      where: { email: 'rep3@dealflow360.com' },
      update: {},
      create: {
        email: 'rep3@dealflow360.com',
        passwordHash: repHash,
        name: 'Frank Wilson',
        role: 'SALES_REP',
        companyId: 'default',
      },
    });

    // ─── Customer Portal Credentials ─────────────────────
    // 5 customers — IDs must match quotation_db.Customer seeds
    const customerHash = await bcrypt.hash('CustomerP@ss123', 12);

    const customers = [
      { id: 'cust-000000-0000-0000-0000-000000000001', email: 'acme@example.com', name: 'Acme Corp' },
      { id: 'cust-000000-0000-0000-0000-000000000002', email: 'beta@example.com', name: 'Beta Industries' },
      { id: 'cust-000000-0000-0000-0000-000000000003', email: 'gamma@example.com', name: 'Gamma LLC' },
      { id: 'cust-000000-0000-0000-0000-000000000004', email: 'delta@example.com', name: 'Delta Corp' },
      { id: 'cust-000000-0000-0000-0000-000000000005', email: 'epsilon@example.com', name: 'Epsilon Ltd' },
      { id: 'c1000000-0000-0000-0000-000000000001', email: 'acme-legacy@example.com', name: 'Acme Corp Legacy' },
    ];

    await tx.customerPortalCredential.deleteMany({});

    for (const customer of customers) {
      await tx.customerPortalCredential.upsert({
        where: { customerId: customer.id },
        update: {},
        create: {
          customerId: customer.id,
          email: customer.email,
          passwordHash: customerHash, // Also supports magic link — both methods work
        },
      });
    }

    console.log(`✅ Seeded 7 internal users (1 admin, 2 managers, 1 finance, 3 sales reps)`);
    console.log(`✅ Seeded 5 customer portal credentials`);
    console.log(`   Admin: admin@dealflow360.com / AdminP@ss123`);
    console.log(`   Manager: manager1@dealflow360.com / ManagerP@ss123`);
    console.log(`   Finance: finance@dealflow360.com / FinanceP@ss123`);
    console.log(`   Sales Rep: rep1@dealflow360.com / RepP@ss123`);
  });
}

seed()
  .catch((err) => {
    console.error('❌ Seed failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
