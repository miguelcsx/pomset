/**
 * The engine request and its budget.
 *
 * The engine's whole input is a validated request written by the supervisor into
 * a read-only file and named by a fixed argv vector. Nothing a scenario supplies
 * is executable authority: the request carries mapped, immutable input
 * references, never host paths.
 *
 * Budgets may only be lowered. A request that tries to raise one is refused,
 * which is what stops an uploaded scenario from granting itself more wall clock,
 * memory or output than the deployment allows.
 */

import type { EngineRequest } from "@pomset/contracts";
import { schemaSet } from "@pomset/contracts";

import { inputInvalid, type Rejection } from "./errors.js";
import { ProtocolError } from "./envelope.js";

/** The six limits an engine runs under, with explicit units in the field names. */
export interface Budget {
  readonly solverTimeMs: number;
  readonly engineWallTimeMs: number;
  readonly memoryBytes: number;
  readonly maxMessageBytes: number;
  readonly maxOutputBytes: number;
  readonly maxArtifactBytes: number;
}

/** The initial CPU-profile limits. An operator may lower them; nothing may raise them. */
export const DEFAULT_BUDGET: Budget = {
  solverTimeMs: 30_000,
  engineWallTimeMs: 120_000,
  memoryBytes: 2_147_483_648,
  maxMessageBytes: 1_048_576,
  maxOutputBytes: 16_777_216,
  maxArtifactBytes: 268_435_456,
};

const BUDGET_FIELDS = Object.keys(DEFAULT_BUDGET) as (keyof Budget)[];

/** True when no field of `requested` exceeds the corresponding default. */
export function budgetWithinDefaults(requested: Partial<Budget>): boolean {
  return BUDGET_FIELDS.every((field) => {
    const value = requested[field];
    return value === undefined || value <= DEFAULT_BUDGET[field];
  });
}

/**
 * Applies a requested budget to the defaults, refusing any field that raises
 * one. Lowering is always allowed; a single raised field refuses the whole
 * request rather than silently clamping it.
 */
export function applyBudget(requested: Partial<Budget>): Budget | ProtocolError {
  const rejections: Rejection[] = [];
  for (const field of BUDGET_FIELDS) {
    const value = requested[field];
    if (value === undefined) continue;
    if (!Number.isSafeInteger(value) || value < 0) rejections.push(inputInvalid(`/${field}`, `${field} must be a nonnegative safe integer`));
    else if (value > DEFAULT_BUDGET[field]) {
      rejections.push(
        inputInvalid(`/${field}`, `${field} of ${value} raises the ${DEFAULT_BUDGET[field]} limit`),
      );
    }
  }
  if (rejections.length > 0) {
    const first = rejections[0] as Rejection;
    return new ProtocolError(first.record.message, { ...first.record.details, pointer: first.pointer });
  }
  return { ...DEFAULT_BUDGET, ...requested };
}

/** Validates a request read from the request file. */
export function validateEngineRequest(raw: unknown): EngineRequest {
  const validate = schemaSet().validatorFor("engine.schema.yaml#/$defs/engineRequest");
  if (!validate(raw)) {
    const first = validate.errors?.[0];
    throw new ProtocolError(
      `engine request is invalid: ${first?.instancePath ?? ""} ${first?.message ?? "malformed"}`,
    );
  }
  const request = raw as EngineRequest;
  const budget = applyBudget(request.budget);
  if (budget instanceof Error) throw budget;
  return request;
}

/**
 * Builds a request with the budget resolved and the defaults applied. The
 * supervisor writes exactly this record, so nothing about the budget is decided
 * by the engine.
 */
export function buildEngineRequest(
  request: Omit<EngineRequest, "budget" | "schemaVersion" | "protocolVersion"> & {
    readonly budget?: Partial<Budget>;
  },
): EngineRequest {
  const budget = applyBudget(request.budget ?? {});
  if (budget instanceof Error) throw budget;
  const { budget: _requested, ...rest } = request;
  return { schemaVersion: 1, protocolVersion: 1, ...rest, budget };
}
