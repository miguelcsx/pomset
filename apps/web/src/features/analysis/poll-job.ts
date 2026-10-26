/** Observe one durable job without owning its submission or its editor state. */
import type { Job } from "@pomset/contracts";
import { jobRecord, request, terminal } from "./workbench-client";

export async function observeJob(
  initial: Job,
  onUpdate: (job: Job) => void,
  signal: AbortSignal,
): Promise<unknown> {
  let job = initial;
  while (!signal.aborted) {
    const raw = await request(
      `/api/analyses/${encodeURIComponent(job.jobId)}`,
      undefined,
      signal,
    );
    if (!raw || typeof raw !== "object" || !("job" in raw))
      throw new Error("Invalid analysis response");
    const next = jobRecord(raw.job);
    if (next.jobId !== initial.jobId)
      throw new Error("Analysis response changed job identity");
    job = next;
    onUpdate(job);
    if (terminal(job)) return raw;
    await new Promise<void>((resolve, reject) => {
      const abort = () => {
        clearTimeout(timer);
        reject(signal.reason);
      };
      const timer = setTimeout(() => {
        signal.removeEventListener("abort", abort);
        resolve();
      }, 250);
      signal.addEventListener("abort", abort, { once: true });
      if (signal.aborted) abort();
    });
  }
  throw signal.reason;
}
