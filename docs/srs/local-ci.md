# Local and CI use — `CLI`

The local path exists so that proprietary source never has to leave the machine,
and so that a team can run the same checks in a pipeline. Sources: `SRC-033`,
`SRC-034`, `SRC-043`, `SRC-047`.

### REQ-CLI-001  Offline analysis without upload

**Statement.** Pomset SHALL provide a local mode that analyses source, stores
snapshots, results and artifacts, and renders reports entirely on the user's
machine, with no network connection and no account required.

**Rationale.** `SRC-033`. Engineers will not paste proprietary kernels into a
third-party website.

**Acceptance.** `ACC-005`.

**Scope.** Local mode uses the same contracts and the same engine protocol as
hosted mode.

**Implemented by.** `TASK-LOC-001`, `TASK-LOC-002`.

**ADRs.** [ADR-0011](../adr/0011-private-local-and-publication.md), [ADR-0006](../adr/0006-jobs-and-persistence.md)  Specification: [`../architecture/local-ci.md`](../architecture/local-ci.md).

**Contracts.** All portable schemas.

### REQ-CLI-002  A manifest describes the experiment

**Statement.** A project SHALL be describable by a checked-in manifest listing its
scenarios, their entrypoints, domains, required properties and profiles, in the
canonical `Scenario` schema.

**Rationale.** `SRC-033`. A CI check has to be reviewable in a diff.

**Acceptance.** `ACC-005`.

**Scope.** The manifest is the same document the hosted API accepts.

**Implemented by.** `TASK-LOC-004`.

**ADRs.** [ADR-0011](../adr/0011-private-local-and-publication.md), [ADR-0006](../adr/0006-jobs-and-persistence.md)  Specification: [`../architecture/local-ci.md`](../architecture/local-ci.md).

**Contracts.** `Scenario`.

### REQ-CLI-003  Commands cover the full local workflow

**Statement.** The CLI SHALL provide `analyze`, `validate`, `benchmark`, `compare`,
`import`, `export` and `serve`, each performing exactly the operation its name
denotes.

**Rationale.** `SRC-033`, `SRC-047`.

**Acceptance.** `ACC-005`.

**Scope.** `benchmark` requires an eligible validation record and explicit local
execution consent.

**Implemented by.** `TASK-LOC-005`, `TASK-LOC-006`, `TASK-REL-001`.

**ADRs.** [ADR-0011](../adr/0011-private-local-and-publication.md), [ADR-0006](../adr/0006-jobs-and-persistence.md)  Specification: [`../architecture/local-ci.md`](../architecture/local-ci.md).

**Contracts.** See [`../architecture/local-ci.md`](../architecture/local-ci.md).

### REQ-CLI-004  Exit status distinguishes policy, failure, and error

**Statement.** The CLI SHALL exit 0 when the requested policy is satisfied, 1 when
an actual property or regression check failed, and 2 when the input is invalid, a
required analysis is unsupported, a required result is unknown, or the engine
failed.

**Rationale.** `SRC-034`. A pipeline must be able to tell "the kernel is wrong"
from "we could not tell".

**Acceptance.** `ACC-005`.

**Scope.** Status 2 aggregates several distinct causes, so the report must
preserve them separately.

**Implemented by.** `TASK-LOC-007`.

**ADRs.** [ADR-0011](../adr/0011-private-local-and-publication.md), [ADR-0006](../adr/0006-jobs-and-persistence.md)  Specification: [`../architecture/local-ci.md`](../architecture/local-ci.md).

**Contracts.** `PropertyResult`, `ErrorRecord`.

### REQ-CLI-005  Reports preserve the exact outcome behind a coarse status

**Statement.** A machine-readable report SHALL be produced for every run, carrying
per-property outcomes, error records with their codes, the policy revision, the
profile revision and the coverage, even when the exit status is 2.

**Rationale.** `SRC-034`. The exit status is a summary; the report is the result.

