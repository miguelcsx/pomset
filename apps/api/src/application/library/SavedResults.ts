/**
 * Copies a finished analysis into a script's results, and reads them back.
 *
 * Only an analysis the caller submitted can be saved, and only once it has
 * finished, so a saved result is always complete evidence and never a partial
 * run. The document is read from the workbench on the server, never taken from
 * the request body, so a client cannot save a document it did not get from us.
 */

import {
  badRequest,
  conflict,
  notFound,
  tooLarge,
} from "../../domain/errors/ApplicationError.js";
import { isTerminal } from "@pomset/domain";

import { pageOf, type Page, type PageRequest, window } from "../../domain/pagination.js";
import type { AnalysisOwners } from "../ports/AnalysisOwners.js";
import type { ResultRepository, SavedResultRecord, SavedResultSummary } from "../ports/ResultRepository.js";
import type { AnalysisReport } from "../analyses/GetAnalysis.js";
import type { ScriptLibrary } from "./ScriptLibrary.js";

/** A saved document is copied into the database, so it is bounded. */
export const RESULT_MAX_BYTES = 1024 * 1024;

export interface AnalysisSource {
  report(id: string): Promise<AnalysisReport>;
}

export interface SavedResultsDependencies {
  readonly scripts: ScriptLibrary;
  readonly results: ResultRepository;
  readonly owners: AnalysisOwners;
  readonly analyses: AnalysisSource;
  readonly now: () => Date;
}

export class SavedResults {
  constructor(private readonly deps: SavedResultsDependencies) {}

  async list(userId: string, scriptId: string, request: PageRequest): Promise<Page<SavedResultSummary>> {
    await this.deps.scripts.owned(userId, scriptId);
    const { items, total } = await this.deps.results.list(userId, scriptId, window(request));
    return pageOf(request, items, total);
  }

  async get(userId: string, scriptId: string, id: string): Promise<SavedResultRecord> {
    const result = await this.deps.results.find(userId, scriptId, id);
    if (!result) throw notFound("No such saved result");
    return result;
  }

  async save(userId: string, scriptId: string, input: unknown): Promise<SavedResultRecord> {
    const analysisId = analysisIdOf(input);
    await this.deps.scripts.owned(userId, scriptId);
    if ((await this.deps.owners.ownerOf(analysisId)) !== userId)
      throw notFound("No such analysis");

    const report = await this.deps.analyses.report(analysisId);
    if (!isTerminal(report.job.state))
      throw conflict("Save the result once the analysis has finished");

    const document = JSON.stringify(report);
    if (Buffer.byteLength(document, "utf8") > RESULT_MAX_BYTES)
      throw tooLarge("This analysis is too large to keep as a saved result");

    const saved = await this.deps.results.create(
      userId,
      scriptId,
      analysisId,
      document,
      this.deps.now().toISOString(),
    );
    if (!saved) throw conflict("This analysis is already saved against the script");
    return saved;
  }

  async remove(userId: string, scriptId: string, id: string): Promise<void> {
    if (!(await this.deps.results.remove(userId, scriptId, id)))
      throw notFound("No such saved result");
  }
}

function analysisIdOf(input: unknown): string {
  const id = typeof input === "object" && input !== null ? (input as { analysisId?: unknown }).analysisId : undefined;
  if (typeof id !== "string" || id.length === 0 || id.length > 128)
    throw badRequest("Name the analysis to save", {
      fields: { analysisId: "Send the identifier of a finished analysis" },
    });
  return id;
}
