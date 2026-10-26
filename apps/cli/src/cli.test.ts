import { request } from "node:http";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { analyze } from "./commands/analyze.js";
import { ROUTES, serve } from "./commands/serve.js";
import { REPO_ROOT } from "./engine.js";
import { exitStatusFor } from "./report.js";
import { runCli } from "./main.js";

const examples = join(REPO_ROOT, "examples/transform-floor-grid");
const engineReady = existsSync(join(REPO_ROOT, ".venv/bin/python"));

const sampleReport = {
  schemaVersion: 1,
  tool: { name: "pomset", version: "0.1.0" },
  jobId: "job_1",
  scenarioId: "scn_floor",
  snapshotId: "snp_1",
  profileRevisionId: "prf_triton_local_cpu",
  policyId: "pol_default",
  policyRevision: 1,
  properties: [{ propertyId: "outputCoverage", outcome: "violated", method: "symbolic", evidenceClass: "counterexample" }],
  qualifiers: { coverage: { kind: "enumerated", pointCount: 24576 }, assumptions: ["values are not modelled"], budget: {} },
  events: [{ sequence: 1, type: "hello" }],
};

describe("the report page", () => {
  it("serves the built shared workbench without embedding private report data", async () => {
    const served = await serve({ port: 0 });
    try {
      const response = await fetch(served.url);
      const html = await response.text();
      // The viewer serves the same exported client the workbench does, with the
      // client's own bundled assets and no report data inlined into it.
      expect(html).toContain('<main class="ide"');
      expect(html).toContain("/_next/static/");
      expect(html).not.toContain("job_1");
    } finally {
      await served.close();
    }
  });
});

describe("the read-only viewer", () => {
  it("exposes no route that could start work", () => {
    expect([...ROUTES]).toEqual(["/", "/api/report"]);
  });

  it("requires the local read capability for the data route", async () => {
    const dir = mkdtempSync(join(tmpdir(), "pomset-serve-"));
    const reportPath = join(dir, "report.json");
    writeFileSync(reportPath, JSON.stringify(sampleReport));
    const served = await serve({ reportPath, port: 0 });
    const port = new URL(served.url).port;
    try {
      const without = await fetch(`http://127.0.0.1:${port}/api/report`);
      expect(without.status).toBe(403);

      const withCapability = await fetch(
        `http://127.0.0.1:${port}/api/report?capability=${served.capability}`,
      );
      expect(withCapability.status).toBe(200);
      const sameOrigin = await fetch(`http://127.0.0.1:${port}/api/report?capability=${served.capability}`, { headers: { Origin: `http://127.0.0.1:${port}` } });
      expect(sameOrigin.status).toBe(200);
      const foreignOrigin = await fetch(`http://127.0.0.1:${port}/api/report?capability=${served.capability}`, { headers: { Origin: "https://evil.example" } });
      expect(foreignOrigin.status).toBe(403);
      const body = (await withCapability.json()) as { data: { jobId: string } };
      expect(body.data.jobId).toBe("job_1");

      // `fetch` refuses to send a custom Host header, so this one is a raw
      // request: the check must hold for a client that does send one.
      const foreignHost = await new Promise<number>((resolve, reject) => {
        const call = request(
          { host: "127.0.0.1", port, path: "/", headers: { Host: "evil.example" } },
          (response) => {
            response.resume();
            resolve(response.statusCode ?? 0);
          },
        );
        call.on("error", reject);
        call.end();
      });
      expect(foreignHost).toBe(403);

      const unknown = await fetch(`http://127.0.0.1:${port}/jobs`);
      expect(unknown.status).toBe(404);
    } finally {
      await served.close();
    }
  });
});

