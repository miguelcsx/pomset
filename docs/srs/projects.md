# Projects, scenarios and snapshots — `PRJ`

The unit of work is a versioned project, a scenario and a set of profiles.
Everything else in the system hangs off these. Sources: `SRC-011`, `SRC-012`,
`SRC-031`.

### REQ-PRJ-001  Multi-file versioned project

**Statement.** Pomset SHALL represent a project as a named, owned container of
multiple source files and configuration files, versioned by immutable
snapshots, and SHALL NOT require the user to paste a single snippet into an
editor as the unit of work.

**Rationale.** Real kernels live in repositories with imports, configuration
and reference code. `SRC-011`.

**Acceptance.** `ACC-004`.

**Scope.** Applies to local, CI and hosted operation alike.

**Implemented by.** `TASK-FND-001`, `TASK-LOC-002`, `TASK-HST-003`.

**ADRs.** [ADR-0005](../adr/0005-snapshots-and-artifacts.md), [ADR-0004](../adr/0004-contract-authority.md)  Specification: [`../architecture/lifecycle.md`](../architecture/lifecycle.md).

**Contracts.** `Project` in [`packages/contracts/schema/domain.schema.yaml`](../../packages/contracts/schema/domain.schema.yaml).

### REQ-PRJ-002  Explicit kernel entrypoint

**Statement.** A scenario SHALL name exactly one kernel entrypoint by file path
and symbol. Pomset SHALL NOT guess an entrypoint, analyse every decorated
function it finds, or select a function because its name resembles a common
kernel name.

**Rationale.** Analysis over an implicitly chosen function produces evidence
about a program the user did not ask about. `SRC-005`.

**Acceptance.** `ACC-001`.

**Scope.** One entrypoint per scenario. Multiple entrypoints are multiple
scenarios.

**Implemented by.** `TASK-TRI-001`.

**ADRs.** [ADR-0005](../adr/0005-snapshots-and-artifacts.md), [ADR-0004](../adr/0004-contract-authority.md)  Specification: [`../architecture/lifecycle.md`](../architecture/lifecycle.md).

**Contracts.** `Scenario.entrypoint`.

### REQ-PRJ-003  Scenario declares allocations, inputs, outputs and launch

**Statement.** A scenario SHALL declare every allocation the kernel touches —
name, role (input, output, scratch), dtype, shape and strides — its launch
configuration, and, when numerical validation is requested, how the expected
output is computed.

**Rationale.** Bounds and coverage are only meaningful relative to declared
allocations. `SRC-005`, `SRC-031`.

**Acceptance.** `ACC-001`, `ACC-006`.

**Scope.** Declared aliasing is part of the declaration, not inferred.

**Implemented by.** `TASK-TRI-002`, `TASK-FND-003`.

**ADRs.** [ADR-0005](../adr/0005-snapshots-and-artifacts.md), [ADR-0004](../adr/0004-contract-authority.md)  Specification: [`../architecture/lifecycle.md`](../architecture/lifecycle.md).

**Contracts.** `Allocation`, `AliasGroup`, `LaunchConfig`, `ReferenceComputation`.

### REQ-PRJ-004  Scenario declares required properties

**Statement.** A scenario SHALL declare the properties it requires from the
kernel, drawn from the shared property vocabulary, and SHALL NOT have a default
property set applied silently on the user's behalf.

**Rationale.** "Correct" is not a single property. Required properties are what
Validate answers. Sources: `SRC-003`, `SRC-016`.

**Acceptance.** `ACC-003`, `ACC-007`.

**Scope.** Unknown property ids in a scenario are rejected at validation.

**Implemented by.** `TASK-LOC-003`, `TASK-WEB-009`.

**ADRs.** [ADR-0005](../adr/0005-snapshots-and-artifacts.md), [ADR-0004](../adr/0004-contract-authority.md)  Specification: [`../architecture/lifecycle.md`](../architecture/lifecycle.md).

**Contracts.** `Scenario.requiredProperties`, `propertyId`.

### REQ-PRJ-005  Launch configuration is data, not a host callback

