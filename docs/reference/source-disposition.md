# Source disposition ledger

This is the authority ledger. Every claim drawn from a source the repository
does not track is recorded here once, with a stable `SRC-###` row, so that the
rest of the documentation can be checked against it and remains intelligible
after the untracked inputs are gone.

## Sources

| Source | Form | Role |
|---|---|---|
| `about.md` | untracked note, 777 lines, English | Earliest comprehensive proposal: architecture, evidence classes, tool integration, expansion ladder. |
| `review.md` | untracked note, 347 lines, English | Mid-point assessment that narrowed the product toward concurrency failures tests miss. |
| `final-review.md` | untracked note, 486 lines, English | Later assessment that pivoted toward compiler-invariant preservation. |
| `latest-review.md` | untracked note, 668 lines, Spanish | **Highest precedence.** Replaces the compiler-defect objective with the behaviour-envelope product. |
| `README.md` (tracked, superseded in part) | repository file, 29 lines | Original positioning: Observe/Explore/Verify modes, asyncio/Tokio runtimes. |
| branch `web/mock` | git branch, plain HTML/CSS/JS | Disposable interface maquette. Visual and interaction reference only. |
| `inspo/compiler-explorer` | untracked vendor copy | Architectural comparison and selective BSD-2 reuse reference. Not a specification. |

Where sources conflict, `latest-review.md` wins. Where it is silent, an older
source keeps its force only if the retained claim is compatible with the
selected scope: user-written kernels, backends Triton (first), CUDA C++ and
OpenMP (subsequent required phases).

## Dispositions

`retained` means the claim is a live product requirement and has at least one
`REQ-` in [`../srs/`](../srs/README.md). `superseded` means the claim is
recorded for history and rationale, and does not generate product work.
`evaluation-only` means the claim is a research or competitive consideration,
tracked through [`../evaluation/methodology.md`](../evaluation/methodology.md)
rather than a product guarantee.

### Product identity and scope

