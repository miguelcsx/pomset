import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { schemaSet, type AnalysisResult, type EligibilityPolicy, type Scenario } from "@pomset/contracts";
import { evaluateEligibility } from "./eligibility.js";
function fixture<T>(name: string, target: string): T {
  const raw: unknown = JSON.parse(readFileSync(new URL(`../../../docs/contracts/examples/${name}.json`, import.meta.url), "utf8"));
  if (!schemaSet().validatorFor(target)(raw)) throw new Error(`Invalid fixture ${name}`); return raw as T;
}
const original = fixture<AnalysisResult>("analysis-result", "evidence.schema.yaml#/$defs/analysisResult");
const scenario = fixture<Scenario>("scenario", "domain.schema.yaml#/$defs/scenario");
const policy = fixture<EligibilityPolicy>("eligibility-policy", "domain.schema.yaml#/$defs/eligibilityPolicy");
const pass: AnalysisResult = { ...original, completeness: { kind: "complete" }, propertyResults: policy.requiredProperties.map((rule, index) => ({ ...original.propertyResults[0]!, propertyResultId: `pr_${index}`, propertyId: rule.propertyId, outcome: "established", method: "symbolic", evidenceClass: "verified-under-assumptions", findingIds: [], witnessIds: [], sampledCheckIds: [] })) };
describe("eligibility across method-specific records", () => {
  it("does not hide a later violation behind an established result", () => {
    const failure = { ...pass.propertyResults[0]!, propertyResultId: "pr_observed", outcome: "violated" as const, method: "instrumented" as const, evidenceClass: "observed" as const };
    for (const propertyResults of [[...pass.propertyResults, failure], [failure, ...pass.propertyResults]]) {
      expect(evaluateEligibility({ ...pass, propertyResults }, scenario, policy).reasonCodes).toContain(`PROPERTY_VIOLATED:${failure.propertyId}`);
    }
  });
  it("ignores an unaccepted observation method when accepted symbolic checks establish the properties", () => {
    const observation = { ...pass.propertyResults[0]!, propertyResultId: "pr_observed", outcome: "unknown" as const, method: "instrumented" as const, evidenceClass: "observed" as const, unknownReason: "Only one execution" };
    expect(evaluateEligibility({ ...pass, propertyResults: [observation, ...pass.propertyResults] }, scenario, policy).eligible).toBe(true);
  });
  it("blocks incomplete and imported evidence independently of property passes", () => {
    expect(evaluateEligibility({ ...pass, origin: "imported", completeness: { kind: "partial" } }, scenario, policy).reasonCodes).toEqual(expect.arrayContaining(["VALIDATION_NOT_COMPLETE", "IMPORTED_EVIDENCE_NOT_ADMITTED"]));
  });
});
