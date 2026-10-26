/**
 * Launching the engine.
 *
 * The deployment selects the executable; the supervisor writes the request into
 * a read-only file and spawns the child with a fixed argv vector ending in
 * `--request <path>`. The path is an argument, never a shell string, so a request
 * directory containing spaces, quotes or a semicolon changes nothing about how
 * the process is started.
 *
 * The child is put in its own process group, so a cancellation can terminate the
 * whole tree rather than the direct child alone.
 */

import { spawn, type ChildProcess } from "node:child_process";

import { DEFAULT_BUDGET } from "./request.js";
import { writeRequestFile } from "./mounts.js";

export interface LaunchOptions {
  /** The deployment-selected executable. Never supplied by a scenario. */
  readonly executable: string;
  /** Arguments fixed by the deployment, before `--request`. */
  readonly args?: readonly string[];
  readonly request: unknown;
  /** Where the request file is written. Read-only once written. */
  readonly requestPath: string;
  readonly cwd?: string;
  readonly env?: Readonly<Record<string, string>>;
}

export interface LaunchedEngine {
  readonly child: ChildProcess;
  readonly requestPath: string;
}

/**
 * Spawns the engine. `shell` is false so the argv vector reaches the process
 * unchanged and no metacharacter is interpreted.
 */
export function launchEngine(options: LaunchOptions): LaunchedEngine {
  writeRequestFile(options.requestPath, options.request);
  const argv = [...(options.args ?? []), "--request", options.requestPath];
  const child = spawn(options.executable, argv, {
    shell: false,
    detached: true,
    stdio: ["pipe", "pipe", "pipe"],
    ...(options.cwd ? { cwd: options.cwd } : {}),
    env: {
      ...process.env,
      ...(options.env ?? {}),
      // The engine reads its identity from the request, not from the environment.
      POMSET_MAX_MESSAGE_BYTES: String(DEFAULT_BUDGET.maxMessageBytes),
    },
  });
  return { child, requestPath: options.requestPath };
}
