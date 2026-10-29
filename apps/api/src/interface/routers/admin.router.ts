import { Router } from "express";

import type { Platform } from "../../application/Platform.js";
import { adminController } from "../controllers/admin.controller.js";
import { authenticate, requireRole } from "../middlewares/authenticate.middleware.js";

/** The administrator's routes. Each one needs a signed-in administrator. */
export function adminRouter(platform: Platform): Router {
  const router = Router();
  const controller = adminController(platform);

  router.use(authenticate(platform.resolveSession), requireRole("admin"));

  router.get("/users", controller.listUsers);

  return router;
}
