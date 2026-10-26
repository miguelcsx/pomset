# ADR-0015  A second implementation of the record store

## Context

[ADR-0014](0014-web-client-and-api-layers.md) gave `apps/api` its layers and
declared that `application` depends on ports rather than on a backend. One of
those ports, `AnalysisRepository`, was written so that a hosted deployment could
implement it. It could not, for three reasons that only appeared when the second
implementation was attempted:

- The port carried `runDirectory`, `captureRun`, `removeRun` and `bytes`. Those
  are how a local workbench hands a child process its inputs and where it keeps
  content-addressed bytes. A deployment with PostgreSQL and an object store has
  no run directory to offer and would have had to fake one.
- The port was **synchronous**. A store reached over a socket cannot answer in
  the same turn, so a synchronous port could only ever have one implementation.
- The rules a record obeys — which canonical schema it must satisfy, which field
  carries its identity, whether it may be overwritten — and the rules a job
  obeys — which transitions are legal, what a cancellation means — lived inside
  the local store beside the SQL that persisted them. A second backend would
  have restated them, and two restatements of those rules drift.

## Decision

- **Three ports, not one.** `AnalysisRepository` holds the durable records and
  the job, and is the one a hosted backend satisfies. `RunWorkspace` is the
  working tree one run is analysed from — local by nature, and documented as
  such. `BlobStore` is content-addressed bytes, which a filesystem and an object
  store each answer differently. `LocalAnalysisStore` implements all three,
  because locally they are one directory.
- **The record store and the blob store are asynchronous.** The local backend
  answers in the same turn; the promise is the interface, not a pretence that
  the work is slow.
- **The rules move to where they can be shared.** The job lifecycle becomes
  `packages/domain/src/job.ts`, and the record identities and schema targets
  become exports of `packages/storage`. Both backends ask the same questions.
- **The hosted backend is PostgreSQL through Prisma**, using the `pg` driver
  adapter. Prisma is used for the connection and for typed queries. It is
  deliberately **not** used to model a job's fields: `packages/contracts` is the
  one schema authority ([ADR-0004](0004-contract-authority.md)), and a second
  model of a job beside it would be a second answer to what a job is. The tables
  hold the canonical documents as `jsonb`.
- **Migrations are reviewed SQL**, not `prisma migrate`. Neither Prisma's query
  engine nor its schema engine is loaded or installed, which keeps installs
  offline and adds no binary to the deployment.
- **The test skips rather than passes without a database.** A green run against
  no database would be the kind of claim this project forbids.

## Consequences

- The port is now demonstrably an interface rather than an intention: the same
  rules are exercised against SQLite and against a real PostgreSQL, and CI
  supplies the database.
- Immutability is enforced in both backends. Recording the same identity with
  different content is a refusal, because evidence citing it would otherwise be
  quietly invalidated.
- A missing job is a not-found failure in both, rather than the incidental
  status the local store used to produce.
- The hosted **platform** is not delivered by this. Ownership, authorization,
  publication, object storage for bytes, and leased job coordination with
  fencing tokens remain unimplemented, and [ADR-0012](0012-research-gates-and-compatibility.md)
  still governs whether they are built: the feasibility gate reads *no-go*, and
  a later-phase document is a specification, not a capability.
- `apps/api/src/generated/` is a build artifact and is not committed. Unlike the
  contract bindings, nothing outside this package consumes it, and the reviewed
  source is `prisma/schema.prisma`.

## Validation obligations

- Demonstrate that recording one identity with different content is refused by
  both backends, and that recording the same content twice is accepted.
- Demonstrate that a queued job cancels outright and a running one moves to
  `cancel-requested`, against both backends, from the same policy.
- Confirm that the event stream is ordered per job from 1 and is appended to,
  never rewritten.
- Confirm that the workbench, which uses the local backend, is unaffected.

## Links

Requirements: `REQ-PLT-014`, `REQ-SEC-001` … `REQ-SEC-012`, `REQ-CLI-009`.
Amends: [ADR-0014](0014-web-client-and-api-layers.md) — the layer shape stands;
the port it declared is now one a second backend actually satisfies.
Specifications: [`../architecture/lifecycle.md`](../architecture/lifecycle.md),
[`../architecture/monorepo.md`](../architecture/monorepo.md).
