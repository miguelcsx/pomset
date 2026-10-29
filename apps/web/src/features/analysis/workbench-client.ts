import { schemaSet } from "@pomset/contracts/browser";
import type { AnalysisSubmission, Job, ProfileRevision } from "@pomset/contracts";
import { apiRequest, unwrap, workbenchCapability } from "../common/http";

export { unwrap };
export interface Connection { profile: ProfileRevision; jobs: Job[]; maxSolverTimeMs: number; unavailable: { backend: string; reason: string }[]; }
export const workbenchToken = workbenchCapability;

/** Analyses belong to a signed-in account, so every call sends its session token. */
export async function request(path: string, body?: unknown, signal?: AbortSignal): Promise<unknown> {
  const options = { auth: "required" as const, ...(body === undefined ? {} : { body }), ...(signal ? { signal } : {}) };
  return unwrap(await apiRequest(path, options));
}
export function jobRecord(value: unknown): Job {
  if (!schemaSet().validatorFor("engine.schema.yaml#/$defs/job")(value)) throw new Error("Invalid job response");
  return value as Job;
}
/** The configuration is public, so it is requested with the session token only when one exists. */
export async function connect(): Promise<Connection> {
  const value = unwrap(await apiRequest("/api/workbench", { auth: "optional" }));
  if (!value || typeof value !== "object" || !("profile" in value) || !schemaSet().validatorFor("domain.schema.yaml#/$defs/profileRevision")(value.profile) || !("jobs" in value) || !Array.isArray(value.jobs)) throw new Error("Invalid workbench configuration");
  value.jobs.forEach(jobRecord);
  if (!("maxSolverTimeMs" in value) || !Number.isSafeInteger(value.maxSolverTimeMs) || Number(value.maxSolverTimeMs) < 1 || !("unavailable" in value) || !Array.isArray(value.unavailable) || value.unavailable.some((item: unknown) => !item || typeof item !== "object" || !("backend" in item) || typeof item.backend !== "string" || !("reason" in item) || typeof item.reason !== "string")) throw new Error("Invalid capability configuration");
  return value as Connection;
}
export async function submit(input: AnalysisSubmission): Promise<Job> { return jobRecord(await request("/api/analyses", input)); }
export const terminal = (job: Job) => ["succeeded", "failed", "cancelled"].includes(job.state);
