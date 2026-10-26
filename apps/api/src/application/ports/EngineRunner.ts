/**
 * The port through which the workbench runs one analysis.
 *
 * The engine is a child process speaking the line protocol, launched with a
 * fixed argv vector and a read-only request file; that boundary is owned by the
 * implementation and is invisible here. The use cases only know that a job runs
 * to completion or is aborted.
 */

import type { Job, ProfileRevision } from "@pomset/contracts";

export interface EngineRunner {
  run(
    job: Job,
    directory: string,
    solverTimeMs: number,
    signal: AbortSignal,
  ): Promise<void>;

  /** Measures the interpreter, engine and solver this workbench will actually use. */
  probe(): ProfileRevision;
}
