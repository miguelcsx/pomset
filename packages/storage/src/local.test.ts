import { chmodSync, readFileSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { AnalysisResult, Job } from "@pomset/contracts";
import { LocalStore } from "./local.js";

function setup() {
  const store = new LocalStore(mkdtempSync(join(tmpdir(), "pomset-storage-")));
  const result = JSON.parse(readFileSync(new URL("../../../docs/contracts/examples/analysis-result.json", import.meta.url), "utf8")) as AnalysisResult;
  const job: Job = { schemaVersion: 1, jobId: result.jobId, attemptId: result.attemptId,
    projectId: "prj_test", snapshotId: result.snapshotId, scenarioId: result.scenarioId,
    profileRevisionId: result.profileRevisionId, state: "queued", createdAt: new Date().toISOString() };
  store.enqueue(job);
  store.start(job.jobId);
  return { store, result, job };
}

describe("transactional local persistence", () => {
  it("commits immutable results with the terminal state, even when they contain violations", () => {
    const { store, result, job } = setup();
    try {
      expect(store.finish(job.jobId, [result]).state).toBe("succeeded");
      expect(store.get("result", result.resultId)).toEqual(result);
      expect(() => store.start(job.jobId)).toThrow("forbidden transition");
      expect(() => store.put("result", result.resultId, { ...result, origin: "imported" })).toThrow("conflicting immutable identity");
    } finally { store.close(); }
  });
  it("recorded cancellation wins and retains qualified partial evidence", () => {
    const { store, result, job } = setup();
    try {
      expect(store.cancel(job.jobId).state).toBe("cancel-requested");
      expect(store.cancel(job.jobId).state).toBe("cancel-requested");
      expect(store.finish(job.jobId, [result]).state).toBe("cancelled");
      expect(store.get<AnalysisResult>("result", result.resultId)?.completeness?.kind).toBe("partial");
      expect(store.cancel(job.jobId).state).toBe("cancelled");
      const events = store.events(job.jobId);
      expect(events.map((event) => event.sequence)).toEqual(events.map((_, index) => index + 1));
      expect(store.events(job.jobId, 2)).toEqual(events.slice(2));
    } finally { store.close(); }
  });
  it("rolls back both result writes and completion if a later result is invalid", () => {
    const { store, result, job } = setup();
    try {
      expect(() => store.finish(job.jobId, [result, { ...result, resultId: "res_other", snapshotId: "snp_other" }])).toThrow("provenance mismatch");
      expect(store.job(job.jobId).state).toBe("running");
      expect(store.get("result", result.resultId)).toBeUndefined();
    } finally { store.close(); }
  });
  it("verifies content hashes on reads and prevents hash path traversal", () => {
    const { store } = setup();
    try {
      const hash = store.putBytes(Buffer.from("original bytes"));
      expect(store.bytes(hash).toString()).toBe("original bytes");
      expect(() => store.bytes("../../outside")).toThrow("malformed content hash");
      // Simulate corrupt storage using an operator-owned file.
      chmodSync(join(store.blobs, hash.slice(7)), 0o600);
      writeFileSync(join(store.blobs, hash.slice(7)), "tampered");
      expect(() => store.bytes(hash)).toThrow("corrupt content-addressed blob");
    } finally { store.close(); }
  });
});
