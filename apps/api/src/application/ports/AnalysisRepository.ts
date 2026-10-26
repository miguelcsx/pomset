/**
 * The record store: the durable objects a job is made of and the job itself.
 *
 * This is the port a hosted backend can satisfy. It knows nothing about where a
 * run's files are written, how an engine is launched, or where bytes are kept —
 * a local workbench answers with SQLite and a filesystem content-addressed
 * store, and a hosted deployment answers with PostgreSQL and an object store.
 * The run workspace, which is local by nature, is a separate port.
 */

import type {
  AnalysisResult,
  Job,
  ProfileRevision,
  Scenario,
  SnapshotManifest,
} from "@pomset/contracts";

export interface AnalysisRepository {
  /** The most recent jobs this store holds, newest first. */
  history(): Job[];
  job(id: string): Job;

  snapshot(id: string): SnapshotManifest;
  scenario(id: string): Scenario;
  revision(id: string): ProfileRevision;
  result(id: string): AnalysisResult | undefined;

  /** Captures one submission's snapshot, scenario and profile, atomically. */
  record(
    snapshot: SnapshotManifest,
    scenario: Scenario,
    profile: ProfileRevision,
  ): void;

  enqueue(job: Job): void;
  cancel(id: string): void;
}
