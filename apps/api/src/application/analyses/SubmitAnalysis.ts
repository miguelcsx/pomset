/**
 * Capture a submission as an immutable snapshot and queue it.
 *
 * Everything the job will consume is captured here — the source files, the
 * scenario derived from them and the measured profile — before the engine is
 * asked to do anything. A result therefore belongs to the snapshot that was
 * analysed even after the working files change.
 */

import { randomUUID } from "node:crypto";

import {
  schemaSet,
  type AnalysisSubmission,
  type Job,
  type Scenario,
  type SnapshotManifest,
} from "@pomset/contracts";

import {
  DEFAULT_POLICY,
  badRequest,
  buildManifest,
  canonicalize,
  notFound,
  sha256Of,
  validateScenario,
} from "../../domain/index.js";
import type { AnalysisRepository, CapturedFile } from "../ports/AnalysisRepository.js";
import type { EngineRunner } from "../ports/EngineRunner.js";
import type { AnalysisRunner } from "./AnalysisRunner.js";

const uid = (prefix: string): string => `${prefix}_${randomUUID()}`;

export class SubmitAnalysis {
  constructor(
    private readonly repository: AnalysisRepository,
    private readonly runner: AnalysisRunner,
    private readonly engine: EngineRunner,
  ) {}

  execute(raw: unknown): Job {
    if (this.runner.activeId !== undefined)
      throw badRequest(
        "An analysis is already running. Cancel it or wait before starting another.",
      );

    const accept = schemaSet().validatorFor(
      "domain.schema.yaml#/$defs/analysisSubmission",
    );
    if (!accept(raw))
      throw badRequest(
        `${accept.errors?.[0]?.instancePath} ${accept.errors?.[0]?.message}`,
      );
    const input = raw as AnalysisSubmission;

    const profile = this.engine.probe();
    if (input.profileRevisionId !== profile.profileRevisionId)
      throw notFound(
        `This workbench measured ${profile.profileRevisionId}, not ${input.profileRevisionId}`,
      );

    const validation = validateScenario(input.scenario);
    if (!validation.ok)
      throw badRequest(
        validation.rejections.map((item) => item.record.message).join("; "),
      );

    const paths = new Set<string>();
    for (const file of input.files) {
      if (paths.has(file.path) || file.path.split("/").includes("."))
        throw badRequest(`Duplicate or invalid source path ${file.path}`);
      if (Buffer.byteLength(file.source) > 1_048_576)
        throw badRequest("Source exceeds one megabyte");
      paths.add(file.path);
    }
    if (
      !paths.has(input.scenario.entrypoint.path) ||
      (input.scenario.reference?.path && !paths.has(input.scenario.reference.path))
    )
      throw badRequest("Entry point or reference is missing from working files");

    const parent = input.parentSnapshotId
      ? this.repository.snapshot(input.parentSnapshotId)
      : undefined;
    if (input.parentSnapshotId && !parent)
      throw badRequest("Parent snapshot is not in this workbench store");

    const now = new Date().toISOString();
    const snapshotId = uid("snp");
    const { domainId: _domainId, ...domainContent } = input.scenario.domain;
    const scenario: Scenario = {
      ...input.scenario,
      snapshotId,
      scenarioId: uid("scn"),
      domain: {
        ...input.scenario.domain,
        domainId: `dom_${sha256Of(canonicalize(domainContent)).slice(7)}`,
      },
      createdAt: now,
    };

    // Capture exactly the source and declaration that this job consumes. The
    // declaration is written beside the source, never over it.
    let configPath = "pomset-scenario.json";
    while (paths.has(configPath))
      configPath = `pomset-scenario-${randomUUID()}.json`;
    const files: CapturedFile[] = [
      ...input.files,
      { path: configPath, source: `${JSON.stringify(scenario, null, 2)}\n` },
    ];

    const manifest = buildManifest({
      snapshotId,
      projectId: parent?.projectId ?? uid("prj"),
      createdAt: now,
      ...(parent ? { parentSnapshotId: parent.snapshotId } : {}),
      files: files.map((file) => ({
        path: file.path,
        role:
          file.path === configPath
            ? "config"
            : file.path === scenario.reference?.path
              ? "reference"
              : "source",
        sha256: sha256Of(file.source),
        bytes: Buffer.byteLength(file.source),
      })),
    });
    if (!manifest.ok)
      throw badRequest(`${manifest.rejections[0]?.record.message}`);

    const job: Job = {
      schemaVersion: 1,
      jobId: uid("job"),
      attemptId: uid("att"),
      projectId: manifest.value.projectId,
      snapshotId,
      scenarioId: scenario.scenarioId,
      profileRevisionId: profile.profileRevisionId,
      operation: "full",
      domainRef: scenario.domain.domainId,
      policyId: DEFAULT_POLICY.policyId,
      policyRevision: DEFAULT_POLICY.policyRevision,
      state: "queued",
      createdAt: now,
    };

    const directory = this.repository.runDirectory(job.jobId);
    try {
      this.repository.captureRun(directory, files, scenario);
      this.repository.record(manifest.value as SnapshotManifest, scenario, profile);
      this.repository.enqueue(job);
    } catch (error) {
      this.repository.removeRun(directory);
      throw error;
    }

    this.runner.start(job, directory, input.solverTimeMs);
    return job;
  }
}
