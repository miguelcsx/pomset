import type { PrismaClient } from "../../generated/accounts/client.js";
import type { AnalysisOwners } from "../../application/ports/AnalysisOwners.js";
import { isUniqueViolation } from "./PrismaUserRepository.js";

export class PrismaAnalysisOwners implements AnalysisOwners {
  constructor(private readonly prisma: PrismaClient) {}

  async record(analysisId: string, userId: string, now: string): Promise<void> {
    try {
      await this.prisma.analysisOwner.create({
        data: { analysisId, userId, createdAt: new Date(now) },
      });
    } catch (error) {
      // Job identifiers are unique, so a second record for one is a bug in the caller.
      if (isUniqueViolation(error)) throw new Error(`Analysis ${analysisId} already has an owner`);
      throw error;
    }
  }

  async ownerOf(analysisId: string): Promise<string | undefined> {
    const row = await this.prisma.analysisOwner.findUnique({ where: { analysisId } });
    return row?.userId;
  }

  async analysisIdsOf(userId: string, window: { skip: number; take: number }): Promise<string[]> {
    const rows = await this.prisma.analysisOwner.findMany({
      where: { userId },
      orderBy: [{ createdAt: "desc" }, { analysisId: "desc" }],
      ...window,
      select: { analysisId: true },
    });
    return rows.map((row) => row.analysisId);
  }

  countOf(userId: string): Promise<number> {
    return this.prisma.analysisOwner.count({ where: { userId } });
  }
}
