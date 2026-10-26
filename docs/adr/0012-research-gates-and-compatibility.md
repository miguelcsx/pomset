# ADR-0012  Research gates and compatibility

## Context

Two kinds of uncertainty sit under this specification. The first is whether the
product's central claim holds at all: that analysing memory-access patterns over
a declared domain finds real defects, and explains them better or more cheaply
than existing tools. The second is whether each specific tool works, at each
specific version, on each specific platform, in the specific sandbox.

Neither uncertainty can be resolved by writing more documentation. But neither
may be quietly assumed away either: a spec that presumes the gate passed would be
a plan for a product that might not exist, and a spec that omitted the later
phases would abandon the parts of the product that are already decided.

A related risk: research ambition is easy to assert and hard to measure. The
older sources contain proposals — portable causal explanations across models,
minimal counterexamples, correctness-aware optimisation — that are hypotheses,
not features.

## Decision

- **A feasibility gate precedes the full web product.** Real or faithfully
  reconstructed known-defect cases with correct controls, parsed and queried,
  producing source-linked reproducible outcomes; an independent comparison
  against existing tools at documented versions; and at least one documented
  benefit — an additional supported defect class, a smaller witness, a lower
  comparable cost, or a better explanation of the changing domain — without
  misclassifying the correct controls.
- **Feature-by-feature tool probes with exact records.** Each tool/version/platform
  combination gets a probe and an immutable capability entry. A version mentioned
  in a reference implementation is a candidate, not a support claim.
- **Research benefit must be measured, not asserted.** The comparison metrics —
  defects found, experimental cost, analysis time, precision, witness size, domain
  coverage — are collected, not projected.
- **Later-phase documentation stays specified if a gate fails.** The CUDA, OpenMP
  and advanced-Triton obligations are fully decomposed. A failed gate stops the
  dependent implementation tasks; it does not silently delete the requirements or
  substitute a different product.
- **GPU-only experiments may remain explicitly blocked** while CPU feasibility
  proceeds, and a blocked experiment does not count as a successful comparison.
- **Missing reproducers are reconstructed honestly.** If an upstream reproducer
  cannot be obtained or legally redistributed, a smaller independently written
  fixture demonstrates the same verified failure mechanism and is labelled as
  such — never as the upstream reproducer.

## Consequences

- The documentation is complete even where the evidence is not, which is what
  makes it usable as a plan: a reader can see which parts are decided, which are
  measured and which are owed.
- Stopping after a failed gate leaves a coherent, publishable specification and
  backlog rather than a half-built product.
- Claims stay narrow. Nothing here asserts novelty, adoption or statistical
  generality.

## Validation obligations

- Publish the gate result with its case counts, measured limitations and the
  exact comparison tools and versions, whether it passes or fails.
- Record every probe's tool version, platform, image digest and outcome in a
  profile revision.
- For any blocked GPU or tool experiment, record the blocker explicitly as a
  blocker, never as a passed or failed check.

## Links

Requirements: [`REQ-PLT-002`](../srs/platform.md), `REQ-PLT-010`,
[`REQ-BCK-004`](../srs/backend-expansion.md), `REQ-BCK-011`,
[`REQ-PERF-010`](../srs/performance.md).
Delivery: [`../delivery/README.md`](../delivery/README.md),
[`../delivery/01-feasibility.md`](../delivery/01-feasibility.md),
[`../evaluation/methodology.md`](../evaluation/methodology.md).
Sources: [`SRC-035`](../reference/source-disposition.md), `SRC-044`,
`SRC-020`, `SRC-045`.
