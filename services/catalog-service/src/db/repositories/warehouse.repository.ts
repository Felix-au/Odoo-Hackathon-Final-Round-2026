import { PrismaClient, type WarehouseDefinition } from '@prisma/client';

export class WarehouseRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findAll(companyId: string): Promise<WarehouseDefinition[]> {
    return this.prisma.warehouseDefinition.findMany({
      where: { companyId },
      orderBy: { name: 'asc' },
    });
  }

  async findActive(companyId: string): Promise<WarehouseDefinition[]> {
    return this.prisma.warehouseDefinition.findMany({
      where: { companyId, isActive: true },
      orderBy: { shippingCostWeight: 'asc' },
    });
  }

  async findById(id: string): Promise<WarehouseDefinition | null> {
    return this.prisma.warehouseDefinition.findUnique({ where: { id } });
  }

  async create(data: {
    companyId: string;
    name: string;
    location?: string | null;
    shippingCostWeight?: number;
    isActive?: boolean;
  }): Promise<WarehouseDefinition> {
    return this.prisma.warehouseDefinition.create({
      data: {
        companyId: data.companyId,
        name: data.name,
        location: data.location ?? undefined,
        shippingCostWeight: data.shippingCostWeight ?? 1.0,
        isActive: data.isActive !== undefined ? data.isActive : true,
      },
    });
  }

  async update(id: string, data: Partial<{
    name: string;
    location: string | null;
    shippingCostWeight: number;
    isActive: boolean;
  }>): Promise<WarehouseDefinition> {
    return this.prisma.warehouseDefinition.update({ where: { id }, data });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.warehouseDefinition.delete({ where: { id } });
  }
}
