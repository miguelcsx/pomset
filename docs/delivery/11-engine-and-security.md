# Engine protocol and security — `ENG`, `SEC`

This epic is written as one integrated contract because the engine boundary and
the security boundary are the same boundary: the supervisor is the only
component that launches, limits, cancels and terminates an engine process, and
the engine owns analysis and nothing else. It is placed last in the file list
but its tasks are prerequisites of `TRI`, `LOC` and `HST`, which is why those
tasks carry explicit prerequisites rather than relying on file order. The local supervisor and SQLite lifecycle are partially implemented; hosted
containment and leased-worker acceptance remain unfinished. Tasks below retain
their full acceptance obligations. See [current evidence](../evaluation/implementation-audit.md).

| Field | Value |
|---|---|
| Epic prefixes | `ENG` (engine protocol and lifecycle), `SEC` (security) |
| Prerequisites as a whole | `TASK-FND-002` for the shared contracts and error registry; the remaining prerequisites are given per task. A no-go at `TASK-FEA-006` stops `FND` and therefore this epic. |
| Milestone | **M1 Foundation**, shared with `FND`; closes when the contracts validate, the generated bindings build and CI runs CPU-only. |
| Downstream | `TRI` (engine implementation and `packages/engine-client`), `LOC` (local supervisor), `HST` (hosted workers and artifact authorization), `CUDA` and `OMP` (native adapters). |

The authoritative texts are
[`../srs/engine-protocol.md`](../srs/engine-protocol.md),
[`../srs/security.md`](../srs/security.md),
[`../architecture/lifecycle.md`](../architecture/lifecycle.md),
[`../architecture/security-and-deployment.md`](../architecture/security-and-deployment.md)
and the engine and bundle schemas in [`../contracts/`](../contracts/README.md).
Nothing in this file restates a requirement as new policy; it links them.

### TASK-ENG-001  Build the JSON Lines codec, the engine envelope and the single initial hello

**Purpose.** Fix the wire boundary: one newline-delimited JSON channel on stdout
and stdin, one validated envelope, and exactly one versioned hello per engine
process.
**Owns.** `packages/engine-client/src/codec.ts`, `packages/engine-client/src/envelope.ts`, `engines/triton/src/hello.py`
**Requirement links.** `REQ-ENG-001`, `REQ-ENG-002`
**Prerequisites.** `TASK-FND-002`
**Implementation.** Implement the codec as JSON Lines over the child process's stdout and stdin, one JSON object per line with no framing beyond the newline, and a bounded stderr reader that carries diagnostics only and is never parsed as a protocol channel. Every message carries `protocolVersion`, `jobId`, `attemptId`, `sequence` and `type` plus its payload. Engine-to-supervisor types are `hello`, `progress`, `finding`, `artifact`, `result` and `error`; supervisor-to-engine is `cancel`. Exactly one initial `hello` declares `protocolVersion: 1`, the engine identity, its version and its capabilities; a first message that is not a hello, a mismatched version or a repeated hello is `PROTOCOL_INVALID`. No Python HTTP microservice sits behind this boundary: the engine is a child process, not a service. The codec is shared by the Triton engine and, later, by the native adapters, so there is one parser rather than one per language.
**Acceptance.** A reader and writer pair round-trips every message type; a first message that is a progress event, a hello with `protocolVersion: 2`, and a second hello each produce `PROTOCOL_INVALID` and no accepted evidence; no line of stderr is ever surfaced as a protocol message; the generated envelope validator rejects a message missing any required field.
**Verification.** Environment: a CPU worker with the workspace installed. Command: `pnpm --filter @pomset/engine-client test -- codec`. Observation: exit status 0, with a per-case report showing each valid envelope accepted and each malformed or duplicated hello rejected with `PROTOCOL_INVALID`.
**Artifacts.** The codec, the envelope validator generated from `engine.schema.yaml`, and the engine-side hello implementation.

### TASK-ENG-002  Launch the engine by fixed argv over a read-only request file

