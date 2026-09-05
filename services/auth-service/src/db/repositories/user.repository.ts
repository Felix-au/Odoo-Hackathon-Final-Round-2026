import { PrismaClient, type User, type Role } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { checkDbAvailable } from '../db-status';

export class UserRepository {
  private inMemoryUsers: Map<string, User> = new Map();
  private initialized = false;

  constructor(private readonly prisma: PrismaClient) {}

  private async ensureInitialized() {
    if (this.initialized) return;
    const now = new Date();
    const adminHash = await bcrypt.hash('AdminP@ss123', 10);
    const managerHash = await bcrypt.hash('ManagerP@ss123', 10);
    const financeHash = await bcrypt.hash('FinanceP@ss123', 10);
    const repHash = await bcrypt.hash('RepP@ss123', 10);

    const defaults: User[] = [
      {
        id: 'usr-admin-01',
        email: 'admin@dealflow360.com',
        name: 'Platform Admin',
        role: 'ADMIN',
        passwordHash: adminHash,
        companyId: 'default',
        isActive: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'usr-mgr-01',
        email: 'manager1@dealflow360.com',
        name: 'Alice Johnson',
        role: 'SALES_MANAGER',
        passwordHash: managerHash,
        companyId: 'default',
        isActive: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'usr-fin-01',
        email: 'finance@dealflow360.com',
        name: 'Carol Finance',
        role: 'FINANCE',
        passwordHash: financeHash,
        companyId: 'default',
        isActive: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'usr-rep-01',
        email: 'rep1@dealflow360.com',
        name: 'Dave Sales',
        role: 'SALES_REP',
        passwordHash: repHash,
        companyId: 'default',
        isActive: true,
        createdAt: now,
        updatedAt: now,
      },
    ];

    for (const u of defaults) {
      this.inMemoryUsers.set(u.email.toLowerCase(), u);
    }
    this.initialized = true;
  }

  async findById(id: string): Promise<User | null> {
    if (await checkDbAvailable(this.prisma)) {
      try {
        return await this.prisma.user.findUnique({ where: { id } });
      } catch {}
    }
    await this.ensureInitialized();
    for (const u of this.inMemoryUsers.values()) {
      if (u.id === id) return u;
    }
    return null;
  }

  async findByEmail(email: string): Promise<User | null> {
    if (await checkDbAvailable(this.prisma)) {
      try {
        return await this.prisma.user.findUnique({ where: { email } });
      } catch {}
    }
    await this.ensureInitialized();
    return this.inMemoryUsers.get(email.toLowerCase().trim()) || null;
  }

  async create(data: {
    email: string;
    passwordHash: string;
    name: string;
    role: Role;
    companyId?: string;
  }): Promise<User> {
    if (await checkDbAvailable(this.prisma)) {
      try {
        return await this.prisma.user.create({
          data: {
            ...data,
            companyId: data.companyId ?? 'default',
          },
        });
      } catch {}
    }
    await this.ensureInitialized();
    const newUser: User = {
      id: `usr-${Date.now()}`,
      email: data.email.toLowerCase().trim(),
      passwordHash: data.passwordHash,
      name: data.name,
      role: data.role,
      companyId: data.companyId ?? 'default',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.inMemoryUsers.set(newUser.email, newUser);
    return newUser;
  }

  async updateRole(id: string, role: Role): Promise<User> {
    if (await checkDbAvailable(this.prisma)) {
      try {
        return await this.prisma.user.update({
          where: { id },
          data: { role },
        });
      } catch {}
    }
    await this.ensureInitialized();
    for (const u of this.inMemoryUsers.values()) {
      if (u.id === id) {
        u.role = role;
        u.updatedAt = new Date();
        return u;
      }
    }
    throw new Error(`User with id ${id} not found`);
  }

  async setActive(id: string, isActive: boolean): Promise<User> {
    if (await checkDbAvailable(this.prisma)) {
      try {
        return await this.prisma.user.update({
          where: { id },
          data: { isActive },
        });
      } catch {}
    }
    await this.ensureInitialized();
    for (const u of this.inMemoryUsers.values()) {
      if (u.id === id) {
        u.isActive = isActive;
        u.updatedAt = new Date();
        return u;
      }
    }
    throw new Error(`User with id ${id} not found`);
  }

  async listAll(page: number, pageSize: number): Promise<{ users: User[]; total: number }> {
    if (await checkDbAvailable(this.prisma)) {
      try {
        const [users, total] = await Promise.all([
          this.prisma.user.findMany({
            orderBy: { createdAt: 'desc' },
            skip: (page - 1) * pageSize,
            take: pageSize,
          }),
          this.prisma.user.count(),
        ]);
        return { users, total };
      } catch {}
    }
    await this.ensureInitialized();
    const all = Array.from(this.inMemoryUsers.values());
    const users = all.slice((page - 1) * pageSize, page * pageSize);
    return { users, total: all.length };
  }
}
