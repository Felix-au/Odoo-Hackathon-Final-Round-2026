import { PrismaClient, type Product, type ProductCategory } from '@prisma/client';

export interface ProductFilters {
  companyId?: string;
  categoryId?: string;
  search?: string;
  isActive?: boolean;
}

export class ProductRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string): Promise<(Product & { category: ProductCategory; variants: import('@prisma/client').ProductVariant[] }) | null> {
    return this.prisma.product.findUnique({
      where: { id },
      include: { category: true, variants: { where: { isActive: true } } },
    });
  }

  async list(filters: ProductFilters, page: number, pageSize: number) {
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
    return this.prisma.product.create({ data });
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
