/**
 * One eligibility policy, implemented once.
 *
 * For each required property the policy states which methods it accepts,
 * whether a sampled pass may satisfy it and whether an `unknown` result may. For
 * benchmarking it states whether an eligible validation record is required,
 * whether the metric must be measured rather than estimated, the cohort match,
 * a minimum sample count and whether warm-up is required.
 *
 * The default accepts neither a sampled pass nor an unknown for a correctness
 * property, so an unknown or unsupported required check blocks automatic
 * eligibility. A user may change the policy; the change is recorded with its
 * revision and it re-labels, never upgrades, the evidence class.
 */

import type { AnalysisResult, EligibilityPolicy as EligibilityPolicyRecord, Method, Scenario } from "@pomset/contracts";

import { isAdmissibleProperty } from "./properties.js";
import { accepted, inputInvalid, pointer, rejected, type Validated, type Rejection } from "./rejection.js";

export type EligibilityPolicy = EligibilityPolicyRecord;

/** The methods a correctness property may be established or violated by. */
export const DEFAULT_ACCEPTED_METHODS: readonly Method[] = ["static", "symbolic"];

/**
 * The default policy: correctness properties are satisfied only by a static or
 * symbolic result, and a sampled pass or an unknown does not satisfy them.
 */
export const DEFAULT_POLICY: EligibilityPolicy = {
  schemaVersion: 1,
  policyId: "pol_default",
  policyRevision: 1,
  requiredProperties: [
    {
      propertyId: "memoryBounds",
      acceptedMethods: [...DEFAULT_ACCEPTED_METHODS],
      acceptSampled: false,
      acceptUnknown: false,
    },
    {
      propertyId: "outputCoverage",
      acceptedMethods: [...DEFAULT_ACCEPTED_METHODS],
      acceptSampled: false,
      acceptUnknown: false,
    },
    {
      propertyId: "writeWriteConflict",
      acceptedMethods: [...DEFAULT_ACCEPTED_METHODS],
      acceptSampled: false,
      acceptUnknown: false,
    },
  ],
  benchmark: {
    requireEligibleValidation: true,
    requireMeasuredMetric: true,
    cohortMatch: "exact-hardware",
    minSamples: 30,
    requireWarmup: true,
  },
  notes:
    "The default accepts neither a sampled pass nor an unknown for a correctness property. Changing it re-labels a result; it never upgrades its evidence class.",
};

export function createEligibilityPolicy(
  record: EligibilityPolicyRecord,
): Validated<EligibilityPolicy> {
  const rejections: Rejection[] = [];
  if (record.policyRevision < 1) {
    rejections.push(inputInvalid(pointer("policyRevision"), "a policy carries a stated revision"));
  }
  if (record.requiredProperties.length === 0) {
    rejections.push(
      inputInvalid(pointer("requiredProperties"), "a policy must state the properties it governs"),
    );
  }
  record.requiredProperties.forEach((entry, index) => {
    const at = pointer("requiredProperties", String(index));
    if (!isAdmissibleProperty(entry.propertyId)) {
      rejections.push(
        inputInvalid(pointer(at, "propertyId"), `unknown property ${entry.propertyId}`),
      );
    }
    if (entry.acceptedMethods.length === 0) {
      rejections.push(
        inputInvalid(pointer(at, "acceptedMethods"), "a property must accept at least one method"),
      );
    }
  });
  if (rejections.length > 0) return rejected(...rejections);
  return accepted(record);
}

/** The policy's rule for one property, if it states one. */
export function propertyRule(
  policy: EligibilityPolicy,
  propertyId: string,
): EligibilityPolicy["requiredProperties"][number] | undefined {
  return policy.requiredProperties.find((entry) => entry.propertyId === propertyId);
}

export function evaluateEligibility(result: AnalysisResult, scenario: ScenarioRecordInput, policy: EligibilityPolicy = DEFAULT_POLICY): { eligible: boolean; reasonCodes: readonly string[]; policyId: string; policyRevision: number } {
  const reasons: string[] = [];
  if (result.snapshotId !== scenario.snapshotId || result.scenarioId !== scenario.scenarioId || result.domain.domainId !== scenario.domain.domainId) reasons.push("PROVENANCE_MISMATCH");
  if (result.policyId !== policy.policyId || result.policyRevision !== policy.policyRevision) reasons.push("POLICY_MISMATCH");
  if (result.completeness?.kind !== "complete") reasons.push("VALIDATION_NOT_COMPLETE");
  if (result.origin === "imported") reasons.push("IMPORTED_EVIDENCE_NOT_ADMITTED");
  for (const propertyId of scenario.requiredProperties) {
    const rule = propertyRule(policy, propertyId);
    const properties = result.propertyResults.filter((entry) => entry.propertyId === propertyId);
    if (!rule || properties.length === 0) { reasons.push(`REQUIRED_RESULT_MISSING:${propertyId}`); continue; }
    // A real failure is never hidden by a passing record or its array position.
    if (properties.some((entry) => entry.outcome === "violated")) reasons.push(`PROPERTY_VIOLATED:${propertyId}`);
    const admitted = properties.filter((entry) => rule.acceptedMethods.includes(entry.method));
    if (admitted.length === 0) { reasons.push(`METHOD_NOT_ACCEPTED:${propertyId}`); continue; }
    for (const property of admitted) {
      if (property.outcome === "unsupported") reasons.push(`PROPERTY_UNSUPPORTED:${propertyId}`);
      const sampleIds = property.sampledCheckIds ?? [];
      if (sampleIds.length > 0) {
        const samples = sampleIds.map((id) => result.sampledChecks?.find((check) => check.sampledCheckId === id));
        const passed = samples.every((check) => check && check.points.length > 0 &&
          new Set(check.points.map((point) => point.pointId)).size === check.points.length &&
          check.observations.length === check.points.length &&
          new Set(check.observations.map((observation) => observation.pointId)).size === check.points.length &&
          check.points.every((point) => check.observations.some((observation) => observation.pointId === point.pointId && observation.observation === "passed")));
        if (!rule.acceptSampled || !passed) reasons.push(`SAMPLED_NOT_ACCEPTED:${propertyId}`);
      }
      if (property.outcome === "unknown" && !(rule.acceptUnknown || (rule.acceptSampled && sampleIds.length > 0))) reasons.push(`PROPERTY_UNKNOWN:${propertyId}`);
    }
  }
  return { eligible: reasons.length === 0, reasonCodes: [...new Set(reasons)], policyId: policy.policyId, policyRevision: policy.policyRevision };
}

type ScenarioRecordInput = Pick<Scenario, "snapshotId" | "scenarioId" | "domain" | "requiredProperties">;
