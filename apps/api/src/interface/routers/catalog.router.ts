import { Router } from "express";

import type { Platform } from "../../application/Platform.js";
import { catalogController } from "../controllers/catalog.controller.js";
import { authenticate, requireRole } from "../middlewares/authenticate.middleware.js";

/**
 * The catalog. Reading it needs no account; writing it needs an administrator,
 * and saving a copy into one's own scripts needs a signed-in account.
 */
export function catalogRouter(platform: Platform): Router {
  const router = Router();
  const controller = catalogController(platform);
  const signedIn = authenticate(platform.resolveSession);
  const administrator = [signedIn, requireRole("admin")];

  router.get("/", controller.list);
  router.get("/:id", controller.get);
  router.post("/:id/scripts", signedIn, controller.saveToScripts);

  router.post("/", ...administrator, controller.create);
  router.put("/:id", ...administrator, controller.update);
  router.delete("/:id", ...administrator, controller.remove);

  return router;
}
