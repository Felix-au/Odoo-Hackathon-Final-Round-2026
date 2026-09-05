import { PrismaClient, Customer } from '@prisma/client';

export interface CustomerFilters {
  companyId?: string;
  search?: string;
  tier?: string;
  hasPortalAccess?: boolean;
}

export class CustomerRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string): Promise<Customer | null> {
    return this.prisma.customer.findUnique({
      where: { id },
    });
  }

  async findByEmail(companyId: string, email: string): Promise<Customer | null> {
    return this.prisma.customer.findUnique({
      where: {
        companyId_email: {
          companyId,
          email,
        },
      },
    });
  }

  async list(filters: CustomerFilters, page = 1, pageSize = 20) {
    const where = {
      ...(filters.companyId && { companyId: filters.companyId }),
      ...(filters.tier && { tier: filters.tier }),
      ...(filters.hasPortalAccess !== undefined && { hasPortalAccess: filters.hasPortalAccess }),
      ...(filters.search && {
        OR: [
          { name: { contains: filters.search, mode: 'insensitive' as const } },
          { email: { contains: filters.search, mode: 'insensitive' as const } },
        ],
      }),
    };

    const [customers, total] = await Promise.all([
      this.prisma.customer.findMany({
        where,
        orderBy: { name: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.customer.count({ where }),
    ]);

    return { customers, total };
  }

  async create(data: {
    companyId?: string;
    name: string;
    email: string;
    tier?: string;
    currency?: string;
    hasPortalAccess?: boolean;
  }): Promise<Customer> {
    return this.prisma.customer.create({
      data: {
        companyId: data.companyId ?? 'default',
        name: data.name,
        email: data.email,
        tier: data.tier ?? 'BRONZE',
        currency: data.currency ?? 'USD',
        hasPortalAccess: data.hasPortalAccess ?? false,
      },
    });
  }

  async update(id: string, data: Partial<Customer>): Promise<Customer> {
    return this.prisma.customer.update({
      where: { id },
      data,
    });
  }

  async setPortalAccess(id: string, hasPortalAccess: boolean): Promise<Customer> {
    return this.prisma.customer.update({
      where: { id },
      data: { hasPortalAccess },
    });
  }
}
