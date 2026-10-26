# Evidence, findings and coverage — `EVD`

What a result is allowed to claim is the whole product. Sources: `SRC-004`,
`SRC-021`, `SRC-022`, `SRC-023`, `SRC-024`, `SRC-026`, `SRC-051`.

### REQ-EVD-001  Six evidence classes

**Statement.** Every finding and every property result SHALL carry exactly one
evidence class from: `observed`, `counterexample`, `potential`,
`verified-under-assumptions`, `measured`, `estimated`.

**Rationale.** `SRC-021`, `SRC-004`. The class is the difference between a
trace of one run and a statement about all runs.

**Acceptance.** `ACC-002`, `ACC-006`.

**Scope.** Applies to imported evidence too; an import never gains a class it
did not have.

**Implemented by.** `TASK-FND-006`, `TASK-TRI-009`.

**ADRs.** [ADR-0001](../adr/0001-product-and-evidence.md), [ADR-0009](../adr/0009-backend-semantics.md)  Specification: [`../architecture/lifecycle.md`](../architecture/lifecycle.md).

**Contracts.** `evidenceClass` in [`packages/contracts/schema/evidence.schema.yaml`](../../packages/contracts/schema/evidence.schema.yaml).

### REQ-EVD-002  Absence of a dynamic error is not proof

**Statement.** An instrumented run that reports no error SHALL be presented as
observed coverage of that run, and SHALL NOT be presented as a proof of
race-freedom or of memory safety.

**Rationale.** `SRC-022`. A sanitizer sees the executions it happened to
schedule.

**Acceptance.** `ACC-009`.

**Scope.** Applies to ThreadSanitizer, Archer, Compute Sanitizer and any future
instrumented tool.

**Implemented by.** `TASK-CUDA-005`, `TASK-OMP-004`, `TASK-WEB-012`.

**ADRs.** [ADR-0001](../adr/0001-product-and-evidence.md), [ADR-0009](../adr/0009-backend-semantics.md)  Specification: [`../architecture/lifecycle.md`](../architecture/lifecycle.md).

**Contracts.** `PropertyResult.outcome`.

### REQ-EVD-003  `established` requires a model, a domain and assumptions

**Statement.** An outcome of `established` SHALL be admissible only with method
`static` or `symbolic`, evidence class `verified-under-assumptions`, and a
non-empty assumption set naming the model, its revision and the domain. Pomset
SHALL NOT produce `established` from a sampled or instrumented run.

**Rationale.** `SRC-021`, `SRC-022`. Proof is relative to something, and that
something must be printed next to it.

**Acceptance.** `ACC-003`.

**Scope.** Applies to the API, the CLI report and the UI.

**Implemented by.** `TASK-TRI-009`, `TASK-FND-006`.

**ADRs.** [ADR-0001](../adr/0001-product-and-evidence.md), [ADR-0009](../adr/0009-backend-semantics.md)  Specification: [`../architecture/lifecycle.md`](../architecture/lifecycle.md).

**Contracts.** `PropertyResult`, `Assumptions`.

### REQ-EVD-004  Allowed outcome/method/evidence tuples are closed

**Statement.** Pomset SHALL accept only these combinations, and SHALL reject
any other as `INPUT_INVALID`:

| Property outcome | Method | Evidence class |
|---|---|---|
| `established` | `static`, `symbolic` | `verified-under-assumptions` |
| `violated` | `symbolic`, `static` | `counterexample` |
| `violated` | `instrumented` | `observed` |
| `unknown` | any | `potential`, `estimated` |
| `unsupported` | any | `potential`, `estimated` |
| measurement only | `benchmark` | `measured`, `estimated` |

**Rationale.** An open matrix would let a combination such as
"established by instrumented observation" exist. `SRC-021`.

**Acceptance.** `ACC-002`, `ACC-003`, `ACC-006`.

**Scope.** Measurements never carry a correctness outcome.

**Implemented by.** `TASK-FND-006`.

**ADRs.** [ADR-0001](../adr/0001-product-and-evidence.md), [ADR-0009](../adr/0009-backend-semantics.md)  Specification: [`../architecture/lifecycle.md`](../architecture/lifecycle.md).

**Contracts.** `PropertyResult`, `Measurement`.

### REQ-EVD-005  Findings link multiple actors, events and source ranges

**Statement.** A finding SHALL reference at least one actor, at least one memory
event and at least one source range, and SHALL be able to reference several of
each when the defect involves more than two parties.

**Rationale.** `SRC-023`. A write/write conflict has two writers, two events and
at least two source locations, and the UI must be able to highlight all of them.

**Acceptance.** `ACC-002`.

**Scope.** A finding without a source range is not renderable and is rejected.

