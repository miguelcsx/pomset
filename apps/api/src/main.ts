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
import { LocalEngineRunner } from "./infrastructure/engine/LocalEngineRunner.js";
import { LocalAnalysisStore } from "./infrastructure/repository/LocalAnalysisStore.js";
import { openWorkbenchStore } from "./infrastructure/storage/openWorkbenchStore.js";

export interface WorkbenchOptions {
  readonly directory: string;
  readonly port?: number;
}

export interface RunningWorkbench {
  readonly url: string;
  readonly token: string;
  readonly workbench: ReturnType<typeof createWorkbench>;
  close(): Promise<void>;
}

export async function startWorkbench(
  options: WorkbenchOptions,
): Promise<RunningWorkbench> {
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

  const token = randomBytes(32).toString("hex");
  let port = options.port ?? 0;
  const app = createWorkbenchApp({
    workbench,
    token,
    boundPort: () => port,
    webRoot: join(REPO_ROOT, "apps/web/out"),
  });

  const server = createServer(app);
  server.requestTimeout = 15000;
  server.headersTimeout = 10000;
  try {
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(port, "127.0.0.1", resolve);
    });
  } catch (error) {
    await workbench.close();
    throw error;
  }

  const address = server.address();
  if (address && typeof address === "object") port = address.port;

  return {
    url: `http://127.0.0.1:${port}/#workbench=${token}`,
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
