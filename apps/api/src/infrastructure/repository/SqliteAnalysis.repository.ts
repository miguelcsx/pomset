/**
 * The local backend: SQLite metadata plus a filesystem content-addressed store.
 *
 * It implements the port the use cases persist through, so nothing above this
 * file knows which backend is in use — the hosted PostgreSQL and object-store
 * implementation is a second class behind the same interface.
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
import { LocalStore, recoverAbandoned } from "@pomset/storage";

import type {
  AnalysisRepository,
  CapturedFile,
} from "../../application/ports/AnalysisRepository.js";
import { notFound } from "../../domain/index.js";
import { claimWorkbench } from "../workbench-owner.js";
import { translate } from "./storage-errors.js";

export class SqliteAnalysisRepository implements AnalysisRepository {
  /**
   * The store is infrastructure. The composition root reads it once to build
   * the engine runner, which has to hand the same durable store to the
   * supervisor. No layer above infrastructure may touch it.
   */
  readonly store: LocalStore;

  private readonly release: () => void;

  constructor(readonly directory: string) {
    this.store = new LocalStore(directory);
    let release: () => void = () => {};
    try {
      release = claimWorkbench(this.store);
      recoverAbandoned(this.store);
      for (const row of this.store.db
        .prepare("SELECT id FROM jobs WHERE json_extract(document, '$.state')='queued'")
        .all())
        this.store.finish(String(row["id"]), [], {
          code: "ENGINE_FAILED",
          message: "Local service ended before the queued attempt started.",
        });
    } catch (error) {
      release();
      this.store.close();
      throw error;
    }
    this.release = release;
  }

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

  bytes(hash: string): Buffer {
    return translate(() => this.store.bytes(hash));
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

  close(): void {
    this.release();
    this.store.close();
  }
}
