/**
 * Scenario and domain validation.
 *
 * A scenario is validated against the portable schema and then against the
 * invariants the schema cannot express. An invalid scenario is rejected, never
 * repaired: nothing is dropped, defaulted or rewritten, and every refusal is one
 * machine-readable entry naming the single error vocabulary and the offending
 * JSON pointer — not a prose message.
 */

import {
  schemaSet,
  type EligibilityPolicy as EligibilityPolicyRecord,
  type Scenario as ScenarioRecord,
  type WorkloadDomain,
} from "@pomset/contracts";

import { createWorkloadDomain, type DomainModel } from "./domain.js";
import { createEligibilityPolicy, type EligibilityPolicy } from "./eligibility.js";
import { inputInvalid, rejected, type Rejection, type Validated } from "./rejection.js";
import { createScenario, type ScenarioModel } from "./scenario.js";

/** Runs the schema validator and turns its errors into the shared rejection list. */
function schemaRejections(target: string, value: unknown): readonly Rejection[] {
  const validate = schemaSet().validatorFor(target);
  if (validate(value)) return [];
  return (validate.errors ?? []).map((error) =>
    inputInvalid(error.instancePath || "", `${error.message ?? "invalid"}`, {
      schemaPath: error.schemaPath,
    }),
  );
}

export function validateDomain(value: unknown): Validated<DomainModel> {
  const schema = schemaRejections("domain.schema.yaml#/$defs/workloadDomain", value);
  if (schema.length > 0) return rejected(...schema);
  return createWorkloadDomain(value as WorkloadDomain);
}

export function validatePolicy(value: unknown): Validated<EligibilityPolicy> {
  const schema = schemaRejections("domain.schema.yaml#/$defs/eligibilityPolicy", value);
  if (schema.length > 0) return rejected(...schema);
  return createEligibilityPolicy(value as EligibilityPolicyRecord);
}

/**
 * The public entry point: schema, then domain, then the scenario's own
 * invariants, all aggregated into one rejection list.
 */
export function validateScenario(value: unknown): Validated<ScenarioModel> {
  const schema = schemaRejections("domain.schema.yaml#/$defs/scenario", value);
  if (schema.length > 0) return rejected(...schema);
  // The invariants live in createScenario, which re-validates the domain and the
  // launch expression against the declared variables.
  return createScenario(value as ScenarioRecord);
}
