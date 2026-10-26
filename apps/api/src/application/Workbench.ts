/**
 * The application layer's public surface.
 *
 * It composes the use cases once, in one place, so no controller builds its own
 * collaborators: a controller receives what it needs and nothing else. The
 * single-analysis constraint is shared by submission and cancellation, which is
 * why the runner is created here rather than inside either use case.
 *
 * The ports are passed in separately even though the local backend happens to be
 * one object, because that is the arrangement a hosted deployment needs: records
 * in PostgreSQL, bytes in an object store, and no run directory at all.
 */

import type { AnalysisRepository } from "./ports/AnalysisRepository.js";
import type { BlobStore } from "./ports/BlobStore.js";
import type { EngineRunner } from "./ports/EngineRunner.js";
import type { RunWorkspace } from "./ports/RunWorkspace.js";
import { AnalysisRunner } from "./analyses/AnalysisRunner.js";
import { CancelAnalysis } from "./analyses/CancelAnalysis.js";
import { GetAnalysis } from "./analyses/GetAnalysis.js";
import { GetProfile } from "./analyses/GetProfile.js";
import { ListAnalyses } from "./analyses/ListAnalyses.js";
import { SubmitAnalysis } from "./analyses/SubmitAnalysis.js";

export interface WorkbenchDependencies {
  readonly repository: AnalysisRepository;
  readonly workspace: RunWorkspace;
  readonly blobs: BlobStore;
  readonly engine: EngineRunner;
  /** Releases the store this workbench owns. */
  readonly closeStore: () => void;
}

export interface Workbench {
  readonly submit: SubmitAnalysis;
  readonly report: GetAnalysis;
  readonly cancel: CancelAnalysis;
  readonly history: ListAnalyses;
  readonly profile: GetProfile;
  close(): Promise<void>;
}

export function createWorkbench(dependencies: WorkbenchDependencies): Workbench {
  const runner = new AnalysisRunner(dependencies.engine);
  return {
    submit: new SubmitAnalysis(
      dependencies.repository,
      dependencies.workspace,
      runner,
      dependencies.engine,
    ),
    report: new GetAnalysis(dependencies.repository, dependencies.blobs),
    cancel: new CancelAnalysis(dependencies.repository, runner),
    history: new ListAnalyses(dependencies.repository),
    profile: new GetProfile(dependencies.engine),
    async close(): Promise<void> {
      const activeId = runner.activeId;
      if (activeId !== undefined) {
        dependencies.repository.cancel(activeId);
        runner.abort(activeId);
        await runner.drain();
      }
      dependencies.closeStore();
    },
  };
}
