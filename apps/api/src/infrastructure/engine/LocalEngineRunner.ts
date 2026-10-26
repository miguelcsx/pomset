/**
 * Runs one analysis through the supervisor.
 *
 * The engine is a child process launched with a fixed argv vector over a
 * read-only request file, speaking JSON Lines on stdin and stdout. Limits,
 * cancellation and process-tree termination belong to the supervisor; this
 * class only connects the use case to it.
 */

import { join } from "node:path";

import type { Job, ProfileRevision } from "@pomset/contracts";
import type { LocalStore } from "@pomset/storage";
import { probeProfile, runSymbolic } from "@pomset/worker";

import type { EngineRunner } from "../../application/ports/EngineRunner.js";

export class LocalEngineRunner implements EngineRunner {
  constructor(
    private readonly store: LocalStore,
    private readonly directory: string,
  ) {}

  run(
    job: Job,
    directory: string,
    solverTimeMs: number,
    signal: AbortSignal,
  ): Promise<void> {
    return runSymbolic(this.store, job, directory, solverTimeMs, signal);
  }

  probe(): ProfileRevision {
    return probeProfile(join(this.directory, "profiles"));
  }
}
