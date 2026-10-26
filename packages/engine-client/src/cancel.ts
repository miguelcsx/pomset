/**
 * Cooperative cancellation with a bounded termination.
 *
 * The supervisor sends `cancel` on stdin and waits for the engine's terminal
 * message as its acknowledgement. If the engine does not answer within the grace
 * period the whole process tree is killed, so a cooperative engine is never the
 * only control and a hung one cannot keep the job alive.
 */

import type { ChildProcess } from "node:child_process";
import type { Writable } from "node:stream";

import { writeMessage } from "./codec.js";
import { PROTOCOL_VERSION } from "./index.js";
import { hasStopped, killProcessTree } from "./process-tree.js";

/** Reasons a cancellation may carry. */
export const CANCEL_REASONS = [
  "user-requested",
  "lease-lost",
  "budget-exceeded",
  "shutdown",
] as const;

export type CancelReason = (typeof CANCEL_REASONS)[number];

/** How long the engine is given to acknowledge before the tree is killed. */
export const CANCEL_GRACE_MS = 2_000;

/** Builds the single supervisor-to-engine message, with its own sequence. */
export function cancelMessage(options: {
  readonly jobId: string;
  readonly attemptId: string;
  readonly sequence: number;
  readonly reason: CancelReason;
  readonly gracePeriodMs?: number;
}): Record<string, unknown> {
  return {
    protocolVersion: PROTOCOL_VERSION,
    jobId: options.jobId,
    attemptId: options.attemptId,
    sequence: options.sequence,
    type: "cancel",
    payload: {
      reason: options.reason,
      ...(options.gracePeriodMs !== undefined ? { gracePeriodMs: options.gracePeriodMs } : {}),
    },
  };
}

/**
 * Requests cancellation and reports how the process actually stopped, so a later
 * reader can tell a cooperative stop from a kill.
 */
export async function requestCancellation(options: {
  readonly child: ChildProcess;
  readonly stdin: Writable;
  readonly jobId: string;
  readonly attemptId: string;
  readonly reason: CancelReason;
  readonly graceMs?: number;
}): Promise<"cooperative" | "killed"> {
  const graceMs = options.graceMs ?? CANCEL_GRACE_MS;
  if (hasStopped(options.child)) return "cooperative";
  const closed = new Promise<"cooperative">((resolve) => options.child.once("close", () => resolve("cooperative")));
  let timer: NodeJS.Timeout | undefined;
  const expired = new Promise<"killed">((resolve) => { timer = setTimeout(() => { killProcessTree(options.child, "SIGKILL"); resolve("killed"); }, graceMs); });
  try {
    await writeMessage(
      options.stdin,
      cancelMessage({
        jobId: options.jobId,
        attemptId: options.attemptId,
        sequence: 1,
        reason: options.reason,
        gracePeriodMs: graceMs,
      }),
    );
  } catch {
    // The engine's stdin is already closed; terminating is all that is left.
  }
  const outcome = await Promise.race([closed, expired]);
  if (timer) clearTimeout(timer);
  if (outcome === "killed") await closed;
  return outcome;
}
