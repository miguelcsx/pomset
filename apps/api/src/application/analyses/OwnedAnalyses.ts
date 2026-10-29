/**
 * The analysis operations, scoped to the account that submitted each analysis.
 *
 * An analysis that belongs to someone else, or to nobody, answers exactly as one
 * that does not exist. A guessed identifier therefore reveals nothing, and an
 * analysis submitted before accounts existed is not reachable from any account.
 */

import type { Job } from "@pomset/contracts";

import { notFound } from "../../domain/errors/ApplicationError.js";
import { pageOf, type Page, type PageRequest, window } from "../../domain/pagination.js";
import type { AnalysisOwners } from "../ports/AnalysisOwners.js";
import type { Workbench } from "../Workbench.js";
import type { AnalysisReport } from "./GetAnalysis.js";

export interface OwnedAnalysesDependencies {
  readonly workbench: Workbench;
  readonly owners: AnalysisOwners;
  readonly now: () => Date;
}

export class OwnedAnalyses {
  constructor(private readonly deps: OwnedAnalysesDependencies) {}

  async submit(userId: string, input: unknown): Promise<Job> {
    const job = await this.deps.workbench.submit.execute(input);
    await this.deps.owners.record(job.jobId, userId, this.deps.now().toISOString());
    return job;
  }

  /**
   * One page of the account's own analyses, newest first. `total` counts what the
   * account submitted; an analysis whose job has since been removed is left out
   * of `items`, so a page can be shorter than `pageSize`.
   */
  async history(userId: string, request: PageRequest): Promise<Page<Job>> {
    const [ids, total] = await Promise.all([
      this.deps.owners.analysisIdsOf(userId, window(request)),
      this.deps.owners.countOf(userId),
    ]);
    return pageOf(request, await this.deps.workbench.history.forIds(ids), total);
  }

  async report(userId: string, id: string): Promise<AnalysisReport> {
    await this.ensureOwner(userId, id);
    return this.deps.workbench.report.execute(id);
  }

  async cancel(userId: string, id: string): Promise<Job> {
    await this.ensureOwner(userId, id);
    return this.deps.workbench.cancel.execute(id);
  }

  private async ensureOwner(userId: string, id: string): Promise<void> {
    if ((await this.deps.owners.ownerOf(id)) !== userId) throw notFound("No such analysis");
  }
}
