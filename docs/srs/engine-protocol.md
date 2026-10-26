# Engine protocol and job lifecycle — `ENG`

The engine analyses; the supervisor owns the process, the lifecycle and the
limits. This file owns protocol direction and version, process limits, job and
attempt transitions, cancellation and fencing, error records, and immutable
partial evidence. Sources: `SRC-029`, `SRC-030`, `SRC-031`.

### REQ-ENG-001  Exactly one initial hello, versioned

**Statement.** An engine process SHALL send exactly one initial `hello` message
declaring `protocolVersion: 1`, its engine identity, its version and its
capabilities. A repeated hello, a mismatched version, or a first message that is not
`hello` SHALL fail the job with `PROTOCOL_INVALID`.

**Rationale.** `SRC-029`. A protocol that negotiates itself into ambiguity cannot be
trusted to report results.

**Acceptance.** `ACC-007`.

**Scope.** `protocolVersion` is 1 for the initial portable format.

**Implemented by.** `TASK-ENG-001`, `TASK-ENG-004`.

**ADRs.** [ADR-0002](../adr/0002-monorepo-and-language-boundary.md), [ADR-0006](../adr/0006-jobs-and-persistence.md)  Specification: [`../architecture/lifecycle.md`](../architecture/lifecycle.md).

**Contracts.** `helloPayload`, `PROTOCOL_INVALID`.

### REQ-ENG-002  JSON Lines on stdin and stdout, diagnostics on stderr

**Statement.** The engine boundary SHALL be JSON Lines over the child process's
stdin and stdout. stderr SHALL carry bounded diagnostics only and SHALL NOT be a
second protocol channel.

**Rationale.** `SRC-029`. One channel, one parser, one set of validation rules.

**Acceptance.** `ACC-007`.

**Scope.** No Python HTTP microservice sits behind this boundary.

**Implemented by.** `TASK-ENG-001`.

**ADRs.** [ADR-0002](../adr/0002-monorepo-and-language-boundary.md), [ADR-0006](../adr/0006-jobs-and-persistence.md)  Specification: [`../architecture/lifecycle.md`](../architecture/lifecycle.md).

**Contracts.** `engineEnvelope`.

### REQ-ENG-003  Launch by fixed argv over a read-only request file

**Statement.** The supervisor SHALL launch the engine with a deployment-selected
argv vector plus `--request <path>`, where the path names a supervisor-created,
read-only request file containing the protocol version, job and attempt identity,
operation, mapped immutable input references, scenario, domain, profile revision and
budget. No command or host path supplied by an uploaded scenario SHALL be executable
authority.

**Rationale.** `SRC-030`. Input data, not instructions.

**Acceptance.** `ACC-007`.

**Scope.** Parse and replay adapters use the same launch contract.

**Implemented by.** `TASK-ENG-002`, `TASK-ENG-003`.

**ADRs.** [ADR-0002](../adr/0002-monorepo-and-language-boundary.md), [ADR-0006](../adr/0006-jobs-and-persistence.md)  Specification: [`../architecture/lifecycle.md`](../architecture/lifecycle.md).

**Contracts.** `EngineRequest`.

### REQ-ENG-004  Envelope validation and per-direction sequence

**Statement.** Every engine message SHALL carry `protocolVersion`, `jobId`,
`attemptId`, `sequence` and `type`. Each direction SHALL maintain its own increasing
sequence starting at 1. A missing required field, a wrong identity, a size limit
breach or a sequence violation SHALL fail the job with `PROTOCOL_INVALID`.

**Rationale.** `SRC-030`. Sequence validation is what makes an append-only stream
meaningful.

**Acceptance.** `ACC-007`.

**Scope.** Message types engine to supervisor: `hello`, `progress`, `finding`,
`artifact`, `result`, `error`. Supervisor to engine: `cancel`.

**Implemented by.** `TASK-ENG-004`.

**ADRs.** [ADR-0002](../adr/0002-monorepo-and-language-boundary.md), [ADR-0006](../adr/0006-jobs-and-persistence.md)  Specification: [`../architecture/lifecycle.md`](../architecture/lifecycle.md).

