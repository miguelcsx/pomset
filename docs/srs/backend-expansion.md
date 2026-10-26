# Backend expansion — `BCK`

Triton first, then CUDA C++ and OpenMP. All three are required delivery phases.
Sources: `SRC-005`, `SRC-006`, `SRC-017`, `SRC-024`, `SRC-029`.

Each backend gets its own semantics, its own tool probes and its own conformance
corpus. Shared contracts do not imply shared semantics.

### REQ-BCK-001  Triton is the first delivery phase

**Statement.** Pomset SHALL deliver the Triton backend first, covering symbolic
bounds, output coverage and non-atomic write/write conflict analysis over the
supported kernel subset, before CUDA C++ or OpenMP work begins.

**Rationale.** `SRC-005`. A structured programming model with real cases to
evaluate, and no compiler to write.

**Acceptance.** `ACC-001`, `ACC-002`, `ACC-003`.

**Scope.** Triton analysis runs on CPU; no GPU is required for the symbolic phase.

**Implemented by.** `TASK-TRI-001`, `TASK-TRI-002`, `TASK-TRI-003`, `TASK-TRI-004`, `TASK-TRI-005`, `TASK-TRI-006`, `TASK-TRI-007`, `TASK-TRI-008`, `TASK-TRI-009`, `TASK-TRI-010`, `TASK-TRI-011`, `TASK-TRI-012`, `TASK-TRI-013`, `TASK-TRI-014`, `TASK-TRI-015`, `TASK-TRI-016`, `TASK-TRI-017`, `TASK-FEA-003`.

**ADRs.** [ADR-0009](../adr/0009-backend-semantics.md), [ADR-0012](../adr/0012-research-gates-and-compatibility.md)  Specification: [`../architecture/native-backends.md`](../architecture/native-backends.md).

**Contracts.** [`../architecture/triton-engine.md`](../architecture/triton-engine.md).

### REQ-BCK-002  CUDA C++ is a required later phase

**Statement.** Pomset SHALL deliver a CUDA C++ backend covering compilation and PTX
inspection, numerical validation, Compute Sanitizer diagnostics, race and
synchronization evidence, and Nsight measurement imports.

**Rationale.** `SRC-006`. Native tooling is the honest source of CUDA evidence.

**Acceptance.** `ACC-009`.

**Scope.** No universal symbolic CUDA verification is promised. Unsupported
constructs are named.

**Implemented by.** `TASK-CUDA-001`, `TASK-CUDA-002`, `TASK-CUDA-003`, `TASK-CUDA-004`, `TASK-CUDA-005`, `TASK-CUDA-006`, `TASK-CUDA-007`, `TASK-CUDA-008`, `TASK-CUDA-009`.

**ADRs.** [ADR-0009](../adr/0009-backend-semantics.md), [ADR-0012](../adr/0012-research-gates-and-compatibility.md)  Specification: [`../architecture/native-backends.md`](../architecture/native-backends.md).

**Contracts.** [`../architecture/native-backends.md`](../architecture/native-backends.md).

### REQ-BCK-003  OpenMP is a required later phase

**Statement.** Pomset SHALL deliver an OpenMP backend covering compiler and toolchain
probing, local CPU execution, a numerical reference runner, ThreadSanitizer with
Archer where compatible, and thread, barrier, deadlock and atomic-ordering evidence
with its limitations stated.

**Rationale.** `SRC-006`, `SRC-031`. Accessible CPU concurrency analysis is a
recurring need from the earliest source. `SRC-017` is superseded and contributes
nothing here.

**Acceptance.** `ACC-009`.

**Scope.** Instrumentation changes timing and coverage; that is recorded, not
hidden.

**Implemented by.** `TASK-OMP-001`, `TASK-OMP-002`, `TASK-OMP-003`, `TASK-OMP-004`, `TASK-OMP-005`, `TASK-OMP-006`.

**ADRs.** [ADR-0009](../adr/0009-backend-semantics.md), [ADR-0012](../adr/0012-research-gates-and-compatibility.md)  Specification: [`../architecture/native-backends.md`](../architecture/native-backends.md).

