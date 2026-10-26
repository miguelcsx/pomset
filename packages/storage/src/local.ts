/** Durable local lifecycle. Results and terminal state commit in one transaction. */
import { randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync, lstatSync, existsSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { schemaSet, type AnalysisResult, type ErrorRecord, type Job, type JobEvent, type JobState, type SnapshotManifest } from "@pomset/contracts";
import { processIdentity } from "./recovery.js";
import { canonicalize, sha256Of, manifestHash } from "@pomset/domain";

const transitions: Record<JobState, readonly JobState[]> = {
  queued: ["running", "failed", "cancelled"], running: ["succeeded", "failed", "cancel-requested"],
  "cancel-requested": ["cancelled"], succeeded: [], failed: [], cancelled: [],
};
const targets: Record<string, string> = {
  snapshot: "domain.schema.yaml#/$defs/snapshotManifest", scenario: "domain.schema.yaml#/$defs/scenario",
  profile: "domain.schema.yaml#/$defs/profileRevision", result: "evidence.schema.yaml#/$defs/analysisResult",
  measurement: "measurement.schema.yaml#/$defs/measurement", project: "domain.schema.yaml#/$defs/project",
};

function check(record: unknown, target: string): void {
  const validate = schemaSet().validatorFor(target);
  if (!validate(record)) throw new Error(`INPUT_INVALID: ${validate.errors?.[0]?.instancePath} ${validate.errors?.[0]?.message}`);
}

export class LocalStore {
  readonly db: DatabaseSync;
  readonly blobs: string;
  constructor(readonly directory: string) {
    mkdirSync(directory, { recursive: true, mode: 0o700 });
    this.blobs = join(directory, "blobs");
    mkdirSync(this.blobs, { recursive: true, mode: 0o700 });
    this.db = new DatabaseSync(join(directory, "metadata.sqlite"));
    this.db.exec(`PRAGMA busy_timeout=5000; PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL;
      CREATE TABLE IF NOT EXISTS records(kind TEXT NOT NULL,id TEXT NOT NULL,document TEXT NOT NULL,PRIMARY KEY(kind,id));
      CREATE TABLE IF NOT EXISTS jobs(id TEXT PRIMARY KEY,document TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS events(job_id TEXT NOT NULL,sequence INTEGER NOT NULL,document TEXT NOT NULL,PRIMARY KEY(job_id,sequence));`);
    this.db.exec("CREATE TABLE IF NOT EXISTS local_owners(job_id TEXT PRIMARY KEY,owner TEXT NOT NULL,engine TEXT)");
    this.db.exec("CREATE TABLE IF NOT EXISTS diagnostics(job_id TEXT PRIMARY KEY,document TEXT NOT NULL)");
    this.db.exec("CREATE TABLE IF NOT EXISTS engine_chunks(job_id TEXT NOT NULL,sequence INTEGER NOT NULL,document TEXT NOT NULL,PRIMARY KEY(job_id,sequence))");
  }
  close(): void { this.db.close(); }
  transaction<T>(action: () => T): T {
    this.db.exec("BEGIN IMMEDIATE");
    try { const result = action(); this.db.exec("COMMIT"); return result; }
    catch (error) { this.db.exec("ROLLBACK"); throw error; }
  }
  put(kind: string, id: string, value: unknown): void {
    const target = targets[kind];
    if (!target) throw new Error(`Unknown record kind ${kind}`);
    check(value, target);
    const field = { snapshot: "snapshotId", scenario: "scenarioId", profile: "profileRevisionId", result: "resultId", measurement: "measurementId", project: "projectId" }[kind as "snapshot" | "scenario" | "profile" | "result" | "measurement" | "project"];
    if ((value as Record<string, unknown>)[field] !== id) throw new Error("INPUT_INVALID: record identifier differs from its storage key");
    if (kind === "snapshot" && manifestHash(value as SnapshotManifest) !== (value as SnapshotManifest).manifestHash) throw new Error("INPUT_INVALID: snapshot manifest hash mismatch");
    const document = canonicalize(value);
    const previous = this.db.prepare("SELECT document FROM records WHERE kind=? AND id=?").get(kind, id);
    if (previous && previous["document"] !== document) throw new Error(`INPUT_INVALID: conflicting immutable identity ${id}`);
    this.db.prepare("INSERT OR IGNORE INTO records VALUES(?,?,?)").run(kind, id, document);
  }
  get<T>(kind: string, id: string): T | undefined {
    const row = this.db.prepare("SELECT document FROM records WHERE kind=? AND id=?").get(kind, id);
    return row ? JSON.parse(row["document"] as string) as T : undefined;
  }
  latestSnapshot(projectId: string): SnapshotManifest | undefined {
    const row = this.db.prepare("SELECT document FROM records WHERE kind='snapshot' AND json_extract(document,'$.projectId')=? ORDER BY json_extract(document,'$.createdAt') DESC,id DESC LIMIT 1").get(projectId);
    return row ? JSON.parse(row["document"] as string) as SnapshotManifest : undefined;
  }
  putBytes(bytes: Uint8Array): string {
    const hash = sha256Of(bytes);
    const path = join(this.blobs, hash.slice(7));
    if (!existsSync(path)) writeFileSync(path, bytes, { flag: "wx", mode: 0o400 });
    if (lstatSync(path).isSymbolicLink() || sha256Of(readFileSync(path)) !== hash) throw new Error("INPUT_INVALID: corrupt content-addressed blob");
    return hash;
  }
  bytes(hash: string): Buffer {
    if (!/^sha256:[a-f0-9]{64}$/.test(hash)) throw new Error("INPUT_INVALID: malformed content hash");
    const path = join(this.blobs, hash.slice(7));
    if (lstatSync(path).isSymbolicLink()) throw new Error("INPUT_INVALID: symlink blob");
    const bytes = readFileSync(path);
    if (sha256Of(bytes) !== hash) throw new Error("INPUT_INVALID: corrupt content-addressed blob");
    return bytes;
  }
  job(id: string): Job {
    const row = this.db.prepare("SELECT document FROM jobs WHERE id=?").get(id);
    if (!row) throw new Error(`INPUT_INVALID: missing job ${id}`);
    return JSON.parse(row["document"] as string) as Job;
  }
  private event(job: Job, type: JobEvent["type"], error?: ErrorRecord): void {
    const sequence = Number(this.db.prepare("SELECT COALESCE(MAX(sequence),0)+1 AS next FROM events WHERE job_id=?").get(job.jobId)?.["next"]);
    const event: JobEvent = { schemaVersion: 1, eventId: `evt_${randomUUID()}`, jobId: job.jobId,
      ...(job.attemptId ? { attemptId: job.attemptId } : {}), sequence, type, createdAt: new Date().toISOString(), ...(error ? { error } : {}) };
    this.db.prepare("INSERT INTO events VALUES(?,?,?)").run(job.jobId, sequence, canonicalize(event));
  }
  enqueue(job: Job): void {
    check(job, "engine.schema.yaml#/$defs/job");
    if (job.state !== "queued" || !job.attemptId) throw new Error("INPUT_INVALID: a new job has one attempt and starts queued");
    this.transaction(() => {
      this.db.prepare("INSERT INTO jobs VALUES(?,?)").run(job.jobId, canonicalize(job));
      this.event(job, "job.queued");
    });
  }
  private change(job: Job, state: JobState, patch: Partial<Job> = {}): Job {
    if (!transitions[job.state].includes(state)) throw new Error(`INPUT_INVALID: forbidden transition ${job.state} -> ${state}`);
    const updated: Job = { ...job, ...patch, state };
    check(updated, "engine.schema.yaml#/$defs/job");
    this.db.prepare("UPDATE jobs SET document=? WHERE id=?").run(canonicalize(updated), job.jobId);
    const type: JobEvent["type"] = state === "running" ? "job.started" : `job.${state}` as JobEvent["type"];
    this.event(updated, type, patch.failure);
    return updated;
  }
  start(id: string): Job {
    const owner = processIdentity();
    if (!owner) throw new Error("Local supervisor identity unavailable.");
    return this.transaction(() => {
      const job = this.change(this.job(id), "running", { startedAt: new Date().toISOString() });
      this.db.prepare("INSERT INTO local_owners(job_id,owner) VALUES(?,?)").run(id, canonicalize(owner));
      return job;
    });
  }
  cancel(id: string): Job {
    return this.transaction(() => {
      const job = this.job(id);
      if (["succeeded", "failed", "cancelled", "cancel-requested"].includes(job.state)) return job;
      return this.change(job, job.state === "queued" ? "cancelled" : "cancel-requested", { cancelRequestedAt: new Date().toISOString() });
    });
  }
  finish(id: string, results: readonly AnalysisResult[], failure?: ErrorRecord): Job {
    return this.transaction(() => {
      const job = this.job(id);
      const cancelled = job.state === "cancel-requested";
      const state = cancelled ? "cancelled" : failure ? "failed" : "succeeded";
      if (!transitions[job.state].includes(state)) throw new Error("INPUT_INVALID: job is already terminal or was not started");
      const resultIds = [];
      for (const result of results) {
        if (result.jobId !== job.jobId || result.attemptId !== job.attemptId || result.snapshotId !== job.snapshotId || result.scenarioId !== job.scenarioId || result.profileRevisionId !== job.profileRevisionId) throw new Error("INPUT_INVALID: result provenance mismatch");
        const committed: AnalysisResult = cancelled || failure ? { ...result, completeness: { kind: "partial", reason: cancelled ? "Cancellation recorded before completion commit." : "Attempt failed before completion commit." } } : result;
        this.put("result", result.resultId, committed);
        resultIds.push(result.resultId);
      }
      return this.change(job, state, { resultIds, finishedAt: new Date().toISOString(), ...(failure && !cancelled ? { failure } : {}) });
    });
  }
  events(id: string, after = 0): JobEvent[] {
    this.job(id);
    return this.db.prepare("SELECT document FROM events WHERE job_id=? AND sequence>? ORDER BY sequence").all(id, after).map((row) => JSON.parse(row["document"] as string) as JobEvent);
  }
  appendChunk(id: string, chunk: { readonly sequence: number; readonly type: string; readonly payload: Readonly<Record<string, unknown>> }): void {
    this.transaction(() => {
      const job = this.job(id);
      if (job.state !== "running" && job.state !== "cancel-requested") throw new Error("INPUT_INVALID: an inactive attempt cannot append evidence");
      const next = Number(this.db.prepare("SELECT COALESCE(MAX(sequence),0)+1 AS next FROM engine_chunks WHERE job_id=?").get(id)?.["next"]);
      if (chunk.sequence !== next) throw new Error("PROTOCOL_INVALID: durable chunk sequence mismatch");
      this.db.prepare("INSERT INTO engine_chunks VALUES(?,?,?)").run(id, chunk.sequence, canonicalize(chunk));
      if (chunk.type === "progress") this.event(job, "job.progress");
    });
  }
  putDiagnostics(id: string, value: { readonly redactionRevision: string; readonly messages: readonly string[]; readonly termination: string }): void {
    this.job(id);
    const document = canonicalize(value);
    const previous = this.db.prepare("SELECT document FROM diagnostics WHERE job_id=?").get(id);
    if (previous && previous["document"] !== document) throw new Error("INPUT_INVALID: diagnostics are immutable");
    this.db.prepare("INSERT OR IGNORE INTO diagnostics VALUES(?,?)").run(id, document);
  }
  diagnostics(id: string): unknown {
    this.job(id);
    const row = this.db.prepare("SELECT document FROM diagnostics WHERE job_id=?").get(id);
    return row ? JSON.parse(row["document"] as string) as unknown : undefined;
  }
  chunks(id: string): unknown[] {
    this.job(id);
    return this.db.prepare("SELECT document FROM engine_chunks WHERE job_id=? ORDER BY sequence").all(id).map((row) => JSON.parse(row["document"] as string) as unknown);
  }
}
