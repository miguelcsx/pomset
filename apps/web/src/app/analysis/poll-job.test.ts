import { afterEach, expect, it, vi } from "vitest";
import type { Job } from "@pomset/contracts";
import { observeJob } from "./poll-job.js";
import { request } from "./workbench-client.js";
vi.mock("./workbench-client.js", async (original) => ({
  ...(await original<typeof import("./workbench-client.js")>()),
  request: vi.fn(),
}));
const job: Job = {
  schemaVersion: 1,
  jobId: "job_poll",
  projectId: "prj_poll",
  snapshotId: "snp_poll",
  scenarioId: "scn_poll",
  profileRevisionId: "prf_poll",
  state: "running",
  createdAt: "2026-10-11T12:00:00Z",
};
afterEach(() => {
  vi.resetAllMocks();
  vi.useRealTimers();
});
it("fetches the result even if submission was already terminal", async () => {
  const response = { job: { ...job, state: "succeeded" }, analysis: {} };
  vi.mocked(request).mockResolvedValue(response);
  expect(
    await observeJob(
      { ...job, state: "succeeded" },
      vi.fn(),
      new AbortController().signal,
    ),
  ).toBe(response);
});
it("stops observing on unmount without cancelling the durable job", async () => {
  vi.useFakeTimers();
  vi.mocked(request).mockResolvedValue({ job });
  const controller = new AbortController();
  const result = observeJob(
    job,
    () => controller.abort(new Error("unmounted")),
    controller.signal,
  );
  await expect(result).rejects.toThrow("unmounted");
  await vi.runAllTimersAsync();
  expect(request).toHaveBeenCalledTimes(1);
  expect(vi.mocked(request).mock.calls[0]?.[0]).toBe("/api/analyses/job_poll");
});
it("rejects an unrelated job response instead of showing its evidence", async () => {
  vi.mocked(request).mockResolvedValue({ job: { ...job, jobId: "job_other" } });
  await expect(
    observeJob(job, vi.fn(), new AbortController().signal),
  ).rejects.toThrow("identity");
});
