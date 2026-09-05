import { PrismaClient, type ProductCategory } from '@prisma/client';

export class CategoryRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findAll(companyId: string): Promise<ProductCategory[]> {
    return this.prisma.productCategory.findMany({
      where: { companyId },
      orderBy: { name: 'asc' },
    });
  }

  async findById(id: string): Promise<ProductCategory | null> {
    return this.prisma.productCategory.findUnique({ where: { id } });
  }

  async create(data: {
    companyId: string;
    name: string;
    discountCeilingPct?: number;
  }): Promise<ProductCategory> {
    return this.prisma.productCategory.create({ data });
  }

  async update(id: string, data: Partial<{
    name: string;
    discountCeilingPct: number;
  }>): Promise<ProductCategory> {
    return this.prisma.productCategory.update({ where: { id }, data });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.productCategory.delete({ where: { id } });
  }
}
