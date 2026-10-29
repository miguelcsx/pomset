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

const MIGRATION = new URL("../../../prisma/accounts/migrations/0001_accounts.sql", import.meta.url);
const SCHEMA_VERSION = 1;

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
  if (Number(row?.user_version ?? 0) >= SCHEMA_VERSION) return;

  for (const statement of statementsOf(readFileSync(MIGRATION, "utf8")))
    await prisma.$executeRawUnsafe(statement);
  await prisma.$executeRawUnsafe(`PRAGMA user_version = ${SCHEMA_VERSION}`);
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
