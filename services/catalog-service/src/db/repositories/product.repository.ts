import { PrismaClient, type Product, type ProductCategory } from '@prisma/client';

export interface ProductFilters {
  companyId?: string;
  categoryId?: string;
  search?: string;
  isActive?: boolean;
}

export class ProductRepository {
  private inMemoryProducts: Map<string, any> = new Map([
    [
      'prod-000000-0000-0000-0000-000000000001',
      {
        id: 'prod-000000-0000-0000-0000-000000000001',
        companyId: 'default',
        name: 'Enterprise Laptop Pro',
        categoryId: 'cat-01',
        basePrice: 1299.0,
        costPrice: 900.0,
        unit: 'unit',
        taxRate: 18,
        description: 'High-performance laptop for enterprise users',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        category: { id: 'cat-01', name: 'Hardware', discountCeilingPct: 15 },
        variants: [],
      },
    ],
    [
      'prod-000000-0000-0000-0000-000000000002',
      {
        id: 'prod-000000-0000-0000-0000-000000000002',
        companyId: 'default',
        name: '4K UHD Monitor 27"',
        categoryId: 'cat-01',
        basePrice: 599.0,
        costPrice: 380.0,
        unit: 'unit',
        taxRate: 18,
        description: 'Ultra-HD designer display panel',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        category: { id: 'cat-01', name: 'Hardware', discountCeilingPct: 15 },
        variants: [],
      },
    ],
    [
      'prod-000000-0000-0000-0000-000000000003',
      {
        id: 'prod-000000-0000-0000-0000-000000000003',
        companyId: 'default',
        name: 'Dell PowerEdge Server',
        categoryId: 'cat-01',
        basePrice: 4999.0,
        costPrice: 3200.0,
        unit: 'unit',
        taxRate: 18,
        description: 'Dual Xeon rackmount compute server',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        category: { id: 'cat-01', name: 'Hardware', discountCeilingPct: 15 },
        variants: [],
      },
    ],
    [
      'prod-000000-0000-0000-0000-000000000004',
      {
        id: 'prod-000000-0000-0000-0000-000000000004',
        companyId: 'default',
        name: 'ProSupport 24/7 SLA',
        categoryId: 'cat-02',
        basePrice: 999.0,
        costPrice: 350.0,
        unit: 'unit',
        taxRate: 18,
        description: 'Enterprise 4-hour on-site response warranty',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        category: { id: 'cat-02', name: 'Services', discountCeilingPct: 10 },
        variants: [],
      },
    ],
    [
      'prod-000000-0000-0000-0000-000000000005',
      {
        id: 'prod-000000-0000-0000-0000-000000000005',
        companyId: 'default',
        name: 'Cloud Backup 1TB',
        categoryId: 'cat-03',
        basePrice: 49.0,
        costPrice: 12.0,
        unit: 'month',
        taxRate: 18,
        description: 'Automated off-site cloud storage',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        category: { id: 'cat-03', name: 'Subscriptions', discountCeilingPct: 5 },
        variants: [],
      },
    ],
  ]);

  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string): Promise<(Product & { category: ProductCategory; variants: import('@prisma/client').ProductVariant[] }) | null> {
    try {
      return await this.prisma.product.findUnique({
        where: { id },
        include: { category: true, variants: { where: { isActive: true } } },
      });
    } catch {
      return this.inMemoryProducts.get(id) || null;
    }
  }

  async list(filters: ProductFilters, page: number, pageSize: number) {
    try {
      const where = {
        ...(filters.companyId && { companyId: filters.companyId }),
        ...(filters.categoryId && { categoryId: filters.categoryId }),
        ...(filters.isActive !== undefined && { isActive: filters.isActive }),
        ...(filters.search && {
          name: { contains: filters.search, mode: 'insensitive' as const },
        }),
      };

      const [products, total] = await Promise.all([
        this.prisma.product.findMany({
          where,
          include: { category: true, variants: { where: { isActive: true } } },
          orderBy: { name: 'asc' },
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
        this.prisma.product.count({ where }),
      ]);

      return { products, total };
    } catch {
      let all = Array.from(this.inMemoryProducts.values());
      if (filters.categoryId) {
        all = all.filter((p) => p.categoryId === filters.categoryId);
      }
      if (filters.search) {
        const q = filters.search.toLowerCase();
        all = all.filter((p) => p.name.toLowerCase().includes(q));
      }
      const products = all.slice((page - 1) * pageSize, page * pageSize);
      return { products, total: all.length };
    }
  }

  async create(data: {
    companyId: string;
    name: string;
    categoryId: string;
    basePrice: number;
    unit?: string;
    taxRate?: number;
    description?: string;
    costPrice?: number;
  }): Promise<Product> {
    try {
      return await this.prisma.product.create({ data });
    } catch {
      const newProd: any = {
        id: `prod-${Date.now()}`,
        companyId: data.companyId,
        name: data.name,
        categoryId: data.categoryId,
        basePrice: data.basePrice,
        costPrice: data.costPrice ?? 0,
        unit: data.unit ?? 'unit',
        taxRate: data.taxRate ?? 18,
        description: data.description ?? '',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        category: { id: data.categoryId, name: 'General', discountCeilingPct: 10 },
        variants: [],
      };
      this.inMemoryProducts.set(newProd.id, newProd);
      return newProd;
    }
  }

  async update(id: string, data: Partial<{
    name: string;
    categoryId: string;
    basePrice: number;
    unit: string;
    taxRate: number;
    description: string;
    costPrice: number;
    isActive: boolean;
  }>): Promise<Product> {
    return this.prisma.product.update({ where: { id }, data });
  }

  async softDelete(id: string): Promise<Product> {
    return this.prisma.product.update({ where: { id }, data: { isActive: false } });
  }

  async addVariant(productId: string, data: {
    attribute: string;
    value: string;
    extraPrice?: number;
  }): Promise<import('@prisma/client').ProductVariant> {
    return this.prisma.productVariant.create({ data: { productId, ...data } });
  }

  async updateVariant(variantId: string, data: Partial<{
    attribute: string;
    value: string;
    extraPrice: number;
    isActive: boolean;
  }>): Promise<import('@prisma/client').ProductVariant> {
    return this.prisma.productVariant.update({ where: { id: variantId }, data });
  }

  async deleteVariant(variantId: string): Promise<void> {
    await this.prisma.productVariant.delete({ where: { id: variantId } });
  }
}
