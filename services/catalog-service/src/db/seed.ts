import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seed() {
  console.log('🌱 Seeding catalog_db...');

  await prisma.$transaction(async (tx) => {

    // ─── Product Categories ─────────────────────────────────
    const hardware = await tx.productCategory.upsert({
      where: { companyId_name: { companyId: 'default', name: 'Hardware' } },
      update: {},
      create: { companyId: 'default', name: 'Hardware', discountCeilingPct: 15 },
    });

    const services = await tx.productCategory.upsert({
      where: { companyId_name: { companyId: 'default', name: 'Services' } },
      update: {},
      create: { companyId: 'default', name: 'Services', discountCeilingPct: 10 },
    });

    const subscriptions = await tx.productCategory.upsert({
      where: { companyId_name: { companyId: 'default', name: 'Subscriptions' } },
      update: {},
      create: { companyId: 'default', name: 'Subscriptions', discountCeilingPct: 5 },
    });

    console.log('✅ Seeded 3 categories: Hardware, Services, Subscriptions');

    // ─── Products ─────────────────────────────────────────────
    const laptop = await tx.product.upsert({
      where: { id: 'prod-000000-0000-0000-0000-000000000001' },
      update: {},
      create: {
        id: 'prod-000000-0000-0000-0000-000000000001',
        companyId: 'default', name: 'Enterprise Laptop Pro', categoryId: hardware.id,
        basePrice: 1299.00, costPrice: 900.00, unit: 'unit', taxRate: 18,
        description: 'High-performance laptop for enterprise users',
      },
    });

    const monitor = await tx.product.upsert({
      where: { id: 'prod-000000-0000-0000-0000-000000000002' },
      update: {},
      create: {
        id: 'prod-000000-0000-0000-0000-000000000002',
        companyId: 'default', name: '4K UHD Monitor 27"', categoryId: hardware.id,
        basePrice: 599.00, costPrice: 380.00, unit: 'unit', taxRate: 18,
      },
    });

    const server = await tx.product.upsert({
      where: { id: 'prod-000000-0000-0000-0000-000000000003' },
      update: {},
      create: {
        id: 'prod-000000-0000-0000-0000-000000000003',
        companyId: 'default', name: 'Dell PowerEdge Server', categoryId: hardware.id,
        basePrice: 4999.00, costPrice: 3200.00, unit: 'unit', taxRate: 18,
      },
    });

    const networkSwitch = await tx.product.upsert({
      where: { id: 'prod-000000-0000-0000-0000-000000000004' },
      update: {},
      create: {
        id: 'prod-000000-0000-0000-0000-000000000004',
        companyId: 'default', name: 'Managed Network Switch 24-port', categoryId: hardware.id,
        basePrice: 899.00, costPrice: 580.00, unit: 'unit', taxRate: 18,
      },
    });

    const onboarding = await tx.product.upsert({
      where: { id: 'prod-000000-0000-0000-0000-000000000005' },
      update: {},
      create: {
        id: 'prod-000000-0000-0000-0000-000000000005',
        companyId: 'default', name: 'Enterprise Onboarding Pack', categoryId: services.id,
        basePrice: 2500.00, costPrice: 800.00, unit: 'engagement', taxRate: 18,
        description: 'Full setup, configuration, and training package',
      },
    });

    const support = await tx.product.upsert({
      where: { id: 'prod-000000-0000-0000-0000-000000000006' },
      update: {},
      create: {
        id: 'prod-000000-0000-0000-0000-000000000006',
        companyId: 'default', name: 'Dedicated Support (Annual)', categoryId: services.id,
        basePrice: 5000.00, costPrice: 1500.00, unit: 'year', taxRate: 18,
      },
    });

    const training = await tx.product.upsert({
      where: { id: 'prod-000000-0000-0000-0000-000000000007' },
      update: {},
      create: {
        id: 'prod-000000-0000-0000-0000-000000000007',
        companyId: 'default', name: 'Technical Training (8h)', categoryId: services.id,
        basePrice: 1200.00, costPrice: 350.00, unit: 'session', taxRate: 18,
      },
    });

    const cloudBackup = await tx.product.upsert({
      where: { id: 'prod-000000-0000-0000-0000-000000000008' },
      update: {},
      create: {
        id: 'prod-000000-0000-0000-0000-000000000008',
        companyId: 'default', name: 'Cloud Backup 1TB', categoryId: subscriptions.id,
        basePrice: 29.99, costPrice: 5.00, unit: 'month', taxRate: 18,
        description: 'Automated cloud backup with 30-day retention',
      },
    });

    const securitySuite = await tx.product.upsert({
      where: { id: 'prod-000000-0000-0000-0000-000000000009' },
      update: {},
      create: {
        id: 'prod-000000-0000-0000-0000-000000000009',
        companyId: 'default', name: 'Enterprise Security Suite', categoryId: subscriptions.id,
        basePrice: 49.99, costPrice: 12.00, unit: 'month', taxRate: 18,
      },
    });

    const managedHosting = await tx.product.upsert({
      where: { id: 'prod-000000-0000-0000-0000-000000000010' },
      update: {},
      create: {
        id: 'prod-000000-0000-0000-0000-000000000010',
        companyId: 'default', name: 'Managed Hosting Pro', categoryId: subscriptions.id,
        basePrice: 149.00, costPrice: 40.00, unit: 'month', taxRate: 18,
      },
    });

    console.log('✅ Seeded 10 products across 3 categories');

    // ─── Product Variants ──────────────────────────────────────
    await tx.productVariant.createMany({
      skipDuplicates: true,
      data: [
        { productId: laptop.id, attribute: 'RAM', value: '16GB', extraPrice: 0 },
        { productId: laptop.id, attribute: 'RAM', value: '32GB', extraPrice: 200 },
        { productId: laptop.id, attribute: 'RAM', value: '64GB', extraPrice: 500 },
        { productId: monitor.id, attribute: 'Size', value: '27"', extraPrice: 0 },
        { productId: monitor.id, attribute: 'Size', value: '32"', extraPrice: 150 },
      ],
    });

    // ─── Price Lists (REQ-BONUS-001: multi-currency) ───────────
    const bronzeUSD = await tx.priceList.upsert({
      where: { id: 'pl-00000000-0000-0000-0000-000000000001' },
      update: {},
      create: { id: 'pl-00000000-0000-0000-0000-000000000001', companyId: 'default', name: 'Bronze USD', customerTier: 'BRONZE', currency: 'USD' },
    });
    const silverUSD = await tx.priceList.upsert({
      where: { id: 'pl-00000000-0000-0000-0000-000000000002' },
      update: {},
      create: { id: 'pl-00000000-0000-0000-0000-000000000002', companyId: 'default', name: 'Silver USD', customerTier: 'SILVER', currency: 'USD' },
    });
    const goldUSD = await tx.priceList.upsert({
      where: { id: 'pl-00000000-0000-0000-0000-000000000003' },
      update: {},
      create: { id: 'pl-00000000-0000-0000-0000-000000000003', companyId: 'default', name: 'Gold USD', customerTier: 'GOLD', currency: 'USD' },
    });
    const goldEUR = await tx.priceList.upsert({
      where: { id: 'pl-00000000-0000-0000-0000-000000000004' },
      update: {},
      create: { id: 'pl-00000000-0000-0000-0000-000000000004', companyId: 'default', name: 'Gold EUR', customerTier: 'GOLD', currency: 'EUR' },
    });

    // Price rules — Bronze: 3% discount, Silver: 7%, Gold: 12% on laptops
    await tx.priceListRule.createMany({
      skipDuplicates: true,
      data: [
        { priceListId: bronzeUSD.id, productId: laptop.id, discountPct: 3 },
        { priceListId: silverUSD.id, productId: laptop.id, discountPct: 7 },
        { priceListId: goldUSD.id, productId: laptop.id, discountPct: 12 },
        { priceListId: goldEUR.id, productId: laptop.id, fixedPrice: 1050 },
        { priceListId: goldUSD.id, productId: server.id, discountPct: 10 },
        { priceListId: silverUSD.id, productId: monitor.id, discountPct: 5 },
      ],
    });

    console.log('✅ Seeded 4 price lists (Bronze/Silver/Gold USD + Gold EUR)');

    // ─── Discount Tiers ────────────────────────────────────────
    // BRONZE: 5%, SILVER: 10%, GOLD: 15%
    // Services category: capped at 10% for all tiers
    await tx.discountTier.deleteMany({ where: { companyId: 'default' } });
    await tx.discountTier.createMany({
      data: [
        { id: 'dt-000000-0000-0000-0000-000000000001', companyId: 'default', customerTier: 'BRONZE', ceilingPct: 5 },
        { id: 'dt-000000-0000-0000-0000-000000000002', companyId: 'default', customerTier: 'SILVER', ceilingPct: 10 },
        { id: 'dt-000000-0000-0000-0000-000000000003', companyId: 'default', customerTier: 'GOLD', ceilingPct: 15 },
        { id: 'dt-000000-0000-0000-0000-000000000004', companyId: 'default', customerTier: 'BRONZE', categoryId: services.id, ceilingPct: 5 },
        { id: 'dt-000000-0000-0000-0000-000000000005', companyId: 'default', customerTier: 'SILVER', categoryId: services.id, ceilingPct: 8 },
        { id: 'dt-000000-0000-0000-0000-000000000006', companyId: 'default', customerTier: 'GOLD', categoryId: services.id, ceilingPct: 10 },
      ],
    });

    console.log('✅ Seeded discount tiers: BRONZE 5%, SILVER 10%, GOLD 15%');

    // ─── Approval Chains ────────────────────────────────────────
    // Canonical default rules matching docs:
    // 1. Standard Operational Flow (Score 0 - 0.1): zero approval
    // 2. Manager Approval Tier (Score 0.1 - 30): Sales Manager approval
    // 3. Two-Tier Critical Chain (Score 30+): Sales Manager + Finance approval
    await tx.approvalChain.deleteMany({ where: { companyId: 'default' } });
    await tx.approvalChain.createMany({
      data: [
        {
          id: 'appr-chain-0000-0000-0000-000000000001',
          companyId: 'default',
          name: 'Standard Operational Flow',
          minRiskScore: 0,
          maxRiskScore: 0.1,
          requiredRoles: [],
        },
        {
          id: 'appr-chain-0000-0000-0000-000000000002',
          companyId: 'default',
          name: 'Manager Approval Tier',
          minRiskScore: 0.1,
          maxRiskScore: 30,
          requiredRoles: ['SALES_MANAGER'],
        },
        {
          id: 'appr-chain-0000-0000-0000-000000000003',
          companyId: 'default',
          name: 'Two-Tier Critical Chain',
          minRiskScore: 30,
          maxRiskScore: 999,
          requiredRoles: ['SALES_MANAGER', 'FINANCE'],
        },
      ],
    });

    console.log('✅ Seeded 3 approval chains: standard (no approval), manager tier, two-tier critical chain (manager+finance)');

    // ─── Warehouses ─────────────────────────────────────────────
    const mainWh = await tx.warehouseDefinition.upsert({
      where: { id: 'wh-000000-0000-0000-0000-000000000001' },
      update: {},
      create: { id: 'wh-000000-0000-0000-0000-000000000001', companyId: 'default', name: 'Main Warehouse', location: 'Chicago, IL', shippingCostWeight: 1.0 },
    });

    const eastDepot = await tx.warehouseDefinition.upsert({
      where: { id: 'wh-000000-0000-0000-0000-000000000002' },
      update: {},
      create: { id: 'wh-000000-0000-0000-0000-000000000002', companyId: 'default', name: 'East Depot', location: 'Newark, NJ', shippingCostWeight: 1.3 },
    });

    console.log('✅ Seeded 2 warehouses: Main (weight 1.0), East Depot (weight 1.3)');

    // ─── Subscription Plans ──────────────────────────────────────
    const proSupportMonthly = await tx.subscriptionPlan.upsert({
      where: { id: 'plan-0000-0000-0000-0000-000000000001' },
      update: {},
      create: {
        id: 'plan-0000-0000-0000-0000-000000000001',
        companyId: 'default',
        name: 'ProSupport Monthly',
        interval: 'MONTHLY',
        basePrice: 49.99,
        currency: 'USD',
        prorationMode: 'DAILY',
        cancellationPolicy: 'end_of_period',
        partialRefundPct: 0,
      },
    });

    const proSupportAnnual = await tx.subscriptionPlan.upsert({
      where: { id: 'plan-0000-0000-0000-0000-000000000002' },
      update: {},
      create: {
        id: 'plan-0000-0000-0000-0000-000000000002',
        companyId: 'default',
        name: 'ProSupport Annual',
        interval: 'YEARLY',
        basePrice: 499.00,
        currency: 'USD',
        prorationMode: 'DAILY',
        cancellationPolicy: 'end_of_period',
        partialRefundPct: 50,
      },
    });

    // Link plans to the support product
    await tx.productPlanLink.createMany({
      skipDuplicates: true,
      data: [
        { productId: cloudBackup.id, planId: proSupportMonthly.id },
        { productId: securitySuite.id, planId: proSupportMonthly.id },
        { productId: securitySuite.id, planId: proSupportAnnual.id },
      ],
    });

    console.log('✅ Seeded 2 subscription plans: ProSupport Monthly ($49.99), Annual ($499)');

    // ─── Upsell Rules ────────────────────────────────────────────
    await tx.upsellRule.createMany({
      skipDuplicates: true,
      data: [
        // Buy laptop → suggest monitor
        { companyId: 'default', triggerProductId: laptop.id, suggestedProductId: monitor.id, minMarginPct: 20, isPromoted: true, priority: 10 },
        // Buy laptop → suggest onboarding
        { companyId: 'default', triggerProductId: laptop.id, suggestedProductId: onboarding.id, minMarginPct: 30, isPromoted: false, priority: 5 },
        // Buy server → suggest switch
        { companyId: 'default', triggerProductId: server.id, suggestedProductId: networkSwitch.id, minMarginPct: 20, isPromoted: true, priority: 10 },
        // Buy server → suggest support
        { companyId: 'default', triggerProductId: server.id, suggestedProductId: support.id, minMarginPct: 0, isPromoted: false, priority: 7 },
        // Buy hardware → suggest security suite
        { companyId: 'default', triggerProductId: laptop.id, suggestedProductId: securitySuite.id, minMarginPct: 15, isPromoted: false, priority: 3 },
      ],
    });

    console.log('✅ Seeded 5 upsell rules');
    console.log('');
    console.log('📦 Catalog seed complete!');
  });
}

seed()
  .catch((err) => { console.error('❌ Seed failed:', err); process.exit(1); })
  .finally(() => prisma.$disconnect());
