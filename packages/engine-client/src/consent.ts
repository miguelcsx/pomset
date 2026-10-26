/**
 * Local execution consent.
 *
 * Reading a kernel and running it are different acts, so any path that imports
 * or executes user code — numerical replay, benchmarking, anything that runs a
 * reference computation — requires the explicit flag on that invocation. Consent
 * is scoped to the single invocation: it is not persisted in a project, a
 * scenario, a manifest or a shell profile, and a second invocation without the
 * flag is refused even when the first one granted it.
 *
 * Pure static or symbolic parsing needs no consent, because it parses text and
 * executes nothing.
 */

import type { EngineRequest } from "@pomset/contracts";

import { errorRecord, type ErrorRecord } from "./errors.js";

/** The flag a user passes to authorize one invocation. */
export const TRUST_LOCAL_CODE_FLAG = "--trust-local-code";

export type ConsentScope = "analysis-only" | "numerical-replay" | "benchmark";

/** The operations that execute something, and therefore need consent. */
const EXECUTING_OPERATIONS: ReadonlySet<string> = new Set(["replay", "validate", "benchmark", "compile"]);

export function requestNeedsConsent(operation: string): boolean {
  return EXECUTING_OPERATIONS.has(operation);
}

/** The consent field carried on the request, as data rather than ambient state. */
export function consentField(
  granted: boolean,
  scope: ConsentScope,
): EngineRequest["consent"] {
  return { granted, scope };
}

/**
 * The backends whose local work is execution rather than reading.
 *
 * The operation vocabulary is the contract's and is shared by every engine, so
 * it cannot say that `full` means "reason about the source" for one backend and
 * "compile and run the kernel" for another. That distinction lives here.
 */
const EXECUTING_BACKENDS: ReadonlySet<string> = new Set(["openmp"]);

export function backendNeedsConsent(backend: string): boolean {
  return EXECUTING_BACKENDS.has(backend);
}

/** The scope a backend's consent covers, so the grant says what it was for. */
export function consentScopeFor(backend: string): ConsentScope {
  return backendNeedsConsent(backend) ? "numerical-replay" : "analysis-only";
}

export class ConsentRequiredError extends Error {
  readonly record: ErrorRecord;
  constructor(operation: string) {
    super(
      `operation ${operation} executes user code and requires ${TRUST_LOCAL_CODE_FLAG} for this invocation`,
    );
    this.name = "ConsentRequiredError";
    this.record = errorRecord("INPUT_INVALID", this.message, {
      operation,
      flag: TRUST_LOCAL_CODE_FLAG,
    });
  }
}

/**
 * Refuses an executing operation without consent. Nothing is started: the
 * refusal happens before a process exists.
 */
export function requireConsent(operation: string, granted: boolean): void {
  if (requestNeedsConsent(operation) && !granted) throw new ConsentRequiredError(operation);
}

/**
 * Refuses an operation that executes user code on this backend without consent.
 *
 * `full` is not an executing operation for a symbolic engine, which reads the
 * source and runs nothing. It is one for an engine that compiles and runs the
 * kernel, and the flag is what says the user meant that.
 */
export function requireConsentFor(
  backend: string,
  operation: string,
  granted: boolean,
): void {
  if (backendNeedsConsent(backend) && !granted) throw new ConsentRequiredError(operation);
  requireConsent(operation, granted);
}
