# ADR-0010  Performance and eligibility

## Context

A kernel has no single performance number, and a fast kernel whose output is
wrong is not an optimisation. Timing a configuration that was never validated,
or recommending one on incomplete evidence, would make the product actively
harmful: it would rank configurations by a metric measured on a run whose
correctness nobody established.

External profilers and sanitizers produce hardware metrics that Pomset could not
produce better. Vendors report that some collection workflows serialise kernel
dispatches, which changes the behaviour being measured. A CPU interpreter's
timing is not GPU timing.

## Decision

- **One `EligibilityPolicy` in domain policy** defines required-property
  acceptance and measurement eligibility. It is implemented once and reused by
  the CLI, the API and the UI.
- **Benchmark execution is gated** on an eligible validation record for the same
  snapshot, scenario, domain and policy, plus explicit local consent.
- **Recommendations require exact identity and complete evidence**: matching
  snapshot, scenario, profile, domain and policy; satisfied declared required
  checks; complete measurement provenance; a measured — not estimated — metric;
  and a compatible hardware cohort.
- **Imports stay labelled.** An imported measurement is inspectable and can be
  ineligible for recommendation with reasons; a structurally invalid or
  hash-conflicting import is rejected. Imported validation never becomes
  provider-produced proof.
- **Policy changes re-label, they never upgrade.** A user may accept sampled
  checks or an unknown required result for benchmarking, and the report records
  the policy revision and the unchanged evidence class.
- **Pomset does not implement its own profiler or autotuner.** It measures
  configurations and imports measurements.
- **Instrumentation effects are declared.** A serialised or instrumented run is
  never presented as unmodified parallel hardware behaviour.
- **Hardware cohorts stay separate.** Unlike devices are not pooled to rank a
  universally fastest configuration.

## Consequences

- The product's strongest claim — a recommendation — carries the strictest bar,
  which is what makes the weaker claims believable.
- A user with an incomplete Nsight export can still read it, and can see exactly
  which fields are missing and why it is not recommendable.
- Compile time, execution time, variance and clock method are separate recorded
  facts, so comparisons are meaningful across cold and warm caches.
- Some legitimate performance questions cannot be answered by Pomset, and the
  answer is that a different tool should be used.

## Validation obligations

- Verify that an unknown or unsupported required check blocks benchmarking until
  the policy explicitly changes, and that changing the policy leaves the
  evidence class unchanged.
- Verify that a measurement taken against a reused autotune buffer, or without a
  fresh or poisoned output, is not accepted as evidence that an output was
  written.
- Verify that an imported record missing warm-up, sample or method information is
  marked ineligible with reasons rather than silently accepted or silently
  discarded.

## Links

Requirements: [`REQ-PERF-001`](../srs/performance.md) …
`REQ-PERF-013`, [`REQ-VAL-001`](../srs/validation.md) …
`REQ-VAL-003`, [`REQ-DOM-011`](../srs/domains.md).
Specification: [`../architecture/exploration-and-validation.md`](../architecture/exploration-and-validation.md).
