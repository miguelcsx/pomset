/**
 * The catalog of curated examples. Reading it is public; writing it is the
 * administrator's, and the router enforces that before a method runs. Saving an
 * item copies it into the caller's own scripts, so the catalog entry itself is
 * never edited by the people who use it.
 */

import { type CatalogItem, parseCatalogInput, type CatalogSummary } from "../../domain/catalog/CatalogItem.js";
import { notFound } from "../../domain/errors/ApplicationError.js";
import { pageOf, type Page, type PageRequest, window } from "../../domain/pagination.js";
import type { SavedScript } from "../../domain/scripts/SavedScript.js";
import type { CatalogRepository } from "../ports/CatalogRepository.js";
import type { ScriptLibrary } from "../library/ScriptLibrary.js";

export interface CatalogDependencies {
  readonly repository: CatalogRepository;
  readonly scripts: ScriptLibrary;
  readonly now: () => Date;
}

export class Catalog {
  constructor(private readonly deps: CatalogDependencies) {}

  async list(request: PageRequest): Promise<Page<CatalogSummary>> {
    const { items, total } = await this.deps.repository.list(window(request));
    return pageOf(request, items, total);
  }

  async get(id: string): Promise<CatalogItem> {
    return this.required(await this.deps.repository.find(id));
  }

  create(input: unknown): Promise<CatalogItem> {
    return this.deps.repository.create(parseCatalogInput(input), this.deps.now().toISOString());
  }

  async update(id: string, input: unknown): Promise<CatalogItem> {
    const parsed = parseCatalogInput(input);
    return this.required(await this.deps.repository.replace(id, parsed, this.deps.now().toISOString()));
  }

  async remove(id: string): Promise<void> {
    if (!(await this.deps.repository.remove(id))) throw notFound("No such catalog item");
  }

  /** Copies an item into the caller's scripts, where the copy can be edited and analysed. */
  async saveToScripts(userId: string, id: string): Promise<SavedScript> {
    return this.deps.scripts.createFromCatalog(userId, await this.get(id));
  }

  private required<T>(item: T | undefined): T {
    if (item === undefined) throw notFound("No such catalog item");
    return item;
  }
}
