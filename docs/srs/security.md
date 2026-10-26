# Security — `SEC`

The system runs code it did not write. Everything here follows from that.
Sources: `SRC-027`, `SRC-029`, `SRC-030`, `SRC-034`, `SRC-037`.

### REQ-SEC-001  Hosted execution runs untrusted code in a fail-closed sandbox

**Statement.** Any hosted execution of user-supplied Python, native code or
compiler toolchain SHALL run inside a Linux OCI sandbox with no network, a
non-root identity, a read-only runtime and bounded scratch and resource limits.
When no such sandbox is available, Pomset SHALL mark the capability unavailable and
SHALL NOT fall back to unsandboxed execution.

**Rationale.** `SRC-030`, and a direct rejection of the permissive default in the
Compiler Explorer reference. See
[`../reference/compiler-explorer.md`](../reference/compiler-explorer.md).

**Acceptance.** `ACC-007`.

**Scope.** See [`../adr/0007-sandbox-and-local-runners.md`](../adr/0007-sandbox-and-local-runners.md).

**Implemented by.** `TASK-HST-012`, `TASK-HST-016`.

**ADRs.** [ADR-0007](../adr/0007-sandbox-and-local-runners.md)  Specification: [`../architecture/security-and-deployment.md`](../architecture/security-and-deployment.md).

**Contracts.** `Capability.availability`.

### REQ-SEC-002  Sandbox preflight is a gate on profile availability

**Statement.** A hosted profile that needs an execution capability SHALL be offered
only after a preflight probe has demonstrated that its interpreter, libraries and
compilation path work inside the deployed sandbox image, including bounded
writable scratch and cache. A failed probe SHALL leave only the capability
unavailable, not the isolation weakened.

**Rationale.** `SRC-030`. The probe is the difference between "tested here" and
"believed to work".

**Acceptance.** `ACC-007`.

**Scope.** If a tool cannot run safely in the sandbox, the hosted profile stays
unavailable and local mode is the honest alternative.

**Implemented by.** `TASK-HST-016`, `TASK-HST-017`, `TASK-REL-002`.

**ADRs.** [ADR-0007](../adr/0007-sandbox-and-local-runners.md)  Specification: [`../architecture/security-and-deployment.md`](../architecture/security-and-deployment.md).

**Contracts.** `ProfileRevision`, `Capability`.

### REQ-SEC-003  Local execution requires explicit consent

**Statement.** Any path that imports or executes user Python, a native program or a
reference computation SHALL require explicit local execution consent for that
invocation. Pure static or symbolic parsing SHALL run without it.

**Rationale.** `SRC-030`. Reading a file and running it are different acts.

**Acceptance.** `ACC-005`, `ACC-009`.

**Scope.** Numerical replay and benchmarking always require consent.

**Implemented by.** `TASK-LOC-006`, `TASK-TRI-017`.

**ADRs.** [ADR-0007](../adr/0007-sandbox-and-local-runners.md)  Specification: [`../architecture/security-and-deployment.md`](../architecture/security-and-deployment.md).

**Contracts.** `EngineRequest.consent`, `--trust-local-code`.

### REQ-SEC-004  Imports are untrusted input

**Statement.** Pomset SHALL treat every imported bundle, measurement, report and
archive as untrusted. It SHALL reject path escaping, absolute paths, symlinks,
conflicting identities, invalid content hashes, unsupported schema versions,
oversized payloads and malformed nesting, and SHALL NOT follow a link, resolve a
path outside the bundle root, or deserialize an executable object.

**Rationale.** `SRC-027`. An import is the most direct route for hostile input.

**Acceptance.** `ACC-005`.

**Scope.** No arbitrary Python pickle or executable object appears in any portable
contract.

**Implemented by.** `TASK-SEC-004`, `TASK-HST-012`.

**ADRs.** [ADR-0007](../adr/0007-sandbox-and-local-runners.md)  Specification: [`../architecture/security-and-deployment.md`](../architecture/security-and-deployment.md).

