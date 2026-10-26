# Native backends

CUDA C++ and OpenMP. Both are required delivery phases, both are later than
Triton, and neither inherits Triton's semantics. Requirements:
[`../srs/backend-expansion.md`](../srs/backend-expansion.md). Decision:
[`../adr/0009-backend-semantics.md`](../adr/0009-backend-semantics.md).

## The invariant that governs both

**Nothing is advertised until its fixtures pass.** Every tool/version/platform
combination is a probe with a recorded outcome and an immutable capability entry.
A version mentioned in a reference implementation is a candidate, not a support
claim. Where a tool cannot run inside the deployment's sandbox, the hosted
capability is unavailable and local mode is the honest alternative.

## CUDA C++

### Toolchain and artifacts

Compilation produces PTX and cubin artifacts, source maps where the toolchain
provides them, and the compiler log. Compiling **never** executes the program,
and a compilation result is recorded as an artifact, not as behaviour evidence.
Source-to-PTX correspondence carries a mapping confidence of `exact`,
`approximate` or `unavailable`, and an approximate mapping is never rendered as
exact.

### Diagnostics

| Evidence | Tool | Recorded as |
|---|---|---|
| Memory errors, initialization, synchronization | NVIDIA Compute Sanitizer | `observed` where a check fired, `potential` where the check reports a candidate |
| Numerical agreement with the reference | The local numerical runner | A comparison, not a race verdict |
| Race and missing-barrier behaviour | Compute Sanitizer plus the conformance corpus | `observed` coverage, never race freedom |
| Hardware metrics | Nsight Compute, Nsight Systems | `measured`, with instrumentation effects declared |

Compute Sanitizer's racecheck documents coverage of on-chip shared memory rather
than general global-memory race coverage. Pomset therefore does not build a
global-memory conflict claim on it. Where a documented limitation applies, the
limitation is surfaced, not cast around.

A run that reports no error is **observed coverage of that run**. It is never
presented as a proof of race freedom or of memory safety.

### Semantics declaration

The CUDA backend declares the ordering, atomicity, scope and synchronization
semantics it models — streams, blocks, warps, atomic scopes and fences — and a
finding carries them. There is no universal memory model in this product, so a
property established under one backend's model is not displayed as though it held
under another's.

### Hardware

GPU work runs only on user-operated machines under explicit per-run consent.
There is no hosted GPU pool and no web-to-local execution. When no device or
tool is present, the affected check is a **documented blocker** — never an
executed check, never a fabricated result.

## OpenMP

### Toolchain

Compiler and toolchain versions are probed and pinned, with an immutable
capability entry per combination. Local CPU execution and a numerical reference
runner provide the correctness baseline.

### Race evidence

Clang ThreadSanitizer plus Archer, where compatible, supplies OpenMP-aware race
reports. What they mean:

- A report is a finding with source locations, classified `observed`.
- Absence of a report is coverage of the executions that ran.
- Instrumentation changes timing and therefore changes what was explored;
  that is recorded, not hidden.

### Thread, barrier and deadlock evidence

Thread, task, barrier, deadlock and atomic-ordering evidence is produced with its
limitations stated. The missing-barrier demonstration — one thread consuming data
before another has made it visible — belongs **here**, in a native backend with
real tooling, not to the initial Triton symbolic capability.

**A timeout is unknown progress.** It is never reported as a deadlock or as a
liveness failure. Blocking forever and waiting a long time are not
distinguishable by a clock.

### Semantics

The OpenMP backend declares the atomicity, ordering and barrier semantics it
models, separately from CUDA and Triton. Cross-backend comparison is a comparison
of **evidence**, not of semantics; results from different backends appear side by
side with their own qualifiers and are never merged into one verdict.

## Conformance corpus

Each backend ships fixtures under `fixtures/kernels` with declared outcomes:

- a bounds violation and its correct control;
- an overlapping-write conflict and its non-overlapping control;
- a missing-synchronization case and its correct control;
- a correct-but-slow kernel, for the performance demonstrations.

A fixture declares what the tool can and cannot observe. An instrumented clean run
on a correct control is recorded as coverage, and the absence of a report on a
defective fixture is recorded as a miss — the corpus exists to make such misses
visible rather than to hide them.

## Extension rule

Later feature families — Triton dynamic control flow, indirect loads, reductions,
dot products, atomics, and further CUDA and OpenMP features — each receive:

1. a supported-model definition;
2. extraction work;
3. query or instrumentation work;
4. independent conformance fixtures.

Only after all four does the capability become available. Until then the family
is explicitly `unsupported` with a named reason. Full functional verification of
arbitrary kernels is not offered by any backend.
