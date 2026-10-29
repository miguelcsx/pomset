/**
 * Builds the workbench's Express application without binding a port.
 *
 * Separating construction from listening is what lets the transport be
 * exercised — and the security boundary asserted — without opening a socket.
 *
 * The exported client is mounted from the same origin as the API, so the
 * browser never makes a cross-origin request and the workbench keeps one host
 * and one origin. When the export is absent the server says how to produce it
 * rather than answering with a bare 404.
 *
 * Two credentials can stand in front of the API. The accounts are always there.
 * The local capability is an extra layer that only the local mode configures.
 */

import { existsSync } from "node:fs";

import express from "express";

import type { Platform } from "./application/Platform.js";
import { capability } from "./interface/middlewares/capability.middleware.js";
import { errorHandler } from "./interface/middlewares/error-handler.middleware.js";
import type { Exposure } from "./interface/middlewares/exposure.js";
import { sameOriginWrites } from "./interface/middlewares/same-origin.middleware.js";
import { security } from "./interface/middlewares/security.middleware.js";
import type { AuthLimits } from "./interface/routers/auth.router.js";
import { apiRouter } from "./interface/routers/index.js";

const NO_CLIENT = [
  "The workbench API is running, but the client has not been built.",
  "Build it with:  pnpm --filter @pomset/web build",
  "Or develop against it with:  pnpm dev   (Next.js on http://localhost:3000)",
  "",
].join("\n");

/** A request body may carry a saved script's source, which can be a megabyte. */
const JSON_LIMIT = "3mb";

export interface WorkbenchAppOptions {
  readonly platform: Platform;
  readonly authLimits: AuthLimits;
  /** The local capability, presented in `X-Workbench-Token`. Absent in public mode. */
  readonly capabilityToken?: string | undefined;
  /** Read per request: an ephemeral bind only learns its port after `listen`. */
  readonly exposure: () => Exposure;
  /** The exported client, served from this origin. Absent in development. */
  readonly webRoot?: string | undefined;
  /** Set behind a platform proxy, so the caller's address is the forwarded one. */
  readonly trustProxy?: boolean | undefined;
}

export function createWorkbenchApp(options: WorkbenchAppOptions): express.Express {
  const app = express();
  app.disable("x-powered-by");
  if (options.trustProxy) app.set("trust proxy", 1);

  // Liveness carries no workbench state, so a platform probe can reach it
  // without knowing the public Host or holding any credential.
  app.get("/healthz", (_request, response) => {
    response.set("Cache-Control", "no-store").json({ status: "ok" });
  });

  app.use(security(options.exposure));
  app.use("/api", sameOriginWrites(options.exposure));
  if (options.capabilityToken !== undefined)
    app.use("/api", capability(options.capabilityToken));
  app.use("/api", express.json({ limit: JSON_LIMIT, strict: true }));
  app.use("/api", apiRouter(options.platform, options.authLimits));

  const webRoot = options.webRoot;
  if (webRoot && existsSync(webRoot))
    app.use(express.static(webRoot, { index: "index.html", dotfiles: "deny" }));
  else app.use((_request, response) => {
    response.status(404).type("text/plain").send(NO_CLIENT);
  });

  app.use(errorHandler);

  return app;
}
