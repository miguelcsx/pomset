# Workload domains — `DOM`

The workload domain is the central model: a kernel has no single correctness
result and no single performance number, because its behaviour depends on
theta = (shape, dtype, layout, launch, hardware). Sources: `SRC-003`, `SRC-004`.

### REQ-DOM-001  The domain is declared, not inferred

**Statement.** Every analysis SHALL run over an explicitly declared workload
domain, and Pomset SHALL NOT generalise a result obtained from one configuration
or one input to the domain as a whole.

**Rationale.** A pass at one shape says nothing about another. Sources:
`SRC-003`, `SRC-016`.

**Acceptance.** `ACC-001`, `ACC-003`.

**Scope.** Applies to symbolic and sampled analysis alike.

**Implemented by.** `TASK-TRI-002`, `TASK-LOC-003`.

**ADRs.** [ADR-0010](../adr/0010-performance-and-eligibility.md), [ADR-0001](../adr/0001-product-and-evidence.md)  Specification: [`../architecture/exploration-and-validation.md`](../architecture/exploration-and-validation.md).

**Contracts.** `WorkloadDomain`.

### REQ-DOM-002  Domain variables cover shape, dtype, layout, launch and hardware

**Statement.** A workload domain SHALL be a conjunction of declared variables
whose kinds cover shape, dtype, layout/strides, launch configuration and
hardware cohort, each with an explicit finite value set, range or enumerated
type.

**Rationale.** The five families named in the behaviour-envelope model.
`SRC-003`.

**Acceptance.** `ACC-003`.

**Scope.** A domain need not vary every family; it must be able to declare
each.

**Implemented by.** `TASK-TRI-002`, `TASK-FND-003`.

**ADRs.** [ADR-0010](../adr/0010-performance-and-eligibility.md), [ADR-0001](../adr/0001-product-and-evidence.md)  Specification: [`../architecture/exploration-and-validation.md`](../architecture/exploration-and-validation.md).

**Contracts.** `domainVariable`.

### REQ-DOM-003  Constraints are explicit and machine-checkable

**Statement.** A domain SHALL carry its constraints as a machine-checkable
conjunction over domain variables, and Pomset SHALL reject a domain whose
constraints are empty, contradictory, or unsatisfiable under the declared value
sets.

**Rationale.** An unsatisfiable domain must be an error, not an empty result set
that looks like a clean sweep. Sources: `SRC-003`, `SRC-005`.

**Acceptance.** `ACC-003`, `ACC-005`.

**Scope.** The same constraint representation is used by the launch evaluator.

**Implemented by.** `TASK-FND-004`, `TASK-TRI-003`.

**ADRs.** [ADR-0010](../adr/0010-performance-and-eligibility.md), [ADR-0001](../adr/0001-product-and-evidence.md)  Specification: [`../architecture/exploration-and-validation.md`](../architecture/exploration-and-validation.md).

**Contracts.** `intConstraint`.

### REQ-DOM-004  Integer width and overflow are preserved

**Statement.** Integer reasoning SHALL preserve the declared width and signedness
of the Triton value it models, including overflow behaviour. Pomset SHALL reject
a value whose width it cannot model rather than reasoning about it as an
unbounded mathematical integer.

**Rationale.** Silent widening turns a real overflow defect into a passing
analysis. Sources: `SRC-003`, `SRC-029`.

**Acceptance.** `ACC-003`.

**Scope.** Unsupported widths are an explicit `unsupported`, with the width
named in the reason.

**Implemented by.** `TASK-TRI-004`.

**ADRs.** [ADR-0010](../adr/0010-performance-and-eligibility.md), [ADR-0001](../adr/0001-product-and-evidence.md)  Specification: [`../architecture/exploration-and-validation.md`](../architecture/exploration-and-validation.md).

**Contracts.** `domainVariable.width`.

### REQ-DOM-005  Sizes and allocations are constrained, not assumed

**Statement.** Pomset SHALL derive every address bound it uses from declared
allocation sizes and domain constraints, and SHALL NOT assume a dimension is
positive, non-zero, or a multiple of any other value unless the constraints
establish it.

