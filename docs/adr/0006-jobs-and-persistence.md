# ADR-0006  Jobs and persistence

## Context

Two deployments must satisfy one user-visible lifecycle. A developer on a laptop
has no database server and no network, and wants a report they can open offline.
A hosted deployment must survive a worker dying mid-analysis without losing the
record of what happened or letting a resurrected worker commit a result that no
longer belongs to it.

A distributed queue service would solve worker coordination, but it adds an
operational dependency the product does not need at this size, and it makes the
hosted deployment less portable.

## Decision

- **Local**: SQLite for metadata, the filesystem for content-addressed artifacts,
  and a directly-invoked supervisor for job execution. No network, no server.
- **Hosted**: PostgreSQL for ownership, projects, snapshots, jobs, attempts and
  the durable event log; an S3-compatible object store for artifacts.
- **Leased PostgreSQL job rows coordinate workers.** A worker claims a lease,
  heartbeats every 5 seconds, and every write presents the active fencing token.
  A lease that expires after 30 seconds finalises the job as failed with
  `WORKER_LOST`, and the expired worker's later writes are rejected.
- **No proprietary cloud queue requirement**, and no managed vendor service
  needed to operate the deployment.
- **Cancellation is a transaction on the leased row.** Workers poll cancellation
  and lease status at most once per second, send a cooperative cancel and allow
  2 seconds before process-tree termination.
- **Completion commits atomically**: result references and terminal state
  together. Completion wins only if it commits before the cancellation request is
  recorded.
- **One job, one attempt.** A rerun is a new job. No automatic retry policy.
- **Events are append-only and durable.** Reconnect uses `Last-Event-ID`;
  authorization on reconnect is identical to the original request.

## Consequences

- The local and hosted lifecycles are the same state machine over different
  stores, so a scenario validated offline behaves identically when hosted.
- Leases make worker death a normal, recoverable event rather than a special
  case, at the cost of a heartbeat loop and fencing checks on every write.
- Queue depth and wait time become visible facts about a deployment rather than
  hidden behaviour, which matters because quotas and capacity are reported as
  measurements rather than promises.
- A hosted deployment cannot be trivially scaled by attaching a cloud-managed
  queue; it is scaled by adding workers that lease rows.

## Validation obligations

- Kill a worker mid-job and verify the job reaches a consistent terminal state,
  the event stream remains replayable, and no orphan result is committed.
- Race a cancellation request against completion and verify one deterministic
  outcome: recorded cancellation produces `cancelled`, never `succeeded`.
- Verify a reconnect with a stale event cursor receives current state rather
  than a fabricated replay.

## Links

Requirements: [`REQ-PLT-005`](../srs/platform.md) …
`REQ-PLT-007`, `REQ-PLT-013`, [`REQ-ENG-011`](../srs/engine-protocol.md),
`REQ-ENG-012`, `REQ-CLI-001`.
Specifications: [`../architecture/lifecycle.md`](../architecture/lifecycle.md),
[`../architecture/local-ci.md`](../architecture/local-ci.md).
