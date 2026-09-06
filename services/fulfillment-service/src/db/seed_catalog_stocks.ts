import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function addStocks() {
  const warehouses = [
    { id: 'wh-000000-0000-0000-0000-000000000001', altId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', name: 'Main Warehouse' },
    { id: 'wh-000000-0000-0000-0000-000000000002', altId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', name: 'East Depot' },
    { id: 'wh-000000-0000-0000-0000-000000000003', altId: 'cccccccc-cccc-cccc-cccc-cccccccccccc', name: 'West Depot' },
  ];

  const products = [
    { id: 'prod-000000-0000-0000-0000-000000000001', altId: '11111111-1111-1111-1111-111111111111', name: 'Enterprise Laptop Pro', qty: [50, 20, 10] },
    { id: 'prod-000000-0000-0000-0000-000000000002', altId: '22222222-2222-2222-2222-222222222222', name: '4K UHD Monitor 27"', qty: [40, 15, 25] },
    { id: 'prod-000000-0000-0000-0000-000000000003', altId: '33333333-3333-3333-3333-333333333333', name: 'Dell PowerEdge Server', qty: [25, 10, 5] },
    { id: 'prod-000000-0000-0000-0000-000000000004', altId: '44444444-4444-4444-4444-444444444444', name: 'Managed Network Switch 24-port', qty: [35, 20, 15] },
  ];

  for (let pIdx = 0; pIdx < products.length; pIdx++) {
    const prod = products[pIdx];
    for (let wIdx = 0; wIdx < warehouses.length; wIdx++) {
      const wh = warehouses[wIdx];
      const qty = prod.qty[wIdx];
      for (const wId of [wh.id, wh.altId]) {
        for (const pId of [prod.id, prod.altId]) {
          const existing = await prisma.warehouseStock.findFirst({
            where: {
              companyId: 'default',
              warehouseId: wId,
              productId: pId,
            }
          });
          if (existing) {
            await prisma.warehouseStock.update({
              where: { id: existing.id },
              data: {
                warehouseName: wh.name,
                quantityOnHand: qty,
              }
            });
          } else {
            await prisma.warehouseStock.create({
              data: {
                companyId: 'default',
                warehouseId: wId,
                warehouseName: wh.name,
                productId: pId,
                quantityOnHand: qty,
                reorderPoint: 10,
                reorderQty: 50,
              }
            });
          }
        }
      }
    }
  }

  console.log('✅ Warehouse stocks successfully populated for all catalog products!');
  await prisma.$disconnect();
}

addStocks().catch(err => {
  console.error(err);
  process.exit(1);
});