| ID | Origin | Claim (English) | Disposition | Reason and owner |
|---|---|---|---|---|
| SRC-001 | `latest-review.md` §11, §"Mi recomendación definitiva" | Pomset is an interactive workbench that answers when a parallel program is correct, when it is fast, and why behaviour changes across workloads and configurations. | retained | The product identity. Owns [`../srs/README.md`](../srs/README.md). |
| SRC-002 | `latest-review.md` §1 | The problem class the developer owns: a kernel can leave output unwritten or produce wrong results through overlapping writes, and the compiler is not at fault. | retained | Kernels the user writes are the subject. Owns `REQ-EXP-*`, `REQ-VAL-*`. |
| SRC-003 | `latest-review.md` §4 | The behaviour envelope: a kernel has no single correctness result or single performance number; behaviour depends on theta = (shape, dtype, layout, launch, hardware). | retained | Central model of the product. Owns [`../srs/domains.md`](../srs/domains.md). |
| SRC-004 | `latest-review.md` §4, table | Every result must state its guarantees; a formally verified region is not equivalent to a region where 100 tests happened to pass; an estimated region is not a measured one. | retained | Evidence discipline. Owns [`../srs/evidence.md`](../srs/evidence.md). |
| SRC-005 | `latest-review.md` §9, first-version table | First version: Triton only; memory accesses and masks over a defined subset; bounds, output coverage and certain conflicts; dimensions/block sizes/launch parameters; symbolic counterexamples where possible; local measurement import; reproducible sharing. | retained | Defines the first delivery phase. Owns [`../delivery/03-triton-engine.md`](../delivery/03-triton-engine.md). |
| SRC-006 | `latest-review.md` §9 | Later expansion to CUDA C++, OpenMP and other parallelism models stays open, without prematurely unifying their semantics. | retained | Phase 2/3 scope with separate semantics. Owns [`../srs/backend-expansion.md`](../srs/backend-expansion.md). |
| SRC-007 | `latest-review.md` §1, "Caso especialmente revelador" | Triton #9230: a kernel that does not write every output element is masked by autotune buffer reuse; maintainers confirmed reuse is intended and the user owns configuration correctness. | retained | The motivating case for the shipped coverage property. Owns `REQ-EXP-002`, `REQ-EXP-003`, `REQ-DOM-005`, `REQ-VAL-006`. The corpus-obtaining obligation is a task in [`../delivery/01-feasibility.md`](../delivery/01-feasibility.md). |
| SRC-008 | `latest-review.md` §2 | Triton #10743: overlapping writes when combining RMSNorm and RoPE; the issue is open and is not a confirmed compiler defect. | evaluation-only | Real reasoning difficulty over fused access. Not a confirmed defect, explicitly excluded from the initial defect corpus. |
| SRC-009 | `latest-review.md` §1, §3 | Triton #9401: autotuning consumed 82 minutes for one input configuration. | evaluation-only | Cost evidence for the exploration motivation. Owns experimentation cost metric in methodology. |
| SRC-010 | `latest-review.md` §3 | KernelBench-X reports 46.6% of correct kernels slower than the PyTorch eager baseline and up to 21.4x speedup variation across hardware, within that benchmark only. | retained | The benchmark-specific figures (46.6% slower than eager; up to 21.4x variation across hardware) ground the cohort-separation and no-latency-only-diagnosis rules. Not population statistics. Owns `REQ-DOM-011`, `REQ-PERF-008`, `REQ-PERF-009`. |
| SRC-011 | `README.md` (tracked) | The unit of work is a versioned project, a test scenario and a set of profiles, with jobs, results and publication. | retained | Preserved unchanged. Owns [`../srs/projects.md`](../srs/projects.md). |
| SRC-012 | `README.md` (tracked) | Invariants: running leaves the project unpublished; compiling leaves it unexecuted; a finished job proves nothing about correctness; reopening evidence returns the old sample; editing source leaves historical results untouched. | retained | Binding rules. Owned by `REQ-PRJ-*` and `REQ-EVD-*`. |
| SRC-013 | `README.md` (tracked) | Three modes Observe/Explore/Verify, and the runtimes asyncio and Tokio. | superseded | Replaced by experiences Explore/Validate/Optimize and by the selected backends. Rationale in [`../adr/0001-product-and-evidence.md`](../adr/0001-product-and-evidence.md). |
| SRC-014 | `README.md` (tracked) | Licence: Apache-2.0 with selective BSD-2-Clause notices for reused Compiler Explorer code. | retained | Licence split unchanged. Owns [`compiler-explorer.md`](compiler-explorer.md). |
| SRC-015 | `final-review.md` §6 | Pomset as a detector of concurrency invariants broken by compiler transformations, analysing two successive compiler representations. | superseded | Explicitly not a second product objective. Recorded in [`../adr/0001-product-and-evidence.md`](../adr/0001-product-and-evidence.md). |
| SRC-016 | `review.md` §3 | Pomset as a finder and explainer of concurrency failures that ordinary tests miss. | retained | Compatible with, and subsumed by, the behaviour-envelope product. Owns `REQ-VAL-*`. |
| SRC-017 | `about.md` §7 stage 4 | A phase dedicated to GenMC, Rust scheduling and additional memory models. | superseded | Outside the selected language scope; the useful diagnostic category survives only as a backend-qualified capability. Owns `REQ-BCK-*`. |
| SRC-018 | `about.md` §7 stage 5 | HIP/ROCm, SYCL and other accelerator or asynchronous runtimes as expansion targets. | superseded | Not selected delivery phases. |
| SRC-019 | `about.md` §4 | A shared causal representation across backends that preserves backend-specific memory semantics rather than asserting a universal execution model. | retained | Constrains the evidence model. Owns `REQ-EVD-*` on qualified partial orders. |
| SRC-020 | `about.md` §9 | Do not claim novelty; parameterised verification, directed test generation and autotuning all have precedent. | retained | Constrains every public claim. Owns [`../evaluation/methodology.md`](../evaluation/methodology.md). |

### Evidence, findings and explanation

| ID | Origin | Claim (English) | Disposition | Reason and owner |
|---|---|---|---|---|
| SRC-021 | `about.md` §6, "Evidence classification is essential" | Six evidence classes: observed, counterexample, potential, verified-under-assumptions, measured, estimated. | retained | Became `REQ-EVD-*`. Owned by [`../srs/evidence.md`](../srs/evidence.md). |
| SRC-022 | `about.md` §6 | A dynamic sanitizer finding no error does not prove race-freedom; a bounded model check is bounded; CPU interpretation of a Triton kernel is not GPU timing. | retained | Owns the explicit-limitation requirements. |
| SRC-023 | `about.md` §6, analysis model table | A finding links source location, execution agent, operation, memory region, address, scope, ordering, provenance and evidence class. | retained | Field list became the contract types. Owned by [`packages/contracts/schema/evidence.schema.yaml`](../../packages/contracts/schema/evidence.schema.yaml). |
| SRC-024 | `about.md` §4 | Backend semantics stay attached to records, so two analyzers' "data races" are not assumed equivalent. | retained | Owns backend-qualified diagnostic categories. |
| SRC-025 | `about.md` §3.2 | A logical race under a mutex: race-free but schedule-dependent final value. | retained | Owns the `synchronizationOrdering` property. |
| SRC-026 | `about.md` §3.3, §6 | Timeout alone is unknown progress, never proof of deadlock or liveness failure. | retained | Owns the liveness/timeout requirement. |
| SRC-027 | `about.md` §6 | Profilers perturb behaviour; AMD Compute Profiler serializes dispatches during counter collection; an instrumented execution must never be presented as unmodified parallel hardware behaviour. | retained | Owns measurement qualification. |
| SRC-028 | `about.md` §8 | Three research directions: portable causal explanations, minimal counterexamples, correctness-aware performance analysis. | retained | Witness minimization is a shipped requirement, not a research aspiration. Owns `REQ-EXP-005`, `REQ-EXP-007`, `REQ-VAL-007`. |

