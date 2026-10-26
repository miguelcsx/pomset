/**
 * Cache identity.
 *
 * A cache hit must mean "the same question, asked of the same inputs, under the
 * same tooling". So a key is composed from exact identities and nothing weaker:
 * a newer model revision or solver version is a different key that may
 * legitimately produce a different established/unknown split, and a measurement
 * key additionally carries the device, the tool and the hardware cohort, so a
 * measurement is never reused across a different device.
 *
 * The key is a pure function: no clock, no path, no process identity, no
 * iteration order. Two processes asked the same question produce the same key.
 */

import { canonicalize } from "./canonicalize.js";
import { sha256Of } from "./identity.js";

/** Everything an analysis answer depends on. */
export interface AnalysisIdentity {
  readonly snapshotId: string;
  readonly scenarioId: string;
  readonly domainId: string;
  readonly policyRevision: number;
  /** The query model and its revision, so a newer model is a different question. */
  readonly modelRevision: string;
  readonly profileRevisionId: string;
}

/** A device and tool identity, which an analysis key does not carry. */
export interface MeasurementIdentity {
  readonly device: string;
  readonly tool: string;
  readonly toolRevision: string;
  readonly environment: string;
  readonly cohortId: string;
}

/**
 * The analysis key: an exact identity comparison, never a resemblance. Changing
 * any single component yields a different key, so an edited source, a changed
 * policy, a different query model or a different device can never reuse earlier
 * evidence.
 */
export function analysisCacheKey(identity: AnalysisIdentity): string {
  return sha256Of(
    canonicalize({
      kind: "analysis",
      snapshotId: identity.snapshotId,
      scenarioId: identity.scenarioId,
      domainId: identity.domainId,
      policyRevision: identity.policyRevision,
      modelRevision: identity.modelRevision,
      profileRevisionId: identity.profileRevisionId,
    }),
  );
}

/**
 * The measurement key: the analysis key plus the device, tool, tool revision,
 * environment and hardware cohort. Two identical analyses on unlike devices are
 * two different keys, which is what keeps the cohorts separate.
 */
export function measurementCacheKey(
  identity: AnalysisIdentity,
  measurement: MeasurementIdentity,
): string {
  return sha256Of(
    canonicalize({
      kind: "measurement",
      analysis: analysisCacheKey(identity),
      device: measurement.device,
      tool: measurement.tool,
      toolRevision: measurement.toolRevision,
      environment: measurement.environment,
      cohortId: measurement.cohortId,
    }),
  );
}

/**
 * Two identities are compatible when they are exactly equal. Compatibility and
 * eligibility compare exact identities, never near ones, so a policy or profile
 * that differs in one revision is incompatible rather than "close enough".
 */
export function sameAnalysisIdentity(a: AnalysisIdentity, b: AnalysisIdentity): boolean {
  return (
    a.snapshotId === b.snapshotId &&
    a.scenarioId === b.scenarioId &&
    a.domainId === b.domainId &&
    a.policyRevision === b.policyRevision &&
    a.modelRevision === b.modelRevision &&
    a.profileRevisionId === b.profileRevisionId
  );
}