**Contracts.** `engineEnvelope`, `engineMessageType`.

### REQ-ENG-005  Directional cancellation with bounded termination

**Statement.** Cancellation SHALL be cooperative: the supervisor sends `cancel`, the
engine acknowledges through its terminal result or error message, and the supervisor
terminates the process tree after a bounded grace period.

**Rationale.** `SRC-030`. Cooperation is what lets an engine flush what it has; the
kill is what guarantees the process actually stops.

**Acceptance.** `ACC-007`.

**Scope.** The grace period is a deployment setting; the supervisor always terminates.

**Implemented by.** `TASK-ENG-005`, `TASK-ENG-006`, `TASK-HST-007`.

**ADRs.** [ADR-0002](../adr/0002-monorepo-and-language-boundary.md), [ADR-0006](../adr/0006-jobs-and-persistence.md)  Specification: [`../architecture/lifecycle.md`](../architecture/lifecycle.md).

**Contracts.** `cancelPayload`.

### REQ-ENG-006  Job state machine with immutable terminal states

**Statement.** `Job.state` SHALL be one of `queued`, `running`, `cancel-requested`,
`succeeded`, `failed`, `cancelled`. The permitted transitions SHALL be exactly:
`queued`→`running`|`cancelled`|`failed`; `running`→`succeeded`|`failed`|`cancel-requested`;
`cancel-requested`→`cancelled`; every terminal state→none. Terminal states SHALL be
immutable.

**Rationale.** `SRC-031`. A state machine with no unlisted transitions is what makes
the event stream replayable.

**Acceptance.** `ACC-004`, `ACC-007`.

**Scope.** A succeeded job carries no correctness assertion; see
[`evidence.md`](evidence.md).

**Implemented by.** `TASK-ENG-005`, `TASK-HST-005`.

**ADRs.** [ADR-0002](../adr/0002-monorepo-and-language-boundary.md), [ADR-0006](../adr/0006-jobs-and-persistence.md)  Specification: [`../architecture/lifecycle.md`](../architecture/lifecycle.md).

**Contracts.** `jobState`.

### REQ-ENG-007  Completion cannot outrun a recorded cancellation

**Statement.** Completion SHALL win only if it commits before a cancellation request
is recorded. Once a cancellation has been recorded, a later completion SHALL NOT
produce `succeeded`. Completion commits its result references and terminal state
atomically.

**Rationale.** `SRC-031`, `SRC-012`. A race between cancel and finish must have one
outcome, and it must be the recorded one.

**Acceptance.** `ACC-004`, `ACC-007`.

**Scope.** Applies to hosted leasing and to local supervision alike.

**Implemented by.** `TASK-ENG-005`, `TASK-HST-007`.

**ADRs.** [ADR-0006](../adr/0006-jobs-and-persistence.md)  Specification: [`../architecture/lifecycle.md`](../architecture/lifecycle.md).

**Contracts.** `Job.state`.

### REQ-ENG-008  Partial evidence survives cancellation

**Statement.** Evidence accepted before a cancellation was recorded SHALL be
retained with its actual completeness and a partial qualifier. It SHALL never be
promoted to a successful complete result.

**Rationale.** `SRC-012`, `SRC-021`. What the interrupted attempt found is still
information.

**Acceptance.** `ACC-004`.

**Scope.** Includes findings, coverage and artifacts already committed.

**Implemented by.** `TASK-ENG-005`, `TASK-HST-006`.

**ADRs.** [ADR-0002](../adr/0002-monorepo-and-language-boundary.md), [ADR-0006](../adr/0006-jobs-and-persistence.md)  Specification: [`../architecture/lifecycle.md`](../architecture/lifecycle.md).

**Contracts.** `AnalysisResult`, `Coverage`.

### REQ-ENG-009  One job, one attempt

**Statement.** A job SHALL have exactly one execution attempt, whose `attemptId` is
its immutable process-execution identity. A user-requested rerun SHALL create a new
job, and SHALL NOT resume or mutate a terminal result.

