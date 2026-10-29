/**
 * The catalog of reviewed examples. Reading it needs no account, saving a copy
 * needs a signed-in one, and writing it needs an administrator. The API enforces
 * each of those rules; this module only sends the token it has.
 */

import { apiRequest, unwrap } from "../common/http";
import { asObject, stringField, type JsonObject, UnexpectedResponse } from "../common/json";
import { pageQuery, parsePage, type Page } from "../common/page";
import { parseScript, type SavedScript } from "../scripts/scripts-api";

export const CATALOG_KINDS = ["defect", "control"] as const;
export type CatalogKind = (typeof CATALOG_KINDS)[number];

export const CATALOG_PAGE_SIZE = 10;

export interface CatalogSummary {
  readonly id: string;
  readonly title: string;
  readonly summary: string;
  readonly kind: CatalogKind;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CatalogItem extends CatalogSummary {
  readonly source: string;
  readonly scenario: JsonObject;
  readonly expectedOutcome: string;
}

export interface CatalogDraft {
  readonly title: string;
  readonly summary: string;
  readonly kind: CatalogKind;
  readonly source: string;
  readonly scenario: JsonObject;
  readonly expectedOutcome: string;
}

export function kindLabel(kind: CatalogKind): string {
  return kind === "defect" ? "Defect" : "Control";
}

function kindOf(record: JsonObject): CatalogKind {
  const value = stringField(record, "kind");
  if (!(CATALOG_KINDS as readonly string[]).includes(value)) throw new UnexpectedResponse();
  return value as CatalogKind;
}

export function parseCatalogSummary(value: unknown): CatalogSummary {
  const record = asObject(value);
  return {
    id: stringField(record, "id"),
    title: stringField(record, "title"),
    summary: stringField(record, "summary"),
    kind: kindOf(record),
    createdAt: stringField(record, "createdAt"),
    updatedAt: stringField(record, "updatedAt"),
  };
}

export function parseCatalogItem(value: unknown): CatalogItem {
  const record = asObject(value);
  return {
    ...parseCatalogSummary(record),
    source: stringField(record, "source"),
    scenario: asObject(record["scenario"]),
    expectedOutcome: stringField(record, "expectedOutcome"),
  };
}

export function listCatalog(page: number, pageSize = CATALOG_PAGE_SIZE): Promise<Page<CatalogSummary>> {
  return apiRequest(`/api/catalog?${pageQuery(page, pageSize)}`).then((response) =>
    parsePage(response, parseCatalogSummary),
  );
}

export async function getCatalogItem(id: string): Promise<CatalogItem> {
  return parseCatalogItem(unwrap(await apiRequest(`/api/catalog/${encodeURIComponent(id)}`)));
}

/** Copies a catalog item into the signed-in account's scripts, where it can be edited and analysed. */
export async function saveCatalogItem(id: string): Promise<SavedScript> {
  const path = `/api/catalog/${encodeURIComponent(id)}/scripts`;
  return parseScript(unwrap(await apiRequest(path, { method: "POST", auth: "required" })));
}

export async function createCatalogItem(draft: CatalogDraft): Promise<CatalogItem> {
  return parseCatalogItem(unwrap(await apiRequest("/api/catalog", { method: "POST", body: draft, auth: "required" })));
}

export async function deleteCatalogItem(id: string): Promise<void> {
  await apiRequest(`/api/catalog/${encodeURIComponent(id)}`, { method: "DELETE", auth: "required" });
}
