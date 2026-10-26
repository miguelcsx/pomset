# Contracts

The canonical portable contracts, in JSON Schema 2020-12. They are the single
authority for the records exchanged between the API, the CLI, the worker, the
workbench and the engines; the HTTP surface references them rather than
redefining them. See [`../adr/0004-contract-authority.md`](../adr/0004-contract-authority.md).

The schemas themselves live in
[`packages/contracts/schema`](../../packages/contracts/schema), beside the single
generator that produces the TypeScript and Python bindings; nothing in `docs/`
is a second copy. This document is the human-readable description of those
schemas, and the example fixtures below are their consumers.

## Files

| File | Owns |
|---|---|
| [`domain.schema.yaml`](../../packages/contracts/schema/domain.schema.yaml) | `Project`, `SnapshotManifest`, `Scenario`, `WorkloadDomain`, `ProfileRevision`, `Capability`, `Allocation`, `EligibilityPolicy`, `intExpr`, `intConstraint`. |
| [`evidence.schema.yaml`](../../packages/contracts/schema/evidence.schema.yaml) | `Actor`, `MemoryAccessEvent`, `SourceRange`, `Finding`, `Witness`, `Assumptions`, `Coverage`, `Budget`, `SampledCheck`, `PropertyResult`, `AnalysisResult`, `ArtifactManifest`, `ErrorRecord`, `ErrorCode`. |
| [`measurement.schema.yaml`](../../packages/contracts/schema/measurement.schema.yaml) | `Measurement`. |
| [`engine.schema.yaml`](../../packages/contracts/schema/engine.schema.yaml) | `Job`, `JobEvent`, `EngineRequest`, engine envelopes, `helloPayload`, `cancelPayload`. |
| [`publication.schema.yaml`](../../packages/contracts/schema/publication.schema.yaml) | `OwnerIdentity`, `Publication`, `DisclosurePreview`. |
| [`bundle.schema.yaml`](../../packages/contracts/schema/bundle.schema.yaml) | `ExperimentBundle`. |
| [`openapi.yaml`](../../packages/contracts/schema/openapi.yaml) | The HTTP surface, referencing the schemas above. |
| [`examples.md`](examples.md) | Valid and invalid examples for each contract, with runnable fixtures under `examples/`. |

Every shared definition uses a local `$ref` inside these files. No schema
redefines a type owned by another, and OpenAPI defines no body type of its own.

## Named types

These names are used identically everywhere in this documentation:

`Project`, `SnapshotManifest`, `Scenario`, `WorkloadDomain`, `ProfileRevision`,
`Capability`, `Job`, `JobEvent`, `AnalysisResult`, `Finding`, `Witness`,
`Measurement`, `ArtifactManifest`, `ExperimentBundle`.

`schemaVersion: 1` is the initial portable format for all of them.

## Provenance is not an identifier

Identifiers are opaque handles. A result explicitly references the `snapshotId`,
`scenarioId`, `profileRevisionId`, `domain`, `property`, `assumptions`,
`coverage`, `budget` and artifact ids that produced it. An identifier never
substitutes for that provenance, and a content hash is never an access
credential.

A finding may link several actors, events and source ranges. A measurement
additionally carries hardware and tool identity, warm-up and sample counts, the
clock and synchronisation method, variance, instrumentation and the reference and
check outcomes. A metric a tool cannot supply is **absent with a capability
explanation**, never a numeric zero.

## Properties, outcomes and evidence

A property outcome is one of `established`, `violated`, `unknown`, `unsupported`,
each with a `method` and an `evidenceClass`. The permitted combinations are
closed:

| Outcome | Method | Evidence class |
|---|---|---|
| `established` | `static`, `symbolic` | `verified-under-assumptions` |
| `violated` | `symbolic`, `static` | `counterexample` |
| `violated` | `instrumented` | `observed` |
| `unknown` | any | `potential`, `estimated` |
| `unsupported` | any | `potential`, `estimated` |

`established` requires the stated model, domain and assumptions. A finite
sampled check is modelled separately as a `SampledCheck` with explicit points and
passed/failed/error observations; it is never assigned a domain-wide
`established`.

`Measurement` uses `measured` or `estimated` and never carries a correctness
outcome.

`Coverage` lists region constraints and per-property classifications of
`established`, `violated`, `sampled`, `unknown`, `unsupported`. Counts and
percentages appear only for a finite, explicitly enumerated denominator with
duplicate points removed; otherwise the contract reports constraints and sampled
points and no percentage at all.

## Support and availability