**Implemented by.** `TASK-TRI-007`, `TASK-FND-006`.

**ADRs.** [ADR-0001](../adr/0001-product-and-evidence.md), [ADR-0009](../adr/0009-backend-semantics.md)  Specification: [`../architecture/lifecycle.md`](../architecture/lifecycle.md).

**Contracts.** `Finding`.

### REQ-EVD-006  Addresses are symbolic until a witness fixes them

**Statement.** A memory access SHALL carry its symbolic address expression, and
SHALL carry a concrete address only when a witness assigns every domain
variable that the expression depends on. Pomset SHALL NOT invent a concrete
address for display.

**Rationale.** A plausible-looking fake address is worse than no address, because
it cannot be distinguished from a real one. `SRC-023`.

**Acceptance.** `ACC-001`, `ACC-003`.

**Scope.** Mask expressions follow the same rule.

**Implemented by.** `TASK-TRI-005`, `TASK-TRI-007`.

**ADRs.** [ADR-0001](../adr/0001-product-and-evidence.md), [ADR-0009](../adr/0009-backend-semantics.md)  Specification: [`../architecture/lifecycle.md`](../architecture/lifecycle.md).

**Contracts.** `MemoryAccessEvent.addressExpr`, `.addressConcrete`.

### REQ-EVD-007  Causal order is partial, never invented as total

**Statement.** When Pomset presents an order between events, it SHALL present a
partial order containing only the edges it established, labelled with the
relation kind (program order, sequenced-before, synchronizes-with,
happens-before, or unresolved), and SHALL NOT present a total order or a
timeline that implies one.

**Rationale.** `SRC-051`, `SRC-019`. Inventing an order between independent
events produces a convincing and wrong explanation.

**Acceptance.** `ACC-010`.

**Scope.** Applies to the workbench, exported bundles and Perfetto exports.

**Implemented by.** `TASK-TRI-007`, `TASK-WEB-011`.

**ADRs.** [ADR-0001](../adr/0001-product-and-evidence.md), [ADR-0009](../adr/0009-backend-semantics.md)  Specification: [`../architecture/lifecycle.md`](../architecture/lifecycle.md).

**Contracts.** `partialOrder`.

### REQ-EVD-008  Assumptions, budgets and coverage travel with every number

**Statement.** Every reported outcome and every measurement SHALL carry the
assumptions under which it holds, the budget that bounded it, and its coverage.
A number SHALL NOT be displayed without what qualifies it.

**Rationale.** `SRC-012`, `SRC-004`, `SRC-054`.

**Acceptance.** `ACC-003`, `ACC-006`, `ACC-010`.

**Scope.** Including measurements imported from external tools.

**Implemented by.** `TASK-WEB-008`, `TASK-LOC-007`, `TASK-PRS-002`, `TASK-FEA-006`.

**ADRs.** [ADR-0001](../adr/0001-product-and-evidence.md), [ADR-0009](../adr/0009-backend-semantics.md)  Specification: [`../architecture/lifecycle.md`](../architecture/lifecycle.md).

**Contracts.** `Assumptions`, `Budget`, `Coverage`.

### REQ-EVD-009  Budget exhaustion is `unknown`, not failure

**Statement.** When a solver or engine budget is exhausted, the affected
property result SHALL be `unknown` with the exhausted limit named. Pomset SHALL
NOT report budget exhaustion as a failed job, as an engine error, or as an
established property.

**Rationale.** `SRC-022`, `SRC-026`. "I could not decide" is a real answer.

**Acceptance.** `ACC-003`.

**Scope.** Same rule for a timeout, an incomplete extraction or an unfinished
partition search.

**Implemented by.** `TASK-TRI-008`, `TASK-FND-006`.

**ADRs.** [ADR-0001](../adr/0001-product-and-evidence.md), [ADR-0009](../adr/0009-backend-semantics.md)  Specification: [`../architecture/lifecycle.md`](../architecture/lifecycle.md).

**Contracts.** `Budget.exhausted`, `PropertyResult.unknownReason`.

### REQ-EVD-010  Timeout is unknown progress

**Statement.** An execution that did not finish within its budget SHALL be
reported as unknown progress. Pomset SHALL NOT report a timeout as a deadlock,
as a liveness failure, or as evidence of either.

**Rationale.** `SRC-026`. Blocking forever and waiting a long time are not
distinguishable by a clock.

**Acceptance.** `ACC-009`.

**Scope.** Applies to every backend; liveness is a backend-specific capability
with a stated model.

**Implemented by.** `TASK-OMP-005`, `TASK-CUDA-006`.

