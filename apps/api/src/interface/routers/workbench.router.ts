import { Router } from "express";

import type { Workbench } from "../../application/Workbench.js";
import { workbenchController } from "../controllers/workbench.controller.js";

export function workbenchRouter(workbench: Workbench): Router {
  const router = Router();
  const controller = workbenchController(workbench);

  router.get("/", controller.get);

  return router;
}
