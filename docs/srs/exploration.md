# Exploration — `EXP`

Extraction, queries, witnesses and counterexample-guided exploration.
Sources: `SRC-002`, `SRC-005`, `SRC-020`, `SRC-028`, `SRC-035`.

### REQ-EXP-001  Extract access expressions and masks from the supported subset

**Statement.** For the supported Triton subset, Pomset SHALL extract, per program
instance and per lane, the symbolic address expression and the predicate mask of
every `tl.load` and `tl.store`, attributable to a source range.

**Rationale.** Addresses and masks are the raw material of every property in the
first phase. `SRC-005`.

**Acceptance.** `ACC-001`.

**Scope.** Supported subset defined in
[`../architecture/triton-engine.md`](../architecture/triton-engine.md). Anything
outside it is `unsupported`, named.

**Implemented by.** `TASK-TRI-005`, `TASK-TRI-006`.

**ADRs.** [ADR-0008](../adr/0008-triton-analysis.md)  Specification: [`../architecture/triton-engine.md`](../architecture/triton-engine.md).

**Contracts.** `MemoryAccessEvent`.

### REQ-EXP-002  Bounds query finds enabled accesses outside their allocation

**Statement.** Pomset SHALL answer, for a declared domain and allocation, whether
some domain point and some enabled access falls outside the allocation's bounds,
returning a witness when it does and an established result over the modelled
domain when it cannot.

**Rationale.** `SRC-005`, `SRC-007`.

**Acceptance.** `ACC-001`.

**Scope.** A negative answer holds over the declared model and domain only.

**Implemented by.** `TASK-TRI-008`.

**ADRs.** [ADR-0008](../adr/0008-triton-analysis.md)  Specification: [`../architecture/triton-engine.md`](../architecture/triton-engine.md).

**Contracts.** `PropertyResult` with `propertyId: memoryBounds`.

### REQ-EXP-003  Output-coverage query finds unwritten declared output

**Statement.** Pomset SHALL answer whether some declared output index has no
enabled write under some domain point, returning the index, the domain point and
the mask provenance as a witness when it does.

**Rationale.** The flagship correctness property. `SRC-002`, `SRC-007`.

**Acceptance.** `ACC-001`.

**Scope.** "Declared output" means an allocation with role `output`; scratch is
not required to be fully written.

**Implemented by.** `TASK-TRI-008`.

**ADRs.** [ADR-0008](../adr/0008-triton-analysis.md)  Specification: [`../architecture/triton-engine.md`](../architecture/triton-engine.md).

**Contracts.** `PropertyResult` with `propertyId: outputCoverage`.

### REQ-EXP-004  Conflict query is non-atomic write/write only, initially

**Statement.** The initial Triton symbolic conflict query SHALL detect two
distinct program instances or lanes writing the same address in an unordered,
non-atomic way. Read/write conflicts, atomics, and synchronization or cross-scope
diagnostics SHALL be separate backend capabilities, available only through a
validated native or instrumented tool or a later explicitly modelled feature.

**Rationale.** Scoping the first query keeps its `unsat` answer meaningful.
Sources: `SRC-005`, `SRC-024`.

**Acceptance.** `ACC-002`.

**Scope.** The missing-barrier demonstration is owned by the CUDA and OpenMP
phases, not claimed as an initial Triton symbolic capability.

**Implemented by.** `TASK-TRI-008`, `TASK-CUDA-005`, `TASK-OMP-004`.

**ADRs.** [ADR-0009](../adr/0009-backend-semantics.md)  Specification: [`../architecture/triton-engine.md`](../architecture/triton-engine.md).

**Contracts.** `PropertyResult` with `propertyId: writeWriteConflict`.

### REQ-EXP-005  A witness is concrete, source-linked and minimizable

**Statement.** A witness SHALL contain the assignments that fix the domain, the
participating actors, the participating events and their source ranges, and
Pomset SHALL attempt to minimize it without dropping any assumption the result
depends on.

**Rationale.** `SRC-028`, `SRC-020`. A small reproducible example is the
deliverable a developer can act on.

**Acceptance.** `ACC-001`, `ACC-002`.

**Scope.** Minimization is attempted and its outcome recorded; an unminimizable
witness is still a witness.

**Implemented by.** `TASK-TRI-015`.

**ADRs.** [ADR-0008](../adr/0008-triton-analysis.md)  Specification: [`../architecture/triton-engine.md`](../architecture/triton-engine.md).

**Contracts.** `Witness`, `Witness.minimization`.

### REQ-EXP-006  Replay is a separate, labelled mechanism

**Statement.** When a witness can be replayed, Pomset SHALL record the replay
method and its outcome. A CPU interpreter replay SHALL NOT be presented as
evidence about GPU race schedules or as a measurement of GPU speed.

**Rationale.** `SRC-022`. Replay reproduces a modelled behaviour, not hardware
timing.

**Acceptance.** `ACC-001`, `ACC-006`.

**Scope.** Replay requires execution consent when it executes anything.

**Implemented by.** `TASK-TRI-016`, `TASK-LOC-006`.

**ADRs.** [ADR-0008](../adr/0008-triton-analysis.md)  Specification: [`../architecture/triton-engine.md`](../architecture/triton-engine.md).

**Contracts.** `Witness.replay`.

### REQ-EXP-007  Domain partitioning is counterexample-guided

