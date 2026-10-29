import { Prisma } from "../../generated/accounts/client.js";
import type { PrismaClient } from "../../generated/accounts/client.js";
import { isRole, type Account } from "../../domain/accounts/Account.js";
import type { NewUser, StoredUser, UserRepository } from "../../application/ports/UserRepository.js";

type UserRow = {
  id: string;
  email: string;
  displayName: string;
  passwordHash: string;
  role: string;
  createdAt: Date;
};

export class PrismaUserRepository implements UserRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findByEmail(email: string): Promise<StoredUser | undefined> {
    const row = await this.prisma.user.findUnique({ where: { email } });
    return row ? { ...toAccount(row), passwordHash: row.passwordHash } : undefined;
  }

  async findById(id: string): Promise<Account | undefined> {
    const row = await this.prisma.user.findUnique({ where: { id } });
    return row ? toAccount(row) : undefined;
  }

  async create(user: NewUser): Promise<Account | undefined> {
    try {
      const row = await this.prisma.user.create({
        data: { ...user, createdAt: new Date(user.createdAt) },
      });
      return toAccount(row);
    } catch (error) {
      if (isUniqueViolation(error)) return undefined;
      throw error;
    }
  }

  async list(window: { skip: number; take: number }): Promise<{ items: Account[]; total: number }> {
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({ orderBy: { createdAt: "asc" }, ...window }),
      this.prisma.user.count(),
    ]);
    return { items: rows.map(toAccount), total };
  }
}

export function toAccount(row: UserRow): Account {
  if (!isRole(row.role)) throw new Error(`Stored account has an unknown role: ${row.role}`);
  return {
    id: row.id,
    email: row.email,
    displayName: row.displayName,
    role: row.role,
    createdAt: row.createdAt.toISOString(),
  };
}

export function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}