**Purpose.** Make the engine's inputs data: a supervisor-written, read-only
request file addressed by a fixed argv vector, with budgets that a request can
only lower.
**Owns.** `packages/engine-client/src/launch.ts`, `packages/engine-client/src/request.ts`, `engines/triton/src/request.py`
**Requirement links.** `REQ-ENG-003`, `REQ-SEC-011`
**Prerequisites.** `TASK-ENG-001`
**Implementation.** The supervisor selects the engine executable from deployment configuration, writes a validated `EngineRequest` into a read-only file inside the sandbox and spawns the child with an argv vector ending in `--request <path>`. The request carries `protocolVersion`, `jobId`, `attemptId`, the operation, the immutable input references as mapped inside the sandbox, the scenario, the domain, the profile revision, the consent flag and the budget; it is passed as an argument vector, never through a shell string, and no command or host path supplied by an uploaded scenario is ever executable authority. The engine reads its identity from that request and thereafter receives only cancel messages on stdin. `Budget` is `solverTimeMs`, `engineWallTimeMs`, `memoryBytes`, `maxMessageBytes`, `maxOutputBytes` and `maxArtifactBytes` with explicit units; initial CPU-profile defaults are 30000 ms solver, 120000 ms engine wall, 2147483648 bytes memory, 1048576 bytes per message, 16777216 output bytes and 268435456 artifact bytes; an operator may lower them per request, and a request that tries to raise any of them is rejected as `INPUT_INVALID`. The same launch contract is used by parse and replay adapters. The engine holds no user accounts, no publication rights and no network access in hosted operation.
**Acceptance.** Spawning with a request path containing spaces, quotes or a semicolon executes the deployment-selected executable and passes the path unchanged, with no shell interpretation; a request raising a budget above the profile default is rejected with `INPUT_INVALID`; a request lowering one is accepted; the request file is read-only to the child and cannot be rewritten by it.
**Verification.** Environment: a CPU worker with the workspace installed. Command: `pnpm --filter @pomset/engine-client test -- launch`. Observation: exit status 0, with one passing case for the metacharacter path, one for the raised-budget rejection and one for the lowered-budget acceptance, and a file-mode assertion reporting the request file as read-only.
**Artifacts.** The launch and request modules for the supervisor, the request parser for the engine, and the budget default table.

### TASK-ENG-003  Map inputs read-only and confine scratch and artifacts inside the sandbox

**Purpose.** Give the engine exactly the files it was granted: inputs mounted
read-only at mapped paths, and bounded writable scratch and artifact directories,
with no scenario-supplied path as authority.
**Owns.** `packages/engine-client/src/mounts.ts`, `infra/` sandbox mount specification
**Requirement links.** `REQ-ENG-003`, `REQ-SEC-011`
**Prerequisites.** `TASK-ENG-002`
**Implementation.** Materialize each immutable input reference at a supervisor-chosen path inside the sandbox and expose it read-only; expose one writable scratch directory with a size bound and one writable artifact directory with a separate size bound, both under a supervisor-owned root. The engine resolves every input through the request's mapped references and never through a path taken from the uploaded scenario. A request naming an input that does not resolve to a mapped reference is rejected before launch; an engine attempt to write outside its scratch and artifact roots is denied by the mount configuration, not by convention. The same mapping contract serves the hosted sandbox and the local supervisor, so a path that works locally is not silently different when hosted.
**Acceptance.** An input reference resolves to a read-only path and a write attempt against it fails; a write inside scratch or the artifact root succeeds within the byte bound; a scenario carrying an absolute host path or a traversal path produces an `INPUT_INVALID` rejection before any process starts; no engine-visible path outside the mapped inputs and the two writable roots exists.
**Verification.** Environment: a CPU worker with the workspace installed; the hosted variant additionally uses the image described in [`../architecture/security-and-deployment.md`](../architecture/security-and-deployment.md). Command: `pnpm --filter @pomset/engine-client test -- mounts`. Observation: exit status 0, with a passing read-only assertion, a passing in-bound scratch write, and a rejection record naming the offending scenario path.
**Artifacts.** The mount mapping module, the sandbox mount specification, and the pre-launch path validation.

### TASK-ENG-004  Validate envelopes, sequences and size limits, and keep accepted evidence append-only

