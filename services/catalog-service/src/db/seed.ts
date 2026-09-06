import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function padId(prefix: string, num: number): string {
  const numStr = String(num).padStart(12, '0');
  return `${prefix}-000000-0000-0000-0000-${numStr}`;
}

export async function seed() {
  console.log('🌱 Seeding catalog_db comprehensively (500+ products, categories, price lists, warehouses)...');

  await prisma.$transaction(async (tx) => {
    // ─── 1. Product Categories ─────────────────────────────────
    const hardware = await tx.productCategory.upsert({
      where: { companyId_name: { companyId: 'default', name: 'Hardware' } },
      update: { discountCeilingPct: 15 },
      create: { companyId: 'default', name: 'Hardware', discountCeilingPct: 15 },
    });

    const networking = await tx.productCategory.upsert({
      where: { companyId_name: { companyId: 'default', name: 'Networking' } },
      update: { discountCeilingPct: 12 },
      create: { companyId: 'default', name: 'Networking', discountCeilingPct: 12 },
    });

    const peripherals = await tx.productCategory.upsert({
      where: { companyId_name: { companyId: 'default', name: 'Peripherals' } },
      update: { discountCeilingPct: 15 },
      create: { companyId: 'default', name: 'Peripherals', discountCeilingPct: 15 },
    });

    const security = await tx.productCategory.upsert({
      where: { companyId_name: { companyId: 'default', name: 'Security' } },
      update: { discountCeilingPct: 10 },
      create: { companyId: 'default', name: 'Security', discountCeilingPct: 10 },
    });

    const services = await tx.productCategory.upsert({
      where: { companyId_name: { companyId: 'default', name: 'Services' } },
      update: { discountCeilingPct: 10 },
      create: { companyId: 'default', name: 'Services', discountCeilingPct: 10 },
    });

    const subscriptions = await tx.productCategory.upsert({
      where: { companyId_name: { companyId: 'default', name: 'Subscriptions' } },
      update: { discountCeilingPct: 5 },
      create: { companyId: 'default', name: 'Subscriptions', discountCeilingPct: 5 },
    });

    console.log('✅ Seeded 6 categories (Hardware, Networking, Peripherals, Security, Services, Subscriptions)');

    // ─── 2. Base 10 Canonical Products ──────────────────────────
    const canonicalProducts = [
      {
        id: 'prod-000000-0000-0000-0000-000000000001',
        companyId: 'default',
        name: 'Enterprise Laptop Pro',
        categoryId: hardware.id,
        basePrice: 1299.00,
        costPrice: 900.00,
        unit: 'unit',
        taxRate: 18,
        description: 'High-performance 14" Intel Core i7 laptop for enterprise power users',
      },
      {
        id: 'prod-000000-0000-0000-0000-000000000002',
        companyId: 'default',
        name: '4K UHD Monitor 27"',
        categoryId: peripherals.id,
        basePrice: 599.00,
        costPrice: 380.00,
        unit: 'unit',
        taxRate: 18,
        description: 'IPS color-calibrated 4K display with USB-C 90W power delivery',
      },
      {
        id: 'prod-000000-0000-0000-0000-000000000003',
        companyId: 'default',
        name: 'Dell PowerEdge Server',
        categoryId: hardware.id,
        basePrice: 4999.00,
        costPrice: 3200.00,
        unit: 'unit',
        taxRate: 18,
        description: 'Dual Xeon Silver rack server with 128GB ECC RAM and redundant PSUs',
      },
      {
        id: 'prod-000000-0000-0000-0000-000000000004',
        companyId: 'default',
        name: 'Managed Network Switch 24-port',
        categoryId: networking.id,
        basePrice: 899.00,
        costPrice: 580.00,
        unit: 'unit',
        taxRate: 18,
        description: 'Layer 2/3 enterprise Gigabit switch with 4x SFP+ uplinks',
      },
      {
        id: 'prod-000000-0000-0000-0000-000000000005',
        companyId: 'default',
        name: 'Enterprise Onboarding Pack',
        categoryId: services.id,
        basePrice: 2500.00,
        costPrice: 800.00,
        unit: 'engagement',
        taxRate: 18,
        description: 'Full infrastructure setup, directory sync, and user migration package',
      },
      {
        id: 'prod-000000-0000-0000-0000-000000000006',
        companyId: 'default',
        name: 'Dedicated Support (Annual)',
        categoryId: services.id,
        basePrice: 5000.00,
        costPrice: 1500.00,
        unit: 'year',
        taxRate: 18,
        description: '24/7 priority SLA tier 1 escalation and quarterly health checks',
      },
      {
        id: 'prod-000000-0000-0000-0000-000000000007',
        companyId: 'default',
        name: 'Technical Training (8h)',
        categoryId: services.id,
        basePrice: 1200.00,
        costPrice: 350.00,
        unit: 'session',
        taxRate: 18,
        description: 'Live instructor-led training for system administrators',
      },
      {
        id: 'prod-000000-0000-0000-0000-000000000008',
        companyId: 'default',
        name: 'Cloud Backup 1TB',
        categoryId: subscriptions.id,
        basePrice: 29.99,
        costPrice: 5.00,
        unit: 'month',
        taxRate: 18,
        description: 'Automated immutable snapshot cloud backup with 30-day retention',
      },
      {
        id: 'prod-000000-0000-0000-0000-000000000009',
        companyId: 'default',
        name: 'Enterprise Security Suite',
        categoryId: security.id,
        basePrice: 49.99,
        costPrice: 12.00,
        unit: 'month',
        taxRate: 18,
        description: 'Next-gen antivirus, EDR telemetry, and automated malware sandboxing',
      },
      {
        id: 'prod-000000-0000-0000-0000-000000000010',
        companyId: 'default',
        name: 'Managed Hosting Pro',
        categoryId: subscriptions.id,
        basePrice: 149.00,
        costPrice: 40.00,
        unit: 'month',
        taxRate: 18,
        description: 'Dedicated cloud VM with auto-scaling, automated SSL, and DDoS shielding',
      },
    ];

    for (const p of canonicalProducts) {
      await tx.product.upsert({
        where: { id: p.id },
        update: p,
        create: p,
      });
    }

    // ─── 3. 510+ Additional Realistic Enterprise Products ───────
    const hardwareTemplates = [
      { name: 'ThinkPad Workstation T16', price: 1750, cost: 1200 },
      { name: 'Dell Latitude 7440 Ultralight', price: 1420, cost: 980 },
      { name: 'MacBook Pro 16" M3 Pro', price: 2499, cost: 1850 },
      { name: 'HP EliteBook 840 G10', price: 1350, cost: 920 },
      { name: 'Lenovo ThinkStation P620', price: 3200, cost: 2100 },
      { name: 'Dell Precision 5820 Tower', price: 2890, cost: 1950 },
      { name: 'HPE ProLiant DL380 Gen11', price: 5400, cost: 3600 },
      { name: 'Supermicro 4U High-Density Storage', price: 6800, cost: 4500 },
      { name: 'Cisco UCS B200 M6 Blade Server', price: 4600, cost: 3100 },
      { name: 'NVIDIA RTX 6000 Ada GPU Workstation', price: 8900, cost: 6500 },
      { name: 'Industrial Edge IoT Gateway', price: 850, cost: 520 },
      { name: 'Rugged RuggedBook Tablet 12"', price: 1650, cost: 1100 },
      { name: 'Synology RackStation RS2423+', price: 2100, cost: 1450 },
      { name: 'QNAP Enterprise 16-Bay NAS', price: 3400, cost: 2300 },
      { name: 'Compact POS Terminal Station', price: 720, cost: 460 },
    ];

    const networkingTemplates = [
      { name: 'Cisco Catalyst 9300 48-Port PoE+', price: 3800, cost: 2400 },
      { name: 'Aruba CX 6200F 24G Switch', price: 1850, cost: 1200 },
      { name: 'Fortinet FortiGate 100F Firewall', price: 2950, cost: 1900 },
      { name: 'Palo Alto PA-440 Next-Gen Firewall', price: 3200, cost: 2150 },
      { name: 'Ubiquiti UniFi Dream Machine Pro', price: 499, cost: 340 },
      { name: 'UniFi Enterprise Wi-Fi 6E Access Point', price: 350, cost: 220 },
      { name: 'Juniper SRX345 Branch Firewall', price: 2600, cost: 1700 },
      { name: 'Mellanox ConnectX-6 100G PCIe NIC', price: 950, cost: 600 },
      { name: 'Cisco Meraki MR46 Cloud Managed AP', price: 820, cost: 510 },
      { name: 'Arista 7050SX 48x10G Spine Switch', price: 5800, cost: 3900 },
      { name: '10GBASE-SR SFP+ Optical Transceiver Pack', price: 240, cost: 110 },
      { name: '100G QSFP28 Direct Attach Cable 3m', price: 160, cost: 75 },
      { name: 'Cat6A Shielded Patch Panel 48-Port', price: 195, cost: 95 },
      { name: 'Barracuda CloudGen WAN Gateway', price: 1800, cost: 1150 },
      { name: 'SonicWall TZ470 High Availability Pair', price: 2100, cost: 1380 },
    ];

    const peripheralTemplates = [
      { name: 'Dell UltraSharp 32" 4K USB-C Hub Monitor', price: 799, cost: 520 },
      { name: 'LG 38" Curved Ultrawide IPS Display', price: 1150, cost: 780 },
      { name: 'HP E27m G4 QHD Conferencing Monitor', price: 450, cost: 290 },
      { name: 'CalDigit TS4 Thunderbolt 4 Station', price: 399, cost: 250 },
      { name: 'Lenovo ThinkPad Universal Dock', price: 240, cost: 140 },
      { name: 'Logitech MX Master 3S + Keys Combo', price: 199, cost: 115 },
      { name: 'Jabra Evolve2 85 Wireless ANC Headset', price: 379, cost: 230 },
      { name: 'Poly Studio P15 4K Video Bar', price: 399, cost: 245 },
      { name: 'APC Smart-UPS RT 3000VA On-Line', price: 1850, cost: 1200 },
      { name: 'CyberPower 1500VA Rackmount LCD UPS', price: 420, cost: 270 },
      { name: 'Tripp Lite 16-Port KVM Switch', price: 650, cost: 410 },
      { name: 'Eaton ePDU G3 Managed Power Strip', price: 580, cost: 370 },
      { name: 'Yubico YubiKey 5 NFC Enterprise 10-Pack', price: 450, cost: 260 },
      { name: 'Brother High-Speed Network Label Maker', price: 180, cost: 110 },
      { name: 'Biometric Access Control Reader', price: 320, cost: 190 },
    ];

    const securityTemplates = [
      { name: 'CrowdStrike Falcon Complete Endpoint', price: 85, cost: 25 },
      { name: 'Okta Adaptive Multi-Factor Auth Seat', price: 36, cost: 10 },
      { name: 'Zscaler Private Access Zero Trust Seat', price: 48, cost: 14 },
      { name: 'SentinelOne Singularity Control EDR', price: 60, cost: 18 },
      { name: 'Proofpoint Targeted Attack Protection', price: 42, cost: 12 },
      { name: 'Qualys VMDR Vulnerability Management', price: 120, cost: 35 },
      { name: 'Splunk Cloud 20GB/day Ingestion Tier', price: 450, cost: 160 },
      { name: 'HashiCorp Vault Enterprise Node', price: 290, cost: 95 },
      { name: 'CyberArk Privileged Access Manager Seat', price: 95, cost: 30 },
      { name: 'Cloudflare Zero Trust Gateway Seat', price: 25, cost: 7 },
      { name: 'Tenable.io Vulnerability Cloud 50-Pack', price: 850, cost: 320 },
      { name: 'KnowBe4 Security Awareness Training', price: 18, cost: 4 },
    ];

    const serviceTemplates = [
      { name: 'Cloud Well-Architected Review (2 Weeks)', price: 4500, cost: 1600 },
      { name: 'Disaster Recovery Simulation & Drill', price: 3200, cost: 1100 },
      { name: 'Kubernetes Cluster Production Hardening', price: 4800, cost: 1750 },
      { name: 'PCI-DSS Level 1 Audit Readiness Pack', price: 6500, cost: 2400 },
      { name: 'Active Directory to Okta Migration SOW', price: 5500, cost: 2000 },
      { name: '24/7 Managed NOC Level 2 SLA (Monthly)', price: 2200, cost: 800 },
      { name: 'Penetration Testing & Red Team Exercise', price: 7500, cost: 2800 },
      { name: 'Datacenter Structured Cabling Audit', price: 1800, cost: 650 },
      { name: 'Database HA Postgres Clustering Setup', price: 3600, cost: 1300 },
      { name: 'Executive Cyber Security Briefing (4h)', price: 1500, cost: 450 },
    ];

    const subscriptionTemplates = [
      { name: 'DealFlow360 Enterprise CRM Seat', price: 79, cost: 15 },
      { name: 'DealFlow360 Logistics Fleet Tracker', price: 120, cost: 28 },
      { name: 'DealFlow360 Margin & Risk Engine Pro', price: 150, cost: 32 },
      { name: 'DealFlow360 Multi-Depot Stock Sync Tier', price: 199, cost: 45 },
      { name: 'Cloud Immutable Backup 5TB Managed', price: 99, cost: 22 },
      { name: 'Cloud Immutable Backup 20TB Managed', price: 299, cost: 65 },
      { name: 'High-Availability Multi-Region VPC', price: 450, cost: 120 },
      { name: 'Dedicated Redis Caching Cluster (Managed)', price: 180, cost: 42 },
    ];

    const extraProducts: any[] = [];
    let curId = 11;

    function buildCategoryBatch(templates: typeof hardwareTemplates, catId: string, unit: string) {
      for (const t of templates) {
        for (let tierIdx = 1; tierIdx <= 6; tierIdx++) {
          if (curId > 525) break;
          const tierSuffix = tierIdx === 1 ? 'Standard' : tierIdx === 2 ? 'Pro' : tierIdx === 3 ? 'Enterprise' : tierIdx === 4 ? 'Max' : tierIdx === 5 ? 'Elite' : 'Prime';
          const multiplier = 1 + (tierIdx - 1) * 0.22;
          const price = Math.round(t.price * multiplier);
          const cost = Math.round(t.cost * multiplier);
          extraProducts.push({
            id: padId('prod', curId),
            companyId: 'default',
            name: `${t.name} (${tierSuffix} v${tierIdx})`,
            categoryId: catId,
            basePrice: price,
            costPrice: cost,
            unit,
            taxRate: 18,
            description: `Commercial grade ${t.name} ${tierSuffix} tier, fully certified for enterprise fleet deployment.`,
            isActive: true,
          });
          curId++;
        }
      }
    }

    buildCategoryBatch(hardwareTemplates, hardware.id, 'unit');
    buildCategoryBatch(networkingTemplates, networking.id, 'unit');
    buildCategoryBatch(peripheralTemplates, peripherals.id, 'unit');
    buildCategoryBatch(securityTemplates, security.id, 'month');
    buildCategoryBatch(serviceTemplates, services.id, 'engagement');
    buildCategoryBatch(subscriptionTemplates, subscriptions.id, 'month');

    // Fill remaining up to 520 products if needed
    while (curId <= 520) {
      extraProducts.push({
        id: padId('prod', curId),
        companyId: 'default',
        name: `Enterprise IT Component SKU-${curId}`,
        categoryId: hardware.id,
        basePrice: 150 + (curId % 50) * 15,
        costPrice: 90 + (curId % 50) * 9,
        unit: 'unit',
        taxRate: 18,
        description: `Precision enterprise IT infrastructure SKU #${curId} for multi-depot deployment.`,
        isActive: true,
      });
      curId++;
    }

    // Insert extra products in chunks
    const chunkSize = 100;
    for (let i = 0; i < extraProducts.length; i += chunkSize) {
      const chunk = extraProducts.slice(i, i + chunkSize);
      await tx.product.createMany({
        skipDuplicates: true,
        data: chunk,
      });
    }

    const totalProductsCount = await tx.product.count({ where: { companyId: 'default' } });
    console.log(`✅ Seeded ${totalProductsCount} enterprise products across 6 categories!`);

    // ─── 4. Product Variants ───────────────────────────────────
    await tx.productVariant.deleteMany({});
    const variantData: any[] = [];
    const sampleProductIds = [
      'prod-000000-0000-0000-0000-000000000001',
      'prod-000000-0000-0000-0000-000000000002',
      'prod-000000-0000-0000-0000-000000000011',
      'prod-000000-0000-0000-0000-000000000012',
      'prod-000000-0000-0000-0000-000000000025',
    ];
    for (const pid of sampleProductIds) {
      variantData.push(
        { productId: pid, attribute: 'Memory / Storage', value: '16GB RAM / 512GB SSD', extraPrice: 0 },
        { productId: pid, attribute: 'Memory / Storage', value: '32GB RAM / 1TB SSD', extraPrice: 250 },
        { productId: pid, attribute: 'Memory / Storage', value: '64GB RAM / 2TB SSD', extraPrice: 600 },
        { productId: pid, attribute: 'Warranty Pack', value: '3-Year On-Site NBD Support', extraPrice: 180 }
      );
    }
    await tx.productVariant.createMany({ skipDuplicates: true, data: variantData });
    console.log(`✅ Seeded ${variantData.length} product variants`);

    // ─── 5. Price Lists ─────────────────────────────────────────
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
    const goldINR = await tx.priceList.upsert({
      where: { id: 'pl-00000000-0000-0000-0000-000000000005' },
      update: {},
      create: { id: 'pl-00000000-0000-0000-0000-000000000005', companyId: 'default', name: 'Gold INR', customerTier: 'GOLD', currency: 'INR' },
    });

    await tx.priceListRule.deleteMany({});
    const rules: any[] = [];
    for (let i = 1; i <= 30; i++) {
      const pid = padId('prod', i);
      rules.push(
        { priceListId: bronzeUSD.id, productId: pid, discountPct: 3 },
        { priceListId: silverUSD.id, productId: pid, discountPct: 7 },
        { priceListId: goldUSD.id, productId: pid, discountPct: 12 },
        { priceListId: goldINR.id, productId: pid, discountPct: 15 }
      );
    }
    await tx.priceListRule.createMany({ skipDuplicates: true, data: rules });
    console.log(`✅ Seeded 5 price lists and ${rules.length} tiered pricing rules`);

    // ─── 6. Discount Tiers ──────────────────────────────────────
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
    console.log('✅ Seeded discount tiers');

    // ─── 7. Approval Chains ─────────────────────────────────────
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
    console.log('✅ Seeded 3 approval chains');

    // ─── 8. Warehouses ──────────────────────────────────────────
    const warehouses = [
      { id: 'wh-000000-0000-0000-0000-000000000001', name: 'Main Warehouse', location: 'Chicago, IL', shippingCostWeight: 1.0 },
      { id: 'wh-000000-0000-0000-0000-000000000002', name: 'East Depot', location: 'Newark, NJ', shippingCostWeight: 1.3 },
      { id: 'wh-000000-0000-0000-0000-000000000003', name: 'West Coast Hub', location: 'Seattle, WA', shippingCostWeight: 1.4 },
      { id: 'wh-000000-0000-0000-0000-000000000004', name: 'Southern Logistics Center', location: 'Dallas, TX', shippingCostWeight: 1.1 },
    ];
    for (const w of warehouses) {
      await tx.warehouseDefinition.upsert({
        where: { id: w.id },
        update: w,
        create: { ...w, companyId: 'default' },
      });
    }
    console.log('✅ Seeded 4 regional warehouses');

    // ─── 9. Subscription Plans ──────────────────────────────────
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

    await tx.productPlanLink.deleteMany({});
    await tx.productPlanLink.createMany({
      skipDuplicates: true,
      data: [
        { productId: 'prod-000000-0000-0000-0000-000000000008', planId: proSupportMonthly.id },
        { productId: 'prod-000000-0000-0000-0000-000000000009', planId: proSupportMonthly.id },
        { productId: 'prod-000000-0000-0000-0000-000000000009', planId: proSupportAnnual.id },
      ],
    });
    console.log('✅ Seeded subscription plans');

    // ─── 10. Upsell Rules ───────────────────────────────────────
    await tx.upsellRule.deleteMany({ where: { companyId: 'default' } });
    await tx.upsellRule.createMany({
      skipDuplicates: true,
      data: [
        { companyId: 'default', triggerProductId: 'prod-000000-0000-0000-0000-000000000001', suggestedProductId: 'prod-000000-0000-0000-0000-000000000002', minMarginPct: 20, isPromoted: true, priority: 10 },
        { companyId: 'default', triggerProductId: 'prod-000000-0000-0000-0000-000000000001', suggestedProductId: 'prod-000000-0000-0000-0000-000000000005', minMarginPct: 30, isPromoted: false, priority: 5 },
        { companyId: 'default', triggerProductId: 'prod-000000-0000-0000-0000-000000000003', suggestedProductId: 'prod-000000-0000-0000-0000-000000000004', minMarginPct: 20, isPromoted: true, priority: 10 },
        { companyId: 'default', triggerProductId: 'prod-000000-0000-0000-0000-000000000003', suggestedProductId: 'prod-000000-0000-0000-0000-000000000006', minMarginPct: 0, isPromoted: false, priority: 7 },
        { companyId: 'default', triggerProductId: 'prod-000000-0000-0000-0000-000000000001', suggestedProductId: 'prod-000000-0000-0000-0000-000000000009', minMarginPct: 15, isPromoted: false, priority: 3 },
      ],
    });
    console.log('✅ Seeded upsell rules');
  });

  console.log('✨ Catalog database seeding complete!');
}

seed()
  .catch((err) => {
    console.error('❌ Catalog seed failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