**Rationale.** `SRC-031`. Immutable attempt identity is what makes a result traceable
to the process that produced it.

**Acceptance.** `ACC-004`.

**Scope.** No automatic retry policy exists.

**Implemented by.** `TASK-ENG-005`, `TASK-HST-007`.

**ADRs.** [ADR-0006](../adr/0006-jobs-and-persistence.md)  Specification: [`../architecture/lifecycle.md`](../architecture/lifecycle.md).

**Contracts.** `Job.attemptId`.

### REQ-ENG-010  Immutable result records under a job

**Statement.** A job SHALL have zero or more immutable result records, each carrying
`jobId`, `attemptId` and the full snapshot, scenario, domain, policy and profile
provenance. Findings SHALL belong to result records, not to the job.

**Rationale.** `SRC-031`, `SRC-012`.

**Acceptance.** `ACC-004`.

**Scope.** A failed or cancelled job may still have produced result records.

**Implemented by.** `TASK-ENG-005`, `TASK-FND-006`.

**ADRs.** [ADR-0002](../adr/0002-monorepo-and-language-boundary.md), [ADR-0006](../adr/0006-jobs-and-persistence.md)  Specification: [`../architecture/lifecycle.md`](../architecture/lifecycle.md).

**Contracts.** `AnalysisResult`.

### REQ-ENG-011  Leases fence stale workers

**Statement.** Hosted jobs SHALL be coordinated by leases: workers poll
cancellation and lease status at most once per second, send a cooperative cancel and
allow two seconds before process-tree termination, send a heartbeat every five
seconds, and hold a lease that expires after thirty seconds. Every write SHALL
present the active lease fencing token, and lease expiry SHALL finalise the job as
failed with `WORKER_LOST`.

**Rationale.** `SRC-031`. Without fencing, a paused worker comes back and commits a
result for a job that no longer belongs to it.

**Acceptance.** `ACC-007`.

**Scope.** No distributed queue service is required; leased rows are the coordinator.

**Implemented by.** `TASK-HST-005`, `TASK-HST-007`.

**ADRs.** [ADR-0006](../adr/0006-jobs-and-persistence.md)  Specification: [`../architecture/lifecycle.md`](../architecture/lifecycle.md).

**Contracts.** `Job.leaseFencingToken`, `WORKER_LOST`.

### REQ-ENG-012  Cancellation finalises deterministically

**Statement.** Once a cancellation is recorded, engine death or grace-period expiry
SHALL finalise the job as `cancelled`, not as `failed`. Lease expiry without a
recorded cancellation SHALL finalise the job as `failed`. Late messages after
finalisation or after lease loss SHALL be rejected.

**Rationale.** `SRC-031`. The recorded intent decides the terminal state.

**Acceptance.** `ACC-007`.

**Scope.** Idempotent: repeated cancellation requests converge on the same state.

**Implemented by.** `TASK-ENG-005`, `TASK-HST-007`.

**ADRs.** [ADR-0006](../adr/0006-jobs-and-persistence.md)  Specification: [`../architecture/lifecycle.md`](../architecture/lifecycle.md).

**Contracts.** `Job.state`.

### REQ-ENG-013  One error vocabulary

**Statement.** Pomset SHALL use exactly one error vocabulary —
`PROFILE_NOT_FOUND`, `ENGINE_FAILED`, `WORKER_LOST`, `PROTOCOL_INVALID`,
`INPUT_INVALID`, `BUNDLE_INVALID`, `UNAUTHORIZED`, `FORBIDDEN` — in HTTP responses,
engine error payloads, job failures and CLI reports, with a shared
`ErrorRecord {code, message, details}` shape.

**Rationale.** `SRC-029`. Two error vocabularies become two stories about one
failure.

**Acceptance.** `ACC-005`, `ACC-007`.

**Scope.** Unsupported and unknown analysis outcomes are not error codes.

**Implemented by.** `TASK-FND-006`, `TASK-ENG-004`, `TASK-FND-002`.

