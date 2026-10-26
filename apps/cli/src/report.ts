/**
 * The machine-readable report and the three exit statuses.
 *
 * Every invocation writes one report, and the exit status is only a summary of
 * it: `0` when the requested policy is satisfied, `1` when an actual property
 * failed, and `2` when the input is invalid, a required analysis is unsupported,
 * a required result is unknown, or the engine failed. Status `2` aggregates
 * distinct causes, so the report must keep them apart — the status alone never
 * says which.
 */

export const EXIT_SATISFIED = 0;
export const EXIT_FAILED = 1;
export const EXIT_ERROR = 2;

export interface ReportProperty {
  readonly propertyId: string;
  readonly outcome: string;
  readonly method: string;
  readonly evidenceClass: string;
  readonly unknownReason?: string;
  readonly unsupportedReason?: string;
}

export interface Report {
  readonly schemaVersion: 1;
  readonly tool: { readonly name: string; readonly version: string };
  readonly jobId: string;
  readonly scenarioId: string;
  readonly snapshotId: string;
  readonly profileRevisionId: string;
  readonly policyId: string;
  readonly policyRevision: number;
  readonly properties: readonly ReportProperty[];
  /** Present when the run produced no result at all. */
  readonly failure?: { readonly code: string; readonly message: string };
  /** What qualified every number in this report. */
  readonly qualifiers: {
    readonly coverage: { readonly kind: string; readonly pointCount?: number };
    readonly assumptions: readonly string[];
    readonly budget: Readonly<Record<string, number>>;
    readonly solverVersion?: string;
  };
  /** The events the run emitted, in order, for a reader to replay. */
  readonly events: readonly { readonly sequence: number; readonly type: string }[];
  readonly diagnostics?: { readonly redactionRevision: string; readonly messages: readonly string[]; readonly termination: string };
  readonly analysis?: import("@pomset/contracts").AnalysisResult;
  readonly snapshot?: import("@pomset/contracts").SnapshotManifest;
  readonly scenario?: import("@pomset/contracts").Scenario;
  readonly profile?: import("@pomset/contracts").ProfileRevision;
  readonly job?: import("@pomset/contracts").Job;
  readonly sourceFiles?: Readonly<Record<string, { readonly encoding: "base64"; readonly data: string }>>;
}

/** The worst status any property implies, which is the status of the run. */
export function exitStatusFor(properties: readonly ReportProperty[]): number {
  if (properties.some((property) => property.outcome === "violated")) return EXIT_FAILED;
  if (
    properties.some((property) => property.outcome === "unknown" || property.outcome === "unsupported")
  ) {
    return EXIT_ERROR;
  }
  if (properties.length > 0 && properties.every((property) => property.outcome === "established")) return EXIT_SATISFIED;
  return EXIT_ERROR;
}
