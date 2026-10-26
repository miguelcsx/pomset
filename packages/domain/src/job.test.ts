import { expect, it } from "vitest";
import type { Job } from "@pomset/contracts";

import {
  acceptsEvidence,
  canTransition,
  cancellationTarget,
  completionTarget,
  isEnqueueable,
  isTerminal,
} from "./job.js";

const job = (state: Job["state"], attemptId = "att_1"): Job =>
  ({ state, attemptId }) as Job;

it("treats a finished attempt as terminal and refuses to move it", () => {
  for (const state of ["succeeded", "failed", "cancelled"] as const) {
    expect(isTerminal(state)).toBe(true);
    expect(canTransition(state, "running")).toBe(false);
  }
  expect(canTransition("queued", "running")).toBe(true);
  expect(canTransition("running", "queued")).toBe(false);
});

it("cancels a queued job outright and asks a running one to stop", () => {
  expect(cancellationTarget("queued")).toBe("cancelled");
  expect(cancellationTarget("running")).toBe("cancel-requested");
  // Already asked, or already over: the request changes nothing.
  expect(cancellationTarget("cancel-requested")).toBeUndefined();
  for (const state of ["succeeded", "failed", "cancelled"] as const)
    expect(cancellationTarget(state)).toBeUndefined();
});

it("gives cancellation precedence over a completion that arrives with it", () => {
  expect(completionTarget("running", false)).toBe("succeeded");
  expect(completionTarget("running", true)).toBe("failed");
  // The attempt was already asked to stop, so its results do not revive it.
  expect(completionTarget("cancel-requested", false)).toBe("cancelled");
  expect(completionTarget("cancel-requested", true)).toBe("cancelled");
  // A queued attempt never started, and a terminal one cannot complete again.
  expect(completionTarget("queued", false)).toBeUndefined();
  expect(completionTarget("succeeded", false)).toBeUndefined();
});

it("admits evidence only while an attempt is live", () => {
  expect(acceptsEvidence("running")).toBe(true);
  expect(acceptsEvidence("cancel-requested")).toBe(true);
  for (const state of ["queued", "succeeded", "failed", "cancelled"] as const)
    expect(acceptsEvidence(state)).toBe(false);
});

it("requires a new job to be queued with one attempt", () => {
  expect(isEnqueueable(job("queued"))).toBe(true);
  expect(isEnqueueable(job("queued", ""))).toBe(false);
  expect(isEnqueueable(job("running"))).toBe(false);
});
