/**
 * Process-tree termination.
 *
 * The child is spawned as its own process-group leader, so signalling the group
 * reaches descendants too. A cooperative engine is never the only control: after
 * the grace period the tree is killed whether or not the engine acknowledged.
 */

import type { ChildProcess } from "node:child_process";

/** True once the child has stopped, whether it exited or was signalled. */
export function hasStopped(child: ChildProcess): boolean {
  return child.exitCode !== null || child.signalCode !== null;
}

/** Signals the child's whole process group, then escalates. */
export function killProcessTree(child: ChildProcess, signal: NodeJS.Signals = "SIGTERM"): void {
  if (child.pid === undefined) return;
  try {
    // A negative pid addresses the process group the child leads.
    process.kill(-child.pid, signal);
  } catch {
    // The group is already gone, or was never created; fall back to the child.
    try {
      if (!hasStopped(child)) child.kill(signal);
    } catch {
      // Nothing left to signal.
    }
  }
}

/** Kills the tree and reports how it actually stopped. */
export async function terminateProcessTree(
  child: ChildProcess,
  graceMs: number,
): Promise<"cooperative" | "killed"> {
  if (hasStopped(child)) return "cooperative";
  const exited = new Promise<void>((resolve) => child.once("exit", () => resolve()));
  killProcessTree(child, "SIGTERM");
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<"timeout">((resolve) => {
    timer = setTimeout(() => resolve("timeout"), graceMs);
  });
  const outcome = await Promise.race([exited.then(() => "exited" as const), timeout]);
  if (timer) clearTimeout(timer);
  if (outcome === "exited") return "cooperative";
  killProcessTree(child, "SIGKILL");
  await exited;
  return "killed";
}
