/**
 * What this workbench is and what it refuses to do.
 *
 * The unavailable list is product copy, not a derived value: CUDA and OpenMP
 * are named with the reason they are absent here. A backend that is missing is
 * reported as missing rather than quietly left out.
 */

import type { NextFunction, Request, Response } from "express";

import type { Platform } from "../../application/Platform.js";
import type { Account } from "../../domain/accounts/Account.js";
import { MAX_PAGE_SIZE } from "../../domain/pagination.js";

const MAX_SOLVER_TIME_MS = 30_000;

/** The newest analyses the description lists: the first page at the largest size. */
const FIRST_PAGE = { page: 1, pageSize: MAX_PAGE_SIZE } as const;

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

/**
 * `jobs` is the signed-in account's own history, and empty for anyone else.
 * Nothing about another account's analyses is ever part of this description.
 */
export function workbenchController(platform: Platform) {
  return {
    async get(_request: Request, response: Response, next: NextFunction): Promise<void> {
      try {
        const account = response.locals["account"] as Account | undefined;
        response.json({
          data: {
            mode: "local-symbolic",
            profile: platform.workbench.profile.execute(),
            maxSolverTimeMs: MAX_SOLVER_TIME_MS,
            jobs: account ? (await platform.analyses.history(account.id, FIRST_PAGE)).items : [],
            unavailable: UNAVAILABLE,
          },
        });
      } catch (error) {
        next(error);
      }
    },
  };
}
