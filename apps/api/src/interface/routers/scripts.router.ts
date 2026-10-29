import { Router } from "express";

import type { Platform } from "../../application/Platform.js";
import { authenticate } from "../middlewares/authenticate.middleware.js";
import { scriptsController } from "../controllers/scripts.controller.js";

/** Scripts and the results saved against them. Every route needs a signed-in account. */
export function scriptsRouter(platform: Platform): Router {
  const router = Router();
  const controller = scriptsController(platform);

  router.use(authenticate(platform.resolveSession));

  router.get("/", controller.list);
  router.post("/", controller.create);
  router.get("/:id", controller.get);
  router.put("/:id", controller.update);
  router.delete("/:id", controller.remove);

  router.get("/:id/results", controller.listResults);
  router.post("/:id/results", controller.saveResult);
  router.get("/:id/results/:resultId", controller.getResult);
  router.delete("/:id/results/:resultId", controller.removeResult);

  return router;
}
