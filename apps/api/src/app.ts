/**
 * Builds the workbench's Express application without binding a port.
 *
 * Separating construction from listening is what lets the transport be
 * exercised — and the security boundary asserted — without opening a socket.
 */

import express from "express";

import type { Workbench } from "./application/Workbench.js";
import { capability } from "./interface/middlewares/capability.middleware.js";
import { errorHandler } from "./interface/middlewares/error-handler.middleware.js";
import { security } from "./interface/middlewares/security.middleware.js";
import { apiRouter } from "./interface/routers/index.js";

export interface WorkbenchAppOptions {
  readonly workbench: Workbench;
  /** The capability printed in the workbench URL. */
  readonly token: string;
  /** Read per request: an ephemeral bind only learns its port after `listen`. */
  readonly boundPort: () => number;
}

export function createWorkbenchApp(options: WorkbenchAppOptions): express.Express {
  const app = express();
  app.disable("x-powered-by");

  app.use(security(options.boundPort));
  app.use("/api", capability(options.token));
  app.use("/api", express.json({ limit: "2mb", strict: true }));
  app.use("/api", apiRouter(options.workbench));
  app.use(errorHandler);

  return app;
}
