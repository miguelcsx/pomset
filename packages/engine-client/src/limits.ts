/**
 * Resource limits.
 *
 * Wall clock, memory, per-message size, output size and artifact size are
 * enforced by the supervisor, over the **whole process tree** rather than the
 * direct child alone. A breach fails the job with the limit and the observed
 * value named.
 *
 * Solver-budget exhaustion is deliberately not handled here: it is a different
 * event that produces an unknown property result, not a failure. Nothing in this
 * module can turn "the solver ran out of road" into "the process did too much".
 */

import { execFileSync } from "node:child_process";
import type { ChildProcess } from "node:child_process";

import { errorRecord, type ErrorRecord } from "./errors.js";

export interface Limits {
  readonly engineWallTimeMs: number;
  readonly memoryBytes: number;
  readonly maxMessageBytes: number;
  readonly maxOutputBytes: number;
  readonly maxArtifactBytes: number;
}

export class LimitBreach extends Error {
  readonly record: ErrorRecord;
  constructor(limit: string, observed: number, allowed: number) {
    super(`engine exceeded the ${limit} limit: observed ${observed}, allowed ${allowed}`);
    this.name = "LimitBreach";
    this.record = errorRecord("ENGINE_FAILED", this.message, { limit, observed, allowed });
  }
}

/** Sums resident memory over every process in the child's group, in bytes. */
export function processTreeMemoryBytes(child: ChildProcess): number {
  if (child.pid === undefined) return 0;
  try {
    // Explicit PGID matching works on both Darwin and Linux; -g has different
    // selection semantics on those platforms.
    const output = execFileSync("ps", ["-axo", "pgid=,rss="], {
      encoding: "utf8",
    });
    const kilobytes = output
      .split("\n")
      .map((line) => line.trim().split(/\s+/).map(Number))
      .filter(([group]) => group === child.pid)
      .map(([, rss]) => rss ?? 0)
      .filter((value) => Number.isFinite(value))
      .reduce((total, value) => total + value, 0);
    return kilobytes * 1024;
  } catch {
    throw new LimitBreach("memoryMonitoringUnavailable", 1, 0);
  }
}

export interface LimitWatcher {
  stop(): void;
  /** Throws the recorded breach when the wall-clock limit has been passed. */
  checkWallClock(): void;
  /** Throws the recorded breach when the tree's memory has been passed. */
  checkMemory(): void;
  /** Counts one produced byte against the output limit. */
  countOutput(bytes: number): void;
  /** Counts one artifact byte against the artifact limit. */
  countArtifact(bytes: number): void;
  /** The output bytes seen so far. */
  readonly outputBytes: number;
}

/**
 * Watches a running engine. The caller decides when to poll: memory is sampled
 * rather than continuously measured, because reading it is a subprocess.
 */
export function watchLimits(child: ChildProcess, limits: Limits): LimitWatcher {
  const startedAt = Date.now();
  let outputBytes = 0;
  let artifactBytes = 0;
  let stopped = false;

  return {
    stop() {
      stopped = true;
    },
    get outputBytes() {
      return outputBytes;
    },
    checkWallClock() {
      if (stopped) return;
      const elapsed = Date.now() - startedAt;
      if (elapsed > limits.engineWallTimeMs) {
        throw new LimitBreach("engineWallTimeMs", elapsed, limits.engineWallTimeMs);
      }
    },
    checkMemory() {
      if (stopped) return;
      const observed = processTreeMemoryBytes(child);
      if (observed > limits.memoryBytes) {
        throw new LimitBreach("memoryBytes", observed, limits.memoryBytes);
      }
    },
    countOutput(bytes) {
      outputBytes += bytes;
      if (outputBytes > limits.maxOutputBytes) {
        throw new LimitBreach("maxOutputBytes", outputBytes, limits.maxOutputBytes);
      }
    },
    countArtifact(bytes) {
      artifactBytes += bytes;
      if (artifactBytes > limits.maxArtifactBytes) {
        throw new LimitBreach("maxArtifactBytes", artifactBytes, limits.maxArtifactBytes);
      }
    },
  };
}