**ADRs.** [ADR-0002](../adr/0002-monorepo-and-language-boundary.md), [ADR-0006](../adr/0006-jobs-and-persistence.md)  Specification: [`../architecture/lifecycle.md`](../architecture/lifecycle.md).

**Contracts.** `errorCode`, `errorRecord`.

### REQ-ENG-014  Synchronous error mapping, asynchronous error carriage

**Statement.** Synchronous HTTP failures SHALL map to 404 for a missing profile, 400
for invalid input or protocol, 422 for an invalid bundle, 401 for unauthenticated,
403 for unauthorized, and 500 for engine or worker failure. An asynchronous failure
SHALL appear in `Job.failure`, in the error event payload and in the engine error
payload using the same record, and SHALL NOT change the HTTP status of an already
successful response or an open stream.

**Rationale.** `SRC-029`. A job that fails after being accepted still returns 200
from the request that accepted it.

**Acceptance.** `ACC-007`, `ACC-008`.

**Scope.** Applies to SSE streams after headers are sent.

**Implemented by.** `TASK-HST-003`, `TASK-ENG-004`.

**ADRs.** [ADR-0002](../adr/0002-monorepo-and-language-boundary.md), [ADR-0006](../adr/0006-jobs-and-persistence.md)  Specification: [`../architecture/lifecycle.md`](../architecture/lifecycle.md).

**Contracts.** [`packages/contracts/schema/openapi.yaml`](../../packages/contracts/schema/openapi.yaml).

### REQ-ENG-015  Budget breaches fail; budget exhaustion is unknown

**Statement.** Exceeding the wall-clock, memory, message, output or artifact limit
SHALL fail the job with `ENGINE_FAILED` and an explicit reason. Exhausting the solver
budget SHALL produce an `unknown` property result, not a job failure, an error code,
or an established property.

**Rationale.** `SRC-030`, `SRC-022`. "The process did too much" and "the solver ran
out of road" are different events.

**Acceptance.** `ACC-003`, `ACC-007`.

**Scope.** Initial CPU-profile defaults: 30000 ms solver, 120000 ms engine wall,
2147483648 bytes memory, 1048576 bytes per message, 16777216 output bytes and
268435456 artifact bytes. Operators may only lower them per request.

**Implemented by.** `TASK-ENG-004`, `TASK-ENG-006`.

**ADRs.** [ADR-0002](../adr/0002-monorepo-and-language-boundary.md), [ADR-0006](../adr/0006-jobs-and-persistence.md)  Specification: [`../architecture/lifecycle.md`](../architecture/lifecycle.md).

**Contracts.** `Budget`.

### REQ-ENG-016  Progress and accepted evidence are append-only

**Statement.** Progress events and accepted evidence chunks SHALL be append-only.
A later message SHALL NOT modify or retract an earlier accepted one.

**Rationale.** `SRC-031`. Append-only is what makes the durable stream replayable and
the record trustworthy.

**Acceptance.** `ACC-007`.

**Scope.** Applies to `progress`, `finding` and `artifact` messages.

**Implemented by.** `TASK-ENG-004`, `TASK-HST-006`.

**ADRs.** [ADR-0002](../adr/0002-monorepo-and-language-boundary.md), [ADR-0006](../adr/0006-jobs-and-persistence.md)  Specification: [`../architecture/lifecycle.md`](../architecture/lifecycle.md).

**Contracts.** `JobEvent`.

### REQ-ENG-017  The engine owns no accounts and no publication

**Statement.** Python and native engines SHALL hold no user accounts, no
publication rights and no network access in hosted operation. Analysis is their
entire authority.

**Rationale.** `SRC-030`. Least privilege at the process boundary.

**Acceptance.** `ACC-007`.

**Scope.** The worker owns cancellation and limits; the engine owns analysis.

**Implemented by.** `TASK-HST-012`, `TASK-ENG-002`.

**ADRs.** [ADR-0002](../adr/0002-monorepo-and-language-boundary.md), [ADR-0006](../adr/0006-jobs-and-persistence.md)  Specification: [`../architecture/lifecycle.md`](../architecture/lifecycle.md).

**Contracts.** —
