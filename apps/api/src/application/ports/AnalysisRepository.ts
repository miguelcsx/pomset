/**
 * The record store: the durable objects a job is made of and the job itself.
 *
 * This is the port a hosted backend can satisfy. It knows nothing about where a
 * run's files are written, how an engine is launched, or where bytes are kept —
 * a local workbench answers with SQLite and a filesystem content-addressed
 * store, and a hosted deployment answers with PostgreSQL and an object store.
 *
 * It is asynchronous, and that is not incidental: a store reached over a socket
 * cannot answer in the same turn, and a port that pretends otherwise could only
 * ever have one implementation. The local backend is free to be synchronous
 * underneath.
 */

import type {
  AnalysisResult,
  Job,
  ProfileRevision,
  Scenario,
  SnapshotManifest,
} from "@pomset/contracts";

export interface AnalysisRepository {
  job(id: string): Promise<Job>;

  snapshot(id: string): Promise<SnapshotManifest>;
  scenario(id: string): Promise<Scenario>;
  revision(id: string): Promise<ProfileRevision>;
  result(id: string): Promise<AnalysisResult | undefined>;

  /** Captures one submission's snapshot, scenario and profile, atomically. */
  record(
    snapshot: SnapshotManifest,
    scenario: Scenario,
    profile: ProfileRevision,
  ): Promise<void>;

  enqueue(job: Job): Promise<void>;
  cancel(id: string): Promise<void>;
}
