/**
 * Request cancellation of one job.
 *
 * Cancellation has precedence over a completion that arrives at the same
 * moment: the durable state is moved to `cancel-requested` first, and the
 * engine is then signalled. A cancelled run keeps its partial evidence rather
 * than disappearing.
 */

import type { Job } from "@pomset/contracts";

import type { AnalysisRepository } from "../ports/AnalysisRepository.js";
import type { AnalysisRunner } from "./AnalysisRunner.js";

export class CancelAnalysis {
  constructor(
    private readonly repository: AnalysisRepository,
    private readonly runner: AnalysisRunner,
  ) {}

  async execute(id: string): Promise<Job> {
    await this.repository.cancel(id);
    this.runner.abort(id);
    return this.repository.job(id);
  }
}
