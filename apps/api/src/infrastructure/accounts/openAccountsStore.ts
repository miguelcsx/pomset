/**
 * Opens the accounts database through Prisma and its libSQL adapter, creating
 * the file on first use and applying the reviewed migration once.
 *
 * SQLite does not enforce foreign keys unless asked, and the cascades that
 * remove a script's results depend on that, so they are switched on for every
 * open. The version recorded in `PRAGMA user_version` is what stops a second
 * start from replaying a migration.
 */

import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

import { PrismaLibSql } from "@prisma/adapter-libsql";

import { PrismaClient } from "../../generated/accounts/client.js";

import { encodeScenario } from "../../domain/scripts/SavedScript.js";
import { CATALOG_SEED } from "./catalogSeed.js";

/** Applied in order; each one runs once, and its version is recorded when it has. */
const MIGRATIONS = [
  { version: 1, file: new URL("../../../prisma/accounts/migrations/0001_accounts.sql", import.meta.url) },
  { version: 2, file: new URL("../../../prisma/accounts/migrations/0002_catalog.sql", import.meta.url) },
] as const;

export interface AccountsStore {
  readonly prisma: PrismaClient;
  close(): Promise<void>;
}

export async function openAccountsStore(file: string): Promise<AccountsStore> {
  const prisma = new PrismaClient({
    adapter: new PrismaLibSql({ url: pathToFileURL(file).href }),
  });
  try {
    await prisma.$executeRawUnsafe("PRAGMA foreign_keys = ON");
    await applyMigrations(prisma);
    await seedCatalog(prisma);
  } catch (error) {
    await prisma.$disconnect();
    throw error;
  }
  return { prisma, close: () => prisma.$disconnect() };
}

async function applyMigrations(prisma: PrismaClient): Promise<void> {
  const [row] = await prisma.$queryRawUnsafe<{ user_version: number | bigint }[]>(
    "PRAGMA user_version",
  );
  const recorded = Number(row?.user_version ?? 0);

  for (const migration of MIGRATIONS) {
    if (migration.version <= recorded) continue;
    for (const statement of statementsOf(readFileSync(migration.file, "utf8")))
      await prisma.$executeRawUnsafe(statement);
    await prisma.$executeRawUnsafe(`PRAGMA user_version = ${migration.version}`);
  }
}

/**
 * Fills in the reviewed examples that are missing. An entry that already exists
 * is left as it is, so an administrator's change survives a restart. SQLite
 * offers no skip-duplicates insert, so each entry is an upsert with no update.
 */
async function seedCatalog(prisma: PrismaClient): Promise<void> {
  for (const item of CATALOG_SEED) {
    const fields = {
      title: item.title,
      summary: item.summary,
      kind: item.kind,
      source: item.source,
      scenario: encodeScenario(item.scenario)!,
      expectedOutcome: item.expectedOutcome,
    };
    await prisma.catalogItem.upsert({ where: { id: item.id }, update: {}, create: { id: item.id, ...fields } });
  }
}

/** The migration holds plain statements and comments only, so splitting on `;` is exact. */
function statementsOf(sql: string): string[] {
  return sql
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("--"))
    .join("\n")
    .split(";")
    .map((statement) => statement.trim())
    .filter((statement) => statement.length > 0);
}
