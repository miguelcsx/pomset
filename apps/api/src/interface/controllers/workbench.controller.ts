/**
 * What this workbench is and what it refuses to do.
 *
 * The unavailable list is product copy, not a derived value: CUDA and OpenMP
 * are named with the reason they are absent here. A backend that is missing is
 * reported as missing rather than quietly left out.
 */

import type { NextFunction, Request, Response } from "express";

import type { Workbench } from "../../application/Workbench.js";

const MAX_SOLVER_TIME_MS = 30_000;

const UNAVAILABLE = [
  {
    backend: "cuda",
    reason:
      "CUDA adapter and toolkit conformance are not available in this workbench. Compilation itself does not require a GPU.",
  },
  {
    backend: "openmp",
    reason:
      "User-kernel adapter is not implemented. OpenMP compilation and execution use a CPU.",
  },
] as const;

export function workbenchController(workbench: Workbench) {
  return {
    async get(_request: Request, response: Response, next: NextFunction): Promise<void> {
      try {
        response.json({
          data: {
            mode: "local-symbolic",
            profile: workbench.profile.execute(),
            maxSolverTimeMs: MAX_SOLVER_TIME_MS,
            jobs: await workbench.history.execute(),
            unavailable: UNAVAILABLE,
          },
        });
      } catch (error) {
        next(error);
      }
    },
  };
}
