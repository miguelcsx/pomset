/** Verify portable bundle contents before any persistence or execution. */
import {
  schemaSet,
  evidenceLinkProblems,
  type AnalysisResult,
  type Scenario,
  type ExperimentBundle,
} from "@pomset/contracts";
import { canonicalize } from "./canonicalize.js";
import { sha256Of } from "./identity.js";
import { manifestHash } from "./manifest.js";
import type { SnapshotManifest } from "@pomset/contracts";

export const BUNDLE_MAX_BYTES = 268_435_456;

export function verifyBundle(
  raw: unknown,
  contents: ReadonlyMap<string, Uint8Array>,
): ExperimentBundle {
  const validate = schemaSet().validatorFor(
    "bundle.schema.yaml#/$defs/experimentBundle",
  );
  if (!validate(raw))
    throw new Error(
      `BUNDLE_INVALID: ${validate.errors?.[0]?.instancePath}: ${validate.errors?.[0]?.message}`,
    );
  const bundle = raw as ExperimentBundle;
  const { manifestHash: recorded, ...manifest } = bundle;
  if (sha256Of(canonicalize(manifest)) !== recorded)
    throw new Error("BUNDLE_INVALID: /manifestHash mismatch");
  const seen = new Set<string>();
  let total = 0;
  for (const [index, entry] of bundle.entries.entries()) {
    if (
      entry.path.split("/").some((part) => part === "." || part === "..") ||
      seen.has(entry.path)
    )
      throw new Error(
        `BUNDLE_INVALID: /entries/${index}/path duplicate or unsafe path`,
      );
    seen.add(entry.path);
    const bytes = contents.get(entry.path);
    if (
      !bytes ||
      bytes.byteLength !== entry.bytes ||
      sha256Of(bytes) !== entry.contentHash
    )
      throw new Error(
        `BUNDLE_INVALID: /entries/${index} byte count or hash mismatch`,
      );
    total += bytes.byteLength;
    if (total > BUNDLE_MAX_BYTES)
      throw new Error("BUNDLE_INVALID: payload exceeds byte limit");
  }
  if (contents.size !== seen.size)
    throw new Error("BUNDLE_INVALID: undeclared content entries");
  const schemas: Record<string, string> = {
    scenarios: "domain.schema.yaml#/$defs/scenario",
    snapshotManifests: "domain.schema.yaml#/$defs/snapshotManifest",
    results: "evidence.schema.yaml#/$defs/analysisResult",
    measurements: "measurement.schema.yaml#/$defs/measurement",
    profileRevisions: "domain.schema.yaml#/$defs/profileRevision",
    projectPath: "domain.schema.yaml#/$defs/project",
  };
  const ids = new Map<string, string>();
  const records = new Map<
    string,
    { category: string; record: Record<string, unknown> }
  >();
  for (const [category, paths] of Object.entries(bundle.documents)) {
    for (const path of typeof paths === "string" ? [paths] : paths) {
      const content = contents.get(path);
      if (!content)
        throw new Error(
          `BUNDLE_INVALID: /documents/${category} references missing content ${path}`,
        );
      let record: Record<string, unknown>;
      try {
        record = JSON.parse(Buffer.from(content).toString("utf8")) as Record<
          string,
          unknown
        >;
      } catch {
        throw new Error(
          `BUNDLE_INVALID: /documents/${category} malformed JSON ${path}`,
        );
      }
      const target = schemas[category];
      if (!target)
        throw new Error(
          `BUNDLE_INVALID: unknown document category ${category}`,
        );
      const check = schemaSet().validatorFor(target);
      if (!check(record))
        throw new Error(
          `BUNDLE_INVALID: ${path}${check.errors?.[0]?.instancePath}: ${check.errors?.[0]?.message}`,
        );
      const field = {
        scenarios: "scenarioId",
        snapshotManifests: "snapshotId",
        results: "resultId",
        measurements: "measurementId",
        profileRevisions: "profileRevisionId",
        projectPath: "projectId",
      }[category];
      const id = String(record[field as string]);
      if (ids.has(id))
        throw new Error(
          `BUNDLE_INVALID: conflicting or duplicated identity ${id}`,
        );
      ids.set(id, path);
      records.set(id, { category, record });
      if (category === "snapshotManifests") {
        const snapshot = record as unknown as SnapshotManifest;
        if (manifestHash(snapshot) !== snapshot.manifestHash)
          throw new Error(`BUNDLE_INVALID: ${path}/manifestHash mismatch`);
        for (const file of snapshot.files) {
          const bytes = contents.get(`files/${file.path}`);
          if (
            !bytes ||
            bytes.byteLength !== file.bytes ||
            sha256Of(bytes) !== file.sha256
          )
            throw new Error(
              `BUNDLE_INVALID: snapshot source ${file.path} missing or mismatched`,
            );
        }
      }
    }
  }
  for (const { category, record } of records.values()) {
    if (category === "scenarios") {
      if (
        record["snapshotId"] !== bundle.snapshotId ||
        !records.has(String(record["snapshotId"]))
      )
        throw new Error(
          "BUNDLE_INVALID: scenario snapshot missing or mismatched",
        );
    }
    if (category === "results") {
      const scenario = records.get(String(record["scenarioId"]));
      if (
        scenario?.category !== "scenarios" ||
        !records.has(String(record["profileRevisionId"]))
      )
        throw new Error("BUNDLE_INVALID: result scenario or profile missing");
      const problems = evidenceLinkProblems(
        record as unknown as AnalysisResult,
        scenario.record as unknown as Scenario,
      );
      if (problems.length)
        throw new Error(`BUNDLE_INVALID: ${problems.join("; ")}`);
    }
    if (category === "measurements") {
      const result = records.get(String(record["resultId"]));
      if (result?.category !== "results")
        throw new Error("BUNDLE_INVALID: measurement result missing");
      for (const field of ["snapshotId", "scenarioId", "profileRevisionId"]) {
        if (
          record[field] !== undefined &&
          record[field] !== result.record[field]
        )
          throw new Error(`BUNDLE_INVALID: measurement ${field} mismatch`);
      }
    }
  }
  return bundle;
}
