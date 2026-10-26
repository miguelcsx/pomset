# Performance — `PERF`

Measurement is a separate evidence class from correctness, and a measurement is
not a proof. Sources: `SRC-010`, `SRC-027`, `SRC-048`, `SRC-052`, `SRC-055`.

### REQ-PERF-001  Pomset measures and imports; it is not a profiler or an autotuner

**Statement.** Pomset SHALL NOT implement its own profiler, counter collector or
general-purpose autotuner. It SHALL execute eligible configurations, measure
them with declared mechanisms, and import measurements produced by external
tools.

**Rationale.** `SRC-048`. Vendor tooling is better at hardware counters, and the
product must not become a worse Nsight.

**Acceptance.** `ACC-006`.

**Scope.** A small launch-and-time harness is in scope; occupancy modelling or
counter collection is not.

**Implemented by.** `TASK-PRS-003`, `TASK-PRS-005`.

**ADRs.** [ADR-0010](../adr/0010-performance-and-eligibility.md)  Specification: [`../architecture/exploration-and-validation.md`](../architecture/exploration-and-validation.md).

**Contracts.** `Measurement`.

### REQ-PERF-002  Only eligible configurations are benchmarked

**Statement.** Pomset SHALL execute a benchmark only for configurations whose
required properties are satisfied under the active policy, and SHALL record the
satisfying validation record that admitted each configuration.

**Rationale.** `SRC-035`. Timing a configuration that writes the wrong answer is
wasted work and a misleading result.

**Acceptance.** `ACC-006`, `ACC-007`.

**Scope.** A user MAY override through an explicit policy change, which is
recorded and does not upgrade any evidence.

**Implemented by.** `TASK-PRS-003`, `TASK-LOC-006`.

**ADRs.** [ADR-0010](../adr/0010-performance-and-eligibility.md)  Specification: [`../architecture/exploration-and-validation.md`](../architecture/exploration-and-validation.md).

**Contracts.** `Measurement.eligibility`.

### REQ-PERF-003  Imported measurements remain inspectable

**Statement.** Pomset SHALL import measurements from external tools with their
original provenance, display them with their provenance, and SHALL mark them
ineligible for recommendation when they lack complete hardware, warm-up, sample
or method information — without discarding them.

**Rationale.** `SRC-027`. A user's own Nsight export is worth looking at even
when the product will not recommend on it.

**Acceptance.** `ACC-006`.

**Scope.** Structurally invalid or hash-conflicting imports are rejected; merely
incomplete ones are kept and marked.

**Implemented by.** `TASK-PRS-002`.

**ADRs.** [ADR-0010](../adr/0010-performance-and-eligibility.md)  Specification: [`../architecture/exploration-and-validation.md`](../architecture/exploration-and-validation.md).

**Contracts.** `Measurement.eligibility.reasonCodes`.

### REQ-PERF-004  Measurement records its qualifiers

**Statement.** A measurement SHALL record the hardware identity, tool identity
and version, warm-up count, sample count, the statistic used, the clock method,
the synchronisation method, and the variance, and SHALL distinguish measured from
estimated.

**Rationale.** `SRC-052`, `SRC-055`. A number without its conditions is not a
measurement.

**Acceptance.** `ACC-006`.

**Scope.** Applies to locally produced and imported measurements alike.

**Implemented by.** `TASK-PRS-001`, `TASK-PRS-003`, `TASK-FEA-002`.

**ADRs.** [ADR-0010](../adr/0010-performance-and-eligibility.md)  Specification: [`../architecture/exploration-and-validation.md`](../architecture/exploration-and-validation.md).

**Contracts.** `Measurement.samples`, `.hardware`, `.synchronization`.

### REQ-PERF-005  Compilation time is separated from execution time

**Statement.** Pomset SHALL record compilation duration and just-in-time cache
state separately from kernel execution duration, and SHALL NOT include compile
time in a reported execution latency.

**Rationale.** `SRC-052`. JIT cost is real but it is not kernel latency, and
conflating them makes comparisons meaningless on the first run.

**Acceptance.** `ACC-006`.

**Scope.** Reported as separate metrics with separate names.

**Implemented by.** `TASK-PRS-003`.

**ADRs.** [ADR-0010](../adr/0010-performance-and-eligibility.md)  Specification: [`../architecture/exploration-and-validation.md`](../architecture/exploration-and-validation.md).

**Contracts.** `Measurement.synchronization.compileTimeMs`.

### REQ-PERF-006  Instrumentation effects are declared, never hidden

**Statement.** A measurement SHALL record whether the observation mechanism
serialised execution or perturbed it, and Pomset SHALL NOT present an
instrumented or serialised execution as unmodified parallel hardware behaviour.

**Rationale.** `SRC-027`. Counter collection workflows are documented to serialise
dispatches, which changes what is being measured.

**Acceptance.** `ACC-006`, `ACC-009`.

**Scope.** Includes trace collection and profiler-attached runs.

**Implemented by.** `TASK-PRS-005`, `TASK-CUDA-008`.

**ADRs.** [ADR-0010](../adr/0010-performance-and-eligibility.md)  Specification: [`../architecture/exploration-and-validation.md`](../architecture/exploration-and-validation.md).

**Contracts.** `Measurement.instrumentation`.

### REQ-PERF-007  Hardware and software metrics are only reported where a tool supplies them

**Statement.** Memory, coalescing, bank-conflict, divergence, load-balance,
register, spill and occupancy metrics SHALL be reported only where an external
tool actually supplies them, with its identity, and SHALL NOT be inferred from
runtime.