describe("the exit statuses", () => {
  it("separates a real failure from an inconclusive run", () => {
    expect(exitStatusFor([{ propertyId: "p", outcome: "established", method: "symbolic", evidenceClass: "verified-under-assumptions" }])).toBe(0);
    expect(exitStatusFor([{ propertyId: "p", outcome: "violated", method: "symbolic", evidenceClass: "counterexample" }])).toBe(1);
    expect(exitStatusFor([{ propertyId: "p", outcome: "unsupported", method: "symbolic", evidenceClass: "potential" }])).toBe(2);
    expect(exitStatusFor([{ propertyId: "p", outcome: "unknown", method: "symbolic", evidenceClass: "potential" }])).toBe(2);
  });

  it("reports an unimplemented command explicitly instead of doing nothing", async () => {
    const status = await runCli(["benchmark"]);
    expect(status).toBe(2);
  });

  it("refuses an unknown command", async () => {
    expect(await runCli(["nonsense"])).toBe(2);
  });
});

describe.skipIf(!engineReady)("analyzing the flagship fixture end to end", () => {
  it("violates on the floor-divided grid", async () => {
    const status = await analyze({ scenarioPath: join(examples, "scenario.json") });
    expect(status).toBe(1);
  });

  it("leaves the correct control silent", async () => {
    const status = await analyze({ scenarioPath: join(examples, "scenario-ceil.json") });
    expect(status).toBe(0);
  });
});

describe("the OpenMP backend", () => {
  /** A host-threads scenario, which is what makes the launch form an OpenMP one. */
  function openmpScenario(directory: string): string {
    const path = join(directory, "scenario.json");
    writeFileSync(path, JSON.stringify({
      schemaVersion: 1, scenarioId: "scn_openmp", snapshotId: "snp_openmp", name: "partial writes",
      entrypoint: { path: "kernel.c", symbol: "transform" },
      allocations: [
        { allocationId: "al_x", name: "X", role: "input", dtype: "fp32", shape: [{ op: "parameter", parameter: "N" }] },
        { allocationId: "al_y", name: "Y", role: "output", dtype: "fp32", shape: [{ op: "parameter", parameter: "N" }] },
      ],
      launch: { schedule: "dynamic" },
      domain: { domainId: "dom_openmp", enumerable: true, variables: [
        { name: "N", kind: "shape", type: "int", width: "i32", min: 64, max: 64, step: 1 }], constraints: [] },
      reference: { kind: "host-python", path: "reference.py", symbol: "reference",
        tolerances: { atol: 0.001, rtol: 0.00001, dtype: "fp32", nanPolicy: "reject-nan", infPolicy: "reject-inf" } },
      requiredProperties: ["initialization"], notes: "", createdAt: "2026-10-18T00:00:00Z",
    }), { flag: "wx" });
    writeFileSync(join(directory, "kernel.c"),
      "#include <omp.h>\nvoid transform(float *X, float *Y, int N) {\n  #pragma omp parallel for\n  for (int i = 0; i < N; ++i) if (i % 2 == 0) Y[i] = X[i] * 2.0f;\n}\n",
      { flag: "wx" });
    writeFileSync(join(directory, "reference.py"),
      "def reference(x):\n    return [value * 2.0 for value in x]\n", { flag: "wx" });
    return path;
  }

  it.skipIf(!engineReady)("refuses a scenario whose launch means compiling and running code", async () => {
    const directory = mkdtempSync(join(tmpdir(), "pomset-openmp-cli-"));
    const scenarioPath = openmpScenario(directory);
    // The launch form is what decides the backend, so a flag cannot name one the
    // scenario cannot use, and the flag is what authorizes running it.
    await expect(analyze({ scenarioPath })).rejects.toThrow("--trust-local-code");
  }, 60_000);

  it.skipIf(!engineReady)("reports an element no store reached as violated", async () => {
    const directory = mkdtempSync(join(tmpdir(), "pomset-openmp-cli-"));
    const scenarioPath = openmpScenario(directory);
    const status = await analyze({ scenarioPath, trustLocalCode: true, reportPath: join(directory, "report.json") });
    // A violation is the CLI's documented exit status for "not established".
    expect(status).toBe(1);
    const report = JSON.parse(readFileSync(join(directory, "report.json"), "utf8")) as {
      profile: { backend: string };
      analysis: { coverage: { notes: string } };
    };
    expect(report.profile.backend).toBe("openmp");
    expect(report.analysis.coverage.notes).toContain("poison");
  }, 120_000);
});
