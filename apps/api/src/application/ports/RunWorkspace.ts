/**
 * The working tree one run is analysed from.
 *
 * A local workbench writes a run directory and the supervisor mounts it
 * read-only into the engine, so the engine reads its inputs from a path it was
 * given rather than from one it chose. A hosted deployment has no such
 * directory — how an engine is handed its inputs there is a different design,
 * and it belongs to the hosted platform rather than here.
 *
 * Bytes are content-addressed through `BlobStore`, not through this port.
 */

import type { Scenario } from "@pomset/contracts";

/** One piece of source or declaration captured for a run. */
export interface CapturedFile {
  readonly path: string;
  readonly source: string;
}

export interface RunWorkspace {
  /** Where one run's captured inputs live. */
  runDirectory(jobId: string): string;

  /**
   * Writes the captured files, content-addresses their bytes and creates the
   * run's scratch and artifact directories. Reads nothing outside `directory`.
   * `runScenario` is the declaration the engine is launched against; it is
   * written beside the run rather than into the manifest.
   */
  captureRun(
    directory: string,
    files: readonly CapturedFile[],
    runScenario: Scenario,
  ): void;

  /** Discards a run whose capture failed, so no half-written run is left behind. */
  removeRun(directory: string): void;
}
