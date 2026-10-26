/**
 * The property vocabulary.
 *
 * Naming is a closed list plus one explicit escape hatch: a project-local
 * property is admitted only under the reserved `x-` prefix and must carry a
 * declared meaning. A property outside the list that lacks the prefix is
 * rejected rather than accepted as a new name, because an unnamed property
 * cannot be validated against a policy.
 */

export const PROPERTY_IDS = [
  "memoryBounds",
  "outputCoverage",
  "initialization",
  "writeWriteConflict",
  "readWriteConflict",
  "raceFreedom",
  "synchronizationOrdering",
  "deadlockFreedom",
  "numericalAgreement",
  "performanceRegression",
] as const;

export type PropertyId = (typeof PROPERTY_IDS)[number];

/** The reserved prefix under which a project may declare its own property. */
export const EXTENSION_PREFIX = "x-";

const EXTENSION_PATTERN = /^x-[a-z0-9-]{2,64}$/;

const KNOWN: ReadonlySet<string> = new Set(PROPERTY_IDS);

export function isKnownProperty(id: string): id is PropertyId {
  return KNOWN.has(id);
}

/** True for a well-formed project-local extension, `x-` plus a lowercase slug. */
export function isExtensionProperty(id: string): boolean {
  return EXTENSION_PATTERN.test(id);
}

/**
 * A property is admissible when it is known, or is a well-formed `x-` extension.
 * Everything else is refused.
 */
export function isAdmissibleProperty(id: string): boolean {
  return isKnownProperty(id) || isExtensionProperty(id);
}

/**
 * An extension is never admissible for automatic eligibility: a policy cannot
 * require a property whose meaning the product does not implement, so the
 * caller learns it is a declared extension rather than a supported one.
 */
export function isAutoEligibleProperty(id: string): id is PropertyId {
  return isKnownProperty(id);
}