**Contracts.** [`../architecture/native-backends.md`](../architecture/native-backends.md).

### REQ-BCK-004  Per-tool capability matrix, pinned and probed

**Statement.** Every backend SHALL declare a capability matrix naming each supported
tool, its exact version, its platform and the support level for each feature, and a
combination SHALL be labelled `validated` only after the backend's conformance
fixtures pass in that exact combination.

**Rationale.** `SRC-031`, `SRC-035`. Version-sensitive tool behaviour cannot be
assumed.

**Acceptance.** `ACC-009`.

**Scope.** A newer tool version is a new capability entry, not an inherited claim.

**Implemented by.** `TASK-FND-008`, `TASK-CUDA-001`, `TASK-OMP-001`.

**ADRs.** [ADR-0009](../adr/0009-backend-semantics.md), [ADR-0012](../adr/0012-research-gates-and-compatibility.md)  Specification: [`../architecture/native-backends.md`](../architecture/native-backends.md).

**Contracts.** `Capability`, `ProfileRevision`.

### REQ-BCK-005  Real diagnostics from real tools

**Statement.** Each backend SHALL obtain its diagnostics by invoking the pinned
external tool and normalising its genuine output, and SHALL distinguish observed
dynamic diagnostics from static analysis and from measurement.

**Rationale.** `SRC-029`, `SRC-021`. The product's value rests on real evidence.

**Acceptance.** `ACC-009`.

**Scope.** A backend whose tools are unavailable reports the blocker instead of an
empty success.

**Implemented by.** `TASK-CUDA-005`, `TASK-OMP-004`, `TASK-PRS-002`.

**ADRs.** [ADR-0009](../adr/0009-backend-semantics.md), [ADR-0012](../adr/0012-research-gates-and-compatibility.md)  Specification: [`../architecture/native-backends.md`](../architecture/native-backends.md).

**Contracts.** `Finding.provenance`.

### REQ-BCK-006  Compiler and profiler artifacts are first-class records

**Statement.** A backend SHALL record compilation artifacts, source maps and
profiler exports as artifacts with their producing profile revision and mapping
confidence, and SHALL make them retrievable from the finding that cites them.

**Rationale.** `SRC-031`, `SRC-048`.

**Acceptance.** `ACC-009`, `ACC-010`.

**Scope.** Artifact extraction is distinct from behaviour analysis and from
execution.

**Implemented by.** `TASK-CUDA-003`, `TASK-CUDA-008`, `TASK-TRI-013`.

**ADRs.** [ADR-0009](../adr/0009-backend-semantics.md), [ADR-0012](../adr/0012-research-gates-and-compatibility.md)  Specification: [`../architecture/native-backends.md`](../architecture/native-backends.md).

**Contracts.** `ArtifactManifest`, `SourceRange.confidence`.

### REQ-BCK-007  Backend-specific ordering, atomic and synchronization models

**Statement.** Each backend SHALL declare the ordering, atomicity, scope and
synchronization semantics it models, and Pomset SHALL NOT present a property result
from one backend's model as if it held under another's.

**Rationale.** `SRC-024`, `SRC-019`. GPU scopes, fences and barriers are not C++
atomics, and neither is Triton's model.

**Acceptance.** `ACC-009`.

**Scope.** There is no universal memory model in this product.

**Implemented by.** `TASK-CUDA-007`, `TASK-OMP-005`, `TASK-FND-006`.

**ADRs.** [ADR-0009](../adr/0009-backend-semantics.md), [ADR-0012](../adr/0012-research-gates-and-compatibility.md)  Specification: [`../architecture/native-backends.md`](../architecture/native-backends.md).

**Contracts.** `Assumptions.model`, `Finding.backendId`.

### REQ-BCK-008  Feature-by-feature expansion with independent conformance

**Statement.** Each unsupported feature family — Triton dynamic control flow,
data-dependent addressing, atomics, reductions and dot products — SHALL receive its
own supported-model definition, extraction work, query work and independent
conformance fixtures before support is enabled for it.

**Rationale.** `SRC-029`. A guessed semantics produces a confident wrong answer.

