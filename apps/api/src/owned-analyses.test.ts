import type { Job } from "@pomset/contracts";
import { describe, expect, it } from "vitest";

import { ListAnalyses } from "./application/analyses/ListAnalyses.js";
import { OwnedAnalyses } from "./application/analyses/OwnedAnalyses.js";
import type { AnalysisOwners } from "./application/ports/AnalysisOwners.js";
import type { AnalysisRepository } from "./application/ports/AnalysisRepository.js";
import type { Workbench } from "./application/Workbench.js";
import { notFound } from "./domain/index.js";

const NOW = new Date("2026-01-01T00:00:00.000Z");
const FIRST = { page: 1, pageSize: 10 } as const;

function job(jobId: string): Job {
  return { jobId, state: "queued", createdAt: NOW.toISOString() } as unknown as Job;
}

/** Owners held in memory, newest first as `analysisIdsOf` promises. */
function memoryOwners(entries: Array<[string, string]>): AnalysisOwners {
  const ownedBy = (userId: string) =>
    entries
      .filter(([, owner]) => owner === userId)
      .map(([id]) => id)
      .reverse();
  return {
    record: async () => {},
    ownerOf: async (analysisId) => entries.find(([id]) => id === analysisId)?.[1],
    analysisIdsOf: async (userId, window) => ownedBy(userId).slice(window.skip, window.skip + window.take),
    countOf: async (userId) => ownedBy(userId).length,
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
  it("lists only the caller's own analyses, newest first, with the total", async () => {
    const owners = memoryOwners([
      ["job_a", "alice"],
      ["job_b", "bob"],
      ["job_c", "alice"],
    ]);
    const analyses = services(owners, [job("job_a"), job("job_b"), job("job_c")]);

    const alice = await analyses.history("alice", FIRST);
    expect(alice.items.map((entry) => entry.jobId)).toEqual(["job_c", "job_a"]);
    expect(alice.pagination).toEqual({ page: 1, pageSize: 10, total: 2, totalPages: 1 });

    expect((await analyses.history("bob", FIRST)).items.map((entry) => entry.jobId)).toEqual(["job_b"]);
  });

  it("lists nothing to an account that owns no analysis, and never the unowned", async () => {
    const owners = memoryOwners([["job_a", "alice"]]);
    const analyses = services(owners, [job("job_a"), job("job_legacy")]);

    const mallory = await analyses.history("mallory", FIRST);
    expect(mallory.items).toEqual([]);
    expect(mallory.pagination.total).toBe(0);
  });

  it("skips an owned identifier whose job is gone instead of failing the list", async () => {
    const owners = memoryOwners([
      ["job_a", "alice"],
      ["job_gone", "alice"],
    ]);
    const analyses = services(owners, [job("job_a")]);

    const page = await analyses.history("alice", FIRST);
    expect(page.items.map((entry) => entry.jobId)).toEqual(["job_a"]);
    expect(page.pagination.total).toBe(2);
  });

  it("pages through the account's analyses without repeating or dropping any", async () => {
    const entries: Array<[string, string]> = ["job_1", "job_2", "job_3", "job_4", "job_5"].map((id) => [id, "alice"]);
    const analyses = services(
      memoryOwners(entries),
      entries.map(([id]) => job(id)),
    );

    const first = await analyses.history("alice", { page: 1, pageSize: 2 });
    const second = await analyses.history("alice", { page: 2, pageSize: 2 });
    const third = await analyses.history("alice", { page: 3, pageSize: 2 });

    expect(first.items.map((entry) => entry.jobId)).toEqual(["job_5", "job_4"]);
    expect(second.items.map((entry) => entry.jobId)).toEqual(["job_3", "job_2"]);
    expect(third.items.map((entry) => entry.jobId)).toEqual(["job_1"]);
    expect(third.pagination).toEqual({ page: 3, pageSize: 2, total: 5, totalPages: 3 });
  });
});