**Rationale.** The floor-versus-ceiling grid defect appears exactly where an
unstated divisibility assumption held. Sources: `SRC-007`, `SRC-005`.

**Acceptance.** `ACC-001`.

**Scope.** Applies to symbolic bounds queries and to replay.

**Implemented by.** `TASK-TRI-005`, `TASK-TRI-008`.

**ADRs.** [ADR-0010](../adr/0010-performance-and-eligibility.md), [ADR-0001](../adr/0001-product-and-evidence.md)  Specification: [`../architecture/exploration-and-validation.md`](../architecture/exploration-and-validation.md).

**Contracts.** `Allocation.shape`, `intConstraint`.

### REQ-DOM-006  Aliasing is declared

**Statement.** Aliasing between allocations SHALL be declared through alias
groups. Two allocations that are not in the same group SHALL be treated as
non-overlapping, and an analysis SHALL NOT report a conflict that depends on an
undeclared overlap.

**Rationale.** Declared aliasing keeps conflict findings honest. Sources:
`SRC-023`, `SRC-005`.

**Acceptance.** `ACC-002`.

**Scope.** A backend may decline to analyse a declared-alias case, and says so.

**Implemented by.** `TASK-TRI-006`.

**ADRs.** [ADR-0010](../adr/0010-performance-and-eligibility.md), [ADR-0001](../adr/0001-product-and-evidence.md)  Specification: [`../architecture/exploration-and-validation.md`](../architecture/exploration-and-validation.md).

**Contracts.** `AliasGroup`.

### REQ-DOM-007  Regions carry independent classifications

**Statement.** Pomset SHALL report a domain as regions, each with per-property
classifications drawn from established, violated, sampled, unknown and
unsupported, and SHALL NOT collapse the domain into a single verdict.

**Rationale.** `SRC-004`: a formally verified region is not equivalent to one
where 100 tests passed. `SRC-054`.

**Acceptance.** `ACC-003`, `ACC-007`.

**Scope.** Regions are constraints plus classifications, not a percentage.

**Implemented by.** `TASK-TRI-009`, `TASK-WEB-008`.

**ADRs.** [ADR-0010](../adr/0010-performance-and-eligibility.md), [ADR-0001](../adr/0001-product-and-evidence.md)  Specification: [`../architecture/exploration-and-validation.md`](../architecture/exploration-and-validation.md).

**Contracts.** `Coverage`.

### REQ-DOM-008  Percentages require an enumerated denominator

**Statement.** Pomset SHALL report a count or percentage of a domain only when
that domain is finite, explicitly enumerated, and its duplicate points removed,
and SHALL otherwise report constraints and sampled points without any implied
domain-wide proportion.

**Rationale.** A percentage over an unterminated space is a fabricated number.
Sources: `SRC-004`, `SRC-021`.

**Acceptance.** `ACC-003`.

**Scope.** The rule applies to the API payload, the CLI report and the UI
alike.

**Implemented by.** `TASK-TRI-009`, `TASK-WEB-008`, `TASK-LOC-007`.

**ADRs.** [ADR-0010](../adr/0010-performance-and-eligibility.md), [ADR-0001](../adr/0001-product-and-evidence.md)  Specification: [`../architecture/exploration-and-validation.md`](../architecture/exploration-and-validation.md).

**Contracts.** `Coverage.denominator`.

### REQ-DOM-009  Sampled regions are never promoted

**Statement.** A sampled region SHALL remain labelled sampled. Pomset SHALL NOT
describe a boundary, random or counterexample-guided sampling result as
established over the domain, and a user MAY declare sampled checks acceptable
for benchmarking only when the resulting report records that policy.

**Rationale.** `SRC-004`, `SRC-042`. Sampling finds counterexamples; it does not
prove their absence.

**Acceptance.** `ACC-003`, `ACC-006`.

**Scope.** A policy change re-labels a result; it never upgrades evidence.

