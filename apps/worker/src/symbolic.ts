/** Static/symbolic jobs only: source is parsed, never imported or executed. */
import { join } from "node:path";
import { rmSync } from "node:fs";
import { schemaSet, evidenceLinkProblems, type Scenario, type AnalysisResult, type ErrorRecord, type Job } from "@pomset/contracts";
import { LocalStore, recordEngineProcess } from "@pomset/storage";
import { startEngine, supervise, applyBudget } from "@pomset/engine-client";
export { probeProfile, REPO_ROOT } from "@pomset/engine-client";

export async function runSymbolic(store: LocalStore, job: Job, directory: string, solverTimeMs: number, signal: AbortSignal): Promise<void> {
  try {
    if (store.job(job.jobId).state === "cancelled") return;
    if (!job.attemptId || !job.domainRef || !job.policyId || job.policyRevision === undefined) throw new Error("Job is missing its attempt or domain identity");
    store.start(job.jobId);
    const budget = applyBudget({ solverTimeMs });
    if (budget instanceof Error) throw budget;
    const { child } = startEngine({ jobId: job.jobId, attemptId: job.attemptId, operation: "full",
      snapshotId: job.snapshotId, scenarioId: job.scenarioId, profileRevisionId: job.profileRevisionId, domainRef: job.domainRef,
      policyId: job.policyId, policyRevision: job.policyRevision, budget,
      inputs: [{ kind: "scenario", path: "scenario.json" }, { kind: "files", path: "files" }],
      scratchDir: "scratch", artifactDir: "artifacts", requestPath: join(directory, "request.json"), cwd: directory });
    if (child.pid) recordEngineProcess(store, job.jobId, child.pid);
    const run = await supervise({ child, jobId: job.jobId, attemptId: job.attemptId, limits: budget, signal,
      artifactDir: join(directory, "artifacts"), onChunk: (chunk) => store.appendChunk(job.jobId, chunk) });
    store.putDiagnostics(job.jobId, { redactionRevision: run.redactionRevision, messages: run.diagnostics, termination: run.termination });
    const raw = run.chunks.find((chunk) => chunk.type === "result")?.payload;
    let result: AnalysisResult | undefined;
    if (raw) {
      if (!schemaSet().validatorFor("evidence.schema.yaml#/$defs/analysisResult")(raw)) throw new Error("PROTOCOL_INVALID: invalid analysis record");
      result = raw as unknown as AnalysisResult;
      const scenario = store.get<Scenario>("scenario", job.scenarioId);
      if (!scenario || result.domain.domainId !== job.domainRef || evidenceLinkProblems(result, scenario).length) throw new Error("PROTOCOL_INVALID: evidence links do not match the captured scenario");
      for (const field of ["jobId", "attemptId", "snapshotId", "scenarioId", "profileRevisionId", "policyId", "policyRevision"] as const) if (result[field] !== job[field]) throw new Error(`PROTOCOL_INVALID: mismatched ${field}`);
    }
    const failure = run.terminal === "error" ? run.error ?? { code: "ENGINE_FAILED", message: "Engine produced no terminal result." } : undefined;
    store.finish(job.jobId, result ? [result] : [], failure as ErrorRecord | undefined);
  } catch (error) {
    if (["running", "cancel-requested", "queued"].includes(store.job(job.jobId).state)) store.finish(job.jobId, [], { code: "ENGINE_FAILED", message: error instanceof Error ? error.message : String(error) });
  } finally { rmSync(directory, { recursive: true, force: true }); }
}
