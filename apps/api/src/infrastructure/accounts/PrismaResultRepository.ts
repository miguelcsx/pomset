import type { PrismaClient } from "../../generated/accounts/client.js";
import type {
  ResultRepository,
  SavedResultRecord,
  SavedResultSummary,
} from "../../application/ports/ResultRepository.js";
import { isUniqueViolation } from "./PrismaUserRepository.js";

type ResultRow = {
  id: string;
  scriptId: string;
  analysisId: string;
  job: string;
  createdAt: Date;
};

/**
 * Every query reaches the script through its owner, so a result is visible only
 * to the account that owns the script it was saved against.
 */
export class PrismaResultRepository implements ResultRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async list(userId: string, scriptId: string, window: { skip: number; take: number }) {
    const where = { scriptId, script: { userId } };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.savedResult.findMany({
        where,
        select: { id: true, analysisId: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        ...window,
      }),
      this.prisma.savedResult.count({ where }),
    ]);
    return { items: rows.map(summaryOf), total };
  }

  async find(userId: string, scriptId: string, id: string): Promise<SavedResultRecord | undefined> {
    const row = await this.prisma.savedResult.findFirst({
      where: { id, scriptId, script: { userId } },
    });
    return row ? recordOf(row) : undefined;
  }

  async create(
    userId: string,
    scriptId: string,
    analysisId: string,
    document: string,
    now: string,
  ): Promise<SavedResultRecord | undefined> {
    const owned = await this.prisma.savedScript.count({ where: { id: scriptId, userId } });
    if (owned === 0) return undefined;
    try {
      const row = await this.prisma.savedResult.create({
        data: { scriptId, analysisId, job: document, createdAt: new Date(now) },
      });
      return recordOf(row);
    } catch (error) {
      if (isUniqueViolation(error)) return undefined;
      throw error;
    }
  }

  async remove(userId: string, scriptId: string, id: string): Promise<boolean> {
    const { count } = await this.prisma.savedResult.deleteMany({
      where: { id, scriptId, script: { userId } },
    });
    return count > 0;
  }
}

function summaryOf(row: Pick<ResultRow, "id" | "analysisId" | "createdAt">): SavedResultSummary {
  return { id: row.id, analysisId: row.analysisId, createdAt: row.createdAt.toISOString() };
}

function recordOf(row: ResultRow): SavedResultRecord {
  return { ...summaryOf(row), scriptId: row.scriptId, document: JSON.parse(row.job) as unknown };
}