**Contracts.** `BUNDLE_INVALID`, `ExperimentBundle`.

### REQ-SEC-005  Resource, network and filesystem limits are enforced by the supervisor

**Statement.** The process supervisor SHALL enforce wall-clock, memory, message
size, output size and artifact size limits on every engine process, SHALL kill the
whole process tree when a limit or cancellation requires it, and SHALL record the
breach with an explicit reason.

**Rationale.** `SRC-030`, `SRC-038`. A cooperative engine is not a control.

**Acceptance.** `ACC-007`.

**Scope.** A limit breach is an engine failure with a reason, distinct from budget
exhaustion that yields `unknown`.

**Implemented by.** `TASK-ENG-004`, `TASK-ENG-006`.

**ADRs.** [ADR-0007](../adr/0007-sandbox-and-local-runners.md)  Specification: [`../architecture/security-and-deployment.md`](../architecture/security-and-deployment.md).

**Contracts.** `Budget`, `ENGINE_FAILED`.

### REQ-SEC-006  No secrets in artifacts or logs

**Statement.** Pomset SHALL keep credential material, session tokens and database
credentials out of job logs, artifacts, error records and exports, and SHALL redact
recognized secret patterns from captured engine output.

**Rationale.** `SRC-037`. A report is shareable; a log that carries a token is
not.

**Acceptance.** `ACC-007`, `ACC-008`.

**Scope.** Includes stderr diagnostics and compiler logs captured from user builds.

**Implemented by.** `TASK-ENG-007`, `TASK-HST-016`.

**ADRs.** [ADR-0007](../adr/0007-sandbox-and-local-runners.md)  Specification: [`../architecture/security-and-deployment.md`](../architecture/security-and-deployment.md).

**Contracts.** `ErrorRecord`, `ArtifactManifest`.

### REQ-SEC-007  Artifact access is authorized per request

**Statement.** Every artifact read SHALL be authorized against the requester's
ownership of the artifact or against a publication that includes it, and SHALL NOT
be authorized by possession of a content hash, an internal path or an unguessable
URL alone.

**Rationale.** `SRC-037`. Unpredictable is not the same as authorized.

**Acceptance.** `ACC-008`.

**Scope.** Internal deduplication must not reveal another owner's artifacts.

**Implemented by.** `TASK-HST-013`.

**ADRs.** [ADR-0007](../adr/0007-sandbox-and-local-runners.md)  Specification: [`../architecture/security-and-deployment.md`](../architecture/security-and-deployment.md).

**Contracts.** `FORBIDDEN`, [`../adr/0005-snapshots-and-artifacts.md`](../adr/0005-snapshots-and-artifacts.md).

### REQ-SEC-008  No automatic remote or hosted GPU execution

**Statement.** Pomset SHALL NOT execute user kernels on hosted GPUs, SHALL NOT
provide web-to-local job submission or runner pairing, and SHALL NOT require any
hosted GPU pool.

**Rationale.** `SRC-030`, `SRC-034`. Untrusted programs interacting with drivers and
accelerator resources are not adequately isolated by ordinary process isolation,
and the honest answer is not to do it.

**Acceptance.** `ACC-008`, `ACC-009`.

**Scope.** GPU work is a local, user-consented operation.

**Implemented by.** `TASK-HST-001`, `TASK-CUDA-001`.

**ADRs.** [ADR-0007](../adr/0007-sandbox-and-local-runners.md)  Specification: [`../architecture/security-and-deployment.md`](../architecture/security-and-deployment.md).

**Contracts.** `Capability.availability`.

### REQ-SEC-009  Publication is a threat boundary

**Statement.** Pomset SHALL treat publication as a disclosure operation: source,
paths, logs, hardware metadata and witness details can each reveal something the
owner did not intend, and each is enumerated in the disclosure preview.

**Rationale.** `SRC-037`.

**Acceptance.** `ACC-008`.

