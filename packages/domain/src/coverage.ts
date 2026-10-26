/**
 * Coverage and its denominator rule.
 *
 * A domain is reported as regions, each carrying its own per-property
 * classification, and never collapsed into one verdict: a formally verified
 * region is not equivalent to one where a hundred tests happened to pass.
 *
 * A count or a percentage exists only for a finite, explicitly enumerated
 * denominator with duplicate points removed. Where the domain is not enumerated,
 * the contract reports constraints and sampled points and no proportion at all —
 * so this module offers no way to obtain a percentage from an unenumerated
 * domain.
 */

import type { Coverage, CoverageDenominator } from "@pomset/contracts";

import { inputInvalid, pointer, rejected, accepted, type Rejection, type Validated } from "./rejection.js";

export type { Coverage, CoverageDenominator };

/** A classification that rests on an analysis result, not on a sample. */
const OUTCOME_CLASSIFICATIONS = ["established", "violated", "unknown", "unsupported"] as const;

export function createCoverage(input: Coverage): Validated<Coverage> {
  const rejections: Rejection[] = [];

  const denominator = input.denominator;
  if (denominator.kind === "enumerated") {
    if (denominator.pointCount === undefined) {
      rejections.push(
        inputInvalid(pointer("denominator", "pointCount"), "an enumerated denominator states how many points it has"),
      );
    }
    if (denominator.duplicatesRemoved !== true) {
      rejections.push(
        inputInvalid(
          pointer("denominator", "duplicatesRemoved"),
          "a count over an enumerated denominator requires duplicate points to have been removed",
        ),
      );
    }
  } else if (denominator.pointCount !== undefined) {
    rejections.push(
      inputInvalid(
        pointer("denominator", "pointCount"),
        "an unenumerated domain carries no count; report its constraints and sampled points instead",
      ),
    );
  }

  if (input.regions.length === 0) {
    rejections.push(inputInvalid(pointer("regions"), "coverage reports at least one region"));
  }

  input.regions.forEach((region, regionIndex) => {
    const base = pointer("regions", String(regionIndex));
    if (region.constraints.length === 0) {
      rejections.push(
        inputInvalid(pointer(base, "constraints"), `region ${region.regionId} states its constraints`),
      );
    }
    if (region.classifications.length === 0) {
      rejections.push(
        inputInvalid(
          pointer(base, "classifications"),
          `region ${region.regionId} classifies at least one property`,
        ),
      );
    }
    region.classifications.forEach((classification, classIndex) => {
      const at = pointer(base, "classifications", String(classIndex));
      if (classification.classification === "sampled" && !classification.sampledCheckId) {
        rejections.push(
          inputInvalid(
            pointer(at, "sampledCheckId"),
            "a sampled classification names the sampled check it rests on",
          ),
        );
      }
      if (
        (OUTCOME_CLASSIFICATIONS as readonly string[]).includes(classification.classification) &&
        !classification.resultId
      ) {
        rejections.push(
          inputInvalid(
            pointer(at, "resultId"),
            `a ${classification.classification} classification names the result that established it`,
          ),
        );
      }
    });
  });

  if (rejections.length > 0) return rejected(...rejections);
  return accepted(input);
}

/**
 * The proportion of an enumerated denominator, or `undefined` when the domain is
 * not enumerated. There is deliberately no fallback: an unenumerated domain has
 * no percentage, not a percentage of zero.
 */
export function coveragePercentage(
  coverage: Coverage,
  classifiedPoints: number,
): number | undefined {
  if (coverage.denominator.kind !== "enumerated") return undefined;
  const total = coverage.denominator.pointCount;
  if (total === undefined || total <= 0) return undefined;
  return classifiedPoints / total;
}

/** The classification of one property in one region, if the region states one. */
export function classificationOf(
  coverage: Coverage,
  regionId: string,
  propertyId: string,
): Coverage["regions"][number]["classifications"][number] | undefined {
  const region = coverage.regions.find((candidate) => candidate.regionId === regionId);
  return region?.classifications.find((entry) => entry.propertyId === propertyId);
}
