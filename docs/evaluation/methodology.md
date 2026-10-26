# Evaluation methodology

How the product's claims are to be measured. The initial baseline evaluation is
reported below; the full measurements remain owed by the tasks named in
[`../delivery/`](../delivery/README.md).
Requirements: [`../srs/performance.md`](../srs/performance.md),
[`../srs/evidence.md`](../srs/evidence.md). Decision:
[`../adr/0012-research-gates-and-compatibility.md`](../adr/0012-research-gates-and-compatibility.md).

## What is being measured

### Baseline gate observation — 2026-10-11

The existing output-coverage analyzer was checked against seven finite-pattern
cases using an internal exhaustive write oracle. The original baseline had four disagreements: domain-variable reordering,
a different mask, a stepped domain and an output allocation larger than the
mask bound. The repaired analyzer now matches all seven internal oracle cases.
That regression improvement does not supply an independent comparison.
This oracle is not an independent comparison tool. No comparative benefit was
demonstrated and no bounds/conflict corpus or strategy comparison was completed.

The decision is **no-go**. All dependent epics remain blocked. The measured
host is Darwin arm64; the pinned Triton 3.1.0 dependency has no matching wheel,
and interpreter, TileLens, TritonSan and Compute Sanitizer comparisons did not
run. Their blocked rows do not count as comparisons. Exact versions, source
bytes, scenario inputs, solver witnesses and single-run timings are retained in
the [gate artifacts](../../fixtures/kernels/feasibility/reports/index.html).
These observations concern this implementation and these finite cases only.

| Claim under test | Measurement |
|---|---|
| The exploration finds real defects in user kernels. | Defects found per case, against known answers. |
| It explains them better than existing tools. | Witness size, source linkage, and whether the explanation identifies the cause. |
| It costs less than exhaustive search. | Experiments/executions needed, analysis wall time, solver time. |
| It does not misclassify correct kernels. | False positives on the correct controls. |
| The behaviour envelope is a real phenomenon. | Regions where correctness or performance actually changes across the domain. |
| Tool integrations report genuine evidence. | Version-qualified observations reproduced against the tool's own output. |

None of these is claimed in advance. Each is measured, published with its
limitations and case counts, and stated as an observation on this corpus — never as
statistical generality and never as a novelty claim.

## Corpus

- **Provenance.** Real or faithfully reconstructed defect cases, each with a
  documented origin. Where an upstream reproducer cannot be obtained or legally
  redistributed, a smaller independently written fixture demonstrates the same
  failure mechanism and is labelled as such — never as the upstream reproducer.
- **Pairs.** Every defect case ships with a **correct control**: the same kernel with
  the defect removed. A method that flags the control is worse than useless.
- **Size.** The validation phase examines at least 15–20 real debugging incidents
  from the relevant upstream projects, drawn from that population rather than
  selected for convenience.
- **Exclusions.** Cases reported upstream but not independently established here as
  confirmed user-kernel defects are prior art, not part of the initial defect corpus.
- **Licensing.** Every fixture carries its licence and origin metadata; see
  `TASK-FND-009`.

## Comparison

Existing tools are the baseline, at documented versions:

- memory-access tracing and profiling for Triton;
- a CPU-backed sanitizer for Triton;
- static and formal analysis for CUDA, where compatible at the version in question;
- stronger numerical validation baselines;
- correctness-aware autotuners.

Each comparison records the tool version, the platform, the exact command or
configuration used, and what the tool did and did not report. A comparison that
cannot be run for want of a tool is a blocker, not a win.

**A defect class the baseline does not report** counts as an additional supported
defect class only if the defect is independently established as real — otherwise a
higher finding count is just a higher false-positive count.

## Experiments

Every experiment records:

| Field | Why |
|---|---|
| Query and model revision | A newer model may legitimately disagree. |
| Solver version | Solver behaviour is version-sensitive. |
| Seeds and budgets | The sample must be re-derivable without re-running the search. |
| Strategy and strategy revision | Strategies are compared, so they must be identified. |
| Domain, constraints, region derivation | Coverage claims are relative to the domain. |
| Instrumentation | It changes what was explored and measured. |
| Hardware, tool and environment identity | Measurements are meaningless without them. |

## Metrics

