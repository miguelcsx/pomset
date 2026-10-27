/**
 * The composition root: the only module that chooses a concrete backend and
 * binds a socket.
 *
 * Everything below it depends on the ports the application layer declares, so
 * swapping SQLite and the child-process supervisor for PostgreSQL and an object
 * store is a change to this file alone.
 */

import { randomBytes } from "node:crypto";
import { createServer } from "node:http";
import { join } from "node:path";

import { REPO_ROOT } from "@pomset/worker";

import { createWorkbenchApp } from "./app.js";
import { createWorkbench } from "./application/Workbench.js";
import { type Exposure, loopbackExposure, publicExposure } from "./interface/middlewares/exposure.js";
import { LocalEngineRunner } from "./infrastructure/engine/LocalEngineRunner.js";
import { LocalAnalysisStore } from "./infrastructure/repository/LocalAnalysisStore.js";
import { openWorkbenchStore } from "./infrastructure/storage/openWorkbenchStore.js";

/** A bearer token shorter than this is guessable, so a public workbench refuses it. */
const MIN_PUBLIC_TOKEN_LENGTH = 32;

export interface WorkbenchOptions {
  readonly directory: string;
  readonly port?: number;
  /**
   * The hostname the platform routes to this process. Its presence makes the
   * workbench public: it binds every interface, answers this name over HTTPS
   * and requires `token`, which it never prints.
   */
  readonly publicHost?: string;
  /** The bearer token for a public workbench, supplied by its operator. */
  readonly token?: string;
}

export interface RunningWorkbench {
  /** The URL to open. A public workbench omits the token, which its operator shares apart. */
  readonly url: string;
  /** The port actually serving, which differs from the request when it was 0. */
  readonly port: number;
  readonly token: string;
  readonly workbench: ReturnType<typeof createWorkbench>;
  close(): Promise<void>;
}

export async function startWorkbench(
  options: WorkbenchOptions,
): Promise<RunningWorkbench> {
  const publicHost = options.publicHost;
  if (publicHost && (!options.token || options.token.length < MIN_PUBLIC_TOKEN_LENGTH))
    throw new Error(
      `A public workbench needs POMSET_WORKBENCH_TOKEN of at least ${MIN_PUBLIC_TOKEN_LENGTH} characters`,
    );

  const opened = openWorkbenchStore(options.directory);
  const local = new LocalAnalysisStore(opened.store, options.directory);
  const engine = new LocalEngineRunner(opened.store, options.directory);
  const workbench = createWorkbench({
    repository: local,
    workspace: local,
    blobs: local,
    engine,
    closeStore: () => opened.close(),
  });

  const token = options.token ?? randomBytes(32).toString("hex");
  let port = options.port ?? 0;
  const exposure: () => Exposure = publicHost
    ? () => publicExposure(publicHost)
    : () => loopbackExposure(port);
  const app = createWorkbenchApp({
    workbench,
    token,
    exposure,
    webRoot: join(REPO_ROOT, "apps/web/out"),
  });

  const server = createServer(app);
  server.requestTimeout = 15000;
  server.headersTimeout = 10000;
  try {
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(port, publicHost ? "0.0.0.0" : "127.0.0.1", resolve);
    });
  } catch (error) {
    await workbench.close();
    throw error;
  }

  const address = server.address();
  if (address && typeof address === "object") port = address.port;

  return {
    url: publicHost
      ? `https://${publicHost}/`
      : `http://127.0.0.1:${port}/#workbench=${token}`,
    port,
    token,
    workbench,
    async close(): Promise<void> {
      await workbench.close();
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    },
  };
}
