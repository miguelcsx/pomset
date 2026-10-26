# Validation — `VAL`

Required properties, numerical reference comparison, replay, and the policy that
decides what counts as satisfied. Sources: `SRC-016`, `SRC-021`, `SRC-022`,
`SRC-025`, `SRC-042`, `SRC-047`.

### REQ-VAL-001  Required-property policy is explicit and single

**Statement.** Pomset SHALL evaluate the required properties declared by a
scenario against exactly one `EligibilityPolicy` at a stated revision, and SHALL
record that policy identity with the result.

**Rationale.** Whether a property counts as satisfied is a policy question, not
an implicit one. Sources: `SRC-004`, `SRC-016`.

**Acceptance.** `ACC-006`, `ACC-007`.

**Scope.** One policy implementation is shared by CLI, API and UI.

**Implemented by.** `TASK-LOC-003`, `TASK-FND-006`.

**ADRs.** [ADR-0010](../adr/0010-performance-and-eligibility.md), [ADR-0008](../adr/0008-triton-analysis.md)  Specification: [`../architecture/exploration-and-validation.md`](../architecture/exploration-and-validation.md).

**Contracts.** `EligibilityPolicy`.

### REQ-VAL-002  Policy states accepted methods and sampled acceptance

**Statement.** For each required property the policy SHALL state which methods
are acceptable, whether a sampled pass may satisfy it, and whether an `unknown`
result may satisfy it. Accepting `unknown` SHALL require an explicit user
change to the policy and SHALL be recorded in the report.

**Rationale.** `SRC-004`. A policy that quietly accepts inconclusive evidence
would turn the product into a green light.

**Acceptance.** `ACC-006`, `ACC-007`.

**Scope.** The default policy accepts neither sampled passes nor unknowns for
correctness properties.

**Implemented by.** `TASK-LOC-003`.

**ADRs.** [ADR-0010](../adr/0010-performance-and-eligibility.md), [ADR-0008](../adr/0008-triton-analysis.md)  Specification: [`../architecture/exploration-and-validation.md`](../architecture/exploration-and-validation.md).

**Contracts.** `EligibilityPolicy.requiredProperties`.

### REQ-VAL-003  Unknown or unsupported required checks block eligibility

**Statement.** A configuration whose required checks are unknown or unsupported
SHALL NOT be automatically eligible for benchmarking or recommendation, unless
the user explicitly changed the policy and the report records the change and the
unchanged evidence class.

**Rationale.** `SRC-004`, `SRC-035`. Changing a policy changes what the product
is willing to accept; it cannot change what was established.

**Acceptance.** `ACC-006`, `ACC-007`.

**Scope.** Applies to local and hosted operation alike.

**Implemented by.** `TASK-LOC-003`, `TASK-PRS-003`.

**ADRs.** [ADR-0010](../adr/0010-performance-and-eligibility.md), [ADR-0008](../adr/0008-triton-analysis.md)  Specification: [`../architecture/exploration-and-validation.md`](../architecture/exploration-and-validation.md).

**Contracts.** `Measurement.eligibility`.

### REQ-VAL-004  Static and dynamic evidence are reported separately

**Statement.** Pomset SHALL report proofs and dynamic checks as separate results
with their own outcomes, methods and evidence classes, and SHALL NOT merge an
instrumented observation with a static result over the same property.

**Rationale.** `SRC-021`, `SRC-022`. Two results about one property can disagree,
and the disagreement is information.

**Acceptance.** `ACC-009`.

**Scope.** The UI shows them side by side under the same property, not merged.

**Implemented by.** `TASK-FND-006`, `TASK-WEB-012`.

**ADRs.** [ADR-0010](../adr/0010-performance-and-eligibility.md), [ADR-0008](../adr/0008-triton-analysis.md)  Specification: [`../architecture/exploration-and-validation.md`](../architecture/exploration-and-validation.md).