**ADRs.** [ADR-0001](../adr/0001-product-and-evidence.md), [ADR-0009](../adr/0009-backend-semantics.md)  Specification: [`../architecture/lifecycle.md`](../architecture/lifecycle.md).

**Contracts.** `PropertyResult.outcome`.

### REQ-EVD-011  `unsupported` and `unknown` are distinct

**Statement.** Pomset SHALL distinguish "the analysis cannot decide this with
the supported model" (`unsupported`, with the missing capability named) from
"the analysis did not decide this within the model and budget" (`unknown`, with
the reason named).

**Rationale.** They lead to different user actions: one needs a different tool
or a later phase, the other needs more budget or a narrower domain. `SRC-029`.

**Acceptance.** `ACC-002`, `ACC-009`.

**Scope.** Neither is an error code.

**Implemented by.** `TASK-TRI-012`, `TASK-FND-006`.

**ADRs.** [ADR-0001](../adr/0001-product-and-evidence.md), [ADR-0009](../adr/0009-backend-semantics.md)  Specification: [`../architecture/lifecycle.md`](../architecture/lifecycle.md).

**Contracts.** `PropertyResult`.

### REQ-EVD-012  Backend semantics stay attached to records

**Statement.** A finding SHALL record the backend and the semantics under which
it holds, and Pomset SHALL NOT assume two findings are equivalent because two
tools both call them a data race.

**Rationale.** `SRC-024`, `SRC-019`.

**Acceptance.** `ACC-009`.

**Scope.** The shared evidence model carries backend-qualified semantics rather
than a universal memory model.

**Implemented by.** `TASK-FND-006`, `TASK-CUDA-007`.

**ADRs.** [ADR-0001](../adr/0001-product-and-evidence.md), [ADR-0009](../adr/0009-backend-semantics.md)  Specification: [`../architecture/lifecycle.md`](../architecture/lifecycle.md).

**Contracts.** `Finding.backendId`, `MemoryAccessEvent.scope`.

### REQ-EVD-013  Provenance names the producing tool and method

**Statement.** Every finding SHALL carry provenance naming at least one source,
method and tool, with the tool version when one exists, and the artifacts that
support it.

**Rationale.** `SRC-023`, `SRC-037`. A reader must be able to audit which tool
said what.

**Acceptance.** `ACC-006`, `ACC-009`.

**Scope.** Imported evidence keeps its original provenance and gains an
`origin: imported` marker; it never impersonates server-produced validation.

**Implemented by.** `TASK-FND-006`, `TASK-PRS-002`, `TASK-FEA-001`, `TASK-FEA-004`.

**ADRs.** [ADR-0001](../adr/0001-product-and-evidence.md), [ADR-0009](../adr/0009-backend-semantics.md)  Specification: [`../architecture/lifecycle.md`](../architecture/lifecycle.md).

**Contracts.** `Finding.provenance`, `AnalysisResult.origin`.

### REQ-EVD-014  The correction hint is a qualified explanation

**Statement.** When an output-coverage witness is caused by the recognized
positive-N/positive-BLOCK floor-grid pattern, Pomset SHALL show the ceiling-division
suggestion as a correction hint that is explicitly qualified, SHALL require the
user to rerun validation, and SHALL NOT edit the kernel automatically or
describe the hint as a proved functional repair.

**Rationale.** A suggestion derived from one pattern is an explanation, not a
proof about the user's intent. `SRC-002`, `SRC-020`.

**Acceptance.** `ACC-001`.

**Scope.** Generic repair synthesis is out of scope; this is one recognized
pattern with an explicit trigger.

**Implemented by.** `TASK-TRI-014`, `TASK-WEB-013`, `TASK-REL-005`.

**ADRs.** [ADR-0008](../adr/0008-triton-analysis.md)  Specification: [`../architecture/lifecycle.md`](../architecture/lifecycle.md).

**Contracts.** `correctionHint`.

### REQ-EVD-015  A succeeded job carries no correctness claim

**Statement.** Pomset SHALL NOT present job state as a correctness verdict. A
job that succeeded MAY contain violated, unknown and unsupported property
results, and the presentation SHALL keep the two independent.

**Rationale.** `SRC-012`. Green alone does not mean safe.

**Acceptance.** `ACC-004`, `ACC-007`.

**Scope.** Applies to CI exit status too; see [`local-ci.md`](local-ci.md).

**Implemented by.** `TASK-FND-006`, `TASK-WEB-008`.

**ADRs.** [ADR-0001](../adr/0001-product-and-evidence.md), [ADR-0009](../adr/0009-backend-semantics.md)  Specification: [`../architecture/lifecycle.md`](../architecture/lifecycle.md).

**Contracts.** `Job.state`, `AnalysisResult`.
