/** Analyze captured source bytes; portable evidence belongs to that snapshot. */
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { backendForLaunch, type AnalysisResult, type Scenario } from "@pomset/contracts";
import { DEFAULT_POLICY } from "@pomset/domain";
import { LocalStore, recoverAbandoned, recordEngineProcess } from "@pomset/storage";
import { DEFAULT_BUDGET, applyBudget, consentField, consentScopeFor, requireConsentFor, supervise } from "@pomset/engine-client";
import { capture, validated } from "../capture.js";
import { startEngine } from "../engine.js";
import { exitStatusFor, EXIT_ERROR, type Report, type ReportProperty } from "../report.js";

export interface AnalyzeOptions {
  readonly scenarioPath: string;
  readonly reportPath?: string;
  readonly jobId?: string;
  readonly profileRevisionId?: string;
  readonly solverTimeMs?: number;
  /** Consent for this invocation only; it is never read from anywhere else. */
  readonly trustLocalCode?: boolean;
  readonly signal?: AbortSignal;
}

export async function analyze(options: AnalyzeOptions): Promise<number> {
  const budget = applyBudget(options.solverTimeMs === undefined ? {} : { solverTimeMs: options.solverTimeMs });
  if (budget instanceof Error) throw budget;
  // Consent is settled before anything is created or started. The scenario's own
  // launch form says which engine would run it, and an engine that compiles and
  // executes the kernel needs the flag on this invocation to do either.
  const declared = validated<Scenario>(JSON.parse(readFileSync(resolve(options.scenarioPath), "utf8")), "domain.schema.yaml#/$defs/scenario");
  const backend = backendForLaunch(declared.launch);
  const granted = options.trustLocalCode === true;
  requireConsentFor(backend, "full", granted);
  const jobId = options.jobId ?? `job_${randomUUID()}`;
  const attemptId = `att_${randomUUID()}`;
  const root = dirname(resolve(options.scenarioPath));
  const store = new LocalStore(join(root, ".pomset"));
  const controller = new AbortController();
  const cancel = () => { store.cancel(jobId); controller.abort(); };
  try {
  recoverAbandoned(store);
  const projectPath = join(root, ".pomset", "project-id");
  const previous = existsSync(projectPath) ? store.latestSnapshot(readFileSync(projectPath, "utf8").trim()) : undefined;
  const captured = capture(resolve(options.scenarioPath), jobId, options.profileRevisionId, previous?.snapshotId);
  const { scenario, profile, snapshot, directory } = captured;
  store.put("snapshot", snapshot.snapshotId, snapshot);
  store.put("scenario", scenario.scenarioId, scenario);
  store.put("profile", profile.profileRevisionId, profile);
  for (const file of snapshot.files) store.putBytes(readFileSync(join(directory, "files", file.path)));
  store.enqueue({ schemaVersion: 1, jobId, attemptId, projectId: snapshot.projectId, snapshotId: snapshot.snapshotId,
    scenarioId: scenario.scenarioId, profileRevisionId: profile.profileRevisionId, operation: "full", domainRef: scenario.domain.domainId,
    policyId: DEFAULT_POLICY.policyId, policyRevision: DEFAULT_POLICY.policyRevision, state: "queued", createdAt: new Date().toISOString() });
  store.start(jobId);
  process.on("SIGINT", cancel);
  process.on("SIGTERM", cancel);
  options.signal?.addEventListener("abort", cancel, { once: true });
  if (options.signal?.aborted) cancel();
  const { child } = startEngine({ jobId, attemptId, operation: "full", snapshotId: snapshot.snapshotId,
    scenarioId: scenario.scenarioId, profileRevisionId: profile.profileRevisionId, domainRef: scenario.domain.domainId,
    policyId: DEFAULT_POLICY.policyId, policyRevision: DEFAULT_POLICY.policyRevision,
    inputs: [{ kind: "scenario", path: "scenario.json" }, { kind: "files", path: "files" }],
    scratchDir: "scratch", artifactDir: "artifacts", requestPath: join(directory, "request.json"), cwd: directory, budget,
    backend, consent: consentField(granted, consentScopeFor(backend)) });
  if (child.pid) recordEngineProcess(store, jobId, child.pid);
  const run = await supervise({ child, jobId, attemptId, limits: budget, signal: controller.signal, artifactDir: join(directory, "artifacts"), onChunk: (chunk) => store.appendChunk(jobId, chunk) });
  store.putDiagnostics(jobId, { redactionRevision: run.redactionRevision, messages: run.diagnostics, termination: run.termination });
  const resultChunk = run.chunks.find((chunk) => chunk.type === "result");
  const analysis = resultChunk ? validated<AnalysisResult>(resultChunk.payload, "evidence.schema.yaml#/$defs/analysisResult") : undefined;
  if (analysis && (analysis.jobId !== jobId || analysis.attemptId !== attemptId || analysis.snapshotId !== snapshot.snapshotId || analysis.scenarioId !== scenario.scenarioId || analysis.profileRevisionId !== profile.profileRevisionId)) {
    throw new Error("PROTOCOL_INVALID: result provenance differs from its request");
  }
  const properties: ReportProperty[] = (analysis?.propertyResults ?? []).map((property) => ({
    propertyId: property.propertyId, outcome: property.outcome, method: property.method, evidenceClass: property.evidenceClass,
    ...(property.unknownReason ? { unknownReason: property.unknownReason } : {}),
    ...(property.unsupportedReason ? { unsupportedReason: property.unsupportedReason } : {}),
  }));
  // A missing required result is inconclusive even if other properties passed.
  for (const propertyId of scenario.requiredProperties) {
    if (!properties.some((property) => property.propertyId === propertyId)) properties.push({ propertyId, outcome: "unknown", method: "symbolic", evidenceClass: "potential", unknownReason: "Engine produced no result for this required property." });
  }
  const failure = run.terminal === "error" ? run.error ?? { code: "ENGINE_FAILED", message: "Engine produced no terminal result." } : undefined;
  const job = store.finish(jobId, analysis ? [analysis] : [], failure as import("@pomset/contracts").ErrorRecord | undefined);
  const report: Report = {
    schemaVersion: 1, tool: { name: "@pomset/cli", version: (JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8")) as { version: string }).version },
    jobId, scenarioId: scenario.scenarioId, snapshotId: snapshot.snapshotId, profileRevisionId: profile.profileRevisionId,
    policyId: DEFAULT_POLICY.policyId, policyRevision: DEFAULT_POLICY.policyRevision, properties,
    ...(failure ? { failure } : {}),
    qualifiers: { coverage: analysis?.coverage.denominator ?? { kind: "unenumerated" },
      assumptions: [...new Set((analysis?.propertyResults ?? []).flatMap((property) => property.assumptions.items.map((item) => item.statement)))],
      budget: { ...(analysis?.budget ?? DEFAULT_BUDGET) } },
    events: run.chunks.map((chunk) => ({ sequence: chunk.sequence, type: chunk.type })),
    snapshot, scenario, profile, job, diagnostics: { redactionRevision: run.redactionRevision, messages: run.diagnostics, termination: run.termination },
    ...(analysis ? { analysis: store.get<AnalysisResult>("result", analysis.resultId)! } : {}),
    sourceFiles: Object.fromEntries(snapshot.files.map((file) => [file.path, { encoding: "base64" as const, data: store.bytes(file.sha256).toString("base64") }])),
  };
  const text = JSON.stringify(report, null, 2) + "\n";
  writeFileSync(join(directory, "report.json"), text, { mode: 0o600 });
  if (options.reportPath) writeFileSync(options.reportPath, text, { mode: 0o600 });
  else process.stdout.write(text);
  const status = job.state === "cancelled" ? EXIT_ERROR : failure ? EXIT_ERROR : exitStatusFor(properties);
  console.error(`pomset: ${properties.map((property) => `${property.propertyId}=${property.outcome}`).join(" ")}${failure ? ` (${failure.code}: ${failure.message})` : ""}`);
  return status;
  } catch (error) {
    const row = store.db.prepare("SELECT id FROM jobs WHERE id=?").get(jobId);
    if (row && ["running", "cancel-requested"].includes(store.job(jobId).state)) store.finish(jobId, [], { code: "ENGINE_FAILED", message: error instanceof Error ? error.message : String(error) });
    throw error;
  } finally {
    process.off("SIGINT", cancel);
    process.off("SIGTERM", cancel);
    options.signal?.removeEventListener("abort", cancel);
    store.close();
  }
}
