/**
 * Assemble the report for one job.
 *
 * A report carries the captured snapshot, scenario and profile beside the
 * result, plus the exact source bytes the job consumed, so a historical
 * finding can be read back after the working files have moved on.
 */

import type {
  AnalysisResult,
  Job,
  ProfileRevision,
  Scenario,
  SnapshotManifest,
} from "@pomset/contracts";

import { evaluateEligibility } from "../../domain/index.js";
import type { AnalysisRepository } from "../ports/AnalysisRepository.js";

export interface AnalysisReport {
  readonly schemaVersion: 1;
  readonly job: Job;
  readonly snapshot: SnapshotManifest;
  readonly scenario: Scenario;
  readonly profile: ProfileRevision;
  readonly analysis?: AnalysisResult;
  readonly eligibility?: ReturnType<typeof evaluateEligibility>;
  readonly sourceFiles: Record<string, { encoding: "base64"; data: string }>;
}

export class GetAnalysis {
  constructor(private readonly repository: AnalysisRepository) {}

  execute(id: string): AnalysisReport {
    const job = this.repository.job(id);
    const snapshot = this.repository.snapshot(job.snapshotId);
    const scenario = this.repository.scenario(job.scenarioId);
    const profile = this.repository.revision(job.profileRevisionId);
    const analysis = job.resultIds?.[0]
      ? this.repository.result(job.resultIds[0])
      : undefined;
    return {
      schemaVersion: 1,
      job,
      snapshot,
      scenario,
      profile,
      ...(analysis
        ? { analysis, eligibility: evaluateEligibility(analysis, scenario) }
        : {}),
      sourceFiles: Object.fromEntries(
        snapshot.files.map((file) => [
          file.path,
          {
            encoding: "base64" as const,
            data: this.repository.bytes(file.sha256).toString("base64"),
          },
        ]),
      ),
    };
  }
}