### Architecture, platform and deployment

| ID | Origin | Claim (English) | Disposition | Reason and owner |
|---|---|---|---|---|
| SRC-029 | `about.md` §6 | Do not write a new compiler, CUDA emulator or universal race detector; integrate existing engines behind adapters and a normalised model. | retained | Owns [`../adr/0009-backend-semantics.md`](../adr/0009-backend-semantics.md). |
| SRC-030 | `about.md` §6, infrastructure | Separate static/compile, interpreted/instrumented and real-GPU workloads; GPU workers need stronger isolation, quotas and scheduling. | retained | Owns [`../adr/0007-sandbox-and-local-runners.md`](../adr/0007-sandbox-and-local-runners.md). |
| SRC-031 | `about.md` §6 | An experiment retains source files, tool and runtime versions, launch parameters, input definitions, requested analyses and hardware requirements, and distinguishes hardware execution from interpretation and static analysis. | retained | Owns `REQ-PRJ-*` and `REQ-PLT-*`. |
| SRC-032 | `about.md` §7 | Demonstrate with three examples: an inter-block write race with correction, a missing synchronization barrier, and a correct-but-slow kernel measured on hardware. | retained | Owns the three flagship acceptance demonstrations. |
| SRC-033 | `latest-review.md` §8 | A local and CI tool so proprietary source need not be uploaded; a team with many kernels validates on every change. | retained | Owns [`../srs/local-ci.md`](../srs/local-ci.md). |
| SRC-034 | `latest-review.md` §8 | Do not make the project depend on owning GPU infrastructure; CPU-side static and symbolic analysis is central, real measurements come from local or user-provided GPUs. | retained | Owns `REQ-PLT-*` on capacity and `REQ-SEC-*` on no hosted GPU. |
| SRC-035 | `latest-review.md` §9 | Before building the full web product, run a feasibility check on known-defect kernels plus correct controls and compare against existing tools; if no clear improvement appears, do not build on that basis. | retained | Owns the research gate in [`../delivery/README.md`](../delivery/README.md). |
| SRC-036 | `about.md` §4 | Four workbench areas: source and configuration, findings, execution exploration, comparison; selecting a finding highlights source lines, actors, address and events together. | retained | Owns [`../srs/workbench.md`](../srs/workbench.md). |
| SRC-037 | `about.md` §6 | A shared Pomset link must preserve enough information to rerun the experiment on a compatible backend and identify differences in tools or hardware. | retained | Owns [`../srs/sharing.md`](../srs/sharing.md). |
| SRC-038 | `about.md` §5 | Public free tier without expensive GPU cost for every interaction; quotas and scheduling. | retained | Owns `REQ-PLT-*` quotas. Measured capacity targets only. |
| SRC-039 | `final-review.md` §4, TritonParse | TritonParse closely resembles the proposal; the space is receiving significant research attention. | evaluation-only | Competitive context. Owns the comparison in [`analysis-tool-landscape.md`](analysis-tool-landscape.md). |
| SRC-040 | `final-review.md` §4.4 | NVIDIA SuperCollider, PLDI 2026, scalable CUDA race detection, reported over 90 races; incomplete detection acknowledged. | evaluation-only | Research candidate, not a chosen integration. |
| SRC-041 | `final-review.md` §4.2 | "Measuring the Checker": mutation testing of GPU-kernel verification; checkers miss defects. | evaluation-only | Motivates sampling honesty, not a product feature. |
| SRC-042 | `final-review.md` §4.1 | KernelBench-Verified: stronger numerical correctness testing against references. | retained | Grounds declared tolerances and the no-sampling-promotion rule. Owns `REQ-VAL-005`, `REQ-DOM-009`. |
| SRC-043 | `review.md` §6 | Validate with 15-20 real debugging incidents before building an ambitious platform, and make experiments reproducible from their recorded seeds, budgets and revisions. | retained | The reproducibility discipline it states underpins `REQ-DOM-013`, `REQ-EXP-008`, `REQ-EXP-009`, `REQ-EXP-012`, `REQ-VAL-007`, `REQ-CLI-012` and `REQ-PLT-011`; the corpus-size obligation is carried by [`../evaluation/methodology.md`](../evaluation/methodology.md). |
| SRC-044 | `review.md` §6 | Try to defeat the idea: run existing tools against the same failures before claiming improvement. | evaluation-only | An obligation on the feasibility comparison, enforced by the gate and the methodology, not by a product requirement. |
| SRC-045 | `review.md` §6 | Earn external validation: upstream reports, independent reproductions, maintainer recommendation, CI adoption. | evaluation-only | Adoption evidence, not a promise. |
| SRC-046 | `latest-review.md` §2 | #10924 and #11153 are prior-art examples, not independently established here as confirmed user-kernel defects. | evaluation-only | Excluded from the initial defect corpus. Rationale recorded in [`analysis-tool-landscape.md`](analysis-tool-landscape.md). |
| SRC-047 | `about.md` §7 | Build the three demonstrations as reproducible shareable experiments, not hardcoded educational animations. | retained | Owns the acceptance requirement that demonstrations are real. |
| SRC-048 | `about.md` §2.4 | Do not claim superior low-level vendor profiling; do not compete on GPU count. | retained | Constrains positioning and the Optimize scope. |
| SRC-049 | `latest-review.md` §5 | The competitive risk is real: TileLens, Compute Sanitizer, Nsight, Kernel Tuner/Helion, KernelBench-Verified each already cover part of the space. | retained | Grounds the interpreter-is-not-GPU evidence rule. Owns `REQ-BCK-010`. |
| SRC-050 | `latest-review.md` §1 | Triton has symbolic/static analysis tooling and maintainers are working on more; do not present Pomset as the first such system. | evaluation-only | Constrains novelty claims. |
| SRC-051 | `about.md` §4, "Why the pomset abstraction actually matters" | Partial orders preserve required dependencies without inventing an order between independent events, and partial-order reduction avoids redundant schedules. | retained | Owns the causal partial-order requirement. |
| SRC-052 | `about.md` §6 | Compilation time must be separated from kernel execution time; hardware, compiler versions, warm-up, utilisation and variance recorded. | retained | Owns [`../srs/performance.md`](../srs/performance.md). |
| SRC-053 | `about.md` §6 | The interface must connect evidence across views rather than displaying independent dashboards. | retained | Owns the linked-selection requirement. |
| SRC-054 | `latest-review.md` §4 | A verified region is not equal to a tested region, and an estimated region is not a measured one; this must be visible in the product. | retained | Owns the UI status requirements. |
| SRC-055 | `latest-review.md` §1, §7 | Explanations of performance change must rest on real metrics, resource models or compilation evidence, not merely on runtime differences. | retained | Owns the no-latency-only-causal-diagnosis requirement. |

## Superseded directions, stated once

1. **Observe / Explore / Verify as the product navigation.** Replaced by
   Explore / Validate / Optimize, with execution mechanisms kept in a separate
   vocabulary.
2. **asyncio and Tokio runtimes.** Out of scope; the selected language scope is
   Triton, CUDA C++ and OpenMP.
3. **Compiler-invariant-preservation as the primary product.** `final-review.md`
   §6 and the `review.md`/`final-review.md` compiler-pass direction are
   superseded. The retained kernel-only product keeps their evaluation
   discipline.
4. **HIP/ROCm, SYCL and a universal memory model.** Recorded as expansion
   candidates at most; no delivery obligation, and no unified semantics.
5. **GenMC/Rust controlled-scheduling phase as an early milestone.** The
   capability survives only as a backend-qualified diagnostic category owned by
   the native-backend phases.
6. **A browser GPU playground and competing on available GPU count.** Explicitly
   rejected as differentiation.

## Evaluation-only material, stated once

Academic deadlines, adoption projections, novelty claims, vendor-defect
research, the Triton issues that are not confirmed user-kernel defects, and all
market-share statements are background. They justify the product's existence
and shape its experiments; they are not product promises, and no requirement
cites them.