**Purpose.** Make the record tamper-evident: each direction sequences
independently, every limit is enforced with a named breach, and an accepted chunk
can never be modified or retracted.
**Owns.** `packages/engine-client/src/supervise.ts`, `packages/engine-client/src/sequence.ts`, `packages/engine-client/src/errors.ts`
**Requirement links.** `REQ-ENG-004`, `REQ-ENG-013`, `REQ-ENG-014`, `REQ-ENG-016`, `REQ-SEC-013`
**Prerequisites.** `TASK-ENG-001`
**Implementation.** Validate every inbound message against the envelope and its direction's own increasing sequence starting at 1; the supervisor's own outbound cancel sequence is tracked separately. A missing required field, a wrong job or attempt identity, a message exceeding `maxMessageBytes`, a sequence violation, a repeated hello or a malformed line fails the job with `PROTOCOL_INVALID`, kills the process tree and leaves every previously accepted chunk intact. Accepted progress events, findings and artifacts are appended to the durable record and are never modified or retracted by a later message. Emit every failure through the single `ErrorRecord {code, message, details}` shape and the single `ErrorCode` enum; an asynchronous failure appears in `Job.failure`, in the error event payload and in the engine error payload using that same record. Synchronous HTTP mapping is owned by the API epic: 404 for a missing profile, 400 for invalid input or protocol, 422 for an invalid bundle, 401 unauthenticated, 403 unauthorized, 500 for engine or worker failure; an asynchronous failure never changes the status of an already successful response or an open stream. Unsupported and unknown analysis outcomes are not error codes.
**Acceptance.** A duplicate sequence number, a skipped sequence number, a message one byte over the limit and an envelope with a missing `attemptId` each fail the job with `PROTOCOL_INVALID` while the previously accepted findings remain readable and unchanged; a later message that restates an earlier finding appends a second record rather than replacing the first; every emitted failure is representable by the shared error record and enum.
**Verification.** Environment: a CPU worker with the workspace installed. Command: `pnpm --filter @pomset/engine-client test -- supervise`. Observation: exit status 0, with one passing case per violation above, an assertion that the accepted-chunk list is byte-identical before and after each violation, and an error-record assertion against the generated enum.
**Artifacts.** The supervisor core, the sequence tracker, and the violation test suite.

### TASK-ENG-005  Implement the job state machine, atomic completion and the cancel-versus-finish race

**Purpose.** Make the lifecycle deterministic under concurrency: one attempt per
job, one atomic completion commit, one winner between cancel and finish, and
immutable terminal states.
**Owns.** `packages/domain/src/job-state.ts`, `packages/storage/src/lifecycle.ts`, `apps/worker/src/attempt.ts`
**Requirement links.** `REQ-ENG-005`, `REQ-ENG-006`, `REQ-ENG-007`, `REQ-ENG-008`, `REQ-ENG-009`, `REQ-ENG-010`, `REQ-ENG-012`
**Prerequisites.** `TASK-ENG-004`
**Implementation.** Encode `Job.state` as exactly `queued`, `running`, `cancel-requested`, `succeeded`, `failed` and `cancelled`, with exactly these transitions: `queued` to `running`, `cancelled` or `failed`; `running` to `succeeded`, `failed` or `cancel-requested`; `cancel-requested` to `cancelled`; and no transition out of a terminal state. A job has exactly one attempt whose `attemptId` is its immutable process-execution identity; a user-requested rerun creates a new job and never resumes or mutates a terminal result; there is no automatic retry policy. Completion commits the result references and the terminal state in one transaction, so a crash between them leaves the previous state for the lease to resolve. Completion wins only if it commits before a cancellation request is recorded; once a cancellation is recorded, a later completion cannot produce `succeeded`, and engine death or grace expiry finalises `cancelled` rather than `failed`, while lease expiry without a recorded cancellation finalises `failed`. Cancellation is idempotent: repeated requests converge on the same state. Evidence accepted before the cancellation was recorded survives with its actual completeness and a partial qualifier, and is never promoted to a complete successful result. A job carries zero or more immutable result records, each with `jobId`, `attemptId` and the full snapshot, scenario, domain, policy and profile provenance; findings belong to result records, not to the job, and a failed or cancelled job may still have produced them. This task implements the local in-process lifecycle; the hosted leased-row consumer implements the same interface in `HST`.
**Acceptance.** Every permitted transition succeeds and every unlisted one — including `succeeded` to `running` and any transition out of a terminal state — is rejected; a completion racing a recorded cancellation resolves to `cancelled` with the committed results retained as partial; a simulated crash between the result write and the terminal-state write leaves the job in its previous state and no orphan result; a rerun produces a new `jobId` with a new `attemptId` while the old result remains byte-identical.
**Verification.** Environment: a CPU worker with the workspace installed, driving the local lifecycle against the filesystem-backed storage implementation. Command: `pnpm --filter @pomset/storage test -- lifecycle`. Observation: exit status 0, with a transition-matrix test, a repeated cancel-versus-finish race test asserting a single terminal outcome across at least a thousand interleavings, and a crash-injection test.
**Artifacts.** The state machine, the lifecycle interface implementation, and the race and crash test suites.

