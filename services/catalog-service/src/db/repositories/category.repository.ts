import { PrismaClient, type ProductCategory } from '@prisma/client';

export class CategoryRepository {
  private inMemoryCategories: Map<string, ProductCategory> = new Map([
    ['cat-01', { id: 'cat-01', companyId: 'default', name: 'Hardware', discountCeilingPct: 15, createdAt: new Date(), updatedAt: new Date() }],
    ['cat-02', { id: 'cat-02', companyId: 'default', name: 'Services', discountCeilingPct: 10, createdAt: new Date(), updatedAt: new Date() }],
    ['cat-03', { id: 'cat-03', companyId: 'default', name: 'Subscriptions', discountCeilingPct: 5, createdAt: new Date(), updatedAt: new Date() }],
  ]);

  constructor(private readonly prisma: PrismaClient) {}

  async findAll(companyId: string): Promise<ProductCategory[]> {
    try {
      return await this.prisma.productCategory.findMany({
        where: { companyId },
        orderBy: { name: 'asc' },
      });
    } catch {
      return Array.from(this.inMemoryCategories.values());
    }
  }

  async findById(id: string): Promise<ProductCategory | null> {
    try {
      return await this.prisma.productCategory.findUnique({ where: { id } });
    } catch {
      return this.inMemoryCategories.get(id) || null;
    }
  }

  async create(data: {
    companyId: string;
    name: string;
    discountCeilingPct?: number;
  }): Promise<ProductCategory> {
    try {
      return await this.prisma.productCategory.create({ data });
    } catch {
      const newCat: ProductCategory = {
        id: `cat-${Date.now()}`,
        companyId: data.companyId,
        name: data.name,
        discountCeilingPct: data.discountCeilingPct ?? 10,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      this.inMemoryCategories.set(newCat.id, newCat);
      return newCat;
    }
  }

  async update(id: string, data: Partial<{
    name: string;
    discountCeilingPct: number;
  }>): Promise<ProductCategory> {
    try {
      return await this.prisma.productCategory.update({ where: { id }, data });
    } catch {
      const existing = this.inMemoryCategories.get(id);
      if (!existing) throw new Error('Category not found');
      Object.assign(existing, data, { updatedAt: new Date() });
      return existing;
    }
  }

  async delete(id: string): Promise<void> {
    try {
      await this.prisma.productCategory.delete({ where: { id } });
    } catch {
      this.inMemoryCategories.delete(id);
    }
  }
}
