# Platform — `PLT`

Profiles, availability, durability, quotas and operations. Sources: `SRC-031`,
`SRC-034`, `SRC-038`, `SRC-037`.

### REQ-PLT-001  A versioned profile catalogue

**Statement.** Pomset SHALL maintain a catalogue of profile revisions, each
pinning the exact engine, tool versions, platform and image digest it measured,
and SHALL NOT rewrite a published revision in place.

**Rationale.** `SRC-031`. A result names the profile that produced it, and a
profile that changes underneath makes the record meaningless.

**Acceptance.** `ACC-004`, `ACC-006`.

**Scope.** A new combination is a new revision.

**Implemented by.** `TASK-FND-008`, `TASK-HST-011`, `TASK-FND-002`.

**ADRs.** [ADR-0006](../adr/0006-jobs-and-persistence.md), [ADR-0012](../adr/0012-research-gates-and-compatibility.md)  Specification: [`../architecture/security-and-deployment.md`](../architecture/security-and-deployment.md).

**Contracts.** `ProfileRevision`.

### REQ-PLT-002  Support level and availability are independent

**Statement.** Each capability SHALL carry a support level (`validated`,
`limited`, `untested`) and an availability (`immediate`, `queued`, `unavailable`)
that are set independently, so that a validated capability can be temporarily
unavailable and an available capability can be untested.

**Rationale.** `SRC-038`. "Busy" and "unsupported" are different answers and must
not collapse into one.

**Acceptance.** `ACC-004`, `ACC-009`.

**Scope.** Availability is derived from live deployment state and never rewrites a
support claim.

**Implemented by.** `TASK-HST-011`, `TASK-FND-008`, `TASK-FND-002`.

**ADRs.** [ADR-0006](../adr/0006-jobs-and-persistence.md), [ADR-0012](../adr/0012-research-gates-and-compatibility.md)  Specification: [`../architecture/security-and-deployment.md`](../architecture/security-and-deployment.md).

**Contracts.** `Capability`.

### REQ-PLT-003  Incompatibility is stated explicitly

**Statement.** When a requested analysis is not supported by a backend, version or
platform, Pomset SHALL state the incompatibility, name the missing component, and
SHALL NOT substitute an alternative that merely looks close.

**Rationale.** `SRC-029`. The unsupported combination gets explained.

**Acceptance.** `ACC-009`.

**Scope.** Includes the CLI manifest validation and the hosted API.

**Implemented by.** `TASK-LOC-005`, `TASK-HST-011`, `TASK-REL-003`.

**ADRs.** [ADR-0006](../adr/0006-jobs-and-persistence.md), [ADR-0012](../adr/0012-research-gates-and-compatibility.md)  Specification: [`../architecture/security-and-deployment.md`](../architecture/security-and-deployment.md).

**Contracts.** `Capability.reason`.

### REQ-PLT-004  Unknown profile resolves to an explicit error

**Statement.** A request naming an unknown profile id SHALL fail with
`PROFILE_NOT_FOUND`, and Pomset SHALL NOT fall back to a nearby, default or first
profile.

**Rationale.** `SRC-029`, and a direct rejection of the fallback observed in the
Compiler Explorer reference. See
[`../reference/compiler-explorer.md`](../reference/compiler-explorer.md).

**Acceptance.** `ACC-004`.

**Scope.** Applies to the API, the CLI and the workbench selector.

**Implemented by.** `TASK-HST-011`, `TASK-LOC-005`.

**ADRs.** [ADR-0012](../adr/0012-research-gates-and-compatibility.md)  Specification: [`../architecture/security-and-deployment.md`](../architecture/security-and-deployment.md).

**Contracts.** `PROFILE_NOT_FOUND`.

### REQ-PLT-005  Durable jobs, events and artifacts

**Statement.** Hosted jobs SHALL be durable across worker restarts, SHALL produce a
durable append-only event stream, and SHALL commit their result and artifact
references atomically with the terminal state.

**Rationale.** `SRC-031`. A durable job is what makes a long analysis usable and a
failure diagnosable.

**Acceptance.** `ACC-004`, `ACC-007`.

**Scope.** Storage selection is described in
[`../adr/0006-jobs-and-persistence.md`](../adr/0006-jobs-and-persistence.md).

**Implemented by.** `TASK-HST-005`, `TASK-HST-006`.

**ADRs.** [ADR-0006](../adr/0006-jobs-and-persistence.md), [ADR-0012](../adr/0012-research-gates-and-compatibility.md)  Specification: [`../architecture/security-and-deployment.md`](../architecture/security-and-deployment.md).

