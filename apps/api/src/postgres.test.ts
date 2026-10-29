/**
 * The hosted record store, exercised against a real PostgreSQL.
 *
 * The point of this test is not that PostgreSQL is reachable. It is that the
 * port has a second implementation that obeys the same rules as the local one:
 * records are immutable, a job's transitions are decided by the shared policy,
 * and the event stream is durable. Anything less would make the port a claim
 * rather than an interface.
 *
 * It runs only when `POMSET_TEST_DATABASE_URL` names a database, because a
 * skipped test is honest and a green one against no database is not. CI supplies
 * one; locally:
 *
 *   POMSET_TEST_DATABASE_URL=postgresql://user@localhost:5432/pomset pnpm test
 */

import { readFileSync } from "node:fs";

import type {
  AnalysisResult,
  Job,
  ProfileRevision,
  Scenario,
  SnapshotManifest,
} from "@pomset/contracts";
import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { ApplicationError } from "./domain/errors/ApplicationError.js";
import { PrismaAnalysisRepository } from "./infrastructure/repository/PrismaAnalysisRepository.js";

const connection = process.env["POMSET_TEST_DATABASE_URL"];
const example = <T,>(name: string): T =>
  JSON.parse(
    readFileSync(
      new URL(`../../../docs/contracts/examples/${name}`, import.meta.url),
      "utf8",
    ),
  ) as T;

describe.skipIf(!connection)("hosted record store", () => {
  let repository: PrismaAnalysisRepository;
  let admin: Client;

  beforeAll(async () => {
    admin = new Client({ connectionString: connection });
    await admin.connect();
    await admin.query(
      readFileSync(
        new URL("../prisma/migrations/0001_records.sql", import.meta.url),
        "utf8",
      ),
    );
    await admin.query("TRUNCATE records, jobs, events");
    repository = new PrismaAnalysisRepository(connection!);
  });

  afterAll(async () => {
    await repository?.close();
    await admin?.end();
  });

  it("records a snapshot, a scenario and a profile, and reads them back", async () => {
    const snapshot = example<SnapshotManifest>("snapshot-manifest.json");
    const scenario = example<Scenario>("scenario.json");
    const profile = example<ProfileRevision>("profile-revision.json");

    await repository.record(snapshot, scenario, profile);

    expect(await repository.snapshot(snapshot.snapshotId)).toEqual(snapshot);
    expect(await repository.scenario(scenario.scenarioId)).toEqual(scenario);
    expect(await repository.revision(profile.profileRevisionId)).toEqual(profile);
  });

  it("refuses a second write of one identity with different content", async () => {
    const snapshot = example<SnapshotManifest>("snapshot-manifest.json");
    const scenario = example<Scenario>("scenario.json");
    const profile = example<ProfileRevision>("profile-revision.json");

    // The same content again is accepted: identity is what is being protected,
    // not the act of writing.
    await expect(repository.record(snapshot, scenario, profile)).resolves.toBeUndefined();

    // Different content under an identity already recorded is a refusal, because
    // evidence that cites it would otherwise be quietly invalidated.
    await expect(
      repository.record({ ...snapshot, createdAt: "2026-01-01T00:00:00Z" }, scenario, profile),
    ).rejects.toThrow("conflicting immutable identity");
  });

  it("queues a job, appends its event, and cancels it through the shared policy", async () => {
    const result = example<AnalysisResult>("analysis-result.json");
    const job: Job = {
      schemaVersion: 1,
      jobId: result.jobId,
      attemptId: result.attemptId,
      projectId: "prj_hosted_test",
      snapshotId: result.snapshotId,
      scenarioId: result.scenarioId,
      profileRevisionId: result.profileRevisionId,
      state: "queued",
      createdAt: new Date().toISOString(),
    };

    await repository.enqueue(job);
    expect(await repository.job(job.jobId)).toEqual(job);

    // A queued attempt never started, so the policy cancels it outright.
    await repository.cancel(job.jobId);
    expect((await repository.job(job.jobId)).state).toBe("cancelled");

    const events = await admin.query<{ sequence: number; document: { type: string } }>(
      'SELECT sequence, document FROM events WHERE "jobId" = $1 ORDER BY sequence',
      [job.jobId],
    );
    expect(events.rows.map((row) => row.document.type)).toEqual([
      "job.queued",
      "job.cancelled",
    ]);
    expect(events.rows.map((row) => row.sequence)).toEqual([1, 2]);
  });

  it("reports a missing job as a not-found failure, not as a raw fault", async () => {
    await expect(repository.job("job_absent")).rejects.toBeInstanceOf(ApplicationError);
    await expect(repository.job("job_absent")).rejects.toMatchObject({
      kind: "not_found",
    });
    expect(await repository.result("res_absent")).toBeUndefined();
  });
});
