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

import type { EngineRequest, ProfileRevision } from "@pomset/contracts";
import { buildEngineRequest } from "./request.js";
import { launchEngine } from "./launch.js";
import type { Budget } from "./request.js";

/** The operations the contract admits, and the inputs a request may map. */
export type Operation = EngineRequest["operation"];
export type MappedInput = EngineRequest["inputs"][number];

/** A backend the contract names; which of them this deployment can run is below. */
export type Backend = ProfileRevision["backend"];

/** The repository root, resolved from this module's own location. */
export const REPO_ROOT = fileURLToPath(new URL("../../../", import.meta.url));

export interface EngineSelection {
  readonly executable: string;
  readonly args: readonly string[];
  readonly cwd: string;
}

interface EngineLocation {
  readonly module: string;
  readonly directory: string;
  /** The environment variable an operator may point at another interpreter. */
  readonly override: string;
}

/**
 * Which engine each backend runs as, in this deployment.
 *
 * A backend absent from this table has no local engine: the contract names CUDA
 * because the product specifies it, not because this machine can run it.
 */
const ENGINES: Readonly<Record<string, EngineLocation>> = {
  triton: {
    module: "pomset_triton",
    directory: "engines/triton",
    override: "POMSET_TRITON_PYTHON",
  },
  openmp: {
    module: "pomset_openmp",
    directory: "engines/openmp",
    override: "POMSET_OPENMP_PYTHON",
  },
};

/**
 * The local engine for one backend. The pinned environment's interpreter is
 * preferred because it already carries the installed engines; an operator may
 * point elsewhere with the backend's own override variable.
 */
export function selectEngine(backend: Backend = "triton"): EngineSelection {
  const engine = ENGINES[backend];
  if (!engine) {
    throw new Error(
      `ENGINE_FAILED: this deployment runs no local engine for the ${backend} backend`,
    );
  }
  const override = process.env[engine.override];
  if (override) {
    return {
      executable: override,
      args: ["-m", engine.module],
      cwd: join(REPO_ROOT, engine.directory),
    };
  }
  const venvPython = join(REPO_ROOT, ".venv/bin/python");
  if (!existsSync(venvPython)) {
    throw new Error(
      `the pinned engine environment is missing; run \`uv sync --frozen\` first, or set ${engine.override}`,
    );
  }
  return {
    executable: venvPython,
    args: ["-m", engine.module],
    cwd: join(REPO_ROOT, engine.directory),
  };
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
  readonly backend?: Backend;
  readonly consent?: EngineRequest["consent"];
}): SpawnedEngine {
  const selection = selectEngine(options.backend ?? "triton");
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
    ...(options.consent ? { consent: options.consent } : {}),
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
