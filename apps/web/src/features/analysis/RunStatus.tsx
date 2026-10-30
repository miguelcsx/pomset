import { useEffect, useState } from "react";
import type { Job, JobState } from "@pomset/contracts";

const LABELS: Record<JobState, string> = {
  queued: "Queued",
  running: "Running",
  "cancel-requested": "Cancelling",
  succeeded: "Done",
  failed: "Failed",
  cancelled: "Cancelled",
};

/** Whole seconds read as "12s"; a minute or more reads as "1m 05s". */
export function formatElapsed(milliseconds: number): string {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000));
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m ${String(seconds % 60).padStart(2, "0")}s`;
}

/** Milliseconds since `since`, refreshed each second so the label keeps moving while the job runs. */
function useElapsed(since: string): number {
  const start = Date.parse(since);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  return Number.isNaN(start) ? 0 : now - start;
}

/** Spinner, state and elapsed time for the analysis that is in flight. */
export function RunStatus({ job }: { job: Job }) {
  const elapsed = useElapsed(job.startedAt ?? job.createdAt);
  return (
    <span className="run-status">
      <span className="spinner" aria-hidden="true" />
      {LABELS[job.state]} · {formatElapsed(elapsed)}
    </span>
  );
}

/** Placeholder results shown while the first analysis of a workspace is still running; the toolbar carries the status. */
export function ResultsSkeleton() {
  return (
    <div className="results-pending" aria-busy="true">
      <div className="skeleton-bar" />
      <div className="skeleton-bar short" />
      <div className="skeleton-cards">
        <div className="skeleton-card" />
        <div className="skeleton-card" />
        <div className="skeleton-card" />
      </div>
    </div>
  );
}
