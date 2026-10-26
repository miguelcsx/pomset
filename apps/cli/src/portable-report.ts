/** Validate portable report boundaries before comparison, export, or serving. */
import { readFileSync, statSync } from "node:fs";
import { schemaSet, evidenceLinkProblems } from "@pomset/contracts";
import { manifestHash, sha256Of, validateScenario } from "@pomset/domain";
import type { Report } from "./report.js";

export const MAX_REPORT_BYTES = 16_777_216;
export function portableReport(raw: unknown): Report {
  if (!raw || typeof raw !== "object") throw new Error("INPUT_INVALID: report must be an object");
  const record = raw as Record<string, unknown>;
  for (const [field, target] of Object.entries({
    analysis: "evidence.schema.yaml#/$defs/analysisResult", scenario: "domain.schema.yaml#/$defs/scenario",
    snapshot: "domain.schema.yaml#/$defs/snapshotManifest", profile: "domain.schema.yaml#/$defs/profileRevision",
  })) {
    const validate = schemaSet().validatorFor(target);
    if (!validate(record[field])) throw new Error(`INPUT_INVALID: ${field}${validate.errors?.[0]?.instancePath}: ${validate.errors?.[0]?.message}`);
  }
  const report = raw as Report;
  const { analysis, scenario, snapshot, profile } = report;
  if (!analysis || !scenario || !snapshot || !profile) throw new Error("INPUT_INVALID: portable records missing");
  const validScenario = validateScenario(scenario);
  if (!validScenario.ok) throw new Error("INPUT_INVALID: scenario semantics invalid");
  const problems = evidenceLinkProblems(analysis, scenario);
  if (problems.length) throw new Error(`INPUT_INVALID: ${problems.join("; ")}`);
  for (const field of ["jobId", "scenarioId", "snapshotId", "profileRevisionId", "policyId", "policyRevision"] as const) {
    if (report[field] !== analysis[field]) throw new Error(`INPUT_INVALID: report ${field} mismatch`);
  }
  if (analysis.snapshotId !== snapshot.snapshotId || analysis.profileRevisionId !== profile.profileRevisionId || manifestHash(snapshot) !== snapshot.manifestHash) throw new Error("INPUT_INVALID: portable provenance mismatch");
  if (report.job) {
    if (!schemaSet().validatorFor("engine.schema.yaml#/$defs/job")(report.job)) throw new Error("INPUT_INVALID: invalid job");
    for (const field of ["jobId", "attemptId", "snapshotId", "scenarioId", "profileRevisionId"] as const) {
      if (report.job[field] !== analysis[field]) throw new Error(`INPUT_INVALID: job ${field} mismatch`);
    }
  }
  const paths = new Set<string>();
  for (const file of snapshot.files) {
    if (paths.has(file.path)) throw new Error("INPUT_INVALID: duplicate snapshot path");
    paths.add(file.path);
    const source = report.sourceFiles?.[file.path];
    if (!source || source.encoding !== "base64" || typeof source.data !== "string") throw new Error(`INPUT_INVALID: missing source ${file.path}`);
    const bytes = Buffer.from(source.data, "base64");
    if (bytes.toString("base64") !== source.data || bytes.byteLength !== file.bytes || sha256Of(bytes) !== file.sha256) throw new Error(`INPUT_INVALID: source hash mismatch ${file.path}`);
  }
  for (const item of [...(analysis.findings ?? []), ...(analysis.events ?? []), ...(analysis.witnesses ?? [])]) {
    if ((item.sourceRanges ?? []).some((range) => !paths.has(range.path))) throw new Error("INPUT_INVALID: source range outside snapshot");
  }
  // Summaries are derived from canonical evidence, never trusted as independent claims.
  return { ...report, properties: analysis.propertyResults.map(({ propertyId, outcome, method, evidenceClass, unknownReason, unsupportedReason }) => ({
    propertyId, outcome, method, evidenceClass, ...(unknownReason ? { unknownReason } : {}), ...(unsupportedReason ? { unsupportedReason } : {}),
  })) };
}
export function readPortableReport(path: string): Report {
  if (statSync(path).size > MAX_REPORT_BYTES) throw new Error("INPUT_INVALID: report exceeds byte limit");
  const bytes = readFileSync(path);
  if (bytes.byteLength > MAX_REPORT_BYTES) throw new Error("INPUT_INVALID: report exceeds byte limit");
  return portableReport(JSON.parse(bytes.toString("utf8")));
}