Support levels are `validated`, `limited`, `untested`. Availability is
independently `immediate`, `queued`, `unavailable`. An unknown profile id yields
`PROFILE_NOT_FOUND` — never a nearby or first profile. A tool crash is
`ENGINE_FAILED`; solver budget exhaustion is an unknown analysis result and
neither a crash nor a successful proof.

## Identity

Content identity is SHA-256.

1. Hash the **original file bytes** individually.
2. Hash the **manifest** over its UTF-8 serialization per
   [RFC 8785 JCS](https://www.rfc-editor.org/rfc/rfc8785.html), with the hash
   field omitted from the input, normalized POSIX relative paths and no symlinks.

Non-I-JSON values are rejected. Integers outside the interoperable JSON
safe-integer range are encoded as decimal strings under explicit schemas.

Analysis cache keys include scenario, policy, model and profile revision.
Measurement keys additionally include device, tool and environment identity.
Imported local evidence is labelled `origin: imported` and cannot impersonate
server-produced validation; provenance completeness does not prove authenticity.

Compatibility and eligibility compare **exact** snapshot, scenario, profile,
domain and policy identities. Schema enum `origin: local | hosted | imported`
records ingestion trust; the original execution location is retained separately
in `executedAt`.

## Lifecycle summaries

`Job.state` is `queued | running | cancel-requested | succeeded | failed | cancelled`.
A succeeded job can contain violated, unknown and unsupported results, and its
state carries no correctness assertion. Permitted transitions:

```text
queued            -> running | cancelled | failed
running           -> succeeded | failed | cancel-requested
cancel-requested  -> cancelled
terminal          -> (none)
```

Cancellation is recorded, idempotent and cooperative, followed by bounded
process-tree termination. Partial evidence survives with its partial and
coverage qualifier. Completion wins only if it commits before the cancellation
request is recorded; a recorded cancellation prevents a later success. Terminal
states are immutable. Lease expiry fences stale worker writes and fails the job
with `WORKER_LOST`. A rerun is a new job and never resumes a terminal result. No
automatic retry policy is added.

Engine messages carry `protocolVersion: 1`, `jobId`, `attemptId`, `sequence`,
`type` and `payload`. Each direction has its own sequence starting at 1.
Engine→supervisor types are `hello`, `progress`, `finding`, `artifact`, `result`,
`error`; supervisor→engine is `cancel`. Exactly one initial `hello`; a mismatched
version, a repeated hello, an invalid envelope or a sequence violation is
`PROTOCOL_INVALID` and fails the job. One job has exactly one attempt. A job has
zero or more immutable result records carrying `jobId`, `attemptId` and full
provenance; findings belong to result records. Progress events and accepted
evidence chunks are append-only.

## Error vocabulary

One enum, shared by HTTP responses, engine error payloads, job failures and CLI
reports, carried in `ErrorRecord {code, message, details}`:

| Code | Synchronous HTTP |
|---|---|
| `PROFILE_NOT_FOUND` | 404 |
| `INPUT_INVALID` | 400 |
| `PROTOCOL_INVALID` | 400 |
| `BUNDLE_INVALID` | 422 |
| `UNAUTHORIZED` | 401 |
| `FORBIDDEN` | 403 |
| `ENGINE_FAILED` | 500 |
| `WORKER_LOST` | 500 |

Asynchronous failures appear in `Job.failure`, in the error event payload and in
the engine error payload using the same record — never as a changed HTTP status
on an already successful `GET` or an open SSE stream. Unsupported and unknown
analysis outcomes are **not** error codes.

## HTTP surface

The OpenAPI document fixes these operations. Mutations use server-side owner
authorization plus CSRF protection; a content hash is never an access
credential. Unauthenticated access is restricted to the public catalogue and
explicitly published views and artifacts.

| Method | Path | Notes |
|---|---|---|
| `GET` | `/v1/profiles` | Profile catalogue with support and availability. |
| `POST` | `/v1/projects` | Create a project. |
| `GET` | `/v1/projects` | List owned projects; opaque cursor pagination, creation order then id. |
| `GET` | `/v1/projects/{projectId}` | Read one project. |
| `POST` | `/v1/projects/{projectId}/snapshots` | Create an immutable snapshot. |
| `GET` | `/v1/projects/{projectId}/snapshots` | List snapshots. |
| `GET` | `/v1/snapshots/{snapshotId}` | Read a snapshot manifest. |
| `POST` | `/v1/snapshots/{snapshotId}/scenarios` | Create a scenario on a snapshot. |
| `GET` | `/v1/scenarios/{scenarioId}` | Read a scenario. |
| `POST` | `/v1/jobs` | Create a job. |
| `GET` | `/v1/jobs/{jobId}` | Read job state. |
| `POST` | `/v1/jobs/{jobId}/cancel` | Request cancellation. |
| `GET` | `/v1/jobs/{jobId}/events` | SSE stream, `Last-Event-ID` reconnect. |
| `GET` | `/v1/jobs/{jobId}/results` | List immutable results. |
| `GET` | `/v1/projects/{projectId}/jobs` | List jobs. |
| `GET` | `/v1/results/{resultId}` | Read an analysis result. |
| `GET` | `/v1/artifacts/{artifactId}` | Authorized artifact retrieval. |
| `POST` | `/v1/publications` | Publish a snapshot and selected artifacts. |
| `GET` | `/v1/publications/{publicationId}` | Read a publication. |
| `GET` | `/v1/projects/{projectId}/publications` | List publications. |
| `DELETE` | `/v1/publications/{publicationId}` | Revoke. |
| `POST` | `/v1/bundles/import` | Import a bundle into an owned project. |
| `GET` | `/v1/results/{resultId}/bundle` | Export a portable bundle. |
| `GET` | `/v1/session` | Current session. |
| `GET` | `/auth/login` | OIDC authorization-code + PKCE redirect. |
| `GET` | `/auth/callback` | OIDC callback. |
| `POST` | `/auth/logout` | End the session. |

Hosted sign-in uses OIDC authorization-code with PKCE, server-side session
cookies and CSRF protection, and authorization is checked on every project,
result and artifact operation. `(issuer, subject)` maps to a server-owned opaque
`ownerId`; caller-supplied owner identity is never authorization. Imported or
shared data is untrusted, size-limited and validated. Bundle import rejects
escaping paths, symlinks, conflicting identities, invalid hashes and unsupported
schema versions, and never auto-executes. No arbitrary Python pickle or
executable object appears in any contract. SSE reconnect is authorized exactly
like the initial request, replays durable events after the given id, and signals
an expired cursor with instructions to fetch current job state.

## Launch configuration

A scenario's launch configuration is a serializable restricted integer-expression
AST, never executable host Python. Operators are `literal`, `parameter`, `add`,
`subtract`, `multiply`, `floorDivide`, `modulo` and `ceilDivide`. Parameter names
resolve only to declared domain variables; divisors must be positive under the
constraints; resulting grid dimensions must be nonnegative; invalid or unbounded
configurations are rejected explicitly. `displayHints` such as `triton.cdiv` are
human-facing text and are never parsed back into semantics. The Triton DSL
extractor and the scenario evaluator share this typed expression model and its
width semantics.

The example scenario uses `floorDivide(N, BLOCK)`; the corrected scenario uses
`ceilDivide(N, BLOCK)`, displayed as `triton.cdiv`.

## Engine request

The engine's initial input is a validated `EngineRequest` written by the
supervisor into a read-only request file. The deployment-selected engine
executable receives `--request <path>` as an argv vector, never through a shell,
and reads its identity from that request; stdin then carries cancel messages.
`Budget` fields are `solverTimeMs`, `engineWallTimeMs`, `memoryBytes`,
`maxMessageBytes`, `maxOutputBytes` and `maxArtifactBytes`, with explicit units.
Initial CPU-profile defaults are 30000 ms solver, 120000 ms engine wall,
2147483648 bytes memory, 1048576 bytes per message, 16777216 output bytes and
268435456 artifact bytes. Operators may lower them; a request cannot raise them.
Solver exhaustion is `unknown`; process or resource breaches fail with
`ENGINE_FAILED` and an explicit reason.

## Eligibility

One `EligibilityPolicy` in domain policy defines required-property acceptance and
measurement eligibility. A recommendation requires exact compatible snapshot,
scenario, profile, domain and policy identities, satisfied declared required
checks, complete measurement provenance, a measured rather than estimated metric,
and a compatible hardware cohort. `Measurement.eligibility` is `eligible` or
`ineligible` with reason codes: well-formed but incomplete imports stay
ineligible; structurally invalid or hash-conflicting imports are rejected.
Imported validation never becomes provider-produced proof. Explicit user policy
may admit local imported evidence while preserving origin and evidence class.

## Local execution authorization

`--trust-local-code` is required for any path that imports or executes user
Python, native programs or reference computations, including numerical replay and
benchmarking. Pure static or symbolic parsing requires no execution consent.
`pomset serve` only browses reports and exposes no job-execution route; there is
no web-to-local job submission and no runner pairing infrastructure. It binds to
loopback, validates Host and Origin, disables cross-origin access and requires a
random local read capability for private report APIs. Merely opening an imported
report cannot authorize execution.
