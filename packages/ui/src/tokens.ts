/**
 * The shared visual language: a fixed spacing scale and five
 * semantic status roles with a fixed hue across themes. A role *decorates* an
 * independent state; it never replaces one state with a single green "safe"
 * label, and status is never carried by colour alone.
 */

/** Spacing scale in logical pixels. Nothing else is hard-coded. */
export const SPACING = [4, 8, 12, 16, 24, 32] as const;

export type Spacing = (typeof SPACING)[number];

/**
 * The five semantic roles the workbench uses to decorate a result.
 *
 * - `violation` — an actual violation.
 * - `caution`   — potential, limited or untested.
 * - `activity`  — queued or running.
 * - `unknown`   — inconclusive, unsupported or unavailable.
 * - `contract`  — declared or established, with visible assumptions.
 */
export const STATUS_ROLES = [
  "violation",
  "caution",
  "activity",
  "unknown",
  "contract",
] as const;

export type StatusRole = (typeof STATUS_ROLES)[number];

/** A human-readable label for a role, so colour is never the only carrier. */
export const STATUS_ROLE_LABELS: Readonly<Record<StatusRole, string>> = {
  violation: "Violation",
  caution: "Caution",
  activity: "Activity",
  unknown: "Unknown",
  contract: "Declared",
};
