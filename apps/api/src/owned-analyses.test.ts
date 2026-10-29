import type { Job } from "@pomset/contracts";
import { describe, expect, it } from "vitest";

import { ListAnalyses } from "./application/analyses/ListAnalyses.js";
import { OwnedAnalyses } from "./application/analyses/OwnedAnalyses.js";
import type { AnalysisOwners } from "./application/ports/AnalysisOwners.js";
import type { AnalysisRepository } from "./application/ports/AnalysisRepository.js";
import type { Workbench } from "./application/Workbench.js";
import { notFound } from "./domain/index.js";

const NOW = new Date("2026-01-01T00:00:00.000Z");

function job(jobId: string): Job {
  return { jobId, state: "queued", createdAt: NOW.toISOString() } as unknown as Job;
}

/** Owners held in memory, newest first as `analysisIdsOf` promises. */
function memoryOwners(entries: Array<[string, string]>): AnalysisOwners {
  return {
    record: async () => {},
    ownerOf: async (analysisId) => entries.find(([id]) => id === analysisId)?.[1],
    analysisIdsOf: async (userId, limit) =>
      entries
        .filter(([, owner]) => owner === userId)
        .map(([id]) => id)
        .reverse()
        .slice(0, limit),
  };
}

function memoryRepository(jobs: Job[]): AnalysisRepository {
  return {
    job: async (id: string) => {
      const found = jobs.find((candidate) => candidate.jobId === id);
      if (!found) throw notFound(`No job ${id} in this store`);
      return found;
    },
  } as unknown as AnalysisRepository;
}

function services(owners: AnalysisOwners, jobs: Job[]): OwnedAnalyses {
  const workbench = { history: new ListAnalyses(memoryRepository(jobs)) } as unknown as Workbench;
  return new OwnedAnalyses({ workbench, owners, now: () => NOW });
}

describe("OwnedAnalyses.history", () => {
  it("lists only the caller's own analyses, in the owner index's order", async () => {
    const owners = memoryOwners([
      ["job_a", "alice"],
      ["job_b", "bob"],
      ["job_c", "alice"],
    ]);
    const analyses = services(owners, [job("job_a"), job("job_b"), job("job_c")]);

    expect((await analyses.history("alice")).map((entry) => entry.jobId)).toEqual(["job_c", "job_a"]);
    expect((await analyses.history("bob")).map((entry) => entry.jobId)).toEqual(["job_b"]);
  });

  it("lists nothing to an account that owns no analysis, and never the unowned", async () => {
    const owners = memoryOwners([["job_a", "alice"]]);
    const analyses = services(owners, [job("job_a"), job("job_legacy")]);

    expect(await analyses.history("mallory")).toEqual([]);
  });

  it("skips an owned identifier whose job is gone instead of failing the list", async () => {
    const owners = memoryOwners([
      ["job_a", "alice"],
      ["job_gone", "alice"],
    ]);
    const analyses = services(owners, [job("job_a")]);

    expect((await analyses.history("alice")).map((entry) => entry.jobId)).toEqual(["job_a"]);
  });
});