**Scope.** See [`sharing.md`](sharing.md) for the publication contract.

**Implemented by.** `TASK-HST-010`, `TASK-WEB-016`.

**ADRs.** [ADR-0007](../adr/0007-sandbox-and-local-runners.md)  Specification: [`../architecture/security-and-deployment.md`](../architecture/security-and-deployment.md).

**Contracts.** `DisclosurePreview`.

### REQ-SEC-010  Worker least privilege

**Statement.** Workers SHALL hold only the database and object-store permissions
their job lifecycle requires, SHALL NOT hold identity-provider or billing
credentials, and SHALL NOT be able to read another owner's artifacts or an
unleased project's content.

**Rationale.** `SRC-030`, `SRC-037`.

**Acceptance.** `ACC-007`.

**Scope.** Leases fence writes; a stale worker cannot commit.

**Implemented by.** `TASK-HST-005`, `TASK-HST-013`.

**ADRs.** [ADR-0007](../adr/0007-sandbox-and-local-runners.md)  Specification: [`../architecture/security-and-deployment.md`](../architecture/security-and-deployment.md).

**Contracts.** `Job.leaseFencingToken`.

### REQ-SEC-011  Scenario-supplied paths are never executable authority

**Statement.** The engine SHALL be launched with a fixed argv vector written by the
supervisor, SHALL receive its inputs through a read-only request file, and SHALL NOT
execute a command or open a host path taken from an uploaded scenario.

**Rationale.** `SRC-030`, `SRC-027`. A scenario is data about a kernel, not a
shell script.

**Acceptance.** `ACC-007`.

**Scope.** Parse and replay adapters use the same launch contract.

**Implemented by.** `TASK-ENG-002`, `TASK-ENG-003`.

**ADRs.** [ADR-0007](../adr/0007-sandbox-and-local-runners.md)  Specification: [`../architecture/security-and-deployment.md`](../architecture/security-and-deployment.md).

**Contracts.** `EngineRequest`.

### REQ-SEC-012  Reused third-party code carries its notices

**Statement.** Any third-party code selectively reused in Pomset SHALL retain its
original per-file copyright and licence notices, SHALL be listed in the project
`NOTICE` file with its origin and revision, and SHALL satisfy the redistribution
conditions of its licence. Pomset's own code remains Apache-2.0.

**Rationale.** `SRC-014`. The Compiler Explorer reference is BSD-2-Clause, whose
conditions require retaining the notice in source redistributions and reproducing
it in the materials accompanying a binary distribution. A repository licence does
not replace a per-file notice.

**Acceptance.** `ACC-009`.

**Scope.** No code is copied by the documentation change; the obligation applies
to any future reuse task, which carries its own licence verification step.

**Implemented by.** `TASK-FND-009`, `TASK-REL-004`.

**ADRs.** [ADR-0004](../adr/0004-contract-authority.md), [ADR-0002](../adr/0002-monorepo-and-language-boundary.md)  Specification: [`../architecture/monorepo.md`](../architecture/monorepo.md).

**Contracts.** [`../contracts/README.md`](../contracts/README.md).

### REQ-SEC-013  Malicious output cannot corrupt the record

**Statement.** Engine messages that exceed the size limit, contain invalid envelopes,
repeat a hello, or violate the sequence rule SHALL be rejected as
`PROTOCOL_INVALID` and SHALL fail the job without corrupting previously accepted
evidence.

**Rationale.** `SRC-030`. A misbehaving engine must not be able to rewrite history.

**Acceptance.** `ACC-007`.

**Scope.** Accepted evidence chunks are append-only.

**Implemented by.** `TASK-ENG-004`, `TASK-ENG-005`.

**ADRs.** [ADR-0007](../adr/0007-sandbox-and-local-runners.md)  Specification: [`../architecture/security-and-deployment.md`](../architecture/security-and-deployment.md).

**Contracts.** `PROTOCOL_INVALID`, `JobEvent`.
