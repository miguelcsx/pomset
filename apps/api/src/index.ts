/**
 * `@pomset/api`.
 *
 * Two surfaces share one application layer. The local symbolic workbench is
 * what exists today: a single-owner loopback application that captures source
 * as data and never executes it. The hosted HTTP API described by
 * `openapi.yaml` — ownership, authorization, project, snapshot, scenario, job
 * and publication routes — lands here in the `HST` epic and reuses the same use
 * cases behind different adapters.
 */

export { createWorkbenchApp, type WorkbenchAppOptions } from "./app.js";
export { createWorkbench, type Workbench } from "./application/Workbench.js";
export type {
  AnalysisRepository,
  CapturedFile,
} from "./application/ports/AnalysisRepository.js";
export type { EngineRunner } from "./application/ports/EngineRunner.js";
export { ApplicationError, type ErrorKind } from "./domain/errors/ApplicationError.js";
export { startWorkbench, type RunningWorkbench, type WorkbenchOptions } from "./main.js";
