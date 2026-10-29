/**
 * The `/api` surface.
 *
 * An unmatched operation is answered here rather than falling through to the
 * error handler, so an unknown path is a 404 and not a 500. The workbench's
 * read-only description stays public, and lists an analysis only to the account
 * that submitted it.
 */

import { Router } from "express";

import type { Platform } from "../../application/Platform.js";
import { adminRouter } from "./admin.router.js";
import { analysesRouter } from "./analyses.router.js";
import { type AuthLimits, authRouter } from "./auth.router.js";
import { scriptsRouter } from "./scripts.router.js";
import { workbenchRouter } from "./workbench.router.js";

export function apiRouter(platform: Platform, limits: AuthLimits): Router {
  const router = Router();

  router.use("/workbench", workbenchRouter(platform));
  router.use("/auth", authRouter(platform, limits));
  router.use("/scripts", scriptsRouter(platform));
  router.use("/admin", adminRouter(platform));
  router.use("/analyses", analysesRouter(platform));

  router.use((_request, response) => {
    response.status(404).json({ error: "No such workbench operation", code: "not_found" });
  });

  return router;
}
