/**
 * Versioned capability and profile manifests.
 *
 * A profile revision is an immutable, measured statement: the pinned engine and
 * tool versions, the platform, the deployment image digest, and one capability
 * entry per analysis feature. Support level and availability are **independent
 * axes**: `validated | limited | untested` is a property of the measured
 * revision, while `immediate | queued | unavailable` is derived from deployment
 * and queue state at read time. A deployment change therefore never rewrites a
 * support claim — it changes only what is currently offered.
 *
 * A capability absent from a manifest is unsupported, with the missing
 * capability named. It is never substituted for a nearby one.
 */

import type { Capability, ProfileRevision, SupportLevel, Availability } from "@pomset/contracts";

import { canonicalize } from "./canonicalize.js";
import { isContentHash, sha256Of } from "./identity.js";
import { inputInvalid, pointer, rejected, accepted, type Rejection, type Validated } from "./rejection.js";

export type { Capability, ProfileRevision, SupportLevel, Availability };

/** The analysis features the contract enumerates, in support-matrix order. */
export const CAPABILITY_FEATURES = [
  "parse",
  "bounds",
  "outputCoverage",
  "writeWriteConflict",
  "readWriteConflict",
  "atomics",
  "dynamicIndexing",
  "reductions",
  "dot",
  "synchronizationDiagnostics",
  "initializationDiagnostics",
  "deadlockDiagnostics",
  "numericalReference",
  "interpreterReplay",
  "compilation",
  "sourceMaps",
  "ptxInspection",
  "instrumentedExecution",
  "benchmark",
  "hardwareMetrics",
  "traceExport",
] as const;

export type CapabilityFeature = (typeof CAPABILITY_FEATURES)[number];

/**
 * The revision hash: SHA-256 over the canonical serialization of the revision
 * with its own hash member omitted, exactly as a snapshot manifest is hashed.
 * Two deployments holding the same measured revision compute the same hash.
 */
export function revisionHashOf(revision: Omit<ProfileRevision, "revisionHash">): string {
  const withoutHash: Record<string, unknown> = { ...revision };
  delete withoutHash["revisionHash"];
  return sha256Of(canonicalize(withoutHash));
}

export function createProfileRevision(input: ProfileRevision): Validated<ProfileRevision> {
  const rejections: Rejection[] = [];
  if (input.components.length === 0) {
    rejections.push(
      inputInvalid(pointer("components"), "a profile revision pins the tool versions it was measured with"),
    );
  }
  for (const [index, component] of input.components.entries()) {
    if (!component.version) {
      rejections.push(
        inputInvalid(
          pointer("components", String(index), "version"),
          `component ${component.name} names no version`,
        ),
      );
    }
  }
  if (input.capabilityIds.length === 0) {
    rejections.push(
      inputInvalid(pointer("capabilityIds"), "a profile revision declares one capability per feature"),
    );
  }
  if (!isContentHash(input.revisionHash)) {
    rejections.push(
      inputInvalid(pointer("revisionHash"), "the revision hash is a SHA-256 content hash"),
    );
  }
  if (rejections.length > 0) return rejected(...rejections);
  return accepted(input);
}

/**
 * A capability declares both a support level and an availability. `validated`
 * additionally requires a recorded conformance reference: a support claim
 * without the fixtures that established it is not a measured claim.
 */
export function createCapability(input: Capability): Validated<Capability> {
  const rejections: Rejection[] = [];
  if (!input.support) {
    rejections.push(inputInvalid(pointer("support"), "a capability declares its support level"));
  }
  if (!input.availability) {
    rejections.push(inputInvalid(pointer("availability"), "a capability declares its availability"));
  }
  if (input.support === "validated" && (input.evidenceArtifactIds ?? []).length === 0) {
    rejections.push(
      inputInvalid(
        pointer("evidenceArtifactIds"),
        `capability ${input.feature} claims validated with no recorded conformance reference`,
      ),
    );
  }
  if ((input.support === "limited" || input.support === "untested") && !input.reason) {
    rejections.push(
      inputInvalid(pointer("reason"), `capability ${input.feature} states why it is ${input.support}`),
    );
  }
  if (input.availability === "unavailable" && !input.reason) {
    rejections.push(
      inputInvalid(pointer("reason"), `capability ${input.feature} is unavailable with no reason given`),
    );
  }
  if (rejections.length > 0) return rejected(...rejections);
  return accepted(input);
}

/**
 * What a deployment currently offers. Availability is a function of deployment
 * state, applied here, and it never touches the stored support level: the
 * revision that was measured is the revision that stays recorded.
 */
export function effectiveAvailability(
  capability: Capability,
  deployment: { readonly available: boolean; readonly queued?: boolean },
): Availability {
  if (!deployment.available) return "unavailable";
  if (deployment.queued) return "queued";
  return capability.availability === "unavailable" ? "unavailable" : "immediate";
}

/** True when the capability is offered immediately, whatever its support level. */
export function isImmediatelyAvailable(capability: Capability): boolean {
  return capability.availability === "immediate";
}

/** The capability for a feature, or `undefined` when the manifest omits it. */
export function capabilityFor(
  capabilities: readonly Capability[],
  feature: string,
): Capability | undefined {
  return capabilities.find((capability) => capability.feature === feature);
}

/**
 * An unsupported request is explained, never substituted: the missing feature is
 * named, with the reason the profile records.
 */
export function explainMissingCapability(
  capabilities: readonly Capability[],
  feature: string,
): { readonly feature: string; readonly reason: string } {
  const capability = capabilityFor(capabilities, feature);
  return {
    feature,
    reason:
      capability?.reason ??
      `the profile declares no capability for ${feature}; no nearby capability is substituted for it`,
  };
}
