import { mkdtempSync, readFileSync, rmSync, existsSync } from "node:fs";
import { request as httpRequest } from "node:http";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterAll, beforeAll, expect, it } from "vitest";
import { schemaSet } from "@pomset/contracts";
import type { AnalysisSubmission, Job, Scenario, AnalysisResult } from "@pomset/contracts";
import { startWorkbench } from "./main.js";
const directory = mkdtempSync(join(tmpdir(), "pomset-workbench-test-"));
let server: Awaited<ReturnType<typeof startWorkbench>>;
let origin: string;
let input: AnalysisSubmission;
beforeAll(async () => {
  server = await startWorkbench({ directory }); origin = new URL(server.url).origin;
  const scenario = JSON.parse(readFileSync(resolve("../../examples/transform-floor-grid/scenario.json"), "utf8")) as Scenario;
  const files = ["kernels/transform.py", "kernels/reference.py"].map((path) => ({ path, source: readFileSync(resolve("../../examples/transform-floor-grid", path), "utf8") }));
  input = { scenario, files, profileRevisionId: server.workbench.profile.execute().profileRevisionId, solverTimeMs: 5000 };
}, 20000);
afterAll(async () => { await server?.close(); rmSync(directory, { recursive: true, force: true }); });
function call(path: string, body?: unknown, headers: Record<string, string> = {}) {
  return fetch(origin + path, { method: body === undefined ? "GET" : "POST", headers: { Authorization: `Bearer ${server.token}`, Origin: origin, "Content-Type": "application/json", ...headers }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
}
type Report = { job: Job; analysis?: AnalysisResult; sourceFiles: Record<string, { data: string }> };
function checkedJob(raw: unknown): Job { expect(schemaSet().validatorFor("engine.schema.yaml#/$defs/job")(raw)).toBe(true); return raw as Job; }
function checkedReport(raw: unknown): Report { expect(raw).toBeTypeOf("object"); const report = raw as Report; checkedJob(report.job); if (report.analysis) expect(schemaSet().validatorFor("evidence.schema.yaml#/$defs/analysisResult")(report.analysis)).toBe(true); return report; }
async function finish(raw: unknown): Promise<Report> {
  const job = checkedJob(raw);
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    const response = await call(`/api/analyses/${job.jobId}`); expect(response.status).toBe(200);
    const report = checkedReport(await response.json());
    if (["succeeded", "failed", "cancelled"].includes(report.job.state)) return report;
    await new Promise((resolve) => setTimeout(resolve, 60));
  }
  throw new Error("Analysis did not finish within the integration test budget");
}
it("requires a capability, loopback host and same-origin writes", async () => {
  expect((await fetch(origin + "/api/workbench")).status).toBe(401);
  expect((await call("/api/workbench", undefined, { Origin: "https://attacker.test" })).status).toBe(403);
  expect((await call("/api/analyses", input, { Origin: "" })).status).toBe(403);
  const status = await new Promise<number | undefined>((resolve, reject) => { const req = httpRequest(origin + "/api/workbench", { headers: { Host: "attacker.test" } }, (res) => { res.resume(); resolve(res.statusCode); }); req.on("error", reject); req.end(); });
  expect(status).toBe(403);
});
it("rejects malformed declarations, traversal, invented profiles and execution authority", async () => {
  for (const body of [{ ...input, command: "python kernel.py" }, { ...input, files: [{ path: "../escape.py", source: "" }] }, { ...input, solverTimeMs: 0 }]) expect((await call("/api/analyses", body)).status).toBe(400);
  expect((await call("/api/analyses", { ...input, profileRevisionId: "prf_missing" })).status).toBe(404);
});
it("analyzes changed declarations and preserves the previous captured evidence", async () => {
  const first = await call("/api/analyses", input); expect(first.status).toBe(202);
  const before = await finish(await first.json()); expect(before.job.state).toBe("succeeded");
  expect(before.analysis?.propertyResults.find((item) => item.propertyId === "outputCoverage")?.outcome).toBe("violated");
  const scenario = structuredClone(input.scenario); const corrected = { ...scenario, launch: { ...scenario.launch, grid: [{ ...scenario.launch.grid[0]!, op: "ceilDivide" as const }] } };
  const second = await call("/api/analyses", { ...input, scenario: corrected, parentSnapshotId: before.job.snapshotId }); expect(second.status).toBe(202);
  const after = await finish(await second.json()); expect(after.job.state).toBe("succeeded");
  expect(after.analysis?.propertyResults.find((item) => item.propertyId === "outputCoverage")?.outcome).toBe("established");
  expect(after.job.snapshotId).not.toBe(before.job.snapshotId);
  expect(checkedReport(await (await call(`/api/analyses/${before.job.jobId}`)).json()).analysis).toEqual(before.analysis);
}, 30000);
it("never executes top-level source and preserves cancellation precedence", async () => {
  const sentinel = join(directory, "must-not-exist");
  const files = input.files.map((file) => ({ ...file, source: file.path === input.scenario.entrypoint.path ? `open(${JSON.stringify(sentinel)}, "w").write("executed")\n${file.source}` : file.source }));
  const response = await call("/api/analyses", { ...input, files }); expect(response.status).toBe(202);
  const job = checkedJob(await response.json()); await call(`/api/analyses/${job.jobId}/cancel`, {});
  const report = await finish(job); expect(report.job.state).toBe("cancelled"); expect(existsSync(sentinel)).toBe(false);
  // Without cancellation, unsupported top-level code still must never execute.
  const next = await call("/api/analyses", { ...input, files }); expect(next.status).toBe(202);
  await finish(await next.json()); expect(existsSync(sentinel)).toBe(false);
}, 30000);

it("refuses a second supervisor for the same store", async () => {
  await expect(startWorkbench({ directory })).rejects.toThrow("Another workbench owns this store");
});
