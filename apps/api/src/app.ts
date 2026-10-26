/**
 * Builds the workbench's Express application without binding a port.
 *
 * Separating construction from listening is what lets the transport be
 * exercised — and the security boundary asserted — without opening a socket.
 *
 * The exported client is mounted from the same origin as the API, so the
 * browser never makes a cross-origin request and the workbench keeps one host,
 * one origin and one capability. When the export is absent the server says how
 * to produce it rather than answering with a bare 404.
 */

import { existsSync } from "node:fs";

import express from "express";

import type { Workbench } from "./application/Workbench.js";
import { capability } from "./interface/middlewares/capability.middleware.js";
import { errorHandler } from "./interface/middlewares/error-handler.middleware.js";
import { security } from "./interface/middlewares/security.middleware.js";
import { apiRouter } from "./interface/routers/index.js";

const NO_CLIENT = [
  "The workbench API is running, but the client has not been built.",
  "Build it with:  pnpm --filter @pomset/web build",
  "Or develop against it with:  pnpm dev   (Next.js on http://localhost:3000)",
  "",
].join("\n");

export interface WorkbenchAppOptions {
  readonly workbench: Workbench;
  /** The capability printed in the workbench URL. */
  readonly token: string;
  /** Read per request: an ephemeral bind only learns its port after `listen`. */
  readonly boundPort: () => number;
  /** The exported client, served from this origin. Absent in development. */
  readonly webRoot?: string;
}

export function createWorkbenchApp(options: WorkbenchAppOptions): express.Express {
  const app = express();
  app.disable("x-powered-by");

  app.use(security(options.boundPort));
  app.use("/api", capability(options.token));
  app.use("/api", express.json({ limit: "2mb", strict: true }));
  app.use("/api", apiRouter(options.workbench));

  const webRoot = options.webRoot;
  if (webRoot && existsSync(webRoot))
    app.use(express.static(webRoot, { index: "index.html", dotfiles: "deny" }));
  else app.use((_request, response) => {
    response.status(404).type("text/plain").send(NO_CLIENT);
  });

  app.use(errorHandler);

  return app;
}