### TASK-ENG-006  Enforce process limits and terminate cooperatively then by process tree

**Purpose.** Put the control in the supervisor: wall-clock, memory, message,
output and artifact limits, a cooperative cancel, and an unconditional process-tree
kill after the grace period.
**Owns.** `packages/engine-client/src/limits.ts`, `packages/engine-client/src/cancel.ts`, `packages/engine-client/src/process-tree.ts`
**Requirement links.** `REQ-ENG-015`, `REQ-SEC-005`
**Prerequisites.** `TASK-ENG-002`
**Implementation.** Enforce `engineWallTimeMs`, `memoryBytes`, `maxMessageBytes`, `maxOutputBytes` and `maxArtifactBytes` on every engine process, measuring memory over the whole process tree rather than the direct child alone. On a cancellation request send `cancel` on stdin, wait for the engine's terminal result or error as acknowledgement, and after the two-second grace period kill the entire process tree including descendants, so a cooperative engine is never the only control. A breach fails the job with `ENGINE_FAILED` and an explicit reason naming the limit and the observed value; a solver-budget exhaustion is a different event and produces an `unknown` property result, never a job failure and never an engine error code. Record the breach and the termination path so a later reader can tell a cooperative stop from a kill.
**Acceptance.** A process exceeding the wall clock is killed with `ENGINE_FAILED` and the observed duration; a child that spawns a grandchild which outlives it leaves no surviving descendant after termination; a process exceeding the memory bound is killed with the observed peak; an engine that acknowledges the cancel within the grace period is recorded as cooperatively stopped rather than killed; an exhausted solver budget yields an `unknown` result and a `succeeded` or `cancelled` job state, never `ENGINE_FAILED`.
**Verification.** Environment: a CPU worker with the workspace installed. Command: `pnpm --filter @pomset/engine-client test -- limits`. Observation: exit status 0, with a wall-clock breach case, a memory breach case, a descendant-survival check listing zero surviving processes, and a cooperative-cancel case whose recorded termination path is the acknowledgement.
**Artifacts.** The limits module, the cancellation and process-tree module, and the breach recording format.

### TASK-ENG-007  Redact recognized secret patterns from captured engine and compiler output

**Purpose.** Keep a shareable report shareable: credential material, session
tokens and database credentials never reach a job log, an artifact, an error
record or an export.
**Owns.** `packages/engine-client/src/redact.ts`, `apps/worker/src/log-capture.ts`
**Requirement links.** `REQ-SEC-006`
**Prerequisites.** `TASK-ENG-004`
**Implementation.** Apply a redaction pass to every captured stderr stream, compiler log and error detail before it is persisted: recognised token and credential shapes, authorization headers, connection strings carrying a password, session cookie values and private key blocks are replaced by a fixed marker that names the class of the removed value, so a reader can tell that something was removed without learning what it was. The redactor runs on the way in, not on the way out, so no unredacted copy is ever written to storage or to an artifact. Redaction never applies to the structured protocol payload, which carries no secrets by contract, and a message that already carries a marker is not redacted a second time into a misleading double marker. The pattern set is data with a recorded revision, so a report states which redaction revision produced it.
**Acceptance.** A log line containing a bearer token, a connection string with an embedded password and a private key block is stored with each of those replaced by a labelled marker; the raw value appears nowhere in the stored record, the artifact store or the exported bundle; a log line with no match is stored unchanged; the redaction revision is recorded with the job.
**Verification.** Environment: a CPU worker with the workspace installed. Command: `pnpm --filter @pomset/engine-client test -- redact`. Observation: exit status 0, with one passing case per secret class asserting the marker and asserting that a full-text search of the stored record for the original value finds zero matches.
**Artifacts.** The redactor, its versioned pattern set, and the secret-leak regression suite.

### TASK-SEC-003  Gate local execution behind explicit per-invocation consent

