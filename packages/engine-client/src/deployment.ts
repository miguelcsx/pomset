/**
 * Where the engine lives and how it is started.
 *
 * The deployment selects the executable; nothing a scenario or a manifest
 * supplies is authority. In this local profile the engine is the interpreter of
 * the pinned environment that `uv sync` created, launched by a fixed argv
 * vector, so no shell is involved and no metacharacter is interpreted.
 */

import { existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import type { EngineRequest } from "@pomset/contracts";
import { buildEngineRequest } from "./request.js";
import { launchEngine } from "./launch.js";
import type { Budget } from "./request.js";

/** The operations the contract admits, and the inputs a request may map. */
export type Operation = EngineRequest["operation"];
export type MappedInput = EngineRequest["inputs"][number];

/** The repository root, resolved from this module's own location. */
export const REPO_ROOT = fileURLToPath(new URL("../../../", import.meta.url));

export interface EngineSelection {
  readonly executable: string;
  readonly args: readonly string[];
  readonly cwd: string;
}

/**
 * The local Triton engine. The pinned environment's interpreter is preferred
 * because it already carries the solver and the engine package; an operator may
 * point elsewhere with `POMSET_TRITON_PYTHON`.
 */
export function selectEngine(): EngineSelection {
  const override = process.env["POMSET_TRITON_PYTHON"];
  if (override) {
    return { executable: override, args: ["-m", "pomset_triton"], cwd: join(REPO_ROOT, "engines/triton") };
  }
  const venvPython = join(REPO_ROOT, ".venv/bin/python");
  if (!existsSync(venvPython)) {
    throw new Error(
      "the pinned engine environment is missing; run `uv sync --frozen` first, or set POMSET_TRITON_PYTHON",
    );
  }
  return { executable: venvPython, args: ["-m", "pomset_triton"], cwd: join(REPO_ROOT, "engines/triton") };
}

export interface SpawnedEngine {
  readonly child: ReturnType<typeof launchEngine>["child"];
  readonly requestPath: string;
}

/** Builds the request and starts the engine for one job. */
export function startEngine(options: {
  readonly jobId: string;
  readonly attemptId: string;
  readonly operation: Operation;
  readonly snapshotId: string;
  readonly scenarioId: string;
  readonly profileRevisionId: string;
  readonly domainRef: string;
  readonly inputs: readonly MappedInput[];
  readonly scratchDir: string;
  readonly artifactDir: string;
  readonly requestPath: string;
  readonly budget?: Partial<Budget>;
  readonly cwd?: string;
  readonly policyId?: string;
  readonly policyRevision?: number;
}): SpawnedEngine {
  const selection = selectEngine();
  const request = buildEngineRequest({
    jobId: options.jobId,
    attemptId: options.attemptId,
    operation: options.operation,
    snapshotId: options.snapshotId,
    scenarioId: options.scenarioId,
    profileRevisionId: options.profileRevisionId,
    domainRef: options.domainRef,
    ...(options.policyId ? { policyId: options.policyId } : {}),
    ...(options.policyRevision ? { policyRevision: options.policyRevision } : {}),
    inputs: options.inputs,
    scratchDir: options.scratchDir,
    ...(options.artifactDir ? { artifactDir: options.artifactDir } : {}),
    ...(options.budget ? { budget: options.budget } : {}),
  });
  const { child, requestPath } = launchEngine({
    executable: selection.executable,
    args: selection.args,
    request,
    requestPath: options.requestPath,
    cwd: options.cwd ?? selection.cwd,
  });
  return { child, requestPath };
}
