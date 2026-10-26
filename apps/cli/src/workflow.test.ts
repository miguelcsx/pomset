import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync, symlinkSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { canonicalize, sha256Of } from "@pomset/domain";
import { LocalStore } from "@pomset/storage";
import type { AnalysisResult, ExperimentBundle } from "@pomset/contracts";
import { analyze } from "./commands/analyze.js";
import { exportBundle, importBundle } from "./commands/bundle.js";
import { compare } from "./commands/compare.js";
import { REPO_ROOT } from "./engine.js";
import type { Report } from "./report.js";
import { readPortableReport } from "./portable-report.js";
import { runCli } from "./main.js";

const engineReady = existsSync(join(REPO_ROOT, ".venv/bin/python"));
describe.skipIf(!engineReady)("portable local workflow", () => {
  it("captures immutable bytes, exports after an edit and imports without executing", async () => {
    const directory = mkdtempSync(join(tmpdir(), "pomset-workflow-"));
    mkdirSync(join(directory, "kernels"));
    const originalSource = readFileSync(join(REPO_ROOT, "examples/transform-floor-grid/kernels/transform.py"), "utf8");
    const marker = join(directory, "executed-marker");
    const capturedSource = `from pathlib import Path\nPath(${JSON.stringify(marker)}).write_text("executed")\n` + originalSource;
    writeFileSync(join(directory, "kernels/transform.py"), capturedSource);
    writeFileSync(join(directory, "kernels/reference.py"), readFileSync(join(REPO_ROOT, "examples/transform-floor-grid/kernels/reference.py")));
    const scenarioPath = join(directory, "scenario.json");
    writeFileSync(scenarioPath, readFileSync(join(REPO_ROOT, "examples/transform-floor-grid/scenario.json")));
    const reportPath = join(directory, "report.json");
    expect(await analyze({ scenarioPath, reportPath })).toBe(1);
    const report = JSON.parse(readFileSync(reportPath, "utf8")) as Report;
    expect(report.analysis?.completeness?.kind).toBe("complete");
    expect(report.job?.state).toBe("succeeded");
    expect(report.analysis?.findings?.length).toBeGreaterThan(0);
    const bundlePath = join(directory, "bundle");
    writeFileSync(join(directory, "kernels/transform.py"), "# edited after the captured run\n");
    const bundle = exportBundle(reportPath, bundlePath);
    expect(readFileSync(join(bundlePath, "files/kernels/transform.py"), "utf8")).toBe(capturedSource);
    const imported = join(directory, "imported");
    importBundle(bundlePath, imported);
    const store = new LocalStore(join(imported, ".pomset"));
    try {
      const result = store.get<AnalysisResult>("result", report.analysis!.resultId);
      expect(result?.origin).toBe("imported");
      expect(result?.snapshotId).toBe(report.snapshotId);
      for (const file of report.snapshot!.files) expect(sha256Of(store.bytes(file.sha256))).toBe(file.sha256);
      expect(bundle.published).toBe(false);
    } finally { store.close(); }
    expect(existsSync(marker)).toBe(false);
    expect(readFileSync(reportPath, "utf8")).toBe(JSON.stringify(report, null, 2) + "\n");
  });
  it("rejects an unsafe or tampered bundle before workspace creation", async () => {
    const directory = mkdtempSync(join(tmpdir(), "pomset-hostile-"));
    const reportPath = join(directory, "report.json");
    await analyze({ scenarioPath: join(REPO_ROOT, "examples/transform-floor-grid/scenario-ceil.json"), reportPath });
    const bundlePath = join(directory, "bundle");
    exportBundle(reportPath, bundlePath);
    const manifestPath = join(bundlePath, "bundle.json");
    const original = JSON.parse(readFileSync(manifestPath, "utf8")) as ExperimentBundle;
    const malicious = { ...original, entries: original.entries.map((entry, index) => index === 0 ? { ...entry, path: "../../outside" } : entry) };
    const { manifestHash: _old, ...withoutHash } = malicious;
    writeFileSync(manifestPath, JSON.stringify({ ...withoutHash, manifestHash: sha256Of(canonicalize(withoutHash)) }));
    const destination = join(directory, "should-not-exist");
    expect(() => importBundle(bundlePath, destination)).toThrow("BUNDLE_INVALID");
    expect(existsSync(destination)).toBe(false);
    writeFileSync(manifestPath, canonicalize(original));
    writeFileSync(join(bundlePath, "docs/result.json"), "{}");
    expect(() => importBundle(bundlePath, destination)).toThrow("hash mismatch");
    expect(existsSync(destination)).toBe(false);
    const entryPath = join(bundlePath, "docs/scenario.json");
    unlinkSync(entryPath);
    symlinkSync(join(bundlePath, "docs/snapshot.json"), entryPath);
    expect(() => importBundle(bundlePath, destination)).toThrow("symlink");
    expect(existsSync(destination)).toBe(false);
  });
  it("compares same-domain named snapshots and refuses domain drift", async () => {
    const directory = mkdtempSync(join(tmpdir(), "pomset-compare-"));
    const before = join(directory, "before.json"), after = join(directory, "after.json");
    await analyze({ scenarioPath: join(REPO_ROOT, "examples/transform-floor-grid/scenario.json"), reportPath: before });
    await analyze({ scenarioPath: join(REPO_ROOT, "examples/transform-floor-grid/scenario-ceil.json"), reportPath: after });
    const saved = readFileSync(before, "utf8");
    expect(compare(before, after).status).toBe(0);
    const current = JSON.parse(readFileSync(after, "utf8")) as Report;
    const changed = { ...current, scenario: { ...current.scenario, domain: { ...current.scenario!.domain, domainId: "dom_different" } } };
    writeFileSync(after, JSON.stringify(changed));
    expect(() => compare(before, after)).toThrow("scenario provenance mismatch");
    expect(readFileSync(before, "utf8")).toBe(saved);
  });
  it("retains imported measurements but removes their recommendation eligibility", async () => {
    const directory = mkdtempSync(join(tmpdir(), "pomset-measurement-import-"));
    const reportPath = join(directory, "report.json");
    await analyze({ scenarioPath: join(REPO_ROOT, "examples/transform-floor-grid/scenario-ceil.json"), reportPath });
    const report = readPortableReport(reportPath);
    const bundlePath = join(directory, "bundle");
    const bundle = exportBundle(reportPath, bundlePath);
    const fixture = JSON.parse(readFileSync(join(REPO_ROOT, "docs/contracts/examples/measurement-measured.json"), "utf8")) as Record<string, unknown>;
    const measurement = { ...fixture, resultId: report.analysis!.resultId, snapshotId: report.snapshotId, scenarioId: report.scenarioId, profileRevisionId: report.profileRevisionId };
    const bytes = Buffer.from(canonicalize(measurement));
    writeFileSync(join(bundlePath, "docs/measurement.json"), bytes);
    const { manifestHash: _hash, ...unsigned } = bundle;
    const changed = { ...unsigned, entries: [...bundle.entries, { path: "docs/measurement.json", contentHash: sha256Of(bytes), bytes: bytes.length, kind: "document", symlink: false }], documents: { ...bundle.documents, measurements: ["docs/measurement.json"] } };
    writeFileSync(join(bundlePath, "bundle.json"), canonicalize({ ...changed, manifestHash: sha256Of(canonicalize(changed)) }));
    const destination = join(directory, "imported");
    importBundle(bundlePath, destination);
    const store = new LocalStore(join(destination, ".pomset"));
    try {
      const imported = store.get<import("@pomset/contracts").Measurement>("measurement", String(fixture["measurementId"]));
      expect(imported?.origin).toBe("imported");
      expect(imported?.value).toBe(fixture["value"]);
      expect(imported?.eligibility.state).toBe("ineligible");
      expect(imported?.eligibility.reasonCodes).toContain("ORIGIN_IMPORTED");
    } finally { store.close(); }
  });
  it("does not compare a forged summary or accept inconsistent portable provenance", async () => {
    const directory = mkdtempSync(join(tmpdir(), "pomset-report-boundary-"));
    const path = join(directory, "report.json");
    await analyze({ scenarioPath: join(REPO_ROOT, "examples/transform-floor-grid/scenario.json"), reportPath: path });
    const report = JSON.parse(readFileSync(path, "utf8")) as Report;
    writeFileSync(path, JSON.stringify({ ...report, properties: report.properties.map((item) => ({ ...item, outcome: "established" })) }));
    expect(readPortableReport(path).properties.find((item) => item.propertyId === "outputCoverage")?.outcome).toBe("violated");
    writeFileSync(path, JSON.stringify({ ...report, profileRevisionId: "prf_forged" }));
    expect(() => exportBundle(path, join(directory, "bundle"))).toThrow("profileRevisionId mismatch");
  });
  it("rejects unknown flags and an explicitly requested unknown profile", async () => {
    expect(await runCli(["analyze", "--garbage"])).toBe(2);
    await expect(analyze({ scenarioPath: join(REPO_ROOT, "examples/transform-floor-grid/scenario.json"), profileRevisionId: "prf_missing" })).rejects.toThrow("PROFILE_NOT_FOUND");
  });
});
