import type { PrismaClient } from "../../generated/accounts/client.js";
import {
  type CatalogItem,
  type CatalogItemInput,
  type CatalogKind,
  type CatalogSummary,
} from "../../domain/catalog/CatalogItem.js";
import { decodeScenario, encodeScenario } from "../../domain/scripts/SavedScript.js";
import type { CatalogRepository } from "../../application/ports/CatalogRepository.js";

type CatalogRow = {
  id: string;
  title: string;
  summary: string;
  kind: string;
  source: string;
  scenario: string;
  expectedOutcome: string;
  createdAt: Date;
  updatedAt: Date;
};

const SUMMARY = { id: true, title: true, summary: true, kind: true, createdAt: true, updatedAt: true } as const;

export class PrismaCatalogRepository implements CatalogRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async list(window: { skip: number; take: number }) {
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.catalogItem.findMany({ select: SUMMARY, orderBy: [{ title: "asc" }, { id: "asc" }], ...window }),
      this.prisma.catalogItem.count(),
    ]);
    return { items: rows.map(summaryOf), total };
  }

  async find(id: string): Promise<CatalogItem | undefined> {
    const row = await this.prisma.catalogItem.findUnique({ where: { id } });
    return row ? itemOf(row) : undefined;
  }

  async create(input: CatalogItemInput, now: string): Promise<CatalogItem> {
    const at = new Date(now);
    const row = await this.prisma.catalogItem.create({
      data: { ...storedFields(input), createdAt: at, updatedAt: at },
    });
    return itemOf(row);
  }

  async replace(id: string, input: CatalogItemInput, now: string): Promise<CatalogItem | undefined> {
    const { count } = await this.prisma.catalogItem.updateMany({
      where: { id },
      data: { ...storedFields(input), updatedAt: new Date(now) },
    });
    return count === 0 ? undefined : this.find(id);
  }

  async remove(id: string): Promise<boolean> {
    const { count } = await this.prisma.catalogItem.deleteMany({ where: { id } });
    return count > 0;
  }
}

function storedFields(input: CatalogItemInput) {
  return {
    title: input.title,
    summary: input.summary,
    kind: input.kind,
    source: input.source,
    scenario: encodeScenario(input.scenario)!,
    expectedOutcome: input.expectedOutcome,
  };
}

function summaryOf(row: Pick<CatalogRow, "id" | "title" | "summary" | "kind" | "createdAt" | "updatedAt">): CatalogSummary {
  return {
    id: row.id,
    title: row.title,
    summary: row.summary,
    kind: row.kind as CatalogKind,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function itemOf(row: CatalogRow): CatalogItem {
  return {
    ...summaryOf(row),
    source: row.source,
    scenario: decodeScenario(row.scenario)!,
    expectedOutcome: row.expectedOutcome,
  };
}
