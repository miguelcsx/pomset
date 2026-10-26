import { Router } from "express";

import type { Workbench } from "../../application/Workbench.js";
import { analysesController } from "../controllers/analyses.controller.js";

export function analysesRouter(workbench: Workbench): Router {
  const router = Router();
  const controller = analysesController(workbench);

  router.post("/", controller.submit);
  router.get("/:id", controller.get);
  router.post("/:id/cancel", controller.cancel);

  return router;
}
