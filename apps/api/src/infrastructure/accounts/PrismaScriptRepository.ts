import type { PrismaClient } from "../../generated/accounts/client.js";
import {
  decodeScenario,
  encodeScenario,
  type SavedScript,
  type ScriptInput,
  type ScriptPatch,
  type ScriptSummary,
} from "../../domain/scripts/SavedScript.js";
import type { ScriptRepository } from "../../application/ports/ScriptRepository.js";

type ScriptRow = {
  id: string;
  title: string;
  source: string;
  scenario: string | null;
  createdAt: Date;
  updatedAt: Date;
};

const SUMMARY = { id: true, title: true, createdAt: true, updatedAt: true } as const;

export class PrismaScriptRepository implements ScriptRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async list(userId: string, window: { skip: number; take: number }) {
    const where = { userId };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.savedScript.findMany({
        where,
        select: SUMMARY,
        orderBy: { updatedAt: "desc" },
        ...window,
      }),
      this.prisma.savedScript.count({ where }),
    ]);
    return { items: rows.map(summaryOf), total };
  }

  async find(userId: string, id: string): Promise<SavedScript | undefined> {
    const row = await this.prisma.savedScript.findFirst({ where: { id, userId } });
    return row ? scriptOf(row) : undefined;
  }

  async create(userId: string, input: ScriptInput, now: string): Promise<SavedScript> {
    const at = new Date(now);
    const row = await this.prisma.savedScript.create({
      data: {
        userId,
        title: input.title,
        source: input.source,
        scenario: encodeScenario(input.scenario),
        createdAt: at,
        updatedAt: at,
      },
    });
    return scriptOf(row);
  }

  async update(userId: string, id: string, patch: ScriptPatch, now: string): Promise<SavedScript | undefined> {
    const data = {
      ...(patch.title !== undefined ? { title: patch.title } : {}),
      ...(patch.source !== undefined ? { source: patch.source } : {}),
      ...(patch.scenario !== undefined ? { scenario: encodeScenario(patch.scenario) } : {}),
      updatedAt: new Date(now),
    };
    const { count } = await this.prisma.savedScript.updateMany({ where: { id, userId }, data });
    return count === 0 ? undefined : this.find(userId, id);
  }

  async remove(userId: string, id: string): Promise<boolean> {
    const { count } = await this.prisma.savedScript.deleteMany({ where: { id, userId } });
    return count > 0;
  }
}

function summaryOf(row: Pick<ScriptRow, "id" | "title" | "createdAt" | "updatedAt">): ScriptSummary {
  return {
    id: row.id,
    title: row.title,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function scriptOf(row: ScriptRow): SavedScript {
  return {
    ...summaryOf(row),
    source: row.source,
    scenario: decodeScenario(row.scenario),
  };
}
