import { Router } from "express";

import type { Platform } from "../../application/Platform.js";
import { workbenchController } from "../controllers/workbench.controller.js";
import { optionalAccount } from "../middlewares/authenticate.middleware.js";

/** Public description; a signed-in caller also gets their own history. */
export function workbenchRouter(platform: Platform): Router {
  const router = Router();
  const controller = workbenchController(platform);

  router.get("/", optionalAccount(platform.resolveSession), controller.get);

  return router;
}