**Acceptance.** `ACC-005`.

**Scope.** JSON on stdout or a named file; human text on request.

**Implemented by.** `TASK-LOC-007`.

**ADRs.** [ADR-0011](../adr/0011-private-local-and-publication.md), [ADR-0006](../adr/0006-jobs-and-persistence.md)  Specification: [`../architecture/local-ci.md`](../architecture/local-ci.md).

**Contracts.** `AnalysisResult`, `ErrorRecord`.

### REQ-CLI-006  Benchmarking requires eligibility and consent

**Statement.** The CLI SHALL refuse `benchmark` unless an eligible validation
record exists for the same snapshot, scenario, domain and policy, and unless the
user passed `--trust-local-code`.

**Rationale.** `SRC-035`. Timing an incorrect configuration wastes work and
produces a misleading number.

**Acceptance.** `ACC-006`.

**Scope.** The refusal names which condition failed.

**Implemented by.** `TASK-LOC-006`.

**ADRs.** [ADR-0011](../adr/0011-private-local-and-publication.md), [ADR-0006](../adr/0006-jobs-and-persistence.md)  Specification: [`../architecture/local-ci.md`](../architecture/local-ci.md).

**Contracts.** `EligibilityPolicy`.

### REQ-CLI-007  Import never executes

**Statement.** The CLI SHALL validate an imported bundle or measurement against
the portable schemas, reject invalid, hash-conflicting, path-escaping or
symlinked content, and SHALL NOT execute any code, kernel or reference found in
an import.

**Rationale.** `SRC-027`, `SRC-033`. An imported report is untrusted input.

**Acceptance.** `ACC-005`.

**Scope.** Opening a report or a bundle URL never authorises execution.

**Implemented by.** `TASK-LOC-008`, `TASK-SEC-004`.

**ADRs.** [ADR-0011](../adr/0011-private-local-and-publication.md), [ADR-0006](../adr/0006-jobs-and-persistence.md)  Specification: [`../architecture/local-ci.md`](../architecture/local-ci.md).

**Contracts.** `ExperimentBundle`, `BUNDLE_INVALID`.

### REQ-CLI-008  `serve` is read-only and exposes no execution route

**Statement.** `pomset serve` SHALL bind to loopback, validate the Host and Origin
headers, disable cross-origin access, require a random local read capability for
private report APIs, and expose no route that starts a job, compiles, or executes
anything.

**Rationale.** `SRC-033`, `SRC-030`. A local viewer must not become a remote
execution surface.

**Acceptance.** `ACC-008`.

**Scope.** No web-to-local job submission and no pairing infrastructure exists.

**Implemented by.** `TASK-LOC-009`.

**ADRs.** [ADR-0011](../adr/0011-private-local-and-publication.md), [ADR-0006](../adr/0006-jobs-and-persistence.md)  Specification: [`../architecture/local-ci.md`](../architecture/local-ci.md).

**Contracts.** See [`../architecture/local-ci.md`](../architecture/local-ci.md).

### REQ-CLI-009  Local GPU execution is explicitly opted in

**Statement.** The CLI SHALL run GPU work only when the user explicitly opts in
for that run, and SHALL NOT enable GPU execution by configuration default, by
project file, or by a shared bundle.

**Rationale.** `SRC-030`, `SRC-034`. A local GPU run has its own trust boundary.

**Acceptance.** `ACC-005`, `ACC-009`.

**Scope.** No hosted GPU execution exists at all.

**Implemented by.** `TASK-CUDA-001`, `TASK-LOC-006`.

**ADRs.** [ADR-0011](../adr/0011-private-local-and-publication.md), [ADR-0006](../adr/0006-jobs-and-persistence.md)  Specification: [`../architecture/local-ci.md`](../architecture/local-ci.md).

**Contracts.** `EngineRequest.consent`.

### REQ-CLI-010  No telemetry and no implicit upload

