import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { analysisCacheKey, measurementCacheKey, sameAnalysisIdentity, type AnalysisIdentity } from "./cache-key.js";

const identity: AnalysisIdentity = {
  snapshotId: "snp_01HN3",
  scenarioId: "scn_91Bx",
  domainId: "dom_1",
  policyRevision: 3,
  modelRevision: "rev-1",
  profileRevisionId: "prf_triton_cpu_1",
};

const measurement = {
  device: "cpu",
  tool: "z3",
  toolRevision: "4.13.0",
  environment: "linux-x86_64",
  cohortId: "hw_a100_80g",
};

describe("analysis cache keys", () => {
  it("is stable for the same question", () => {
    expect(analysisCacheKey(identity)).toBe(analysisCacheKey({ ...identity }));
  });

  it("changes when any single component changes", () => {
    const base = analysisCacheKey(identity);
    const variations: Partial<AnalysisIdentity>[] = [
      { snapshotId: "snp_other" },
      { scenarioId: "scn_other" },
      { domainId: "dom_other" },
      { policyRevision: 4 },
      { modelRevision: "rev-2" },
      { profileRevisionId: "prf_other" },
    ];
    for (const variation of variations) {
      expect(analysisCacheKey({ ...identity, ...variation })).not.toBe(base);
    }
  });

  it("treats only exactly equal identities as compatible", () => {
    expect(sameAnalysisIdentity(identity, { ...identity })).toBe(true);
    expect(sameAnalysisIdentity(identity, { ...identity, policyRevision: 4 })).toBe(false);
  });
});

describe("measurement cache keys", () => {
  it("adds device and tool identity to the analysis key", () => {
    const analysis = analysisCacheKey(identity);
    expect(measurementCacheKey(identity, measurement)).not.toBe(analysis);
  });

  it("changes when device, tool revision or environment changes", () => {
    const base = measurementCacheKey(identity, measurement);
    for (const variation of [
      { device: "gpu" },
      { toolRevision: "4.14.0" },
      { environment: "darwin-arm64" },
      { cohortId: "hw_other" },
    ]) {
      expect(measurementCacheKey(identity, { ...measurement, ...variation })).not.toBe(base);
    }
  });

  it("leaves the analysis key unchanged when only the device changes", () => {
    expect(analysisCacheKey(identity)).toBe(analysisCacheKey(identity));
  });

  it("is deterministic across processes", () => {
    // A separately launched process computing the same key must agree: the key
    // has no clock, path, process identity or iteration-order input. It runs the
    // built module, so it is a genuinely separate process, not the vitest one.
    const built = fileURLToPath(new URL("../dist/cache-key.js", import.meta.url));
    const script = `import(${JSON.stringify(built)}).then((m) => process.stdout.write(m.analysisCacheKey(${JSON.stringify(identity)})));`;
    const other = execFileSync(process.execPath, ["-e", script], {
      encoding: "utf8",
      cwd: fileURLToPath(new URL("..", import.meta.url)),
    });
    expect(other).toBe(analysisCacheKey(identity));
  });
});
