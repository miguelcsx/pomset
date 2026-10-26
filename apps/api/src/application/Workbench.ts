/**
 * The application layer's public surface.
 *
 * It composes the use cases once, in one place, so no controller builds its own
 * collaborators: a controller receives what it needs and nothing else. The
 * single-analysis constraint is shared by submission and cancellation, which is
 * why the runner is created here rather than inside either use case.
 */

import type { AnalysisRepository } from "./ports/AnalysisRepository.js";
import type { EngineRunner } from "./ports/EngineRunner.js";
import { AnalysisRunner } from "./analyses/AnalysisRunner.js";
import { CancelAnalysis } from "./analyses/CancelAnalysis.js";
import { GetAnalysis } from "./analyses/GetAnalysis.js";
import { GetProfile } from "./analyses/GetProfile.js";
import { ListAnalyses } from "./analyses/ListAnalyses.js";
import { SubmitAnalysis } from "./analyses/SubmitAnalysis.js";

export interface Workbench {
  readonly submit: SubmitAnalysis;
  readonly report: GetAnalysis;
  readonly cancel: CancelAnalysis;
  readonly history: ListAnalyses;
  readonly profile: GetProfile;
  close(): Promise<void>;
}

export function createWorkbench(
  repository: AnalysisRepository,
  engine: EngineRunner,
): Workbench {
  const runner = new AnalysisRunner(engine);
  return {
    submit: new SubmitAnalysis(repository, runner, engine),
    report: new GetAnalysis(repository),
    cancel: new CancelAnalysis(repository, runner),
    history: new ListAnalyses(repository),
    profile: new GetProfile(engine),
    async close(): Promise<void> {
      const activeId = runner.activeId;
      if (activeId !== undefined) {
        repository.cancel(activeId);
        runner.abort(activeId);
        await runner.drain();
      }
      repository.close();
    },
  };
}
