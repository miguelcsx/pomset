/** Directory bundles are portable records and original bytes, never executable archives. */
import { randomUUID } from "node:crypto";
import { lstatSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import type { AnalysisResult, ExperimentBundle } from "@pomset/contracts";
import { BUNDLE_MAX_BYTES, canonicalize, sha256Of, verifyBundle } from "@pomset/domain";
import { LocalStore } from "@pomset/storage";
import { readPortableReport } from "../portable-report.js";

function readContained(root: string, path: string): Buffer {
  if (!/^(?!\/)(?!.*\.\.)(?!.*\\)[A-Za-z0-9._@+-]+(\/[A-Za-z0-9._@+-]+)*$/.test(path) || path.split("/").some((part) => part === ".")) throw new Error(`BUNDLE_INVALID: unsafe path ${path}`);
  let current = root;
  for (const part of path.split("/")) {
    current = join(current, part);
    if (lstatSync(current).isSymbolicLink()) throw new Error(`BUNDLE_INVALID: symlink ${path}`);
  }
  const stat = lstatSync(current);
  if (!stat.isFile() || stat.size > BUNDLE_MAX_BYTES) throw new Error(`BUNDLE_INVALID: invalid or oversized entry ${path}`);
  return readFileSync(current);
}

export function exportBundle(reportPath: string, destination: string): ExperimentBundle {
  const report = readPortableReport(reportPath);
  if (!report.snapshot || !report.scenario || !report.analysis || !report.profile) throw new Error("BUNDLE_INVALID: export requires complete portable records, not a legacy summary");
  const contents = new Map<string, Uint8Array>();
  contents.set("docs/scenario.json", Buffer.from(canonicalize(report.scenario)));
  contents.set("docs/snapshot.json", Buffer.from(canonicalize(report.snapshot)));
  contents.set("docs/result.json", Buffer.from(canonicalize(report.analysis)));
  contents.set("docs/profile.json", Buffer.from(canonicalize(report.profile)));
  // These are captured bytes, never the possibly edited working source.
  for (const file of report.snapshot.files) {
    const source = report.sourceFiles?.[file.path];
    if (!source || source.encoding !== "base64") throw new Error(`BUNDLE_INVALID: captured bytes missing for ${file.path}`);
    const bytes = Buffer.from(source.data, "base64");
    if (bytes.toString("base64") !== source.data) throw new Error(`BUNDLE_INVALID: invalid base64 for ${file.path}`);
    contents.set(`files/${file.path}`, bytes);
  }
  const manifest = {
    schemaVersion: 1 as const, bundleId: `bnd_${randomUUID()}`, createdAt: new Date().toISOString(), sourceOrigin: report.analysis.origin,
    snapshotId: report.snapshotId, scenarioId: report.scenarioId, profileRevisionIds: [report.profileRevisionId],
    entries: [...contents].map(([path, bytes]) => ({ path, contentHash: sha256Of(bytes), bytes: bytes.byteLength, kind: "document" as const, symlink: false as const })),
    documents: { scenarios: ["docs/scenario.json"], snapshotManifests: ["docs/snapshot.json"], results: ["docs/result.json"], profileRevisions: ["docs/profile.json"] },
    requiredTools: report.profile.components.map((component) => ({ name: component.name, version: component.version })),
    executable: false as const, published: false as const,
  };
  const bundle: ExperimentBundle = { ...manifest, manifestHash: sha256Of(canonicalize(manifest)) };
  verifyBundle(bundle, contents);
  const root = resolve(destination);
  // An export must not overwrite a directory or follow pre-existing links.
  mkdirSync(root, { recursive: false, mode: 0o700 });
  for (const [path, bytes] of contents) {
    mkdirSync(dirname(join(root, path)), { recursive: true, mode: 0o700 });
    writeFileSync(join(root, path), bytes, { flag: "wx", mode: 0o600 });
  }
  writeFileSync(join(root, "bundle.json"), canonicalize(bundle) + "\n", { flag: "wx", mode: 0o600 });
  return bundle;
}

export function importBundle(source: string, workspace: string): ExperimentBundle {
  const root = realpathSync(source);
  const raw = JSON.parse(readContained(root, "bundle.json").toString("utf8")) as ExperimentBundle;
  // Bound aggregate reads before constructing the complete in-memory payload.
  if (!Array.isArray(raw.entries) || raw.entries.length > 10000) throw new Error("BUNDLE_INVALID: malformed or oversized entry list");
  const contents = new Map<string, Uint8Array>();
  let total = 0;
  for (const entry of raw.entries) {
    if (typeof entry.path !== "string" || contents.has(entry.path)) throw new Error("BUNDLE_INVALID: duplicate or malformed entry path");
    const bytes = readContained(root, entry.path);
    total += bytes.byteLength;
    if (total > BUNDLE_MAX_BYTES) throw new Error("BUNDLE_INVALID: payload exceeds byte limit");
    contents.set(entry.path, bytes);
  }
  const bundle = verifyBundle(raw, contents);
  const store = new LocalStore(join(resolve(workspace), ".pomset"));
  try {
    for (const [path, bytes] of contents) if (path.startsWith("files/")) store.putBytes(bytes);
    store.transaction(() => {
      if (bundle.documents.projectPath) {
        const record = JSON.parse(Buffer.from(contents.get(bundle.documents.projectPath) as Uint8Array).toString("utf8")) as Record<string, unknown>;
        store.put("project", String(record["projectId"]), record);
      }
      const categories = { snapshotManifests: ["snapshot", "snapshotId"], scenarios: ["scenario", "scenarioId"], profileRevisions: ["profile", "profileRevisionId"], results: ["result", "resultId"], measurements: ["measurement", "measurementId"] } as const;
      for (const [category, [kind, idField]] of Object.entries(categories)) {
        const paths = bundle.documents[category as keyof typeof categories] ?? [];
        for (const path of paths) {
          const record = JSON.parse(Buffer.from(contents.get(path) as Uint8Array).toString("utf8")) as Record<string, unknown>;
          const imported = kind === "result" || kind === "measurement" ? { ...record, origin: "imported" as const } as unknown as AnalysisResult : record;
          const qualified = kind === "measurement" ? {
            ...imported,
            eligibility: { ...(record["eligibility"] as object), state: "ineligible", reasonCodes: [...new Set([...(record["eligibility"] as { reasonCodes: string[] }).reasonCodes, "ORIGIN_IMPORTED"])] },
          } : imported;
          store.put(kind, String(record[idField]), qualified);
        }
      }
    });
  } finally { store.close(); }
  return bundle;
}
