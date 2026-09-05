import { PrismaClient, Customer } from '@prisma/client';

export interface CustomerFilters {
  companyId?: string;
  search?: string;
  tier?: string;
  hasPortalAccess?: boolean;
}

export class CustomerRepository {
  private inMemoryCustomers: Map<string, Customer> = new Map([
    [
      'cust-000000-0000-0000-0000-000000000001',
      {
        id: 'cust-000000-0000-0000-0000-000000000001',
        companyId: 'default',
        name: 'Acme Corporation',
        email: 'acme@example.com',
        tier: 'GOLD',
        currency: 'USD',
        hasPortalAccess: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ],
    [
      'cust-000000-0000-0000-0000-000000000002',
      {
        id: 'cust-000000-0000-0000-0000-000000000002',
        companyId: 'default',
        name: 'Beta Logistics',
        email: 'beta@example.com',
        tier: 'SILVER',
        currency: 'USD',
        hasPortalAccess: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ],
    [
      'cust-000000-0000-0000-0000-000000000003',
      {
        id: 'cust-000000-0000-0000-0000-000000000003',
        companyId: 'default',
        name: 'Gamma Innovations',
        email: 'gamma@example.com',
        tier: 'BRONZE',
        currency: 'USD',
        hasPortalAccess: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ],
  ]);

  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string): Promise<Customer | null> {
    try {
      return await this.prisma.customer.findUnique({
        where: { id },
      });
    } catch {
      return this.inMemoryCustomers.get(id) ?? null;
    }
  }

  async findByEmail(companyId: string, email: string): Promise<Customer | null> {
    try {
      return await this.prisma.customer.findUnique({
        where: {
          companyId_email: {
            companyId,
            email,
          },
        },
      });
    } catch {
      for (const c of this.inMemoryCustomers.values()) {
        if (c.companyId === companyId && c.email === email) return c;
      }
      return null;
    }
  }

  async list(filters: CustomerFilters, page = 1, pageSize = 20) {
    try {
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
    } catch {
      let all = Array.from(this.inMemoryCustomers.values());
      if (filters.companyId) all = all.filter((c) => c.companyId === filters.companyId);
      if (filters.tier) all = all.filter((c) => c.tier === filters.tier);
      if (filters.hasPortalAccess !== undefined) {
        all = all.filter((c) => c.hasPortalAccess === filters.hasPortalAccess);
      }
      if (filters.search) {
        const q = filters.search.toLowerCase();
        all = all.filter((c) => c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q));
      }
      const total = all.length;
      const customers = all.slice((page - 1) * pageSize, page * pageSize);
      return { customers, total };
    }
  }

  async create(data: {
    companyId?: string;
    name: string;
    email: string;
    tier?: string;
    currency?: string;
    hasPortalAccess?: boolean;
  }): Promise<Customer> {
    try {
      return await this.prisma.customer.create({
        data: {
          companyId: data.companyId ?? 'default',
          name: data.name,
          email: data.email,
          tier: data.tier ?? 'BRONZE',
          currency: data.currency ?? 'USD',
          hasPortalAccess: data.hasPortalAccess ?? false,
        },
      });
    } catch {
      const newCust: Customer = {
        id: `cust-${Date.now()}`,
        companyId: data.companyId ?? 'default',
        name: data.name,
        email: data.email,
        tier: data.tier ?? 'BRONZE',
        currency: data.currency ?? 'USD',
        hasPortalAccess: data.hasPortalAccess ?? false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      this.inMemoryCustomers.set(newCust.id, newCust);
      return newCust;
    }
  }

  async update(id: string, data: Partial<Customer>): Promise<Customer> {
    try {
      return await this.prisma.customer.update({
        where: { id },
        data,
      });
    } catch {
      const existing = this.inMemoryCustomers.get(id);
      if (!existing) throw new Error('Customer not found');
      const updated = { ...existing, ...data, updatedAt: new Date() };
      this.inMemoryCustomers.set(id, updated);
      return updated;
    }
  }

  async setPortalAccess(id: string, hasPortalAccess: boolean): Promise<Customer> {
    try {
      return await this.prisma.customer.update({
        where: { id },
        data: { hasPortalAccess },
      });
    } catch {
      const existing = this.inMemoryCustomers.get(id);
      if (!existing) throw new Error('Customer not found');
      const updated = { ...existing, hasPortalAccess, updatedAt: new Date() };
      this.inMemoryCustomers.set(id, updated);
      return updated;
    }
  }
}
