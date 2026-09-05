import { PrismaClient, FulfillmentStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function seed() {
  console.log('🌱 Seeding fulfillment-service database...');

  const COMPANY_ID = 'default';
  const WH_A = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const WH_B = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  const WH_C = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
  const PROD_1 = '11111111-1111-1111-1111-111111111111';
  const PROD_2 = '22222222-2222-2222-2222-222222222222';

  // Warehouse A: Main Warehouse
  await prisma.warehouseStock.upsert({
    where: {
      companyId_warehouseId_productId_variantId: {
        companyId: COMPANY_ID, warehouseId: WH_A, productId: PROD_1, variantId: null,
      },
    },
    create: {
      companyId: COMPANY_ID,
      warehouseId: WH_A,
      warehouseName: 'Main Warehouse',
      productId: PROD_1,
      quantityOnHand: 50,
      reorderPoint: 10,
      reorderQty: 50,
    },
    update: { quantityOnHand: 50 },
  });

  await prisma.warehouseStock.upsert({
    where: {
      companyId_warehouseId_productId_variantId: {
        companyId: COMPANY_ID, warehouseId: WH_A, productId: PROD_2, variantId: null,
      },
    },
    create: {
      companyId: COMPANY_ID,
      warehouseId: WH_A,
      warehouseName: 'Main Warehouse',
      productId: PROD_2,
      quantityOnHand: 30,
    },
    update: { quantityOnHand: 30 },
  });

  // Warehouse B: East Depot
  await prisma.warehouseStock.upsert({
    where: {
      companyId_warehouseId_productId_variantId: {
        companyId: COMPANY_ID, warehouseId: WH_B, productId: PROD_1, variantId: null,
      },
    },
    create: {
      companyId: COMPANY_ID,
      warehouseId: WH_B,
      warehouseName: 'East Depot',
      productId: PROD_1,
      quantityOnHand: 20,
    },
    update: { quantityOnHand: 20 },
  });

  // Warehouse C: West Depot
  await prisma.warehouseStock.upsert({
    where: {
      companyId_warehouseId_productId_variantId: {
        companyId: COMPANY_ID, warehouseId: WH_C, productId: PROD_2, variantId: null,
      },
    },
    create: {
      companyId: COMPANY_ID,
      warehouseId: WH_C,
      warehouseName: 'West Depot',
      productId: PROD_2,
      quantityOnHand: 15,
    },
    update: { quantityOnHand: 15 },
  });

  console.log('✅ Fulfillment seed complete');
  await prisma.$disconnect();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