**Statement.** A launch configuration SHALL be expressed as a restricted
integer-expression tree over declared domain variables, using only literal,
parameter, add, subtract, multiply, floor-divide, ceil-divide and modulo.
Pomset SHALL NOT parse or execute an arbitrary host lambda, and SHALL reject a
configuration whose divisors are not provably positive or whose resulting grid
dimensions are not provably nonnegative under the declared constraints.

**Rationale.** A launch lambda is arbitrary host code. Expressing it as data
makes it analysable, replayable and safe to import. Sources: `SRC-005`,
`SRC-031`.

**Acceptance.** `ACC-001`, `ACC-003`.

**Scope.** Human-facing display text such as `triton.cdiv(N, BLOCK)` MAY be
stored alongside, and is never parsed back into semantics.

**Implemented by.** `TASK-TRI-003`, `TASK-FND-004`.

**ADRs.** [ADR-0005](../adr/0005-snapshots-and-artifacts.md), [ADR-0004](../adr/0004-contract-authority.md)  Specification: [`../architecture/lifecycle.md`](../architecture/lifecycle.md).

**Contracts.** `intExpr`, `launchConfig`.

### REQ-PRJ-006  Reference computation is declared, not assumed

**Statement.** When a scenario requests numerical agreement, it SHALL declare
the reference computation (a named kind plus path and symbol), and the
tolerances, dtype, NaN policy and Inf policy used for comparison.

**Rationale.** Numerical agreement without a stated reference and tolerance is
not a result. `SRC-021`, `SRC-052`.

**Acceptance.** `ACC-006`.

**Scope.** Executing a reference requires local execution consent; a scenario
may declare a reference without consenting to run it.

**Implemented by.** `TASK-TRI-011`, `TASK-LOC-006`.

**ADRs.** [ADR-0005](../adr/0005-snapshots-and-artifacts.md), [ADR-0004](../adr/0004-contract-authority.md)  Specification: [`../architecture/lifecycle.md`](../architecture/lifecycle.md).

**Contracts.** `ReferenceComputation`.

### REQ-PRJ-007  Immutable snapshots over source and configuration

**Statement.** Every analysis SHALL run against an immutable snapshot that
records the exact bytes and content hashes of the source and configuration
files it used, together with the parent snapshot when the snapshot was derived
by editing.

**Rationale.** A result belongs to the snapshot that was analysed. `SRC-012`.

**Acceptance.** `ACC-004`.

**Scope.** Hash the original bytes; hash the manifest separately over its
canonical serialization. See [`../contracts/README.md`](../contracts/README.md).

**Implemented by.** `TASK-FND-005`, `TASK-LOC-002`, `TASK-HST-004`.

**ADRs.** [ADR-0005](../adr/0005-snapshots-and-artifacts.md), [ADR-0004](../adr/0004-contract-authority.md)  Specification: [`../architecture/lifecycle.md`](../architecture/lifecycle.md).

**Contracts.** `SnapshotManifest`.

### REQ-PRJ-008  Editing creates a new snapshot

**Statement.** Editing source or configuration SHALL create a new snapshot.
Pomset SHALL NOT mutate an existing snapshot, and SHALL NOT silently retarget
an existing job or result at the edited content.

**Rationale.** Historical results must keep pointing at what they analysed.
`SRC-012`.

**Acceptance.** `ACC-004`.

**Scope.** Applies to the hosted API, the CLI and the workbench alike.

**Implemented by.** `TASK-LOC-002`, `TASK-HST-004`, `TASK-WEB-004`.

**ADRs.** [ADR-0005](../adr/0005-snapshots-and-artifacts.md), [ADR-0004](../adr/0004-contract-authority.md)  Specification: [`../architecture/lifecycle.md`](../architecture/lifecycle.md).

**Contracts.** `SnapshotManifest.parentSnapshotId`.

### REQ-PRJ-009  Comparing snapshots is an explicit operation

**Statement.** Pomset SHALL allow a user to compare two snapshots of the same
project, showing what changed in the files and how the results attached to each
snapshot differ, without treating the comparison as a rerun of the older
snapshot.

**Rationale.** The recurring workflow is detect, explain, modify, re-analyse,
compare (`SRC-020`, `SRC-047`). The comparison must not fabricate results for the
older snapshot.

