import { Router } from "express";

import type { Platform } from "../../application/Platform.js";
import { analysesController } from "../controllers/analyses.controller.js";
import { authenticate } from "../middlewares/authenticate.middleware.js";

/** Analyses the signed-in account submitted. Anyone else's analysis is not found. */
export function analysesRouter(platform: Platform): Router {
  const router = Router();
  const controller = analysesController(platform);

  router.use(authenticate(platform.resolveSession));

  router.get("/", controller.history);
  router.post("/", controller.submit);
  router.get("/:id", controller.get);
  router.post("/:id/cancel", controller.cancel);

  return router;
}
