/**
 * The `/api` surface.
 *
 * An unmatched operation is answered here rather than falling through to the
 * error handler, so an unknown path is a 404 and not a 500.
 */

import { Router } from "express";

import type { Workbench } from "../../application/Workbench.js";
import { analysesRouter } from "./analyses.router.js";
import { workbenchRouter } from "./workbench.router.js";

export function apiRouter(workbench: Workbench): Router {
  const router = Router();

  router.use("/workbench", workbenchRouter(workbench));
  router.use("/analyses", analysesRouter(workbench));

  router.use((_request, response) => {
    response.status(404).json({ error: "No such workbench operation" });
  });

  return router;
}