**Contracts.** `Job`, `JobEvent`.

### REQ-PLT-006  Event stream reconnects without fabricated stages

**Statement.** The job event stream SHALL support reconnect using durable event
identifiers, replaying the events after the last identifier the client received,
and SHALL signal an expired cursor with instructions to fetch current job state
instead of replaying from the beginning.

**Rationale.** `SRC-031`, `SRC-012`. A dropped connection must not corrupt the
client's picture of what happened.

**Acceptance.** `ACC-007`.

**Scope.** SSE with `Last-Event-ID`; authorization on reconnect is identical to
the original request.

**Implemented by.** `TASK-HST-008`.

**ADRs.** [ADR-0006](../adr/0006-jobs-and-persistence.md), [ADR-0012](../adr/0012-research-gates-and-compatibility.md)  Specification: [`../architecture/security-and-deployment.md`](../architecture/security-and-deployment.md).

**Contracts.** `JobEvent`, [`packages/contracts/schema/openapi.yaml`](../../packages/contracts/schema/openapi.yaml).

### REQ-PLT-007  Cancellation and resource budgets

**Statement.** Pomset SHALL support cancelling a queued or running job, SHALL
enforce the declared resource budgets on every engine process, and SHALL record
a cancellation durably and idempotently.

**Rationale.** `SRC-031`, `SRC-038`.

**Acceptance.** `ACC-007`.

**Scope.** Lifecycle and fencing rules live in [`engine-protocol.md`](engine-protocol.md).

**Implemented by.** `TASK-HST-007`, `TASK-ENG-005`, `TASK-REL-002`.

**ADRs.** [ADR-0006](../adr/0006-jobs-and-persistence.md), [ADR-0012](../adr/0012-research-gates-and-compatibility.md)  Specification: [`../architecture/security-and-deployment.md`](../architecture/security-and-deployment.md).

**Contracts.** `Budget`, `Job.state`.

### REQ-PLT-008  Authenticated ownership

**Statement.** Hosted operations SHALL authenticate the caller, authorize every
project, result and artifact operation against the server-owned owner identity,
and protect state-changing requests against cross-site request forgery.

**Rationale.** `SRC-037`, `SRC-038`.

**Acceptance.** `ACC-008`.

**Scope.** Caller-supplied owner identity is never authorization.

**Implemented by.** `TASK-HST-002`, `TASK-HST-010`, `TASK-REL-002`.

**ADRs.** [ADR-0006](../adr/0006-jobs-and-persistence.md), [ADR-0012](../adr/0012-research-gates-and-compatibility.md)  Specification: [`../architecture/security-and-deployment.md`](../architecture/security-and-deployment.md).

**Contracts.** `OwnerIdentity`, `UNAUTHORIZED`, `FORBIDDEN`.

### REQ-PLT-009  A free CPU tier with declared quotas

**Statement.** The hosted service SHALL offer a free CPU-based tier with declared
quotas for concurrent jobs, total job time and artifact storage, and SHALL NOT
require a GPU for a user to obtain a useful result.

**Rationale.** `SRC-034`, `SRC-038`. No GPU pool is operated, so cost must be
bounded by CPU analysis and quotas.

**Acceptance.** `ACC-005`, `ACC-007`.

**Scope.** Quotas are configuration, published with the deployment, not invented
service-level promises.

**Implemented by.** `TASK-HST-014`, `TASK-REL-001`.

**ADRs.** [ADR-0006](../adr/0006-jobs-and-persistence.md), [ADR-0012](../adr/0012-research-gates-and-compatibility.md)  Specification: [`../architecture/security-and-deployment.md`](../architecture/security-and-deployment.md).

**Contracts.** `Budget`.

### REQ-PLT-010  Capacity targets are measured, not promised

**Statement.** Pomset SHALL record measured capacity for its deployment — job
throughput, queue latency and artifact growth — and SHALL NOT publish an
availability or latency promise that has not been measured on the deployment it
describes.

**Rationale.** `SRC-038`. An invented SLA is a false statement about a system that
does not exist yet.

**Acceptance.** `ACC-007`.

**Scope.** Replaces any earlier adoption or capacity projection.

**Implemented by.** `TASK-HST-014`, `TASK-REL-003`, `TASK-FEA-006`.

**ADRs.** [ADR-0006](../adr/0006-jobs-and-persistence.md), [ADR-0012](../adr/0012-research-gates-and-compatibility.md)  Specification: [`../architecture/security-and-deployment.md`](../architecture/security-and-deployment.md).

