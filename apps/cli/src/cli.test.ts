import { request } from "node:http";
import { existsSync, mkdtempSync, writeFileSync } from "node:fs";
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
      const body = (await withCapability.json()) as { jobId: string };
      expect(body.jobId).toBe("job_1");

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