**Contracts.** `PropertyResult` multiplicity per `propertyId`.

### REQ-VAL-005  Numerical comparison declares reference and tolerances

**Statement.** A numerical agreement check SHALL state the reference computation
used, the dtype, the absolute and relative tolerances, and the NaN and Inf
policy, and SHALL report disagreement with the first differing element and the
observed and expected values.

**Rationale.** `SRC-042`, `SRC-006`. "Values differ" is not a diagnosis.

**Acceptance.** `ACC-006`.

**Scope.** Comparison happens against the declared reference only; an
undeclared reference blocks the check.

**Implemented by.** `TASK-TRI-011`, `TASK-LOC-006`, `TASK-OMP-002`.

**ADRs.** [ADR-0010](../adr/0010-performance-and-eligibility.md), [ADR-0008](../adr/0008-triton-analysis.md)  Specification: [`../architecture/exploration-and-validation.md`](../architecture/exploration-and-validation.md).

**Contracts.** `ReferenceComputation.tolerances`.

### REQ-VAL-006  Output buffers are fresh or poisoned before numerical comparison

**Statement.** A numerical comparison SHALL run against output buffers that were
freshly allocated or filled with a poison pattern, and Pomset SHALL record
whether a reused autotune buffer was in play. A comparison against residue from a
previous run SHALL NOT be accepted as evidence that an output was written.

**Rationale.** `SRC-007`. This is precisely how an unwritten output hid behind a
green result.

**Acceptance.** `ACC-001`, `ACC-006`.

**Scope.** Applies to every numerical runner, including imported ones where the
information is available.

**Implemented by.** `TASK-TRI-011`, `TASK-CUDA-004`, `TASK-OMP-003`.

**ADRs.** [ADR-0010](../adr/0010-performance-and-eligibility.md), [ADR-0008](../adr/0008-triton-analysis.md)  Specification: [`../architecture/exploration-and-validation.md`](../architecture/exploration-and-validation.md).

**Contracts.** `Measurement.referenceOutcome.freshBufferUsed`, `.autotuneBufferReuse`.

### REQ-VAL-007  Replay minimises and preserves assumptions

**Statement.** Replay of a counterexample SHALL attempt minimization and SHALL
record what was dropped. A replay that fails SHALL be recorded as
`not-reproduced` or `blocked` with its reason, and SHALL NOT be omitted.

**Rationale.** `SRC-028`, `SRC-043`. A witness that no longer reproduces is a
result too.

**Acceptance.** `ACC-001`, `ACC-002`.

**Scope.** A blocked replay names the missing tool or device.

**Implemented by.** `TASK-TRI-015`, `TASK-LOC-006`.

**ADRs.** [ADR-0010](../adr/0010-performance-and-eligibility.md), [ADR-0008](../adr/0008-triton-analysis.md)  Specification: [`../architecture/exploration-and-validation.md`](../architecture/exploration-and-validation.md).

**Contracts.** `Witness.replay`, `Witness.minimization`.

### REQ-VAL-008  Synchronization, atomics and initialization are backend capabilities

**Statement.** Diagnostics for synchronization ordering, atomics, initialization
and deadlock SHALL be declared per backend as capabilities with a support level
and an availability, and Pomset SHALL NOT offer a capability under a backend that
has not passed its declared conformance fixtures.

**Rationale.** `SRC-024`, `SRC-019`. The same property name means different things
under Triton, CUDA C++ and OpenMP, so each capability is declared per backend.
`SRC-017` is superseded and contributes nothing here.

**Acceptance.** `ACC-009`.

**Scope.** Unvalidated combinations are `untested` or unavailable, never
silently approximated.

**Implemented by.** `TASK-CUDA-005`, `TASK-OMP-004`, `TASK-HST-011`.

**ADRs.** [ADR-0010](../adr/0010-performance-and-eligibility.md), [ADR-0008](../adr/0008-triton-analysis.md)  Specification: [`../architecture/exploration-and-validation.md`](../architecture/exploration-and-validation.md).

