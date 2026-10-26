/**
 * The single-analysis constraint.
 *
 * ADR-0013 makes the local workbench serialize analyses, so the state of the
 * one run in flight lives here rather than in each use case. A submission is
 * refused while a run is active and an abort reaches the engine through the
 * supervisor's cancellation.
 */

import type { Job } from "@pomset/contracts";

import type { EngineRunner } from "../ports/EngineRunner.js";

export class AnalysisRunner {
  private active:
    | { readonly id: string; readonly controller: AbortController; readonly done: Promise<void> }
    | undefined;

  constructor(private readonly engine: EngineRunner) {}

  get activeId(): string | undefined {
    return this.active?.id;
  }

  start(job: Job, directory: string, solverTimeMs: number): void {
    const controller = new AbortController();
    const done = Promise.resolve()
      .then(() => this.engine.run(job, directory, solverTimeMs, controller.signal))
      .finally(() => {
        this.active = undefined;
      });
    this.active = { id: job.jobId, controller, done };
  }

  abort(id: string): void {
    if (this.active?.id === id) this.active.controller.abort();
  }

  async drain(): Promise<void> {
    await this.active?.done;
  }
}
