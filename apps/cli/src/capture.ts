/** Capture original bytes before analysis and probe the actual installed engine. */
import { randomUUID } from "node:crypto";
import { chmodSync, existsSync, lstatSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { basename, dirname, join, relative, resolve, sep } from "node:path";
import { schemaSet, type ProfileRevision, type Scenario, type SnapshotManifest } from "@pomset/contracts";
import { buildManifest, sha256Of } from "@pomset/domain";
import { probeProfile } from "@pomset/engine-client";

export function validated<T>(raw: unknown, target: string): T {
  const check = schemaSet().validatorFor(target);
  if (!check(raw)) throw new Error(`INPUT_INVALID: ${check.errors?.[0]?.instancePath} ${check.errors?.[0]?.message}`);
  return raw as T;
}

export interface CapturedRun {
  readonly scenario: Scenario;
  readonly snapshot: SnapshotManifest;
  readonly profile: ProfileRevision;
  readonly directory: string;
}

export function capture(scenarioPath: string, jobId: string, profileId?: string, parentSnapshotId?: string): CapturedRun {
  const scenarioBytes = readFileSync(scenarioPath);
  const original = validated<Scenario>(JSON.parse(scenarioBytes.toString("utf8")), "domain.schema.yaml#/$defs/scenario");
  const root = realpathSync(dirname(scenarioPath));
  const directory = join(root, ".pomset", jobId);
  const profile = probeProfile(join(root, ".pomset", "profiles"), profileId);
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  chmodSync(join(root, ".pomset"), 0o700);
  const configPath = basename(scenarioPath);
  const paths = [original.entrypoint.path, configPath];
  if (original.reference?.path) paths.push(original.reference.path);
  const files = [...new Set(paths)].map((path) => {
    const full = resolve(root, path);
    if (relative(root, full).startsWith("..") || relative(root, full).split(sep).some((_, index, parts) => lstatSync(join(root, ...parts.slice(0, index + 1))).isSymbolicLink())) {
      throw new Error(`INPUT_INVALID: symlink or escaping snapshot path ${path}`);
    }
    const bytes = path === configPath ? scenarioBytes : readFileSync(full);
    const target = join(directory, "files", path);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, bytes, { flag: "wx", mode: 0o444 });
    return { path, role: path === configPath ? "config" as const : path === original.entrypoint.path ? "source" as const : "reference" as const,
      sha256: sha256Of(bytes), bytes: bytes.length };
  });
  const projectPath = join(root, ".pomset", "project-id");
  if (!existsSync(projectPath)) writeFileSync(projectPath, `prj_${randomUUID()}\n`, { flag: "wx", mode: 0o600 });
  const built = buildManifest({ snapshotId: `snp_${randomUUID()}`, projectId: readFileSync(projectPath, "utf8").trim(),
    createdAt: new Date().toISOString(), ...(parentSnapshotId ? { parentSnapshotId } : {}), files });
  if (!built.ok) throw new Error(built.rejections[0]?.record.message);
  const snapshot = built.value;
  const scenario: Scenario = { ...original, scenarioId: `scn_${randomUUID()}`, snapshotId: snapshot.snapshotId, createdAt: new Date().toISOString() };
  writeFileSync(join(directory, "scenario.json"), JSON.stringify(scenario, null, 2) + "\n", { flag: "wx", mode: 0o444 });
  writeFileSync(join(directory, "snapshot.json"), JSON.stringify(snapshot, null, 2) + "\n", { flag: "wx", mode: 0o444 });
  writeFileSync(join(directory, "profile.json"), JSON.stringify(profile, null, 2) + "\n", { flag: "wx", mode: 0o444 });
  mkdirSync(join(directory, "scratch"));
  mkdirSync(join(directory, "artifacts"));
  return { scenario, snapshot, profile, directory };
}

