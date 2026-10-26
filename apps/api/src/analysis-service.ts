/** Durable, bounded single-owner analysis for the explicitly launched loopback workbench. */
import { randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import {
  schemaSet,
  type AnalysisSubmission,
  type AnalysisResult,
  type Job,
  type Scenario,
  type SnapshotManifest,
  type ProfileRevision,
} from "@pomset/contracts";
import {
  DEFAULT_POLICY,
  buildManifest,
  canonicalize,
  evaluateEligibility,
  sha256Of,
  validateScenario,
} from "@pomset/domain";
import { LocalStore, recoverAbandoned } from "@pomset/storage";
import { probeProfile, runSymbolic } from "@pomset/worker";
import { claimWorkbench } from "./workbench-owner.js";
const uid = (prefix: string) => `${prefix}_${randomUUID()}`;
export class AnalysisService {
  readonly store: LocalStore;
  private active:
    | { id: string; controller: AbortController; done: Promise<void> }
    | undefined;
  private release: () => void = () => {};
  constructor(readonly directory: string) {
    this.store = new LocalStore(directory);
    try {
      this.release = claimWorkbench(this.store);
      recoverAbandoned(this.store);
      for (const row of this.store.db.prepare("SELECT id FROM jobs WHERE json_extract(document, '$.state')='queued'").all()) this.store.finish(String(row["id"]), [], { code: "ENGINE_FAILED", message: "Local service ended before the queued attempt started." });
    } catch (error) { this.release(); this.store.close(); throw error; }
  }
  profile(): ProfileRevision {
    return probeProfile(join(this.directory, "profiles"));
  }
  submit(raw: unknown): Job {
    if (this.active)
      throw new Error(
        "INPUT_INVALID: An analysis is already running. Cancel it or wait before starting another.",
      );
    const check = schemaSet().validatorFor(
      "domain.schema.yaml#/$defs/analysisSubmission",
    );
    if (!check(raw))
      throw new Error(
        `INPUT_INVALID: ${check.errors?.[0]?.instancePath} ${check.errors?.[0]?.message}`,
      );
    const input = raw as AnalysisSubmission;
    const profile = this.profile();
    if (input.profileRevisionId !== profile.profileRevisionId)
      throw new Error(`PROFILE_NOT_FOUND: ${input.profileRevisionId}`);
    const validation = validateScenario(input.scenario);
    if (!validation.ok)
      throw new Error(
        `INPUT_INVALID: ${validation.rejections.map((item) => item.record.message).join("; ")}`,
      );
    const paths = new Set<string>();
    for (const file of input.files) {
      if (paths.has(file.path) || file.path.split("/").includes("."))
        throw new Error(
          `INPUT_INVALID: Duplicate or invalid source path ${file.path}`,
        );
      if (Buffer.byteLength(file.source) > 1_048_576)
        throw new Error("INPUT_INVALID: Source exceeds one megabyte");
      paths.add(file.path);
    }
    if (
      !paths.has(input.scenario.entrypoint.path) ||
      (input.scenario.reference?.path &&
        !paths.has(input.scenario.reference.path))
    )
      throw new Error(
        "INPUT_INVALID: Entry point or reference is missing from working files",
      );
    const parent = input.parentSnapshotId
      ? this.store.get<SnapshotManifest>("snapshot", input.parentSnapshotId)
      : undefined;
    if (input.parentSnapshotId && !parent)
      throw new Error(
        "INPUT_INVALID: Parent snapshot is not in this workbench store",
      );
    const now = new Date().toISOString();
    const snapshotId = uid("snp");
    const { domainId: _domainId, ...domainContent } = input.scenario.domain;
    const scenario: Scenario = {
      ...input.scenario,
      snapshotId,
      scenarioId: uid("scn"),
      domain: {
        ...input.scenario.domain,
        domainId: `dom_${sha256Of(canonicalize(domainContent)).slice(7)}`,
      },
      createdAt: now,
    };
    // Capture exactly the source and declaration that this job consumes.
    let configPath = "pomset-scenario.json";
    while (paths.has(configPath))
      configPath = `pomset-scenario-${randomUUID()}.json`;
    const files = [
      ...input.files,
      { path: configPath, source: JSON.stringify(scenario, null, 2) + "\n" },
    ];
    const manifest = buildManifest({
      snapshotId,
      projectId: parent?.projectId ?? uid("prj"),
      createdAt: now,
      ...(parent ? { parentSnapshotId: parent.snapshotId } : {}),
      files: files.map((file) => ({
        path: file.path,
        role:
          file.path === configPath
            ? "config"
            : file.path === scenario.reference?.path
              ? "reference"
              : "source",
        sha256: sha256Of(file.source),
        bytes: Buffer.byteLength(file.source),
      })),
    });
    if (!manifest.ok)
      throw new Error(
        `INPUT_INVALID: ${manifest.rejections[0]?.record.message}`,
      );
    const job: Job = {
      schemaVersion: 1,
      jobId: uid("job"),
      attemptId: uid("att"),
      projectId: manifest.value.projectId,
      snapshotId,
      scenarioId: scenario.scenarioId,
      profileRevisionId: profile.profileRevisionId,
      operation: "full",
      domainRef: scenario.domain.domainId,
      policyId: DEFAULT_POLICY.policyId,
      policyRevision: DEFAULT_POLICY.policyRevision,
      state: "queued",
      createdAt: now,
    };
    const directory = join(this.directory, "runs", job.jobId);
    try {
      for (const file of files) {
        const path = join(directory, "files", file.path);
        mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
        writeFileSync(path, file.source, { flag: "wx", mode: 0o444 });
        this.store.putBytes(Buffer.from(file.source));
      }
      for (const name of ["scratch", "artifacts"])
        mkdirSync(join(directory, name));
      writeFileSync(
        join(directory, "scenario.json"),
        JSON.stringify(scenario),
        { flag: "wx", mode: 0o444 },
      );
      this.store.transaction(() => {
        this.store.put("snapshot", snapshotId, manifest.value);
        this.store.put("scenario", scenario.scenarioId, scenario);
        this.store.put("profile", profile.profileRevisionId, profile);
      });
      this.store.enqueue(job);
    } catch (error) {
      rmSync(directory, { recursive: true, force: true });
      throw error;
    }
    const controller = new AbortController();
    const done = Promise.resolve()
      .then(() =>
        runSymbolic(
          this.store,
          job,
          directory,
          input.solverTimeMs,
          controller.signal,
        ),
      )
      .finally(() => {
        this.active = undefined;
      });
    this.active = { id: job.jobId, controller, done };
    return job;
  }
  cancel(id: string): Job {
    this.store.cancel(id);
    if (this.active?.id === id) this.active.controller.abort();
    return this.store.job(id);
  }
  history(): Job[] {
    return this.store.db
      .prepare("SELECT document FROM jobs ORDER BY rowid DESC LIMIT 100")
      .all()
      .map((row) => JSON.parse(String(row["document"])) as Job);
  }
  report(id: string): Record<string, unknown> {
    const job = this.store.job(id);
    const snapshot = this.store.get<SnapshotManifest>(
      "snapshot",
      job.snapshotId,
    )!;
    const scenario = this.store.get<Scenario>("scenario", job.scenarioId)!;
    const profile = this.store.get<ProfileRevision>(
      "profile",
      job.profileRevisionId,
    )!;
    const analysis = job.resultIds?.[0]
      ? this.store.get<AnalysisResult>("result", job.resultIds[0])
      : undefined;
    return {
      schemaVersion: 1,
      job,
      snapshot,
      scenario,
      profile,
      ...(analysis
        ? { analysis, eligibility: evaluateEligibility(analysis, scenario) }
        : {}),
      sourceFiles: Object.fromEntries(
        snapshot.files.map((file) => [
          file.path,
          {
            encoding: "base64",
            data: this.store.bytes(file.sha256).toString("base64"),
          },
        ]),
      ),
    };
  }
  async close(): Promise<void> {
    if (this.active) {
      this.cancel(this.active.id);
      await this.active.done;
    }
    this.release();
    this.store.close();
  }
}
