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

    // 1. Primary Seeded Users Requested
    await tx.user.upsert({
      where: { email: 'harshit.admin@dealflow360.com' },
      update: { name: 'Harshit Admin', passwordHash: adminHash, role: 'ADMIN' },
      create: {
        email: 'harshit.admin@dealflow360.com',
        passwordHash: adminHash,
        name: 'Harshit Admin',
        role: 'ADMIN',
        companyId: 'default',
      },
    });

    await tx.user.upsert({
      where: { email: 'atharva.manager@dealflow360.com' },
      update: { name: 'Atharva Manager', passwordHash: managerHash, role: 'SALES_MANAGER' },
      create: {
        email: 'atharva.manager@dealflow360.com',
        passwordHash: managerHash,
        name: 'Atharva Manager',
        role: 'SALES_MANAGER',
        companyId: 'default',
      },
    });

    await tx.user.upsert({
      where: { email: 'madhab.cfo@dealflow360.com' },
      update: { name: 'Madhab CFO', passwordHash: financeHash, role: 'FINANCE' },
      create: {
        email: 'madhab.cfo@dealflow360.com',
        passwordHash: financeHash,
        name: 'Madhab CFO',
        role: 'FINANCE',
        companyId: 'default',
      },
    });

    await tx.user.upsert({
      where: { email: 'sales.rep@dealflow360.com' },
      update: { name: 'Sales Rep', passwordHash: repHash, role: 'SALES_REP' },
      create: {
        email: 'sales.rep@dealflow360.com',
        passwordHash: repHash,
        name: 'Sales Rep',
        role: 'SALES_REP',
        companyId: 'default',
      },
    });

    // Backwards-compatible aliases for automated tests
    await tx.user.upsert({
      where: { email: 'admin@dealflow360.com' },
      update: { name: 'Harshit Admin' },
      create: {
        email: 'admin@dealflow360.com',
        passwordHash: adminHash,
        name: 'Harshit Admin',
        role: 'ADMIN',
        companyId: 'default',
      },
    });

    await tx.user.upsert({
      where: { email: 'manager@dealflow360.com' },
      update: { name: 'Atharva Manager', passwordHash: managerHash },
      create: {
        email: 'manager@dealflow360.com',
        passwordHash: managerHash,
        name: 'Atharva Manager',
        role: 'SALES_MANAGER',
        companyId: 'default',
      },
    });

    await tx.user.upsert({
      where: { email: 'finance@dealflow360.com' },
      update: { name: 'Madhab CFO' },
      create: {
        email: 'finance@dealflow360.com',
        passwordHash: financeHash,
        name: 'Madhab CFO',
        role: 'FINANCE',
        companyId: 'default',
      },
    });

    await tx.user.upsert({
      where: { email: 'rep@dealflow360.com' },
      update: { name: 'Sales Rep', passwordHash: repHash },
      create: {
        email: 'rep@dealflow360.com',
        passwordHash: repHash,
        name: 'Sales Rep',
        role: 'SALES_REP',
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
      { id: 'cust-000000-0000-0000-0000-000000000006', email: 'zeta@example.com', name: 'Zeta Media' },
      { id: 'cust-000000-0000-0000-0000-000000000007', email: 'theta@example.com', name: 'Theta Retail' },
      { id: 'cust-000000-0000-0000-0000-000000000008', email: 'apex@example.com', name: 'Apex Global' },
      { id: 'cust-000000-0000-0000-0000-000000000009', email: 'nexus@example.com', name: 'Nexus Tech' },
      { id: 'cust-000000-0000-0000-0000-000000000010', email: 'horizon@example.com', name: 'Horizon Energy' },
      { id: 'cust-000000-0000-0000-0000-000000000011', email: 'vanguard@example.com', name: 'Vanguard Systems' },
      { id: 'cust-000000-0000-0000-0000-000000000012', email: 'summit@example.com', name: 'Summit Dynamics' },
      { id: 'cust-000000-0000-0000-0000-000000000013', email: 'pinnacle@example.com', name: 'Pinnacle Telecom' },
      { id: 'cust-000000-0000-0000-0000-000000000014', email: 'aegis@example.com', name: 'Aegis BioTech' },
      { id: 'cust-000000-0000-0000-0000-000000000015', email: 'starlight@example.com', name: 'Starlight Supply Chain' },
      { id: 'cust-000000-0000-0000-0000-000000000016', email: 'cyberdyne@example.com', name: 'Cyberdyne Systems' },
      { id: 'cust-000000-0000-0000-0000-000000000017', email: 'omni@example.com', name: 'Omni Consumer Products' },
      { id: 'cust-000000-0000-0000-0000-000000000018', email: 'initech@example.com', name: 'Initech Software' },
      { id: 'cust-000000-0000-0000-0000-000000000019', email: 'umbrella@example.com', name: 'Umbrella Sciences' },
      { id: 'cust-000000-0000-0000-0000-000000000020', email: 'massive@example.com', name: 'Massive Dynamic' },
      { id: 'cust-000000-0000-0000-0000-000000000021', email: 'soylent@example.com', name: 'Soylent AgriTech' },
      { id: 'cust-000000-0000-0000-0000-000000000022', email: 'hooli@example.com', name: 'Hooli Cloud' },
      { id: 'cust-000000-0000-0000-0000-000000000023', email: 'piedpiper@example.com', name: 'Pied Piper' },
      { id: 'cust-000000-0000-0000-0000-000000000024', email: 'stark@example.com', name: 'Stark Industries' },
      { id: 'cust-000000-0000-0000-0000-000000000025', email: 'wayne@example.com', name: 'Wayne Enterprises' },
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