**Contracts.** `Capability`.

### REQ-VAL-009  Regression comparison is between named snapshots

**Statement.** Pomset SHALL compare validation outcomes between two named
snapshots and report, per required property and per region, whether the outcome
improved, regressed, or stayed the same, without re-labelling the older result.

**Rationale.** `SRC-033`, `SRC-047`. The CI use case is regression detection over
a named baseline.

**Acceptance.** `ACC-004`, `ACC-010`.

**Scope.** A comparison between different domains is refused rather than
approximated.

**Implemented by.** `TASK-LOC-008`, `TASK-WEB-014`.

**ADRs.** [ADR-0010](../adr/0010-performance-and-eligibility.md), [ADR-0008](../adr/0008-triton-analysis.md)  Specification: [`../architecture/exploration-and-validation.md`](../architecture/exploration-and-validation.md).

**Contracts.** `AnalysisResult`, `Coverage`.

### REQ-VAL-010  Property naming is a closed vocabulary plus explicit extensions

**Statement.** Property identifiers SHALL be drawn from the shared vocabulary,
and a project-local property SHALL use the reserved `x-` prefix and be
unavailable for automatic eligibility.

**Rationale.** A local property has no shared meaning, so no shared policy can
accept it. `SRC-024`.

**Acceptance.** `ACC-005`.

**Scope.** The reserved prefix is enforced at scenario validation.

**Implemented by.** `TASK-FND-004`.

**ADRs.** [ADR-0010](../adr/0010-performance-and-eligibility.md), [ADR-0008](../adr/0008-triton-analysis.md)  Specification: [`../architecture/exploration-and-validation.md`](../architecture/exploration-and-validation.md).

**Contracts.** `propertyId`.

### REQ-VAL-011  A validation record is bound to one snapshot and profile

**Statement.** A validation record SHALL name the snapshot, scenario, domain,
policy revision and profile revision it belongs to, and SHALL be unusable as
evidence for a different one.

**Rationale.** `SRC-012`, `SRC-031`. Compatibility is exact identity, not
resemblance.

**Acceptance.** `ACC-004`, `ACC-006`.

**Scope.** Applies to imported records, which keep their original identity.

**Implemented by.** `TASK-FND-006`, `TASK-HST-006`.

**ADRs.** [ADR-0010](../adr/0010-performance-and-eligibility.md), [ADR-0008](../adr/0008-triton-analysis.md)  Specification: [`../architecture/exploration-and-validation.md`](../architecture/exploration-and-validation.md).

**Contracts.** `AnalysisResult`.

### REQ-VAL-012  Schedule-dependent outcomes are reported against a declared order

**Statement.** When a kernel's outcome depends on the order in which concurrent
operations execute, Pomset SHALL report the set of outcomes the analysis observed
or modelled, SHALL state which of them the scenario's declared requirement accepts,
and SHALL NOT report a single observed value as the program's result.

**Rationale.** `SRC-025`. Two threads writing under the same lock may leave either
value, and both executions are correct as a race-free program; whether the result
is acceptable is a question about the required order, not about a sanitizer's
silence. The category stays backend-qualified.

**Acceptance.** `ACC-002`, `ACC-009`.

**Scope.** Applies where a backend can observe or model the alternatives. Where it
cannot, the outcome is `unsupported` with the missing capability named, never a
silently chosen value.

**Implemented by.** `TASK-LOC-003`, `TASK-TRI-009`, `TASK-OMP-005`.

**ADRs.** [ADR-0010](../adr/0010-performance-and-eligibility.md), [ADR-0009](../adr/0009-backend-semantics.md)  Specification: [`../architecture/exploration-and-validation.md`](../architecture/exploration-and-validation.md).

**Contracts.** `PropertyResult` with `propertyId: synchronizationOrdering`.
