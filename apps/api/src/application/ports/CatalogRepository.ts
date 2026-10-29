/** Where catalog items are kept. Writes take a whole item, so an update replaces every field. */

import type { CatalogItem, CatalogItemInput, CatalogSummary } from "../../domain/catalog/CatalogItem.js";

export interface CatalogRepository {
  list(window: { skip: number; take: number }): Promise<{ items: CatalogSummary[]; total: number }>;
  find(id: string): Promise<CatalogItem | undefined>;
  create(input: CatalogItemInput, now: string): Promise<CatalogItem>;
  replace(id: string, input: CatalogItemInput, now: string): Promise<CatalogItem | undefined>;
  remove(id: string): Promise<boolean>;
}
