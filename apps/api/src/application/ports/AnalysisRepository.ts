/**
 * The port the use cases persist through.
 *
 * The local implementation is SQLite plus a filesystem content-addressed store;
 * the planned hosted implementation is PostgreSQL plus an object store. Neither
 * is visible above this interface, and `SqliteAnalysisRepository` is the only
 * module that knows which backend is in use.
 */

import type {
  AnalysisResult,
  Job,
  ProfileRevision,
  Scenario,
  SnapshotManifest,
} from "@pomset/contracts";

/** One piece of source or declaration captured for a run. */
export interface CapturedFile {
  readonly path: string;
  readonly source: string;
}

export interface AnalysisRepository {
  history(): Job[];
  job(id: string): Job;
  snapshot(id: string): SnapshotManifest;
  scenario(id: string): Scenario;
  revision(id: string): ProfileRevision;
  result(id: string): AnalysisResult | undefined;

  /** Reads back the bytes captured for a content hash. */
  bytes(hash: string): Buffer;

  /** Where one run's captured inputs live. */
  runDirectory(jobId: string): string;

  /**
   * Writes the captured files, content-addresses their bytes and creates the
   * run's scratch and artifact directories. Reads nothing outside `directory`.
   * `runScenario` is the declaration the engine is launched against; it is
   * written beside the run rather than into the manifest, exactly as the source
   * files are not rewritten.
   */
  captureRun(
    directory: string,
    files: readonly CapturedFile[],
    runScenario: Scenario,
  ): void;

  /** Discards a run whose capture failed, so no half-written run is left behind. */
  removeRun(directory: string): void;

  /** Persists one submission's snapshot, scenario and profile in one transaction. */
  record(
    snapshot: SnapshotManifest,
    scenario: Scenario,
    profile: ProfileRevision,
  ): void;

  enqueue(job: Job): void;
  cancel(id: string): void;
  close(): void;
}