**Acceptance.** `ACC-004`, `ACC-010`.

**Scope.** Comparison over an unchanged snapshot and a derived snapshot.

**Implemented by.** `TASK-WEB-014`, `TASK-LOC-008`.

**ADRs.** [ADR-0005](../adr/0005-snapshots-and-artifacts.md), [ADR-0004](../adr/0004-contract-authority.md)  Specification: [`../architecture/lifecycle.md`](../architecture/lifecycle.md).

**Contracts.** `SnapshotManifest`, `AnalysisResult`.

### REQ-PRJ-010  Run and compile never publish

**Statement.** Creating a snapshot, running a job, or compiling a target SHALL
NOT publish anything and SHALL NOT make any artifact retrievable to anyone
other than its owner. Publication SHALL be a separate, explicit act.

**Rationale.** A binding invariant of the product. `SRC-012`, `SRC-037`.

**Acceptance.** `ACC-004`, `ACC-008`.

**Scope.** Enforced at the API authorization layer, not only in the UI.

**Implemented by.** `TASK-HST-010`, `TASK-LOC-009`.

**ADRs.** [ADR-0011](../adr/0011-private-local-and-publication.md), [ADR-0005](../adr/0005-snapshots-and-artifacts.md)  Specification: [`../architecture/lifecycle.md`](../architecture/lifecycle.md).

**Contracts.** `Publication`; see [`sharing.md`](sharing.md).

### REQ-PRJ-011  Compiling leaves the target unexecuted

**Statement.** A compilation operation SHALL produce artifacts and SHALL NOT
execute the compiled program, and its results SHALL be recorded as artifacts
rather than as behaviour evidence.

**Rationale.** Compiler output is not execution. `SRC-012`.

**Acceptance.** `ACC-009`.

**Scope.** Compilation inside the sandbox is still compilation.

**Implemented by.** `TASK-CUDA-002`, `TASK-TRI-013`.

**ADRs.** [ADR-0008](../adr/0008-triton-analysis.md), [ADR-0009](../adr/0009-backend-semantics.md)  Specification: [`../architecture/lifecycle.md`](../architecture/lifecycle.md).

**Contracts.** `ArtifactManifest.kind`.

### REQ-PRJ-012  Scenario validation rejects rather than repairs

**Statement.** Pomset SHALL validate every scenario against the portable
schema and the backend's declared capabilities, and SHALL reject an invalid
scenario with an explicit error rather than dropping, defaulting or rewriting
the parts it does not understand.

**Rationale.** A scenario quietly repaired is a scenario the user did not write.
Sources: `SRC-005`, `SRC-029`.

**Acceptance.** `ACC-005`.

**Scope.** Missing entrypoint, unknown property, unresolvable parameter name,
undefined allocation referenced by the launch expression.

**Implemented by.** `TASK-FND-004`, `TASK-LOC-004`, `TASK-FND-001`.

**ADRs.** [ADR-0005](../adr/0005-snapshots-and-artifacts.md), [ADR-0004](../adr/0004-contract-authority.md)  Specification: [`../architecture/lifecycle.md`](../architecture/lifecycle.md).

**Contracts.** `INPUT_INVALID` in [`../contracts/README.md`](../contracts/README.md).

### REQ-PRJ-013  A scenario belongs to exactly one snapshot

**Statement.** A scenario SHALL reference exactly one snapshot, and a result
SHALL carry the snapshot, scenario, profile revision, domain and policy
revisions that produced it. Identifiers SHALL NOT substitute for that
provenance.

**Rationale.** Compatibility and eligibility comparisons need exact identity.
Sources: `SRC-031`, `SRC-037`.

**Acceptance.** `ACC-004`, `ACC-006`.

**Scope.** Applies to imported records too; an import never invents identity.

**Implemented by.** `TASK-FND-006`, `TASK-HST-006`.

**ADRs.** [ADR-0005](../adr/0005-snapshots-and-artifacts.md), [ADR-0004](../adr/0004-contract-authority.md)  Specification: [`../architecture/lifecycle.md`](../architecture/lifecycle.md).

**Contracts.** `AnalysisResult`.