**Statement.** Pomset SHALL NOT transmit source, evidence, measurements, usage
statistics or identifiers to any remote service without an explicit user action
naming what will be sent.

**Rationale.** `SRC-033`, `SRC-034`.

**Acceptance.** `ACC-005`, `ACC-008`.

**Scope.** Includes crash reporting and version checks.

**Implemented by.** `TASK-LOC-001`, `TASK-HST-010`.

**ADRs.** [ADR-0011](../adr/0011-private-local-and-publication.md), [ADR-0006](../adr/0006-jobs-and-persistence.md)  Specification: [`../architecture/local-ci.md`](../architecture/local-ci.md).

**Contracts.** —

### REQ-CLI-011  Local execution consent is explicit and scoped

**Statement.** Any command path that imports or executes user Python, a native
program, or a reference computation SHALL require the `--trust-local-code` flag,
while pure static or symbolic parsing SHALL require no execution consent.

**Rationale.** `SRC-030`. Parsing a file and running it are different acts and
deserve different consent.

**Acceptance.** `ACC-005`, `ACC-009`.

**Scope.** The consent is per invocation and names its scope.

**Implemented by.** `TASK-LOC-006`, `TASK-SEC-003`.

**ADRs.** [ADR-0011](../adr/0011-private-local-and-publication.md), [ADR-0007](../adr/0007-sandbox-and-local-runners.md)  Specification: [`../architecture/local-ci.md`](../architecture/local-ci.md).

**Contracts.** `EngineRequest.consent`.

### REQ-CLI-012  CI recipes are reproducible and documented

**Statement.** Pomset SHALL document reproducible CI recipes that pin the tool and
profile revisions used, keep a named baseline snapshot for regression comparison,
and require no hosted credentials.

**Rationale.** `SRC-043`, `SRC-047`. A regression check that drifts is a check that
will be ignored.

**Acceptance.** `ACC-005`.

**Scope.** Includes the exact commands and the expected exit statuses.

**Implemented by.** `TASK-LOC-010`, `TASK-FND-001`.

**ADRs.** [ADR-0011](../adr/0011-private-local-and-publication.md), [ADR-0006](../adr/0006-jobs-and-persistence.md)  Specification: [`../architecture/local-ci.md`](../architecture/local-ci.md).

**Contracts.** `ProfileRevision`, `AnalysisResult`.

### REQ-CLI-013  The local viewer shares the workbench components

**Statement.** The local report viewer SHALL use the same `packages/ui` components
and the same read-only transport as the hosted workbench, and SHALL NOT maintain a
second visualization implementation.

**Rationale.** `SRC-053`. Two renderers drift, and the drift shows up as
disagreeing reports.

**Acceptance.** `ACC-005`, `ACC-010`.

**Scope.** Offline reports receive the same keyboard, non-colour, source, actor
and memory inspection acceptance as hosted reports.

**Implemented by.** `TASK-LOC-009`, `TASK-WEB-001`.

**ADRs.** [ADR-0011](../adr/0011-private-local-and-publication.md), [ADR-0006](../adr/0006-jobs-and-persistence.md)  Specification: [`../architecture/local-ci.md`](../architecture/local-ci.md).

**Contracts.** —

### REQ-CLI-014  Write and job controls are unavailable offline, with an explanation

**Statement.** In the read-only local viewer, controls that would start a job or
modify a project SHALL be unavailable with an explicit explanation of why, and
SHALL NOT be omitted silently or left inert.

**Rationale.** `SRC-029`, `SRC-033`.

**Acceptance.** `ACC-009`.

**Scope.** The explanation names the local CLI command that performs the
operation instead.

**Implemented by.** `TASK-LOC-009`, `TASK-WEB-010`.

**ADRs.** [ADR-0011](../adr/0011-private-local-and-publication.md), [ADR-0006](../adr/0006-jobs-and-persistence.md)  Specification: [`../architecture/local-ci.md`](../architecture/local-ci.md).

**Contracts.** `Capability.reason`.