**Contracts.** —

### REQ-PLT-011  Reproducibility of a stored result

**Statement.** For every stored result, Pomset SHALL retain enough information —
snapshot identity, scenario, domain, policy revision, profile revision, query model
revision, solver version and artifact references — that the analysis can be
re-attempted and its outcome compared.

**Rationale.** `SRC-031`, `SRC-043`.

**Acceptance.** `ACC-004`, `ACC-006`.

**Scope.** Re-attempting may legitimately produce a different unknown/established
split under a newer model; the difference is reported.

**Implemented by.** `TASK-HST-006`, `TASK-FND-006`.

**ADRs.** [ADR-0006](../adr/0006-jobs-and-persistence.md), [ADR-0012](../adr/0012-research-gates-and-compatibility.md)  Specification: [`../architecture/security-and-deployment.md`](../architecture/security-and-deployment.md).

**Contracts.** `AnalysisResult`.

### REQ-PLT-012  Artifact isolation

**Statement.** Hosted artifacts SHALL be stored under opaque, owner-scoped
references, SHALL be retrievable only through an authorized route, and SHALL NOT be
reachable by guessing a content hash or a path.

**Rationale.** `SRC-037`, `SRC-030`.

**Acceptance.** `ACC-007`, `ACC-008`.

**Scope.** Internal deduplication must not expose another owner's artifacts.

**Implemented by.** `TASK-HST-009`, `TASK-HST-013`.

**ADRs.** [ADR-0006](../adr/0006-jobs-and-persistence.md), [ADR-0012](../adr/0012-research-gates-and-compatibility.md)  Specification: [`../architecture/security-and-deployment.md`](../architecture/security-and-deployment.md).

**Contracts.** `ArtifactManifest`, [`../adr/0005-snapshots-and-artifacts.md`](../adr/0005-snapshots-and-artifacts.md).

### REQ-PLT-013  Deployment without a proprietary queue service

**Statement.** The hosted deployment SHALL run on PostgreSQL, an S3-compatible
object store, the API and workers, and SHALL NOT require a proprietary cloud queue
or a managed vendor service to operate.

**Rationale.** `SRC-034`. Portability of the deployment is part of keeping the
public tier affordable and reproducible.

**Acceptance.** `ACC-007`.

**Scope.** See [`../architecture/security-and-deployment.md`](../architecture/security-and-deployment.md).

**Implemented by.** `TASK-HST-015`, `TASK-REL-002`.

**ADRs.** [ADR-0006](../adr/0006-jobs-and-persistence.md), [ADR-0012](../adr/0012-research-gates-and-compatibility.md)  Specification: [`../architecture/security-and-deployment.md`](../architecture/security-and-deployment.md).

**Contracts.** [`../adr/0006-jobs-and-persistence.md`](../adr/0006-jobs-and-persistence.md).

### REQ-PLT-014  No hosted GPU execution

**Statement.** Pomset SHALL NOT execute user kernels on hosted GPUs, and SHALL NOT
offer a mechanism by which a hosted web session starts execution on a user's
machine.

**Rationale.** `SRC-030`, `SRC-034`. GPU work runs on user-operated machines under
their own trust boundary.

**Acceptance.** `ACC-008`, `ACC-009`.

**Scope.** This is a scope decision, not a future roadmap item.

**Implemented by.** `TASK-HST-001`, `TASK-CUDA-001`.

**ADRs.** [ADR-0007](../adr/0007-sandbox-and-local-runners.md)  Specification: [`../architecture/security-and-deployment.md`](../architecture/security-and-deployment.md).

**Contracts.** [`../adr/0007-sandbox-and-local-runners.md`](../adr/0007-sandbox-and-local-runners.md).

### REQ-PLT-015  Retention and deletion are explicit

**Statement.** Pomset SHALL define retention per artifact class, SHALL record the
retention class of every artifact, and SHALL distinguish deleting stored bytes from
revoking access to an already published report.

**Rationale.** `SRC-037`, `SRC-012`. These are different operations with different
guarantees.

**Acceptance.** `ACC-007`, `ACC-008`.

**Scope.** Ownership remains distinct from content identity throughout.

**Implemented by.** `TASK-HST-013`.

**ADRs.** [ADR-0006](../adr/0006-jobs-and-persistence.md), [ADR-0012](../adr/0012-research-gates-and-compatibility.md)  Specification: [`../architecture/security-and-deployment.md`](../architecture/security-and-deployment.md).

**Contracts.** `ArtifactManifest.retention`.
