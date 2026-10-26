/** Recover local attempts only when their recorded supervisor process is gone. */
import { execFileSync } from "node:child_process";
import { hostname } from "node:os";
import type { AnalysisResult } from "@pomset/contracts";
import type { LocalStore } from "./local.js";

export interface ProcessIdentity { readonly host: string; readonly pid: number; readonly started: string; }
export function processIdentity(pid = process.pid): ProcessIdentity | undefined {
  try {
    const started = execFileSync("ps", ["-p", String(pid), "-o", "lstart="], { encoding: "utf8" }).trim();
    return started ? { host: hostname(), pid, started } : undefined;
  } catch (error) {
    if ((error as { status?: number }).status === 1) return undefined;
    throw new Error("Local process identity probe unavailable; automatic recovery refused.");
  }
}
function alive(identity: ProcessIdentity): boolean {
  if (identity.host !== hostname()) throw new Error("Automatic recovery requires the recorded local host.");
  return processIdentity(identity.pid)?.started === identity.started;
}
export function recordEngineProcess(store: LocalStore, jobId: string, pid: number): void {
  const identity = processIdentity(pid);
  if (!identity) return;
  store.db.prepare("UPDATE local_owners SET engine=? WHERE job_id=?").run(JSON.stringify(identity), jobId);
}
export function recoverAbandoned(store: LocalStore): string[] {
  const recovered: string[] = [];
  const rows = store.db.prepare("SELECT job_id,owner,engine FROM local_owners").all();
  for (const row of rows) {
    const id = String(row["job_id"]);
    const job = store.job(id);
    if (job.state !== "running" && job.state !== "cancel-requested") continue;
    const owner = JSON.parse(String(row["owner"])) as ProcessIdentity;
    if (alive(owner)) continue;
    if (row["engine"]) {
      const engine = JSON.parse(String(row["engine"])) as ProcessIdentity;
      if (alive(engine)) {
        try { process.kill(-engine.pid, "SIGKILL"); }
        catch (error) { if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error; }
      }
    }
    const results = store.chunks(id).filter((chunk): chunk is { type: "result"; payload: AnalysisResult } =>
      !!chunk && typeof chunk === "object" && "type" in chunk && chunk.type === "result" && "payload" in chunk,
    ).map((chunk) => chunk.payload);
    store.finish(id, results, { code: "ENGINE_FAILED", message: "Supervisor process ended before an atomic completion commit.", details: { recovery: "orphaned-local-attempt", supervisor: owner } });
    recovered.push(id);
  }
  return recovered;
}