**Implemented by.** `TASK-LOC-003`, `TASK-TRI-010`.

**ADRs.** [ADR-0010](../adr/0010-performance-and-eligibility.md), [ADR-0001](../adr/0001-product-and-evidence.md)  Specification: [`../architecture/exploration-and-validation.md`](../architecture/exploration-and-validation.md).

**Contracts.** `SampledCheck`, `EligibilityPolicy`.

### REQ-DOM-010  Unsupported regions are named

**Statement.** A region whose property cannot be decided because the kernel
uses semantics outside the supported model SHALL be classified unsupported with
the unsupported construct named, and SHALL NOT be silently grouped with the
unknown regions or with the established ones.

**Rationale.** `SRC-029`, `SRC-003`. An unsupported combination is explained.

**Acceptance.** `ACC-002`, `ACC-009`.

**Scope.** Atomics, dynamic indexing, reductions and dot products in Triton
begin unsupported.

**Implemented by.** `TASK-TRI-012`, `TASK-CUDA-005`, `TASK-OMP-004`.

**ADRs.** [ADR-0010](../adr/0010-performance-and-eligibility.md), [ADR-0001](../adr/0001-product-and-evidence.md)  Specification: [`../architecture/exploration-and-validation.md`](../architecture/exploration-and-validation.md).

**Contracts.** `PropertyResult.unsupportedReason`.

### REQ-DOM-011  Hardware cohorts are compared separately

**Statement.** Cross-architecture comparisons SHALL keep hardware cohorts
separate, and Pomset SHALL NOT pool unlike devices to rank a single universally
fastest configuration.

**Rationale.** Reported speedup variation across hardware is large within one
benchmark (`SRC-010`); pooling would manufacture a conclusion.

**Acceptance.** `ACC-006`, `ACC-010`.

**Scope.** A cohort is declared in the domain and carried by every measurement.

**Implemented by.** `TASK-LOC-006`, `TASK-PRS-004`.

**ADRs.** [ADR-0010](../adr/0010-performance-and-eligibility.md), [ADR-0001](../adr/0001-product-and-evidence.md)  Specification: [`../architecture/exploration-and-validation.md`](../architecture/exploration-and-validation.md).

**Contracts.** `Measurement.cohortId`.

### REQ-DOM-012  Domain identity participates in cache keys

**Statement.** Analysis cache keys SHALL include the scenario, policy, model and
profile revision identity, and measurement cache keys SHALL additionally include
device, tool and environment identity. Pomset SHALL NOT reuse evidence across
different domain or hardware identity.

**Rationale.** A cached result from another domain is a wrong answer with the
right shape. Sources: `SRC-031`, `SRC-037`.

**Acceptance.** `ACC-004`, `ACC-006`.

**Scope.** Cache identity is content identity, never ownership.

**Implemented by.** `TASK-FND-007`, `TASK-HST-009`.

**ADRs.** [ADR-0010](../adr/0010-performance-and-eligibility.md), [ADR-0001](../adr/0001-product-and-evidence.md)  Specification: [`../architecture/exploration-and-validation.md`](../architecture/exploration-and-validation.md).

**Contracts.** See [`../architecture/lifecycle.md`](../architecture/lifecycle.md).

### REQ-DOM-013  A domain point is reproducible from its record

**Statement.** Every domain point used by a sampled check SHALL be reproducible
from the recorded strategy, strategy revision, seed and budget, without
re-running the exploration that chose it.

**Rationale.** `SRC-043`: a failure that cannot be re-derived is not evidence.

**Acceptance.** `ACC-003`.

**Scope.** Applies to exhaustive, random, boundary, partition-guided and
counterexample-guided strategies.

**Implemented by.** `TASK-TRI-010`, `TASK-LOC-007`.

**ADRs.** [ADR-0010](../adr/0010-performance-and-eligibility.md), [ADR-0001](../adr/0001-product-and-evidence.md)  Specification: [`../architecture/exploration-and-validation.md`](../architecture/exploration-and-validation.md).

**Contracts.** `SampledCheck`.
