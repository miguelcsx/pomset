/**
 * Input mounting.
 *
 * The engine sees exactly the files it was granted: each immutable input is
 * materialized at a supervisor-chosen path and exposed read-only, and one
 * bounded writable scratch directory and one artifact directory sit under a
 * supervisor-owned root. A request that names an input which does not resolve is
 * refused before any process starts, and no path an uploaded scenario supplies is
 * ever authority — writing outside the two writable roots is denied by the
 * configuration, not by convention.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { isAbsolute, join, normalize } from "node:path";

import { inputInvalid, type Rejection } from "./errors.js";

export interface InputReference {
  readonly kind: string;
  /** The path as it appears inside the sandbox, never a host path. */
  readonly path: string;
  readonly sha256?: string;
}

export interface MountPlan {
  /** Read-only inputs, at the paths the request will name. */
  readonly inputs: readonly InputReference[];
  readonly scratchDir: string;
  readonly artifactDir: string;
  readonly readOnlyPaths: readonly string[];
}

/** True for a path that stays inside its root and is not absolute. */
export function isContainedPath(path: string, root: string): boolean {
  if (isAbsolute(path)) return false;
  const normalized = normalize(path);
  if (normalized.startsWith("..")) return false;
  const target = normalize(join(root, normalized));
  return target === root || target.startsWith(`${root}/`);
}

/**
 * Builds the mount plan. Inputs are addressed by the paths they will have inside
 * the sandbox; the supervisor is the only thing that knows where they came from.
 */
export function buildMountPlan(options: {
  readonly inputs: readonly InputReference[];
  readonly scratchDir: string;
  readonly artifactDir: string;
}): MountPlan | Rejection[] {
  const rejections: Rejection[] = [];
  if (options.inputs.length === 0) {
    rejections.push(inputInvalid("/inputs", "an engine request maps at least one input"));
  }
  const seen = new Set<string>();
  for (const [index, input] of options.inputs.entries()) {
    if (isAbsolute(input.path) || !isContainedPath(input.path, "/")) {
      rejections.push(
        inputInvalid(`/inputs/${index}/path`, "an input path is relative and stays inside the sandbox", {
          path: input.path,
        }),
      );
    }
    if (seen.has(input.path)) {
      rejections.push(inputInvalid(`/inputs/${index}/path`, `duplicate input path ${input.path}`));
    }
    seen.add(input.path);
  }
  if (rejections.length > 0) return rejections;
  return {
    inputs: options.inputs,
    scratchDir: options.scratchDir,
    artifactDir: options.artifactDir,
    readOnlyPaths: options.inputs.map((input) => input.path),
  };
}

/**
 * Writes the request into a read-only file. The file mode is the enforcement:
 * the child can read it and cannot rewrite it, so the request it launched with
 * is the request it keeps.
 */
export function writeRequestFile(path: string, request: unknown): void {
  mkdirSync(join(path, ".."), { recursive: true });
  writeFileSync(path, `${JSON.stringify(request, null, 2)}\n`, { mode: 0o444 });
}
