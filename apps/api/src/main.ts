/**
 * The composition root: the only module that chooses a concrete backend and
 * binds a socket.
 *
 * Everything below it depends on the ports the application layer declares, so
 * swapping SQLite and the child-process supervisor for PostgreSQL and an object
 * store is a change to this file alone.
 *
 * A public workbench is reached by strangers, so it has no local capability:
 * its only credential is an account, and its session tokens are signed with a
 * secret the operator supplies. A local workbench keeps the capability printed
 * in its URL and signs with a secret that lasts only for that run.
 */

import { randomBytes } from "node:crypto";
import { createServer } from "node:http";
import { join } from "node:path";

import { REPO_ROOT } from "@pomset/worker";

import { createWorkbenchApp } from "./app.js";
import { createWorkbench } from "./application/Workbench.js";
import { createPlatform } from "./application/Platform.js";
import { type DemoPasswords, seedDemoAccounts } from "./application/accounts/SeedDemoAccounts.js";
import { type Exposure, loopbackExposure, publicExposure } from "./interface/middlewares/exposure.js";
import type { AuthLimits } from "./interface/routers/auth.router.js";
import { LocalEngineRunner } from "./infrastructure/engine/LocalEngineRunner.js";
import { BcryptPasswordHasher } from "./infrastructure/accounts/BcryptPasswordHasher.js";
import { JwtSessionTokens } from "./infrastructure/accounts/JwtSessionTokens.js";
import { PrismaAnalysisOwners } from "./infrastructure/accounts/PrismaAnalysisOwners.js";
import { PrismaCatalogRepository } from "./infrastructure/accounts/PrismaCatalogRepository.js";
import { PrismaResultRepository } from "./infrastructure/accounts/PrismaResultRepository.js";
import { PrismaScriptRepository } from "./infrastructure/accounts/PrismaScriptRepository.js";
import { PrismaUserRepository } from "./infrastructure/accounts/PrismaUserRepository.js";
import { openAccountsStore } from "./infrastructure/accounts/openAccountsStore.js";
import { FixedWindowLimiter } from "./infrastructure/limits/FixedWindowLimiter.js";
import { LocalAnalysisStore } from "./infrastructure/repository/LocalAnalysisStore.js";
import { openWorkbenchStore } from "./infrastructure/storage/openWorkbenchStore.js";

/** A secret shorter than this is guessable, so a public workbench refuses it. */
const MIN_PUBLIC_SECRET_LENGTH = 32;

const ACCOUNTS_FILE = "accounts.sqlite";
const MINUTE = 60_000;

export interface WorkbenchOptions {
  readonly directory: string;
  readonly port?: number;
  /**
   * The hostname the platform routes to this process. Its presence makes the
   * workbench public: it binds every interface, answers this name over HTTPS,
   * and requires `jwtSecret`.
   */
  readonly publicHost?: string;
  /** Signs session tokens. Required for a public workbench; a local one makes its own. */
  readonly jwtSecret?: string;
  /** Creates the demo accounts with these passwords. Each account is created only once. */
  readonly demoAccounts?: DemoPasswords;
}

export interface RunningWorkbench {
  /** The URL to open. A public workbench omits the capability, which has no meaning there. */
  readonly url: string;
  /** The port actually serving, which differs from the request when it was 0. */
  readonly port: number;
  /** The local capability, or `undefined` for a public workbench. */
  readonly capability: string | undefined;
  readonly workbench: ReturnType<typeof createWorkbench>;
  close(): Promise<void>;
}

export async function startWorkbench(options: WorkbenchOptions): Promise<RunningWorkbench> {
  const publicHost = options.publicHost;
  if (publicHost && (!options.jwtSecret || options.jwtSecret.length < MIN_PUBLIC_SECRET_LENGTH))
    throw new Error(
      `A public workbench needs JWT_SECRET of at least ${MIN_PUBLIC_SECRET_LENGTH} characters`,
    );
  const jwtSecret = options.jwtSecret ?? randomBytes(32).toString("hex");

  const opened = openWorkbenchStore(options.directory);
  const accounts = await openAccountsStore(join(options.directory, ACCOUNTS_FILE)).catch(
    async (error: unknown) => {
      await opened.close();
      throw error;
    },
  );
  const closeStores = async (): Promise<void> => {
    await accounts.close();
    await opened.close();
  };

  const hasher = new BcryptPasswordHasher();
  try {
    if (options.demoAccounts) {
      const users = new PrismaUserRepository(accounts.prisma);
      await seedDemoAccounts({ users, hasher, now: () => new Date() }, options.demoAccounts);
    }
  } catch (error) {
    await closeStores();
    throw error;
  }

  const local = new LocalAnalysisStore(opened.store, options.directory);
  const engine = new LocalEngineRunner(opened.store, options.directory);
  const workbench = createWorkbench({
    repository: local,
    workspace: local,
    blobs: local,
    engine,
    closeStore: closeStores,
  });

  const platform = createPlatform({
    workbench,
    users: new PrismaUserRepository(accounts.prisma),
    scripts: new PrismaScriptRepository(accounts.prisma),
    catalog: new PrismaCatalogRepository(accounts.prisma),
    results: new PrismaResultRepository(accounts.prisma),
    owners: new PrismaAnalysisOwners(accounts.prisma),
    hasher,
    tokens: new JwtSessionTokens(jwtSecret),
  });

  const capability = publicHost ? undefined : randomBytes(32).toString("hex");
  let port = options.port ?? 0;
  const exposure: () => Exposure = publicHost
    ? () => publicExposure(publicHost)
    : () => loopbackExposure(port);
  const app = createWorkbenchApp({
    platform,
    authLimits: authLimits(),
    capabilityToken: capability,
    exposure,
    webRoot: join(REPO_ROOT, "apps/web/out"),
    trustProxy: publicHost !== undefined,
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
    url: publicHost ? `https://${publicHost}/` : `http://127.0.0.1:${port}/#workbench=${capability}`,
    port,
    capability,
    workbench,
    async close(): Promise<void> {
      await workbench.close();
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    },
  };
}

/**
 * The attempt limits. Each limiter is built once per process, so its counts
 * survive between requests; a restart clears them, which is acceptable for a
 * single-instance deployment.
 */
function authLimits(): AuthLimits {
  return {
    register: new FixedWindowLimiter({ windowMs: 60 * MINUTE, max: 10 }),
    signIn: new FixedWindowLimiter({ windowMs: 15 * MINUTE, max: 30 }),
    signInByEmail: new FixedWindowLimiter({ windowMs: 15 * MINUTE, max: 10 }),
  };
}