| Metric | Definition | Unit |
|---|---|---|
| Defects found | Defect cases where the method produced a witness for the intended defect. | count |
| False positives | Correct controls on which the method produced a violating outcome. | count |
| Experimental cost | Configurations actually executed during an exploration. | count |
| Analysis time | Wall time and solver time to produce a result, budget-capped. | seconds |
| Witness size | Assignments, actors and events in the delivered witness, after minimization. | count |
| Domain coverage | Regions classified established, violated, sampled, unknown, unsupported. | region description, plus a count **only** for an enumerated denominator |
| Explanation quality | Whether the reported cause matches the independently known cause. | categorical |
| Inconclusive rate | Required checks returning unknown or unsupported. | count |

Reported together, never one alone: a method that finds more defects at ten times
the cost, or that finds them by flagging correct controls, is not better.

## Instrumentation caveats

- Instrumented and serialized executions are never presented as unmodified parallel
  hardware behaviour. Some counter-collection workflows serialize dispatches, which
  changes the behaviour being measured; that is recorded with the measurement.
- Absence of a report from a dynamic tool is coverage of the executions that ran,
  not a safety proof.
- CPU interpreter results are numerical and modelling evidence. They are never
  evidence about GPU scheduling or GPU speed, and the interpreter's documented
  dtype and indirect-load limitations are surfaced.
- A timeout is unknown progress. It is neither deadlock nor liveness failure.

## CPU and GPU separation

- CPU-side symbolic and sampling experiments run anywhere and are the basis of the
  feasibility gate.
- GPU experiments require real hardware and run only on user-operated machines under
  explicit consent. Where no device is available, the GPU half of the comparison
  remains explicitly blocked; a blocked experiment never counts as a successful
  comparison, and CPU interpreter timing never stands in for it.
- Hardware cohorts are never pooled across unlike devices to produce one ranking.

## Reproducible commands

The exact commands are supplied by the implementation tasks as they land, and each
experiment records them with its result. The documentation change itself is verified
separately, by the validator described in
[`../contracts/examples.md`](../contracts/examples.md), which establishes internal
consistency and **not** that the application exists.

## Evaluation-only sources and where they are used

These source rows are background or research material. They are not product
promises and they generate no requirement; each one is carried by a named
evaluation or feasibility task instead.

| Source | What it is | Carried by |
|---|---|---|
| `SRC-008` | A real case of reasoning difficulty over overlapping writes in a fused kernel, reported upstream but not established here as a confirmed defect. | `TASK-FEA-001` case corpus, and the exclusion rule under **Corpus** above. |
| `SRC-009` | Autotuning consumed 82 minutes for one input configuration. | `TASK-FEA-005` cost metric. |
| `SRC-039` | TritonParse closely resembles the proposal and already provides a browser interface with regression bisection. | The comparison list under **Comparison** above. |
| `SRC-040` | NVIDIA SuperCollider reports more than 90 races and acknowledges incomplete detection. | The comparison list under **Comparison** above. |
| `SRC-041` | Mutation testing of GPU-kernel checkers found checkers miss defects. | The instrumented-coverage caveat and the false-positive metric under **Metrics**. |
| `SRC-044` | Run existing tools against the same failures before claiming improvement. | `TASK-FEA-004`; the comparison obligation under **Comparison**. |
| `SRC-045` | Earn external validation through upstream reports, independent reproductions and CI adoption. | This document's publication rules; never a product promise. |
| `SRC-046` | Two upstream reports that are not independently established here as confirmed user-kernel defects. | The exclusion rule under **Corpus**; neither enters the initial defect corpus. |
| `SRC-050` | Triton already has symbolic and static analysis tooling, and maintainers are extending it. | The novelty constraint in [`../adr/0012-research-gates-and-compatibility.md`](../adr/0012-research-gates-and-compatibility.md) and the comparison list above. |

The two `superseded` rows (`SRC-015`, the compiler-invariant-preservation
product, and `SRC-018`, the HIP/ROCm and SYCL expansion track) are carried by
[`../adr/0001-product-and-evidence.md`](../adr/0001-product-and-evidence.md) and
the superseded list in
[`../reference/source-disposition.md`](../reference/source-disposition.md). They
generate no requirements, by design.

## Publication of the gate

The feasibility gate publishes:

- the case list with origins and control pairs, or the honest statement that a
  reproducer could not be obtained;
- the comparison tools with exact versions and what each reported;
- the measured metrics above;
- the measured limitations, including cases the method missed;
- an explicit go or no-go.

No invented performance numbers, no adoption projections, no statistical claims
over a corpus this size.
