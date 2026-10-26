/**
 * The analysis result and the shared error record.
 *
 * A result belongs to the snapshot that was analysed, and it carries the full
 * provenance — snapshot, scenario, domain, policy revision and profile revision
 * — that makes it re-attemptable and comparable. A result without any of those
 * is not constructible.
 *
 * `Job.state` is not part of a result and never implies a correctness verdict. A
 * `succeeded` job may hold violated, unknown and unsupported results; the two are
 * reported separately wherever they appear.
 */

import type { AnalysisResult, ErrorRecord } from "@pomset/contracts";

import { inputInvalid, pointer, rejected, accepted, type Rejection, type Validated } from "./rejection.js";

export type { AnalysisResult, ErrorRecord };

/** Builds the one error record shape, used by every vocabulary consumer. */
export function errorRecord(
  code: ErrorRecord["code"],
  message: string,
  details?: Readonly<Record<string, unknown>>,
): ErrorRecord {
  return details ? { code, message, details } : { code, message };
}

/** The provenance a result must carry to be attributable to a question. */
export interface ResultProvenance {
  readonly snapshotId: string;
  readonly scenarioId: string;
  readonly domainId: string;
  readonly policyRevision: number;
  readonly profileRevisionId: string;
}

export function provenanceOf(result: AnalysisResult): ResultProvenance | undefined {
  if (
    !result.snapshotId ||
    !result.scenarioId ||
    !result.domain?.domainId ||
    result.policyRevision < 1 ||
    !result.profileRevisionId
  ) {
    return undefined;
  }
  return {
    snapshotId: result.snapshotId,
    scenarioId: result.scenarioId,
    domainId: result.domain.domainId,
    policyRevision: result.policyRevision,
    profileRevisionId: result.profileRevisionId,
  };
}

/**
 * Validates a result's provenance and structure. Nothing about a job's state is
 * consulted: a result is a claim about a snapshot, and whether the process that
 * produced it finished says nothing about the claim.
 */
export function createAnalysisResult(input: AnalysisResult): Validated<AnalysisResult> {
  const rejections: Rejection[] = [];

  const provenance = provenanceOf(input);
  if (!provenance) {
    const missing: string[] = [];
    if (!input.snapshotId) missing.push("snapshotId");
    if (!input.scenarioId) missing.push("scenarioId");
    if (!input.domain?.domainId) missing.push("domain.domainId");
    if (input.policyRevision < 1) missing.push("policyRevision");
    if (!input.profileRevisionId) missing.push("profileRevisionId");
    rejections.push(
      inputInvalid(
        pointer(),
        "a result carries the snapshot, scenario, domain, policy and profile it belongs to",
        { missing },
      ),
    );
  }

  if (input.propertyResults.length === 0) {
    rejections.push(
      inputInvalid(pointer("propertyResults"), "a result carries at least one property result"),
    );
  }

  // Findings belong to results, not to the job, so their references must resolve
  // within this result.
  if (input.findings && input.witnesses) {
    const witnessIds = new Set(input.witnesses.map((witness) => witness.witnessId));
    for (const [index, finding] of input.findings.entries()) {
      if (finding.witnessId && !witnessIds.has(finding.witnessId)) {
        rejections.push(
          inputInvalid(
            pointer("findings", String(index), "witnessId"),
            `finding ${finding.findingId} cites witness ${finding.witnessId}, which this result does not carry`,
          ),
        );
      }
    }
  }

  if (rejections.length > 0) return rejected(...rejections);
  return accepted(input);
}

/** The outcome tally of a result, kept separate from any job state. */
export function outcomesOf(result: AnalysisResult): Readonly<Record<string, number>> {
  const tally: Record<string, number> = {};
  for (const property of result.propertyResults) {
    tally[property.outcome] = (tally[property.outcome] ?? 0) + 1;
  }
  return tally;
}
