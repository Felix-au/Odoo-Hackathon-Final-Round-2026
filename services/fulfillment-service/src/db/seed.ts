import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function padId(prefix: string, num: number): string {
  const numStr = String(num).padStart(12, '0');
  return `${prefix}-000000-0000-0000-0000-${numStr}`;
}

async function seed() {
  console.log('🌱 Seeding fulfillment-service database comprehensively...');

  const COMPANY_ID = 'default';
  const warehouses = [
    { id: 'wh-000000-0000-0000-0000-000000000001', altId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', name: 'Main Warehouse' },
    { id: 'wh-000000-0000-0000-0000-000000000002', altId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', name: 'East Depot' },
    { id: 'wh-000000-0000-0000-0000-000000000003', altId: 'cccccccc-cccc-cccc-cccc-cccccccccccc', name: 'West Coast Hub' },
    { id: 'wh-000000-0000-0000-0000-000000000004', altId: 'dddddddd-dddd-dddd-dddd-dddddddddddd', name: 'Southern Logistics Center' },
  ];

  // Prepare warehouse stock entries for the 521 products
  const stockRows: any[] = [];

  for (let i = 1; i <= 521; i++) {
    const prodId = padId('prod', i);
    // Each warehouse gets stock
    for (const wh of warehouses) {
      const baseQty = 40 + ((i * 7) % 180);
      const resQty = (i % 5 === 0) ? (i % 15) : 0;
      stockRows.push({
        companyId: COMPANY_ID,
        warehouseId: wh.id,
        warehouseName: wh.name,
        productId: prodId,
        variantId: null,
        quantityOnHand: baseQty,
        quantityReserved: resQty,
        reorderPoint: 15,
        reorderQty: 50,
        updatedAt: new Date(),
      });
      // Also insert with legacy UUID for compatibility
      stockRows.push({
        companyId: COMPANY_ID,
        warehouseId: wh.altId,
        warehouseName: wh.name,
        productId: prodId,
        variantId: null,
        quantityOnHand: baseQty,
        quantityReserved: resQty,
        reorderPoint: 15,
        reorderQty: 50,
        updatedAt: new Date(),
      });
    }
  }

  // Also include canonical UUID aliases
  const canonicalAliases = [
    { id: '11111111-1111-1111-1111-111111111111', name: 'Enterprise Laptop Pro' },
    { id: '22222222-2222-2222-2222-222222222222', name: '4K UHD Monitor 27"' },
    { id: '33333333-3333-3333-3333-333333333333', name: 'Dell PowerEdge Server' },
    { id: '44444444-4444-4444-4444-444444444444', name: 'Managed Network Switch 24-port' },
  ];
  for (const alias of canonicalAliases) {
    for (const wh of warehouses) {
      stockRows.push({
        companyId: COMPANY_ID,
        warehouseId: wh.id,
        warehouseName: wh.name,
        productId: alias.id,
        variantId: null,
        quantityOnHand: 85,
        quantityReserved: 5,
        reorderPoint: 15,
        reorderQty: 50,
        updatedAt: new Date(),
      });
      stockRows.push({
        companyId: COMPANY_ID,
        warehouseId: wh.altId,
        warehouseName: wh.name,
        productId: alias.id,
        variantId: null,
        quantityOnHand: 85,
        quantityReserved: 5,
        reorderPoint: 15,
        reorderQty: 50,
        updatedAt: new Date(),
      });
    }
  }

  // Clear existing stocks and insert in chunks
  await prisma.warehouseStock.deleteMany({ where: { companyId: COMPANY_ID } });

  const chunkSize = 200;
  for (let i = 0; i < stockRows.length; i += chunkSize) {
    const chunk = stockRows.slice(i, i + chunkSize);
    await prisma.warehouseStock.createMany({
      skipDuplicates: true,
      data: chunk,
    });
  }

  const count = await prisma.warehouseStock.count({ where: { companyId: COMPANY_ID } });
  console.log(`✅ Fulfillment seed complete: ${count} warehouse stock records populated!`);
  await prisma.$disconnect();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
