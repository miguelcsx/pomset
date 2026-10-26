/**
 * Evidence, findings, witnesses and sampled checks.
 *
 * What a result is allowed to claim is the whole product, so the closed
 * outcome x method x evidenceClass table is enforced **at construction** rather
 * than validated later: a combination such as "established by instrumented
 * observation" cannot be built at all, because the only constructor refuses it.
 *
 * Two consequences run through this module. A finite sampled check is a
 * `SampledCheck` with explicit points and observations and is never assigned a
 * domain-wide `established`. And a job's state is not part of a result: a
 * `succeeded` job may hold violated, unknown and unsupported results, and its
 * state carries no correctness assertion.
 */

import { isAllowedTuple, type EvidenceClass, type Finding, type Method, type Outcome, type SampledCheck, type Witness } from "@pomset/contracts";
import type { PropertyResult, Assumptions } from "@pomset/contracts";

import { inputInvalid, pointer, rejected, accepted, type Rejection, type Validated } from "./rejection.js";

/** True when a model, its revision and a domain are all named. */
export function hasStatedModel(assumptions: Assumptions): boolean {
  return (
    assumptions.model.trim().length > 0 &&
    (assumptions.modelRevision ?? "").trim().length > 0 &&
    assumptions.domainRef.trim().length > 0 &&
    assumptions.items.length > 0
  );
}

/**
 * The one way to construct a property result. The closed table decides first: an
 * unknown or unlisted combination is refused before any other rule is consulted,
 * so no later rule can admit it.
 */
export function createPropertyResult(input: {
  readonly propertyResultId: string;
  readonly propertyId: string;
  readonly outcome: Outcome;
  readonly method: Method;
  readonly evidenceClass: EvidenceClass;
  readonly assumptions: Assumptions;
  readonly coverageRef: string;
  readonly budget?: PropertyResult["budget"];
  readonly findingIds?: readonly string[];
  readonly witnessIds?: readonly string[];
  readonly sampledCheckIds?: readonly string[];
  readonly unsupportedReason?: string;
  readonly unknownReason?: string;
  readonly semanticRole?: PropertyResult["semanticRole"];
}): Validated<PropertyResult> {
  const rejections: Rejection[] = [];
  const at = "";

  if (!isAllowedTuple(input.outcome, input.method, input.evidenceClass)) {
    rejections.push(
      inputInvalid(
        pointer(at, "evidenceClass"),
        `${input.outcome} is not permitted with method ${input.method} and evidence class ${input.evidenceClass}`,
        { outcome: input.outcome, method: input.method, evidenceClass: input.evidenceClass },
      ),
    );
  }

  if (input.outcome === "established") {
    if (input.method !== "static" && input.method !== "symbolic") {
      rejections.push(
        inputInvalid(pointer(at, "method"), "an established property comes only from static or symbolic analysis"),
      );
    }
    if (!hasStatedModel(input.assumptions)) {
      rejections.push(
        inputInvalid(
          pointer(at, "assumptions"),
          "an established property requires a model, its revision and a domain, with at least one stated assumption",
        ),
      );
    }
  }

  if (input.outcome === "unknown" && !input.unknownReason) {
    rejections.push(
      inputInvalid(pointer(at, "unknownReason"), "an unknown result names what it could not decide within"),
    );
  }
  if (input.outcome === "unsupported" && !input.unsupportedReason) {
    rejections.push(
      inputInvalid(pointer(at, "unsupportedReason"), "an unsupported result names the construct it cannot model"),
    );
  }

  // A sampled check is never promoted: an outcome that rests on sampling must
  // carry the sampled check it rests on.
  if (input.sampledCheckIds && input.sampledCheckIds.length > 0 && input.outcome === "established") {
    rejections.push(
      inputInvalid(
        pointer(at, "outcome"),
        "a sampled check never produces a domain-wide established result",
      ),
    );
  }

  if (rejections.length > 0) return rejected(...rejections);
  return accepted(input as PropertyResult);
}

/** A finding must be renderable: at least one actor, one event and one source range. */
export function createFinding(input: Finding): Validated<Finding> {
  const rejections: Rejection[] = [];
  if (input.actorIds.length === 0) {
    rejections.push(inputInvalid(pointer("actorIds"), "a finding references at least one actor"));
  }
  if (input.eventIds.length === 0) {
    rejections.push(inputInvalid(pointer("eventIds"), "a finding references at least one memory event"));
  }
  if (input.sourceRanges.length === 0) {
    rejections.push(
      inputInvalid(pointer("sourceRanges"), "a finding without a source range is not renderable"),
    );
  }
  if (rejections.length > 0) return rejected(...rejections);
  return accepted(input);
}

/**
 * A witness fixes every domain variable the property depends on. Whether it
 * actually does is decided against the extracted model; the
 * structural rule here is that it assigns at least one variable and references
 * the actors, events and ranges it is about.
 */
export function createWitness(input: Witness): Validated<Witness> {
  const rejections: Rejection[] = [];
  if (input.assignments.length === 0) {
    rejections.push(
      inputInvalid(pointer("assignments"), "a witness assigns at least one domain variable"),
    );
  }
  if (input.actorIds.length === 0) {
    rejections.push(inputInvalid(pointer("actorIds"), "a witness names the actors it involves"));
  }
  if (input.eventIds.length === 0) {
    rejections.push(inputInvalid(pointer("eventIds"), "a witness names the events it involves"));
  }
  if (input.sourceRanges.length === 0) {
    rejections.push(inputInvalid(pointer("sourceRanges"), "a witness names the source ranges it involves"));
  }
  if (!input.minimization || input.minimization.attempted === false) {
    rejections.push(
      inputInvalid(
        pointer("minimization"),
        "minimization is always attempted and its outcome recorded, even when nothing was dropped",
      ),
    );
  }
  if (rejections.length > 0) return rejected(...rejections);
  return accepted(input);
}

/**
 * A sampled check is a finite set of points with one observation each. A point
 * without an observation, or an observation of a point that does not exist, is
 * refused: a count over a set that was not enumerated is exactly the fabricated
 * number the contract forbids.
 */
export function createSampledCheck(input: SampledCheck): Validated<SampledCheck> {
  const rejections: Rejection[] = [];
  if (input.points.length === 0) {
    rejections.push(inputInvalid(pointer("points"), "a sampled check enumerates the points it drew"));
  }
  const pointIds = new Set(input.points.map((point) => point.pointId));
  for (const [index, observation] of input.observations.entries()) {
    if (!pointIds.has(observation.pointId)) {
      rejections.push(
        inputInvalid(
          pointer("observations", String(index), "pointId"),
          `observation refers to point ${observation.pointId}, which was not drawn`,
        ),
      );
    }
  }
  if (input.observations.length !== input.points.length) {
    rejections.push(
      inputInvalid(
        pointer("observations"),
        `every drawn point has exactly one observation: ${input.points.length} points, ${input.observations.length} observations`,
      ),
    );
  }
  if (rejections.length > 0) return rejected(...rejections);
  return accepted(input);
}
