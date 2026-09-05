import type { ProductRepository, ProductFilters } from '../../db/repositories/product.repository';
import type { CatalogCache } from '../../cache/catalog-cache';

export class ProductService {
  constructor(
    private readonly productRepo: ProductRepository,
    private readonly cache: CatalogCache,
  ) {}

  async getById(companyId: string, productId: string) {
    const cacheKey = this.cache.productKey(companyId, productId);
    const cached = await this.cache.get<object>(cacheKey);
    if (cached) return cached;

    const product = await this.productRepo.findById(productId);
    if (!product || product.companyId !== companyId) return null;

    await this.cache.set(cacheKey, product, this.cache.productTtl);
    return product;
  }

  async list(companyId: string, filters: Omit<ProductFilters, 'companyId'>, page: number, pageSize: number) {
    return this.productRepo.list({ ...filters, companyId }, page, pageSize);
  }

  async create(companyId: string, data: {
    name: string;
    categoryId: string;
    basePrice: number;
    unit?: string;
    taxRate?: number;
    description?: string;
    costPrice?: number;
  }) {
    const product = await this.productRepo.create({ ...data, companyId });
    await this.cache.invalidateProduct(companyId, product.id);
    return product;
  }

  async update(companyId: string, productId: string, data: Parameters<ProductRepository['update']>[1]) {
    await this.productRepo.update(productId, data);
    await this.cache.invalidateProduct(companyId, productId);
    return this.productRepo.findById(productId);
  }

  async softDelete(companyId: string, productId: string) {
    await this.productRepo.softDelete(productId);
    await this.cache.invalidateProduct(companyId, productId);
  }

  async addVariant(companyId: string, productId: string, data: { attribute: string; value: string; extraPrice?: number }) {
    const variant = await this.productRepo.addVariant(productId, data);
    await this.cache.invalidateProduct(companyId, productId);
    return variant;
  }

  async updateVariant(companyId: string, productId: string, variantId: string, data: Parameters<ProductRepository['updateVariant']>[1]) {
    const variant = await this.productRepo.updateVariant(variantId, data);
    await this.cache.invalidateProduct(companyId, productId);
    return variant;
  }

  async deleteVariant(companyId: string, productId: string, variantId: string) {
    await this.productRepo.deleteVariant(variantId);
    await this.cache.invalidateProduct(companyId, productId);
  }
}
