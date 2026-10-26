/**
 * The job lifecycle.
 *
 * Which states exist, which transitions are legal, and what a cancellation or a
 * completion means are one rule, not one rule per backend. It used to live
 * inside the local store, where a hosted store would have had to restate it —
 * and two restatements of "may this job still be cancelled" drift.
 *
 * It is policy, so it lives here: no clock, no database, no process.
 */

import type { Job, JobState } from "@pomset/contracts";

/** Every legal transition. A state with no successors is terminal. */
export const JOB_TRANSITIONS: Readonly<Record<JobState, readonly JobState[]>> = {
  queued: ["running", "failed", "cancelled"],
  running: ["succeeded", "failed", "cancel-requested"],
  "cancel-requested": ["cancelled"],
  succeeded: [],
  failed: [],
  cancelled: [],
};

export function isTerminal(state: JobState): boolean {
  return JOB_TRANSITIONS[state].length === 0;
}

export function canTransition(from: JobState, to: JobState): boolean {
  return JOB_TRANSITIONS[from].includes(to);
}

/** A new job carries exactly one attempt and starts queued. */
export function isEnqueueable(job: Job): boolean {
  return job.state === "queued" && Boolean(job.attemptId);
}

/**
 * Where a cancellation request leads from this state.
 *
 * A queued job is cancelled outright, because nothing has started. A running
 * one is asked to stop and the request is recorded: cancellation takes
 * precedence over a completion arriving at the same moment. A job that already
 * finished, or was already asked, is left exactly as it is.
 */
export function cancellationTarget(state: JobState): JobState | undefined {
  if (state === "queued") return "cancelled";
  if (state === "running") return "cancel-requested";
  return undefined;
}

/**
 * Where a completion leads from this state.
 *
 * An attempt that was asked to stop is recorded as cancelled even when its
 * results arrive, because the durable decision was already made and a result
 * that outran a cancellation is still a cancelled attempt.
 */
export function completionTarget(
  state: JobState,
  failed: boolean,
): JobState | undefined {
  const target: JobState =
    state === "cancel-requested" ? "cancelled" : failed ? "failed" : "succeeded";
  return canTransition(state, target) ? target : undefined;
}

/** Only a live attempt may append evidence. */
export function acceptsEvidence(state: JobState): boolean {
  return state === "running" || state === "cancel-requested";
}
