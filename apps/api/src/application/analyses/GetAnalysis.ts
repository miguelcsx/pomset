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
import type { BlobStore } from "../ports/BlobStore.js";

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
  constructor(
    private readonly repository: AnalysisRepository,
    private readonly blobs: BlobStore,
  ) {}

  async execute(id: string): Promise<AnalysisReport> {
    const job = await this.repository.job(id);
    const [snapshot, scenario, profile] = await Promise.all([
      this.repository.snapshot(job.snapshotId),
      this.repository.scenario(job.scenarioId),
      this.repository.revision(job.profileRevisionId),
    ]);
    const resultId = job.resultIds?.[0];
    const analysis = resultId
      ? await this.repository.result(resultId)
      : undefined;
    const sourceFiles = await Promise.all(
      snapshot.files.map(async (file) => [
        file.path,
        {
          encoding: "base64" as const,
          data: (await this.blobs.bytes(file.sha256)).toString("base64"),
        },
      ] as const),
    );
    return {
      schemaVersion: 1,
      job,
      snapshot,
      scenario,
      profile,
      ...(analysis
        ? { analysis, eligibility: evaluateEligibility(analysis, scenario) }
        : {}),
      sourceFiles: Object.fromEntries(sourceFiles),
    };
  }
}