**Acceptance.** `ACC-009`.

**Scope.** Until then, the family remains explicitly unsupported with a named
reason.

**Implemented by.** `TASK-TRX-001`, `TASK-TRX-002`, `TASK-TRX-003`, `TASK-TRX-004`, `TASK-TRX-005`.

**ADRs.** [ADR-0009](../adr/0009-backend-semantics.md), [ADR-0012](../adr/0012-research-gates-and-compatibility.md)  Specification: [`../architecture/native-backends.md`](../architecture/native-backends.md).

**Contracts.** `Capability.support`.

### REQ-BCK-009  The missing-barrier demonstration belongs to the native phases

**Statement.** The missing-synchronization demonstration, in which one thread
consumes data before another has made it visible, SHALL be demonstrated through the
CUDA or OpenMP backend with its real tooling, and SHALL NOT be claimed as an initial
Triton symbolic capability.

**Rationale.** `SRC-032`, `SRC-005`. The initial Triton conflict query covers
non-atomic write/write only.

**Acceptance.** `ACC-009`, `ACC-010`.

**Scope.** Triton may report the case as unsupported with a reason.

**Implemented by.** `TASK-CUDA-006`, `TASK-OMP-005`.

**ADRs.** [ADR-0009](../adr/0009-backend-semantics.md)  Specification: [`../architecture/native-backends.md`](../architecture/native-backends.md).

**Contracts.** —

### REQ-BCK-010  Interpreter replay is not GPU behaviour

**Statement.** CPU interpreter replay of a Triton kernel SHALL be labelled as a
numerical and modelling mechanism, SHALL NOT be presented as evidence of GPU
scheduling, race freedom or GPU performance, and SHALL be accompanied by the
documented limitations of the interpreter.

**Rationale.** `SRC-022`, `SRC-049`.

**Acceptance.** `ACC-001`, `ACC-006`.

**Scope.** Includes numeric dtype behaviour such as bfloat16 and any documented
indirect-load limitation.

**Implemented by.** `TASK-TRI-016`.

**ADRs.** [ADR-0009](../adr/0009-backend-semantics.md), [ADR-0012](../adr/0012-research-gates-and-compatibility.md)  Specification: [`../architecture/native-backends.md`](../architecture/native-backends.md).

**Contracts.** `Witness.replay`, `Measurement.evidenceClass`.

### REQ-BCK-011  Unsupported is never emulated

**Statement.** Where a backend cannot analyse or execute something, Pomset SHALL
report the unsupported or unavailable condition, and SHALL NOT emulate the missing
capability, approximate it with a different tool, or silently narrow the analysis.

**Rationale.** `SRC-029`. This is the difference between a tool a user can trust and
a tool that guesses.

**Acceptance.** `ACC-002`, `ACC-009`.

**Scope.** Applies across all three backends and to the CLI, API and workbench.

**Implemented by.** `TASK-FND-008`, `TASK-WEB-010`.

**ADRs.** [ADR-0009](../adr/0009-backend-semantics.md), [ADR-0012](../adr/0012-research-gates-and-compatibility.md)  Specification: [`../architecture/native-backends.md`](../architecture/native-backends.md).

**Contracts.** `Capability`, `PropertyResult.unsupportedReason`.

### REQ-BCK-012  Cross-backend comparison is of evidence, not of semantics

**Statement.** When Pomset shows results from different backends together, it SHALL
present them as separate evidence about the same kernel with their own semantics and
qualifiers, and SHALL NOT rank or merge them into one verdict.

**Rationale.** `SRC-019`, `SRC-024`.

**Acceptance.** `ACC-010`.

**Scope.** The comparison lanes are per profile revision, not per universal notion
of correctness.

**Implemented by.** `TASK-WEB-006`, `TASK-FND-006`.

**ADRs.** [ADR-0009](../adr/0009-backend-semantics.md), [ADR-0012](../adr/0012-research-gates-and-compatibility.md)  Specification: [`../architecture/native-backends.md`](../architecture/native-backends.md).

**Contracts.** `Finding.backendId`, `Capability`.
