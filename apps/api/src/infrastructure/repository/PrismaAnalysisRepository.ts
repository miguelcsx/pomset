/**
 * The hosted record store: PostgreSQL through Prisma, behind the same port as
 * the local one.
 *
 * The rules are not restated here. Which schema a record must satisfy and which
 * field carries its identity come from `@pomset/storage`, and which state a job
 * may move to comes from `@pomset/domain` — the same answers the local backend
 * asks for. What differs is only where the bytes end up.
 *
 * Prisma is used for the connection and the typed queries. It is deliberately
 * not used to model a job's fields: `packages/contracts` is the one schema
 * authority (ADR-0004), and a second model of a job beside it would be a second
 * answer to what a job is.
 */

import { randomUUID } from "node:crypto";

import { PrismaPg } from "@prisma/adapter-pg";
import type {
  AnalysisResult,
  Job,
  JobEvent,
  ProfileRevision,
  Scenario,
  SnapshotManifest,
} from "@pomset/contracts";
import { schemaSet } from "@pomset/contracts";
import { cancellationTarget, canonicalize, isEnqueueable } from "@pomset/domain";
import { RECORD_IDENTITY_FIELDS, RECORD_TARGETS } from "@pomset/storage";

import type { AnalysisRepository } from "../../application/ports/AnalysisRepository.js";
import { badRequest, notFound } from "../../domain/index.js";
import { PrismaClient } from "../../generated/prisma/client.js";

/** The record kinds this store holds. */
type RecordKind = "snapshot" | "scenario" | "profile" | "result";

/** The subset of the client a transaction handle shares with the client itself. */
type Client = Pick<
  PrismaClient,
  "record" | "job" | "jobEvent" | "$queryRaw" | "$executeRaw"
>;

export class PrismaAnalysisRepository implements AnalysisRepository {
  private readonly prisma: PrismaClient;

  constructor(connectionString: string) {
    this.prisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString }),
    });
  }

  async job(id: string): Promise<Job> {
    const row = await this.prisma.job.findUnique({ where: { id } });
    if (!row) throw notFound(`No job ${id} in this store`);
    return row.document as unknown as Job;
  }

  async snapshot(id: string): Promise<SnapshotManifest> {
    return (await this.read("snapshot", id)) as SnapshotManifest;
  }

  async scenario(id: string): Promise<Scenario> {
    return (await this.read("scenario", id)) as Scenario;
  }

  async revision(id: string): Promise<ProfileRevision> {
    return (await this.read("profile", id)) as ProfileRevision;
  }

  async result(id: string): Promise<AnalysisResult | undefined> {
    const row = await this.prisma.record.findUnique({
      where: { kind_id: { kind: "result", id } },
    });
    return row ? (row.document as unknown as AnalysisResult) : undefined;
  }

  async record(
    snapshot: SnapshotManifest,
    scenario: Scenario,
    profile: ProfileRevision,
  ): Promise<void> {
    await this.prisma.$transaction(async (transaction) => {
      await this.write(transaction as Client, "snapshot", snapshot.snapshotId, snapshot);
      await this.write(transaction as Client, "scenario", scenario.scenarioId, scenario);
      await this.write(transaction as Client, "profile", profile.profileRevisionId, profile);
    });
  }

  async enqueue(job: Job): Promise<void> {
    if (!isEnqueueable(job))
      throw badRequest("A new job has one attempt and starts queued");
    this.validate(job, "engine.schema.yaml#/$defs/job");
    await this.prisma.$transaction(async (transaction) => {
      await transaction.job.create({
        data: { id: job.jobId, document: JSON.parse(canonicalize(job)) },
      });
      await this.append(transaction as Client, job, "job.queued");
    });
  }

  async cancel(id: string): Promise<void> {
    await this.prisma.$transaction(async (transaction) => {
      const current = await transaction.job.findUnique({ where: { id } });
      if (!current) throw notFound(`No job ${id} in this store`);
      const job = current.document as unknown as Job;
      const target = cancellationTarget(job.state);
      if (!target) return;
      const updated: Job = {
        ...job,
        state: target,
        cancelRequestedAt: new Date().toISOString(),
      };
      await transaction.job.update({
        where: { id },
        data: { document: JSON.parse(canonicalize(updated)) },
      });
      await this.append(transaction as Client, updated, `job.${target}` as JobEvent["type"]);
    });
  }

  async close(): Promise<void> {
    await this.prisma.$disconnect();
  }

  private async read(kind: RecordKind, id: string): Promise<unknown> {
    const row = await this.prisma.record.findUnique({
      where: { kind_id: { kind, id } },
    });
    if (!row) throw notFound(`No ${kind} ${id} in this store`);
    return row.document;
  }

  /**
   * Records are immutable: writing the same identity with different content is a
   * refusal, not an overwrite. A hash is never a credential, and a result
   * belongs to the snapshot that was analysed, so silently replacing one would
   * quietly invalidate evidence that cites it.
   */
  private async write(
    client: Client,
    kind: RecordKind,
    id: string,
    value: unknown,
  ): Promise<void> {
    const target = RECORD_TARGETS[kind]!;
    this.validate(value, target);
    if ((value as Record<string, unknown>)[RECORD_IDENTITY_FIELDS[kind]!] !== id)
      throw badRequest("record identifier differs from its storage key");
    const document = JSON.parse(canonicalize(value)) as object;
    const existing = await client.record.findUnique({
      where: { kind_id: { kind, id } },
    });
    if (existing) {
      if (canonicalize(existing.document) !== canonicalize(value))
        throw badRequest(`conflicting immutable identity ${id}`);
      return;
    }
    await client.record.create({ data: { kind, id, document } });
  }

  /** Progress and accepted evidence are never modified or retracted. */
  private async append(
    client: Client,
    job: Job,
    type: JobEvent["type"],
  ): Promise<void> {
    const rows = await client.$queryRaw<Array<{ next: number }>>`
      SELECT COALESCE(MAX(sequence), 0) + 1 AS next FROM events WHERE "jobId" = ${job.jobId}`;
    const sequence = Number(rows[0]?.next ?? 1);
    const event: JobEvent = {
      schemaVersion: 1,
      eventId: `evt_${randomUUID()}`,
      jobId: job.jobId,
      ...(job.attemptId ? { attemptId: job.attemptId } : {}),
      sequence,
      type,
      createdAt: new Date().toISOString(),
    };
    await client.jobEvent.create({
      data: {
        jobId: job.jobId,
        sequence,
        document: JSON.parse(canonicalize(event)),
      },
    });
  }

  private validate(value: unknown, target: string): void {
    const check = schemaSet().validatorFor(target);
    if (!check(value))
      throw badRequest(`${check.errors?.[0]?.instancePath} ${check.errors?.[0]?.message}`);
  }
}
