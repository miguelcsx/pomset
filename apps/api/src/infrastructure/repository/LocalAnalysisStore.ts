/**
 * The local backend, in one class because locally it is one thing: SQLite
 * metadata in a single file beside a filesystem content-addressed store and the
 * run directories the supervisor mounts.
 *
 * It satisfies three ports that a hosted deployment satisfies separately —
 * records in PostgreSQL, bytes in an object store, and no run directory at all.
 * Keeping the ports apart is what makes that deployment possible; this class is
 * only able to merge them because here they share a directory.
 *
 * The record and blob ports are asynchronous because a remote store must be.
 * These methods answer in the same turn; the promise is the interface, not a
 * pretence that the work is slow.
 */

import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import type {
  AnalysisResult,
  Job,
  ProfileRevision,
  Scenario,
  SnapshotManifest,
} from "@pomset/contracts";
import type { LocalStore } from "@pomset/storage";

import type { AnalysisRepository } from "../../application/ports/AnalysisRepository.js";
import type { BlobStore } from "../../application/ports/BlobStore.js";
import type { CapturedFile, RunWorkspace } from "../../application/ports/RunWorkspace.js";
import { notFound } from "../../domain/index.js";
import { translate } from "./storage-errors.js";

export class LocalAnalysisStore
  implements AnalysisRepository, RunWorkspace, BlobStore
{
  constructor(
    private readonly store: LocalStore,
    private readonly directory: string,
  ) {}

  async job(id: string): Promise<Job> {
    return translate(() => this.store.job(id));
  }

  async snapshot(id: string): Promise<SnapshotManifest> {
    const value = this.store.get<SnapshotManifest>("snapshot", id);
    if (!value) throw notFound(`No snapshot ${id} in this workbench store`);
    return value;
  }

  async scenario(id: string): Promise<Scenario> {
    const value = this.store.get<Scenario>("scenario", id);
    if (!value) throw notFound(`No scenario ${id} in this workbench store`);
    return value;
  }

  async revision(id: string): Promise<ProfileRevision> {
    const value = this.store.get<ProfileRevision>("profile", id);
    if (!value) throw notFound(`No profile revision ${id} in this workbench store`);
    return value;
  }

  async result(id: string): Promise<AnalysisResult | undefined> {
    return this.store.get<AnalysisResult>("result", id);
  }

  async record(
    snapshot: SnapshotManifest,
    scenario: Scenario,
    profile: ProfileRevision,
  ): Promise<void> {
    translate(() =>
      this.store.transaction(() => {
        this.store.put("snapshot", snapshot.snapshotId, snapshot);
        this.store.put("scenario", scenario.scenarioId, scenario);
        this.store.put("profile", profile.profileRevisionId, profile);
      }),
    );
  }

  async enqueue(job: Job): Promise<void> {
    translate(() => this.store.enqueue(job));
  }

  async cancel(id: string): Promise<void> {
    translate(() => this.store.cancel(id));
  }

  runDirectory(jobId: string): string {
    return join(this.directory, "runs", jobId);
  }

  captureRun(
    directory: string,
    files: readonly CapturedFile[],
    runScenario: Scenario,
  ): void {
    for (const file of files) {
      const path = join(directory, "files", file.path);
      mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
      writeFileSync(path, file.source, { flag: "wx", mode: 0o444 });
      translate(() => this.store.putBytes(Buffer.from(file.source)));
    }
    for (const name of ["scratch", "artifacts"]) mkdirSync(join(directory, name));
    writeFileSync(join(directory, "scenario.json"), JSON.stringify(runScenario), {
      flag: "wx",
      mode: 0o444,
    });
  }

  removeRun(directory: string): void {
    rmSync(directory, { recursive: true, force: true });
  }

  async bytes(hash: string): Promise<Buffer> {
    return translate(() => this.store.bytes(hash));
  }

  async putBytes(bytes: Uint8Array): Promise<string> {
    return translate(() => this.store.putBytes(bytes));
  }
}
