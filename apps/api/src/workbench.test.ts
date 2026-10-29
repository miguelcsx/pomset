import { mkdtempSync, readFileSync, rmSync, existsSync } from "node:fs";
import { request as httpRequest } from "node:http";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterAll, beforeAll, expect, it } from "vitest";
import { schemaSet } from "@pomset/contracts";
import type { AnalysisSubmission, Job, ProgramInstanceLaunch, Scenario, AnalysisResult } from "@pomset/contracts";
import { startWorkbench } from "./main.js";
const directory = mkdtempSync(join(tmpdir(), "pomset-workbench-test-"));
const PASSWORD = "correct horse battery";
let server: Awaited<ReturnType<typeof startWorkbench>>;
let origin: string;
let capability: string;
let session: string;
let input: AnalysisSubmission;
beforeAll(async () => {
  server = await startWorkbench({ directory }); origin = new URL(server.url).origin; capability = server.capability!;
  const scenario = JSON.parse(readFileSync(resolve("../../examples/transform-floor-grid/scenario.json"), "utf8")) as Scenario;
  const files = ["kernels/transform.py", "kernels/reference.py"].map((path) => ({ path, source: readFileSync(resolve("../../examples/transform-floor-grid", path), "utf8") }));
  input = { scenario, files, profileRevisionId: server.workbench.profile.execute().profileRevisionId, solverTimeMs: 5000 };
  session = await register("author@example.test");
}, 20000);
afterAll(async () => { await server?.close(); rmSync(directory, { recursive: true, force: true }); });
/** Every `/api` call carries the local capability; the session is the account's, unless a test overrides it. */
function call(path: string, body?: unknown, headers: Record<string, string> = {}) {
  return fetch(origin + path, { method: body === undefined ? "GET" : "POST", headers: { "X-Workbench-Token": capability, Authorization: `Bearer ${session}`, Origin: origin, "Content-Type": "application/json", ...headers }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
}
async function register(email: string): Promise<string> {
  const response = await call("/api/auth/register", { email, password: PASSWORD, displayName: "Author" }, { Authorization: "" });
  expect(response.status).toBe(201);
  return (payload(await response.json()) as { token: string }).token;
}
type Report = { job: Job; analysis?: AnalysisResult; sourceFiles: Record<string, { data: string }> };
/** A successful response carries its payload under `data`, and nothing else is accepted. */
function payload(body: unknown): unknown {
  expect(body).toBeTypeOf("object");
  expect(body).toHaveProperty("data");
  return (body as { data: unknown }).data;
}
function checkedJob(raw: unknown): Job { expect(schemaSet().validatorFor("engine.schema.yaml#/$defs/job")(raw)).toBe(true); return raw as Job; }
function checkedReport(raw: unknown): Report { expect(raw).toBeTypeOf("object"); const report = raw as Report; checkedJob(report.job); if (report.analysis) expect(schemaSet().validatorFor("evidence.schema.yaml#/$defs/analysisResult")(report.analysis)).toBe(true); return report; }
async function finish(body: unknown): Promise<Report> {
  const job = checkedJob(payload(body));
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    const response = await call(`/api/analyses/${job.jobId}`); expect(response.status).toBe(200);
    const report = checkedReport(payload(await response.json()));
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
it("requires a signed-in account for every analysis operation", async () => {
  expect((await call("/api/analyses", input, { Authorization: "" })).status).toBe(401);
  expect((await call("/api/analyses/job_missing", undefined, { Authorization: "Bearer not-a-token" })).status).toBe(401);
});
it("rejects malformed declarations, traversal, invented profiles and execution authority", async () => {
  for (const body of [{ ...input, command: "python kernel.py" }, { ...input, files: [{ path: "../escape.py", source: "" }] }, { ...input, solverTimeMs: 0 }]) expect((await call("/api/analyses", body)).status).toBe(400);
  expect((await call("/api/analyses", { ...input, profileRevisionId: "prf_missing" })).status).toBe(404);
});
it("analyzes changed declarations and preserves the previous captured evidence", async () => {
  const first = await call("/api/analyses", input); expect(first.status).toBe(202);
  const before = await finish(await first.json()); expect(before.job.state).toBe("succeeded");
  expect(before.analysis?.propertyResults.find((item) => item.propertyId === "outputCoverage")?.outcome).toBe("violated");
  const scenario = structuredClone(input.scenario); const launch = scenario.launch as ProgramInstanceLaunch; const corrected = { ...scenario, launch: { ...launch, grid: [{ ...launch.grid[0]!, op: "ceilDivide" as const }] } };
  const second = await call("/api/analyses", { ...input, scenario: corrected, parentSnapshotId: before.job.snapshotId }); expect(second.status).toBe(202);
  const after = await finish(await second.json()); expect(after.job.state).toBe("succeeded");
  expect(after.analysis?.propertyResults.find((item) => item.propertyId === "outputCoverage")?.outcome).toBe("established");
  expect(after.job.snapshotId).not.toBe(before.job.snapshotId);
  expect(checkedReport(payload(await (await call(`/api/analyses/${before.job.jobId}`)).json())).analysis).toEqual(before.analysis);
}, 30000);
it("keeps an analysis private to the account that submitted it", async () => {
  const response = await call("/api/analyses", input); expect(response.status).toBe(202);
  const job = checkedJob(payload(await response.json()));
  const other = await register("neighbour@example.test");
  expect((await call(`/api/analyses/${job.jobId}`, undefined, { Authorization: `Bearer ${other}` })).status).toBe(404);
  expect((await call(`/api/analyses/${job.jobId}/cancel`, {}, { Authorization: `Bearer ${other}` })).status).toBe(404);
  await finish({ data: job });
}, 30000);
it("saves a finished analysis against a script, and only once", async () => {
  const entry = input.files.find((file) => file.path === input.scenario.entrypoint.path)!;
  const created = await call("/api/scripts", { title: "Transform floor grid", source: entry.source, scenario: input.scenario });
  expect(created.status).toBe(201);
  const script = payload(await created.json()) as { id: string };

  const submitted = await call("/api/analyses", input);
  const report = await finish(await submitted.json());
  const saved = await call(`/api/scripts/${script.id}/results`, { analysisId: report.job.jobId });
  expect(saved.status).toBe(201);
  const result = payload(await saved.json()) as { id: string };

  const listed = payload(await (await call(`/api/scripts/${script.id}/results`)).json()) as { items: unknown[]; pagination: { total: number } };
  expect(listed.pagination.total).toBe(1);
  const detail = payload(await (await call(`/api/scripts/${script.id}/results/${result.id}`)).json()) as { document: unknown };
  expect(checkedReport(detail.document).job.jobId).toBe(report.job.jobId);
  expect((await call(`/api/scripts/${script.id}/results`, { analysisId: report.job.jobId })).status).toBe(409);
});
it("never executes top-level source and preserves cancellation precedence", async () => {
  const sentinel = join(directory, "must-not-exist");
  const files = input.files.map((file) => ({ ...file, source: file.path === input.scenario.entrypoint.path ? `open(${JSON.stringify(sentinel)}, "w").write("executed")\n${file.source}` : file.source }));
  const response = await call("/api/analyses", { ...input, files }); expect(response.status).toBe(202);
  const submitted = await response.json();
  const job = checkedJob(payload(submitted));
  await call(`/api/analyses/${job.jobId}/cancel`, {});
  const report = await finish(submitted); expect(report.job.state).toBe("cancelled"); expect(existsSync(sentinel)).toBe(false);
  // Without cancellation, unsupported top-level code still must never execute.
  const next = await call("/api/analyses", { ...input, files }); expect(next.status).toBe(202);
  await finish(await next.json()); expect(existsSync(sentinel)).toBe(false);
}, 30000);

it("refuses a second supervisor for the same store", async () => {
  await expect(startWorkbench({ directory })).rejects.toThrow("Another workbench owns this store");
});
