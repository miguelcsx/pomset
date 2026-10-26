/**
 * The local backend, in one class because locally it is one thing: SQLite
 * metadata in a single file beside a filesystem content-addressed store and the
 * run directories the supervisor mounts.
 *
 * It satisfies three ports that a hosted deployment would satisfy separately —
 * records in PostgreSQL, bytes in an object store, and no run directory at all.
 * Keeping the ports apart is what makes that deployment possible; this class is
 * only able to merge them because here they share a directory.
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

  history(): Job[] {
    return this.store.db
      .prepare("SELECT document FROM jobs ORDER BY rowid DESC LIMIT 100")
      .all()
      .map((row) => JSON.parse(String(row["document"])) as Job);
  }

  job(id: string): Job {
    return translate(() => this.store.job(id));
  }

  snapshot(id: string): SnapshotManifest {
    const value = this.store.get<SnapshotManifest>("snapshot", id);
    if (!value) throw notFound(`No snapshot ${id} in this workbench store`);
    return value;
  }

  scenario(id: string): Scenario {
    const value = this.store.get<Scenario>("scenario", id);
    if (!value) throw notFound(`No scenario ${id} in this workbench store`);
    return value;
  }

  revision(id: string): ProfileRevision {
    const value = this.store.get<ProfileRevision>("profile", id);
    if (!value) throw notFound(`No profile revision ${id} in this workbench store`);
    return value;
  }

  result(id: string): AnalysisResult | undefined {
    return this.store.get<AnalysisResult>("result", id);
  }

  record(
    snapshot: SnapshotManifest,
    scenario: Scenario,
    profile: ProfileRevision,
  ): void {
    translate(() =>
      this.store.transaction(() => {
        this.store.put("snapshot", snapshot.snapshotId, snapshot);
        this.store.put("scenario", scenario.scenarioId, scenario);
        this.store.put("profile", profile.profileRevisionId, profile);
      }),
    );
  }

  enqueue(job: Job): void {
    translate(() => this.store.enqueue(job));
  }

  cancel(id: string): void {
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
      this.putBytes(Buffer.from(file.source));
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

  bytes(hash: string): Buffer {
    return translate(() => this.store.bytes(hash));
  }

  putBytes(bytes: Uint8Array): string {
    return translate(() => this.store.putBytes(bytes));
  }
}