**Purpose.** Separate reading a kernel from running it: the local consent flag is
required for any path that imports or executes user code, is scoped to one
invocation, and is visible in the request the engine receives.
**Owns.** `apps/cli/src/consent.ts`, `packages/engine-client/src/consent.ts`, `apps/cli/src/commands/analyze.ts`
**Requirement links.** `REQ-CLI-011`, `REQ-SEC-003`
**Prerequisites.** `TASK-ENG-002`
**Implementation.** Require `--trust-local-code` on any command path that imports or executes user Python, a native program or a reference computation — numerical replay and benchmarking always included — and carry the consent as an explicit field on the `EngineRequest` rather than as ambient process state. Consent is scoped to the single invocation: it is not persisted in a project, a scenario, a manifest or a shell profile, and a second invocation without the flag is refused even when the first one granted it. Pure static or symbolic parsing runs without consent, because reading a file and running it are different acts. `pomset serve` browses reports only and exposes no job-execution route, so opening an imported report or a loopback URL never triggers execution and merely viewing a report cannot authorize a later run. Absent consent, the command exits with status 2, reports the unsupported required operation with its reason and names the flag, and starts no process.
**Acceptance.** A replay or benchmark invocation without the flag exits 2 with the flag named and starts no child process; the same invocation with the flag starts exactly one process whose request carries the consent field; the flag is absent from every persisted manifest and scenario; a `serve` session offers no route that executes a kernel even when a prior invocation in the same shell granted consent.
**Verification.** Environment: a clean CPU machine with the CLI built and networking disabled. Commands: `pomset validate --scenario examples/transform.json` followed by the same command with `--trust-local-code`, and `pomset serve --report <report>` searched for an execution route via `curl`. Observation: exit status 2 with the flag named and no child process for the first; exit status 0 with one consented process for the second; the persisted manifest contains no consent field; the `serve` route inventory lists no job-execution endpoint.
**Artifacts.** The consent module, the request field, and the CLI guard with its refusal message.

### TASK-SEC-004  Validate untrusted imports and never execute or publish on import

**Purpose.** Treat every imported bundle, measurement, report and archive as
hostile input: validate it structurally, reject the dangerous shapes, and prove
that importing performs no execution and no publication.
**Owns.** `packages/contracts/src/import.ts`, `apps/cli/src/commands/import.ts`, `packages/domain/src/bundle-validate.ts`
**Requirement links.** `REQ-CLI-007`, `REQ-PERF-012`, `REQ-SEC-004`, `REQ-SHR-005`
**Prerequisites.** `TASK-FND-006`
**Implementation.** Validate an imported bundle or measurement against the portable schemas and the content hashes it declares, and reject with `BUNDLE_INVALID` a path that escapes the bundle root or is absolute, a symlink entry, a conflicting identity where two records claim the same identifier, an invalid or mismatched content hash, an unsupported schema version, an oversized payload and malformed nesting. Never follow a link, never resolve a path outside the bundle root and never deserialize an executable object: no arbitrary Python pickle and no executable object appears in any portable contract. A structurally invalid or hash-conflicting import is rejected outright; a well-formed but incomplete import is accepted and marked ineligible with reason codes, keeping its original provenance and gaining `origin: imported` so that it can never impersonate server-produced validation. Import performs no execution: it starts no child process, deserializes nothing executable and runs no reference computation. Import performs no publication: it creates no publication, changes no visibility and leaves the snapshot, result and measurement private to the importing owner's namespace. The same validator is used by the CLI and by the hosted `POST /v1/bundles/import` route so the two cannot drift.
**Acceptance.** A bundle containing `../../etc/passwd`, an absolute path, a symlink to a file outside the root, two records sharing one identifier, a wrong content hash and an unsupported schema version is rejected with `BUNDLE_INVALID` and a JSON pointer to the offending member; the import runs with no child process started, no publication created and no visibility changed; a well-formed import with a missing warm-up count is accepted and marked ineligible with the reason code, retaining its original provenance.
**Verification.** Environment: a CPU worker with the workspace installed. Command: `pnpm --filter @pomset/contracts test -- import`. Observation: exit status 0, with one passing rejection case per shape above, a process-spawn assertion recording zero child processes, a publication-count assertion recording zero, and one passing ineligible-import case naming its reason code.
**Artifacts.** The bundle validator, the CLI import command, and the hostile-bundle fixtures under `docs/contracts/examples/invalid/`.