**Rationale.** `SRC-055`, `SRC-048`. Latency alone does not diagnose a cause.

**Acceptance.** `ACC-006`, `ACC-010`.

**Scope.** A metric that a tool cannot supply is absent with a capability
explanation, never a numeric zero.

**Implemented by.** `TASK-PRS-005`, `TASK-CUDA-008`.

**ADRs.** [ADR-0010](../adr/0010-performance-and-eligibility.md)  Specification: [`../architecture/exploration-and-validation.md`](../architecture/exploration-and-validation.md).

**Contracts.** `Capability`, `Measurement.metric`.

### REQ-PERF-008  No causal diagnosis from latency alone

**Statement.** When Pomset explains why performance changed, every causal claim
SHALL cite a measured metric, a compilation artifact, or a declared resource
model, and SHALL state which of the three it rests on.

**Rationale.** `SRC-055`, `SRC-010`. A slower run does not explain itself.

**Acceptance.** `ACC-010`.

**Scope.** Applies to the workbench explanations and to exported reports.

**Implemented by.** `TASK-WEB-015`, `TASK-PRS-005`.

**ADRs.** [ADR-0010](../adr/0010-performance-and-eligibility.md)  Specification: [`../architecture/exploration-and-validation.md`](../architecture/exploration-and-validation.md).

**Contracts.** `Measurement`, `Finding`.

### REQ-PERF-009  Comparisons keep hardware cohorts separate

**Statement.** Pomset SHALL compare configurations within a declared hardware
cohort, SHALL NOT rank configurations across unlike devices in one ordered list,
and SHALL label a cross-cohort view as a comparison of cohorts.

**Rationale.** `SRC-010` reports speedup variation of up to 21.4x across hardware
within one benchmark.

**Acceptance.** `ACC-006`, `ACC-010`.

**Scope.** `cohortMatch` in the policy states the required strictness.

**Implemented by.** `TASK-PRS-004`.

**ADRs.** [ADR-0010](../adr/0010-performance-and-eligibility.md)  Specification: [`../architecture/exploration-and-validation.md`](../architecture/exploration-and-validation.md).

**Contracts.** `Measurement.cohortId`, `EligibilityPolicy.benchmark`.

### REQ-PERF-010  A recommendation requires complete, measured, compatible evidence

**Statement.** Pomset SHALL make a performance recommendation only when the
measurement's snapshot, scenario, profile, domain and policy identities exactly
match, its required checks are satisfied, its provenance is complete, and its
metric is measured rather than estimated.

**Rationale.** `SRC-004`, `SRC-035`. A recommendation is the product's strongest
claim and carries the strictest bar.

**Acceptance.** `ACC-006`, `ACC-007`.

**Scope.** Explicit user policy may admit imported local evidence while keeping
its origin and evidence class visible.

**Implemented by.** `TASK-LOC-003`, `TASK-PRS-004`.

**ADRs.** [ADR-0010](../adr/0010-performance-and-eligibility.md)  Specification: [`../architecture/exploration-and-validation.md`](../architecture/exploration-and-validation.md).

**Contracts.** `EligibilityPolicy.benchmark`.

### REQ-PERF-011  Estimated values are labelled as estimates everywhere

**Statement.** A value produced by a model or simulator SHALL be labelled
`estimated` in the API payload, the CLI report and every chart, and SHALL NOT be
presented as a measurement.

**Rationale.** `SRC-004`, `SRC-054`.

**Acceptance.** `ACC-006`, `ACC-010`.

**Scope.** Chart axes and legends carry the label, not only a tooltip.

**Implemented by.** `TASK-WEB-015`, `TASK-LOC-007`.

**ADRs.** [ADR-0010](../adr/0010-performance-and-eligibility.md)  Specification: [`../architecture/exploration-and-validation.md`](../architecture/exploration-and-validation.md).

**Contracts.** `Measurement.evidenceClass`.

### REQ-PERF-012  External measurement formats are validated on import

**Statement.** Pomset SHALL validate an imported measurement against the portable
schema, required provenance fields and content hashes, SHALL reject a structurally
invalid or hash-conflicting record, and SHALL NOT execute anything on import.

**Rationale.** `SRC-027`. An import is untrusted input.

**Acceptance.** `ACC-005`, `ACC-006`.

**Scope.** Includes oversized and malformed records.

**Implemented by.** `TASK-PRS-002`, `TASK-SEC-004`, `TASK-FEA-002`.

**ADRs.** [ADR-0010](../adr/0010-performance-and-eligibility.md)  Specification: [`../architecture/exploration-and-validation.md`](../architecture/exploration-and-validation.md).

**Contracts.** `BUNDLE_INVALID`, `INPUT_INVALID`.

### REQ-PERF-013  Trace export requires representable qualified data

**Statement.** Pomset SHALL export a timeline only for event data whose order the
analysis actually established, SHALL mark unresolved ordering, and SHALL NOT
fabricate a total order to produce a tidier timeline.

**Rationale.** `SRC-051`, `SRC-027`.

**Acceptance.** `ACC-010`.

**Scope.** The export is a user exit path, not a rendering dependency.

**Implemented by.** `TASK-PRS-006`.

**ADRs.** [ADR-0010](../adr/0010-performance-and-eligibility.md)  Specification: [`../architecture/exploration-and-validation.md`](../architecture/exploration-and-validation.md).

**Contracts.** `partialOrder`.
