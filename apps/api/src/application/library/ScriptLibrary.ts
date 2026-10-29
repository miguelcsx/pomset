/**
 * The scripts a signed-in user keeps. Each operation takes the caller's account
 * and refuses anything that account does not own with the same not-found answer
 * a missing script gets.
 */

import { notFound } from "../../domain/errors/ApplicationError.js";
import { pageOf, type Page, type PageRequest, window } from "../../domain/pagination.js";
import {
  parseScriptInput,
  parseScriptPatch,
  type SavedScript,
  type ScriptSummary,
} from "../../domain/scripts/SavedScript.js";
import type { ScriptRepository } from "../ports/ScriptRepository.js";

export class ScriptLibrary {
  constructor(
    private readonly scripts: ScriptRepository,
    private readonly now: () => Date,
  ) {}

  async list(userId: string, request: PageRequest): Promise<Page<ScriptSummary>> {
    const { items, total } = await this.scripts.list(userId, window(request));
    return pageOf(request, items, total);
  }

  create(userId: string, input: unknown): Promise<SavedScript> {
    return this.scripts.create(userId, parseScriptInput(input), this.now().toISOString());
  }

  async get(userId: string, id: string): Promise<SavedScript> {
    return this.required(await this.scripts.find(userId, id));
  }

  async update(userId: string, id: string, input: unknown): Promise<SavedScript> {
    const patch = parseScriptPatch(input);
    return this.required(await this.scripts.update(userId, id, patch, this.now().toISOString()));
  }

  async remove(userId: string, id: string): Promise<void> {
    if (!(await this.scripts.remove(userId, id))) throw notFound("No such script");
  }

  /** Ownership is checked here, once, for every operation that names a script. */
  async owned(userId: string, id: string): Promise<void> {
    await this.get(userId, id);
  }

  private required<T>(script: T | undefined): T {
    if (script === undefined) throw notFound("No such script");
    return script;
  }
}
