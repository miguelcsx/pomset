# Analysis tool landscape

Every tool named in the source inputs, with the role it plays *here*. A tool
appearing in this table is not an integration requirement. The roles are:

- **chosen integration** — Pomset plans to drive it and normalise its output.
- **feasibility comparison** — Pomset must be compared against it before
  claiming an improvement.
- **historical context** — explains why a direction was dropped.
- **unvalidated candidate** — interesting, but no support claim exists and none
  will exist until a probe passes.

Support levels are `validated`, `limited`, `untested` and are assigned only
after the conformance fixtures in
[`../evaluation/acceptance.md`](../evaluation/acceptance.md) pass. Nothing in
this document is a support claim.

## Chosen integrations

| Tool | Backend | Role | What Pomset takes from it | Owning phase |
|---|---|---|---|---|
| Clang ThreadSanitizer | C/C++ threads (later OpenMP) | chosen integration | Dynamic race reports with source locations, normalised into `raceFreedom` evidence classified `observed`. Absence of a report is coverage, never proof. | [`../delivery/09-openmp-and-advanced-triton.md`](../delivery/09-openmp-and-advanced-triton.md) |
| Archer | OpenMP | chosen integration | OpenMP-aware TSan instrumentation; same evidence class as TSan. | OpenMP phase |
| NVIDIA Compute Sanitizer | CUDA C++ | chosen integration | Memory-error, initialization and synchronization diagnostics as `observed` or `potential` evidence depending on the check. Documented racecheck coverage is limited to on-chip shared memory, so global-memory conflict claims are not built on it. | [`../delivery/08-cuda.md`](../delivery/08-cuda.md) |
| Nsight Compute / Nsight Systems | CUDA C++ | chosen integration | Hardware metrics and system traces imported as `measured` data with tool, version and collection-method qualifiers. Instrumentation effects are recorded. | CUDA phase |
| Perfetto-compatible export | all | chosen integration | Timeline inspection **only** for event data that is genuinely ordered. Export exists so a user can leave with their data; it is not a rendering dependency. | [`../delivery/07-performance-and-sharing.md`](../delivery/07-performance-and-sharing.md) |
| Z3 (SMT solver) | Triton | chosen integration | Satisfiability over the extracted address/mask model. `unsat` establishes a property over the declared model and domain only; budget exhaustion is `unknown`. | [`../delivery/03-triton-engine.md`](../delivery/03-triton-engine.md) |

## Feasibility comparisons (baselines the product must be measured against)

| Tool | Why it is the comparison | What a Pomset claim must beat |
|---|---|---|
| TileLens | Traces and visualises Triton/NKI tile memory accesses and profiling. Its race command captures symbolic accesses. | Pomset must show a *decision* (established/violated/unknown over a declared domain) not just a trace, or a smaller/clearer witness, or a lower analysis cost. |
| TritonSan | Uses CPU/LLVM sanitizers plus a CPU reference backend for Triton race analysis. | Pomset must not sell "no GPU needed" as its own novelty; it must show a difference in what is concluded, not only in where it runs. |
| Triton interpreter | Sequential CPU/NumPy program-instance execution, documented as not modelling GPU scheduling or performance, with BF16 and indirect-load limitations. | Comparison baseline for numerical replay. Replay results are never presented as GPU scheduling evidence or as GPU speed. |
| KernelBench-Verified | Stronger numerical checks and more realistic baselines for generated kernels. | Pomset's numerical validation must add something (domain qualification, coverage, provenance) beyond more inputs and tighter tolerances. |
| Kernel Tuner, Helion | Correctness checking during autotuning plus search strategies. | "Correctness plus tuning" is not novel. The gap must be the explanation of *where behaviour changes*, not the combination. |
| GPUVerify, Faial | Static/formal GPU analysis for race and divergence properties. | Where compatible, they are the static baseline for CUDA claims. GPUVerify's latest published GitHub release dates from 2018, so compatibility is evaluated before any dependence. |
| GenMC, herd7/Dat3M | Model checking and memory-model exploration for C/C++. | Baseline for ordering and liveness categories. Out of the initial backend scope; only a backend-qualified capability if ever added. |
| Loom, Shuttle | Controlled concurrency exploration for Rust. | Historical baseline: superseded as a delivery phase with the rest of the Rust track. |
| Compute Sanitizer racecheck | The closest CUDA race check a user already has. | Pomset must not re-claim what racecheck already covers on shared memory. |

## Historical context (why directions were dropped)

| Item | Context |
|---|---|
| Browser GPU playground (LeetGPU, GPU MODE/KernelBot) | Already mature; rejected as differentiation. Pomset does not compete on available GPU count. |
| TritonParse | Browser interface, source-to-IR correlation, comparisons, reproducer extraction, automated regression bisection across Triton/LLVM/PyTorch. It invalidates a "find the compiler version that broke it" product. |
| RESOLVE | Testing, concurrency reduction and formal analysis for GPU kernels (reported October 2026; a preprint whose results are **not** independently reproduced here). Overlaps the general "verifier plus reduction" framing. |
| PyTorch DebugMode, Flight Recorder | Numerical divergence hunting and distributed-timeout diagnosis already exist; distributed training was evaluated and dropped as an entry point. |
| Intra-Kernel Profiler, Op-Gym, AMD ROCm tooling, Intel VTune/Inspector, Microsoft Concurrency Visualizer, SASS/PTX inspection | Vendor and research tooling already covers low-level profiling and visualisation. Pomset does not claim superiority there. |
| LLVM, MLIR, PTX inspection | Useful as *artifact* views correlated with source. Compiler-internals investigation is a superseded product track. |

## Unvalidated candidates

| Item | Status |
|---|---|
| NVIDIA SuperCollider | PLDI 2026 race detection over several GPU memory spaces; its authors report more than 90 races and explicitly acknowledge incomplete detection. That figure is the authors' reported result, not measured here. Research candidate; no integration until a probe exists. |
| MAccConc | Interactive exploration of concurrency failures over Linux-kernel access recording, with GUI constraints on execution order. Reference for interaction ideas only; its instrumentation-specific scope is not a model for the kernel backends. |
| HGRD | Uses host launch information to distinguish feasible races from theoretical warnings. The published results are research claims, not independently validated here. |
| TritonSan | Listed above as a comparison; its exact supported subset is unverified here, so it is not yet a chosen integration. |
| GPUVerify | Compatibility (dependencies, supported CUDA versions) is a probe, not an assumption. |
| Triton #10924, #11153 | Prior-art examples only. Neither is independently established here as a confirmed user-kernel defect, and neither is in the initial user-kernel defect corpus. #10924 was closed as not planned. |

## Diagnostic categories that survive from the older sources

Backend-qualified, never universal:

| Category | Survives as | Does not survive as |
|---|---|---|
| Data race | A property of a modelled execution under a named memory model. | A universal notion shared by every backend. |
| Logical / schedule-dependent conflict | `synchronizationOrdering`, requiring a specified order. | A race the sanitizer "should have caught". |
| Deadlock | A backend capability on instrumented native tools. | A conclusion drawn from a timeout. |
| Liveness failure | A liveness property with a stated model and schedule assumption. | An inference from "the wait was long". |
| Memory-ordering / visibility defect | Scope-qualified ordering evidence. | A single global ordering story across CUDA, C++ and Triton. |

**Timeout alone is unknown progress.** It is never reported as deadlock or as a
liveness failure.
