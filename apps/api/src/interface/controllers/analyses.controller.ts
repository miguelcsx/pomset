/**
 * The analysis routes' handlers.
 *
 * A payload is returned under `data` and a failure under `error`, so a caller
 * never has to guess which it received. Each handler delegates to a use case and
 * forwards any failure to the error handler; a status code is chosen here only
 * where the HTTP contract itself decides it, such as the 202 that says the work
 * has been accepted rather than finished.
 *
 * The store answers asynchronously, so the handlers are asynchronous too and
 * catch their own rejections: Express 4 does not await a handler for you.
 */

import type { NextFunction, Request, Response } from "express";

import type { Workbench } from "../../application/Workbench.js";

export function analysesController(workbench: Workbench) {
  return {
    async submit(request: Request, response: Response, next: NextFunction): Promise<void> {
      try {
        response.status(202).json({ data: await workbench.submit.execute(request.body) });
      } catch (error) {
        next(error);
      }
    },

    async get(request: Request, response: Response, next: NextFunction): Promise<void> {
      try {
        response.json({ data: await workbench.report.execute(request.params["id"]!) });
      } catch (error) {
        next(error);
      }
    },

    async cancel(request: Request, response: Response, next: NextFunction): Promise<void> {
      try {
        response.json({ data: await workbench.cancel.execute(request.params["id"]!) });
      } catch (error) {
        next(error);
      }
    },
  };
}
