import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { AnalysisResult, Job } from "@pomset/contracts";
import { LocalStore } from "./local.js";
import { recoverAbandoned } from "./recovery.js";

describe("durable local crash recovery", () => {
  it("recovers a stopped supervisor, retains its evidence and cancellation precedence", () => {
    const directory = mkdtempSync(join(tmpdir(), "pomset-recovery-"));
    const result = JSON.parse(readFileSync(new URL("../../../docs/contracts/examples/analysis-result.json", import.meta.url), "utf8")) as AnalysisResult;
    const job: Job = { schemaVersion: 1, jobId: result.jobId, attemptId: result.attemptId, projectId: "prj_test", snapshotId: result.snapshotId, scenarioId: result.scenarioId, profileRevisionId: result.profileRevisionId, state: "queued", createdAt: new Date().toISOString() };
    const url = new URL("../dist/local.js", import.meta.url).href;
    const child = spawnSync(process.execPath, ["--input-type=module", "-e", `
      import { LocalStore } from ${JSON.stringify(url)};
      const store = new LocalStore(${JSON.stringify(directory)});
      const job = ${JSON.stringify(job)};
      store.enqueue(job); store.start(job.jobId);
      store.appendChunk(job.jobId,{sequence:1,type:"hello",payload:{engineName:"test",engineVersion:"1",capabilities:[]}});
      store.appendChunk(job.jobId,{sequence:2,type:"result",payload:${JSON.stringify(result)}});
      store.cancel(job.jobId);
      process.exit(0);
    `], { encoding: "utf8" });
    expect(child.status, child.stderr).toBe(0);
    const store = new LocalStore(directory);
    try {
      expect(recoverAbandoned(store)).toEqual([job.jobId]);
      expect(store.job(job.jobId).state).toBe("cancelled");
      expect(store.get<AnalysisResult>("result", result.resultId)?.completeness?.kind).toBe("partial");
      expect(store.chunks(job.jobId)).toHaveLength(2);
      expect(recoverAbandoned(store)).toEqual([]);
    } finally { store.close(); }
  });
  it("leaves a live supervisor running and preserves immutable diagnostics", () => {
    const store = new LocalStore(mkdtempSync(join(tmpdir(), "pomset-live-")));
    const job: Job = { schemaVersion: 1, jobId: "job_live", attemptId: "att_live", projectId: "prj_test", snapshotId: "snp_test", scenarioId: "scn_test", profileRevisionId: "prf_test", state: "queued", createdAt: new Date().toISOString() };
    try {
      store.enqueue(job); store.start(job.jobId);
      expect(recoverAbandoned(store)).toEqual([]);
      expect(store.job(job.jobId).state).toBe("running");
      const diagnostic = { redactionRevision: "2", messages: ["[REDACTED]"], termination: "exited" };
      store.putDiagnostics(job.jobId, diagnostic);
      expect(store.diagnostics(job.jobId)).toEqual(diagnostic);
      expect(() => store.putDiagnostics(job.jobId, { ...diagnostic, messages: ["changed"] })).toThrow("immutable");
    } finally { store.close(); }
  });
});
