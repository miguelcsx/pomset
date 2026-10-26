import { schemaSet } from "@pomset/contracts/browser";
import type { AnalysisSubmission, Job, ProfileRevision } from "@pomset/contracts";
export interface Connection { profile: ProfileRevision; jobs: Job[]; maxSolverTimeMs: number; unavailable: { backend: string; reason: string }[]; }
export function workbenchToken(): string | null { return new URLSearchParams(location.hash.slice(1)).get("workbench"); }
/**
 * Every successful response carries its payload under `data`, and a failure
 * carries `error` instead, so a caller never has to guess which it received.
 * Both transports answer this way: the workbench's `/api` and the local
 * viewer's `/api/report`.
 */
export function unwrap(value: unknown): unknown {
  if (!value || typeof value !== "object" || !("data" in value))
    throw new Error("Invalid response envelope");
  return (value as { data: unknown }).data;
}
export async function request(path: string, body?: unknown, signal?: AbortSignal): Promise<unknown> {
  const token = workbenchToken();
  if (!token) throw new Error("Launch the local workbench with pnpm workbench to analyze. The report viewer is read-only.");
  const response = await fetch(path, { ...(signal ? { signal } : {}), method: body === undefined ? "GET" : "POST", headers: { Authorization: `Bearer ${token}`, ...(body === undefined ? {} : { "Content-Type": "application/json" }) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const value: unknown = await response.json();
  if (!response.ok) throw new Error(value && typeof value === "object" && "error" in value ? String(value.error) : `Request failed (${response.status})`);
  return unwrap(value);
}
export function jobRecord(value: unknown): Job {
  if (!schemaSet().validatorFor("engine.schema.yaml#/$defs/job")(value)) throw new Error("Invalid job response");
  return value as Job;
}
export async function connect(): Promise<Connection> {
  const value = await request("/api/workbench");
  if (!value || typeof value !== "object" || !("profile" in value) || !schemaSet().validatorFor("domain.schema.yaml#/$defs/profileRevision")(value.profile) || !("jobs" in value) || !Array.isArray(value.jobs)) throw new Error("Invalid workbench configuration");
  value.jobs.forEach(jobRecord);
  if (!("maxSolverTimeMs" in value) || !Number.isSafeInteger(value.maxSolverTimeMs) || Number(value.maxSolverTimeMs) < 1 || !("unavailable" in value) || !Array.isArray(value.unavailable) || value.unavailable.some((item: unknown) => !item || typeof item !== "object" || !("backend" in item) || typeof item.backend !== "string" || !("reason" in item) || typeof item.reason !== "string")) throw new Error("Invalid capability configuration");
  return value as Connection;
}
export async function submit(input: AnalysisSubmission): Promise<Job> { return jobRecord(await request("/api/analyses", input)); }
export const terminal = (job: Job) => ["succeeded", "failed", "cancelled"].includes(job.state);
