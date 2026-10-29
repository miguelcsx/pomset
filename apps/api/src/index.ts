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
export { createWorkbench, type Workbench, type WorkbenchDependencies } from "./application/Workbench.js";
export type { AnalysisRepository } from "./application/ports/AnalysisRepository.js";
export type { BlobStore } from "./application/ports/BlobStore.js";
export type { EngineRunner } from "./application/ports/EngineRunner.js";
export type { CapturedFile, RunWorkspace } from "./application/ports/RunWorkspace.js";
export { createPlatform, type Platform, type PlatformDependencies } from "./application/Platform.js";
export { ApplicationError, type ErrorKind } from "./domain/errors/ApplicationError.js";
export { type DemoPasswords } from "./application/accounts/SeedDemoAccounts.js";
export { startWorkbench, type RunningWorkbench, type WorkbenchOptions } from "./main.js";
