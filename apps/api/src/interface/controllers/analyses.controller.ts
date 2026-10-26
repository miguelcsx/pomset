/**
 * The analysis routes' handlers.
 *
 * Each one delegates to a use case and forwards any failure to the error
 * handler. A status code is chosen here only where the HTTP contract itself
 * decides it, such as the 202 that says the work has been accepted rather than
 * finished.
 */

import type { NextFunction, Request, Response } from "express";

import type { Workbench } from "../../application/Workbench.js";

export function analysesController(workbench: Workbench) {
  return {
    submit(request: Request, response: Response, next: NextFunction): void {
      try {
        response.status(202).json(workbench.submit.execute(request.body));
      } catch (error) {
        next(error);
      }
    },

    get(request: Request, response: Response, next: NextFunction): void {
      try {
        response.json(workbench.report.execute(request.params["id"]!));
      } catch (error) {
        next(error);
      }
    },

    cancel(request: Request, response: Response, next: NextFunction): void {
      try {
        response.json(workbench.cancel.execute(request.params["id"]!));
      } catch (error) {
        next(error);
      }
    },
  };
}
