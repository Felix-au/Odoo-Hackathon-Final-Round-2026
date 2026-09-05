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

  async function upsertStock(data: {
    companyId: string;
    warehouseId: string;
    warehouseName: string;
    productId: string;
    variantId?: string | null;
    quantityOnHand: number;
    reorderPoint?: number;
    reorderQty?: number;
  }) {
    const existing = await prisma.warehouseStock.findFirst({
      where: {
        companyId: data.companyId,
        warehouseId: data.warehouseId,
        productId: data.productId,
        variantId: data.variantId ?? null,
      },
    });

    if (existing) {
      await prisma.warehouseStock.update({
        where: { id: existing.id },
        data: {
          warehouseName: data.warehouseName,
          quantityOnHand: data.quantityOnHand,
          ...(data.reorderPoint !== undefined ? { reorderPoint: data.reorderPoint } : {}),
          ...(data.reorderQty !== undefined ? { reorderQty: data.reorderQty } : {}),
        },
      });
    } else {
      await prisma.warehouseStock.create({
        data: {
          companyId: data.companyId,
          warehouseId: data.warehouseId,
          warehouseName: data.warehouseName,
          productId: data.productId,
          variantId: data.variantId ?? null,
          quantityOnHand: data.quantityOnHand,
          reorderPoint: data.reorderPoint ?? 10,
          reorderQty: data.reorderQty ?? 50,
        },
      });
    }
  }

  // Warehouse A: Main Warehouse
  await upsertStock({
    companyId: COMPANY_ID,
    warehouseId: WH_A,
    warehouseName: 'Main Warehouse',
    productId: PROD_1,
    quantityOnHand: 50,
    reorderPoint: 10,
    reorderQty: 50,
  });

  await upsertStock({
    companyId: COMPANY_ID,
    warehouseId: WH_A,
    warehouseName: 'Main Warehouse',
    productId: PROD_2,
    quantityOnHand: 30,
  });

  // Warehouse B: East Depot
  await upsertStock({
    companyId: COMPANY_ID,
    warehouseId: WH_B,
    warehouseName: 'East Depot',
    productId: PROD_1,
    quantityOnHand: 20,
  });

  // Warehouse C: West Depot
  await upsertStock({
    companyId: COMPANY_ID,
    warehouseId: WH_C,
    warehouseName: 'West Depot',
    productId: PROD_2,
    quantityOnHand: 15,
  });

  console.log('✅ Fulfillment seed complete');
  await prisma.$disconnect();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
