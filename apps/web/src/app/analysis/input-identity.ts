import type { Scenario } from "@pomset/contracts";
import type { WorkingCopy } from "../workspace/working-copy.js";
/** Captured IDs and timestamps change on submission; semantic input identity does not. */
export function inputIdentity(copy: WorkingCopy, scenario: Scenario, profileId: string, solverTimeMs: number): string {
  const { scenarioId: _scenario, snapshotId: _snapshot, createdAt: _created, domain, ...declaration } = scenario;
  const { domainId: _domain, ...domainContent } = domain;
  return JSON.stringify({ files: [...copy.files].sort((a, b) => a.path.localeCompare(b.path)), scenario: { ...declaration, domain: domainContent }, profileId, solverTimeMs });
}
