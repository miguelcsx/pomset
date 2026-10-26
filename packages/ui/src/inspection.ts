/** The inspector reads portable records; it does not analyze or grant eligibility. */
import type { AnalysisResult, Job, ProfileRevision, Scenario, SnapshotManifest, SourceRange } from "@pomset/contracts";

export interface InspectionDocument {
  readonly analysis: AnalysisResult;
  readonly scenario: Scenario;
  readonly snapshot: SnapshotManifest;
  readonly profile: ProfileRevision;
  readonly job?: Job;
  readonly sourceFiles: Readonly<Record<string, { readonly encoding: "base64"; readonly data: string }>>;
}
export interface SourceSelection {
  readonly path: string;
  readonly line: number;
  readonly ranges?: readonly SourceRange[];
}
