/**
 * The jobs behind a list of analysis identifiers, in the order given.
 *
 * A run being over proves nothing about the kernel, so the history is a list of
 * attempts and their states, not a list of verdicts. The identifiers decide what
 * may be listed: this use case never enumerates the store on its own, so a job
 * outside the list is not reachable from here. An identifier whose job is gone
 * is skipped rather than failing the whole list.
 */

import type { Job } from "@pomset/contracts";

import { ApplicationError } from "../../domain/errors/ApplicationError.js";
import type { AnalysisRepository } from "../ports/AnalysisRepository.js";

export class ListAnalyses {
  constructor(private readonly repository: AnalysisRepository) {}

  async forIds(ids: readonly string[]): Promise<Job[]> {
    const jobs = await Promise.all(ids.map((id) => this.find(id)));
    return jobs.filter((job): job is Job => job !== undefined);
  }

  private async find(id: string): Promise<Job | undefined> {
    try {
      return await this.repository.job(id);
    } catch (error) {
      if (error instanceof ApplicationError && error.kind === "not_found") return undefined;
      throw error;
    }
  }
}