**Statement.** Pomset SHALL support partitioning a domain into regions using the
constraints under which behaviour changes, and using found counterexamples to
direct the next partition, rather than relying only on uniform sampling.

**Rationale.** `SRC-028`, `SRC-020`. The point of the exercise is to need fewer
experiments than exhaustive enumeration.

**Acceptance.** `ACC-003`.

**Scope.** Partition-guided exploration is a strategy with a recorded revision,
like any other.

**Implemented by.** `TASK-TRI-010`.

**ADRs.** [ADR-0008](../adr/0008-triton-analysis.md)  Specification: [`../architecture/triton-engine.md`](../architecture/triton-engine.md).

**Contracts.** `SampledCheck.strategyId`.

### REQ-EXP-008  Sampling strategies are recorded, seeded and comparable

**Statement.** Pomset SHALL support exhaustive, random, boundary and
counterexample-guided sample selection as comparable strategies, each recording
its strategy revision, seed, budget and the resulting points.

**Rationale.** `SRC-020`, `SRC-043`. Comparing strategies is how the feasibility
gate reaches a conclusion.

**Acceptance.** `ACC-003`.

**Scope.** Exhaustive is only available over an enumerated finite domain.

**Implemented by.** `TASK-TRI-010`, `TASK-FEA-005`.

**ADRs.** [ADR-0008](../adr/0008-triton-analysis.md)  Specification: [`../architecture/triton-engine.md`](../architecture/triton-engine.md).

**Contracts.** `SampledCheck`.

### REQ-EXP-009  Seeds make a sample reproducible

**Statement.** A sampling run SHALL be reproducible from its strategy, strategy
revision, seed and budget alone, and Pomset SHALL NOT depend on wall-clock time,
process identity or iteration order for the points it selects.

**Rationale.** `SRC-043`. Determinism is what makes a CI comparison meaningful.

**Acceptance.** `ACC-003`.

**Scope.** Applies across processes and machines for the same revision.

**Implemented by.** `TASK-TRI-010`.

**ADRs.** [ADR-0008](../adr/0008-triton-analysis.md)  Specification: [`../architecture/triton-engine.md`](../architecture/triton-engine.md).

**Contracts.** `SampledCheck.seed`.

### REQ-EXP-010  Unsupported semantics stop extraction explicitly

**Statement.** When extraction meets a construct outside the supported subset —
data-dependent addresses, dynamic loops, indirect loads, reductions, dot
products or atomics — Pomset SHALL stop and report `unsupported` with the
construct named and its source range, and SHALL NOT guess a semantics for it.

**Rationale.** `SRC-029`. A guessed semantics produces confident nonsense.

**Acceptance.** `ACC-002`, `ACC-009`.

**Scope.** Each unsupported family gets its own expansion task before support is
enabled.

**Implemented by.** `TASK-TRI-012`, `TASK-TRX-001`, `TASK-TRX-005`.

**ADRs.** [ADR-0009](../adr/0009-backend-semantics.md), [ADR-0008](../adr/0008-triton-analysis.md)  Specification: [`../architecture/triton-engine.md`](../architecture/triton-engine.md).

**Contracts.** `PropertyResult.unsupportedReason`.

### REQ-EXP-011  Source, IR and PTX views are qualified by mapping quality

**Statement.** When Pomset shows a source-to-IR or source-to-PTX correspondence,
it SHALL record whether the mapping is exact, approximate or unavailable, and
SHALL NOT present an approximate mapping as exact.

**Rationale.** `SRC-031`. A wrong line number is a wrong explanation.

**Acceptance.** `ACC-009`.

**Scope.** Applies to artifacts produced by compilation and extraction.

**Implemented by.** `TASK-CUDA-003`, `TASK-TRI-013`.

**ADRs.** [ADR-0008](../adr/0008-triton-analysis.md)  Specification: [`../architecture/triton-engine.md`](../architecture/triton-engine.md).

**Contracts.** `SourceRange.confidence`.

### REQ-EXP-012  The explorer reports the query and model revision it used

**Statement.** Every analysis result SHALL record the revision of the extraction
and query model and the solver version that produced it.

**Rationale.** `SRC-037`, `SRC-043`. A re-run under a newer model may legitimately
disagree.

**Acceptance.** `ACC-003`, `ACC-009`.

**Scope.** Applies to symbolic, sampled and replay results.

**Implemented by.** `TASK-TRI-008`, `TASK-FND-006`.

**ADRs.** [ADR-0008](../adr/0008-triton-analysis.md)  Specification: [`../architecture/triton-engine.md`](../architecture/triton-engine.md).

**Contracts.** `AnalysisResult.queryRevision`.

### REQ-EXP-013  A missing capability is actionable

**Statement.** When a requested analysis is unavailable, Pomset SHALL state the
missing capability, the reason it is unavailable, and the alternative that does
exist — including "run locally instead" where that is the honest answer — and
SHALL NOT substitute a nearby analysis that appears to answer the question.

**Rationale.** `SRC-029`, `SRC-038`. The unsupported combination is explained.

**Acceptance.** `ACC-002`, `ACC-009`.

**Scope.** Applies to the profile catalogue, the CLI manifest and the workbench.

**Implemented by.** `TASK-HST-011`, `TASK-WEB-010`, `TASK-LOC-005`.

**ADRs.** [ADR-0008](../adr/0008-triton-analysis.md)  Specification: [`../architecture/triton-engine.md`](../architecture/triton-engine.md).

**Contracts.** `Capability.reason`.
