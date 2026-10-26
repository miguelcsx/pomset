# Traceability

Every requirement in this directory is listed below with the source rows it came from, the
decisions that shape it, the tasks that will implement it and the acceptance scenarios that
observe it. The table is generated from the requirement blocks, and the documentation validator
described in the delivery plan re-checks it mechanically: no retained source goal without a
requirement, no requirement without a task and an acceptance scenario, no unresolved task
prerequisite, no cycle.

## Requirement to source, decision, task and acceptance

| Requirement | Subject | Sources | ADRs | Tasks | Acceptance |
|---|---|---|---|---|---|
| **PRJ** | _Projects, scenarios and snapshots_ | | | | |
| `REQ-PRJ-001` | Multi-file versioned project | `SRC-011` | [ADR-0004](../adr/0004-contract-authority.md), [ADR-0005](../adr/0005-snapshots-and-artifacts.md) | `TASK-FND-001`, `TASK-HST-003`, `TASK-LOC-002` | `ACC-004` |
| `REQ-PRJ-002` | Explicit kernel entrypoint | `SRC-005` | [ADR-0004](../adr/0004-contract-authority.md), [ADR-0005](../adr/0005-snapshots-and-artifacts.md) | `TASK-TRI-001` | `ACC-001` |
| `REQ-PRJ-003` | Scenario declares allocations, inputs, outputs and launch | `SRC-005`, `SRC-031` | [ADR-0004](../adr/0004-contract-authority.md), [ADR-0005](../adr/0005-snapshots-and-artifacts.md) | `TASK-FND-003`, `TASK-TRI-002` | `ACC-001`, `ACC-006` |
| `REQ-PRJ-004` | Scenario declares required properties | `SRC-003`, `SRC-016` | [ADR-0004](../adr/0004-contract-authority.md), [ADR-0005](../adr/0005-snapshots-and-artifacts.md) | `TASK-LOC-003`, `TASK-WEB-009` | `ACC-003`, `ACC-007` |
| `REQ-PRJ-005` | Launch configuration is data, not a host callback | `SRC-005`, `SRC-031` | [ADR-0004](../adr/0004-contract-authority.md), [ADR-0005](../adr/0005-snapshots-and-artifacts.md) | `TASK-FND-004`, `TASK-TRI-003` | `ACC-001`, `ACC-003` |
| `REQ-PRJ-006` | Reference computation is declared, not assumed | `SRC-021`, `SRC-052` | [ADR-0004](../adr/0004-contract-authority.md), [ADR-0005](../adr/0005-snapshots-and-artifacts.md) | `TASK-LOC-006`, `TASK-TRI-011` | `ACC-006` |
| `REQ-PRJ-007` | Immutable snapshots over source and configuration | `SRC-012` | [ADR-0004](../adr/0004-contract-authority.md), [ADR-0005](../adr/0005-snapshots-and-artifacts.md) | `TASK-FND-005`, `TASK-HST-004`, `TASK-LOC-002` | `ACC-004` |
| `REQ-PRJ-008` | Editing creates a new snapshot | `SRC-012` | [ADR-0004](../adr/0004-contract-authority.md), [ADR-0005](../adr/0005-snapshots-and-artifacts.md) | `TASK-HST-004`, `TASK-LOC-002`, `TASK-WEB-004` | `ACC-004` |
| `REQ-PRJ-009` | Comparing snapshots is an explicit operation | `SRC-020`, `SRC-047` | [ADR-0004](../adr/0004-contract-authority.md), [ADR-0005](../adr/0005-snapshots-and-artifacts.md) | `TASK-LOC-008`, `TASK-WEB-014` | `ACC-004`, `ACC-010` |
| `REQ-PRJ-010` | Run and compile never publish | `SRC-012`, `SRC-037` | [ADR-0005](../adr/0005-snapshots-and-artifacts.md), [ADR-0011](../adr/0011-private-local-and-publication.md) | `TASK-HST-010`, `TASK-LOC-009` | `ACC-004`, `ACC-008` |
| `REQ-PRJ-011` | Compiling leaves the target unexecuted | `SRC-012` | [ADR-0008](../adr/0008-triton-analysis.md), [ADR-0009](../adr/0009-backend-semantics.md) | `TASK-CUDA-002`, `TASK-TRI-013` | `ACC-009` |
| `REQ-PRJ-012` | Scenario validation rejects rather than repairs | `SRC-005`, `SRC-029` | [ADR-0004](../adr/0004-contract-authority.md), [ADR-0005](../adr/0005-snapshots-and-artifacts.md) | `TASK-FND-001`, `TASK-FND-004`, `TASK-LOC-004` | `ACC-005` |
| `REQ-PRJ-013` | A scenario belongs to exactly one snapshot | `SRC-031`, `SRC-037` | [ADR-0004](../adr/0004-contract-authority.md), [ADR-0005](../adr/0005-snapshots-and-artifacts.md) | `TASK-FND-006`, `TASK-HST-006` | `ACC-004`, `ACC-006` |
| **DOM** | _Workload domains_ | | | | |
| `REQ-DOM-001` | The domain is declared, not inferred | `SRC-003`, `SRC-016` | [ADR-0001](../adr/0001-product-and-evidence.md), [ADR-0010](../adr/0010-performance-and-eligibility.md) | `TASK-LOC-003`, `TASK-TRI-002` | `ACC-001`, `ACC-003` |
| `REQ-DOM-002` | Domain variables cover shape, dtype, layout, launch and hardware | `SRC-003` | [ADR-0001](../adr/0001-product-and-evidence.md), [ADR-0010](../adr/0010-performance-and-eligibility.md) | `TASK-FND-003`, `TASK-TRI-002` | `ACC-003` |
| `REQ-DOM-003` | Constraints are explicit and machine-checkable | `SRC-003`, `SRC-005` | [ADR-0001](../adr/0001-product-and-evidence.md), [ADR-0010](../adr/0010-performance-and-eligibility.md) | `TASK-FND-004`, `TASK-TRI-003` | `ACC-003`, `ACC-005` |
| `REQ-DOM-004` | Integer width and overflow are preserved | `SRC-003`, `SRC-029` | [ADR-0001](../adr/0001-product-and-evidence.md), [ADR-0010](../adr/0010-performance-and-eligibility.md) | `TASK-TRI-004` | `ACC-003` |
| `REQ-DOM-005` | Sizes and allocations are constrained, not assumed | `SRC-005`, `SRC-007` | [ADR-0001](../adr/0001-product-and-evidence.md), [ADR-0010](../adr/0010-performance-and-eligibility.md) | `TASK-TRI-005`, `TASK-TRI-008` | `ACC-001` |
| `REQ-DOM-006` | Aliasing is declared | `SRC-005`, `SRC-023` | [ADR-0001](../adr/0001-product-and-evidence.md), [ADR-0010](../adr/0010-performance-and-eligibility.md) | `TASK-TRI-006` | `ACC-002` |
| `REQ-DOM-007` | Regions carry independent classifications | `SRC-004`, `SRC-054` | [ADR-0001](../adr/0001-product-and-evidence.md), [ADR-0010](../adr/0010-performance-and-eligibility.md) | `TASK-TRI-009`, `TASK-WEB-008` | `ACC-003`, `ACC-007` |
| `REQ-DOM-008` | Percentages require an enumerated denominator | `SRC-004`, `SRC-021` | [ADR-0001](../adr/0001-product-and-evidence.md), [ADR-0010](../adr/0010-performance-and-eligibility.md) | `TASK-LOC-007`, `TASK-TRI-009`, `TASK-WEB-008` | `ACC-003` |
| `REQ-DOM-009` | Sampled regions are never promoted | `SRC-004`, `SRC-042` | [ADR-0001](../adr/0001-product-and-evidence.md), [ADR-0010](../adr/0010-performance-and-eligibility.md) | `TASK-LOC-003`, `TASK-TRI-010` | `ACC-003`, `ACC-006` |
| `REQ-DOM-010` | Unsupported regions are named | `SRC-003`, `SRC-029` | [ADR-0001](../adr/0001-product-and-evidence.md), [ADR-0010](../adr/0010-performance-and-eligibility.md) | `TASK-CUDA-005`, `TASK-OMP-004`, `TASK-TRI-012` | `ACC-002`, `ACC-009` |
| `REQ-DOM-011` | Hardware cohorts are compared separately | `SRC-010` | [ADR-0001](../adr/0001-product-and-evidence.md), [ADR-0010](../adr/0010-performance-and-eligibility.md) | `TASK-LOC-006`, `TASK-PRS-004` | `ACC-006`, `ACC-010` |
| `REQ-DOM-012` | Domain identity participates in cache keys | `SRC-031`, `SRC-037` | [ADR-0001](../adr/0001-product-and-evidence.md), [ADR-0010](../adr/0010-performance-and-eligibility.md) | `TASK-FND-007`, `TASK-HST-009` | `ACC-004`, `ACC-006` |
| `REQ-DOM-013` | A domain point is reproducible from its record | `SRC-043` | [ADR-0001](../adr/0001-product-and-evidence.md), [ADR-0010](../adr/0010-performance-and-eligibility.md) | `TASK-LOC-007`, `TASK-TRI-010` | `ACC-003` |
| **EVD** | _Evidence and findings_ | | | | |
| `REQ-EVD-001` | Six evidence classes | `SRC-004`, `SRC-021` | [ADR-0001](../adr/0001-product-and-evidence.md), [ADR-0009](../adr/0009-backend-semantics.md) | `TASK-FND-006`, `TASK-TRI-009` | `ACC-002`, `ACC-006` |
| `REQ-EVD-002` | Absence of a dynamic error is not proof | `SRC-022` | [ADR-0001](../adr/0001-product-and-evidence.md), [ADR-0009](../adr/0009-backend-semantics.md) | `TASK-CUDA-005`, `TASK-OMP-004`, `TASK-WEB-012` | `ACC-009` |
| `REQ-EVD-003` | `established` requires a model, a domain and assumptions | `SRC-021`, `SRC-022` | [ADR-0001](../adr/0001-product-and-evidence.md), [ADR-0009](../adr/0009-backend-semantics.md) | `TASK-FND-006`, `TASK-TRI-009` | `ACC-003` |
| `REQ-EVD-004` | Allowed outcome/method/evidence tuples are closed | `SRC-021` | [ADR-0001](../adr/0001-product-and-evidence.md), [ADR-0009](../adr/0009-backend-semantics.md) | `TASK-FND-006` | `ACC-002`, `ACC-003`, `ACC-006` |
| `REQ-EVD-005` | Findings link multiple actors, events and source ranges | `SRC-023` | [ADR-0001](../adr/0001-product-and-evidence.md), [ADR-0009](../adr/0009-backend-semantics.md) | `TASK-FND-006`, `TASK-TRI-007` | `ACC-002` |
| `REQ-EVD-006` | Addresses are symbolic until a witness fixes them | `SRC-023` | [ADR-0001](../adr/0001-product-and-evidence.md), [ADR-0009](../adr/0009-backend-semantics.md) | `TASK-TRI-005`, `TASK-TRI-007` | `ACC-001`, `ACC-003` |
| `REQ-EVD-007` | Causal order is partial, never invented as total | `SRC-019`, `SRC-051` | [ADR-0001](../adr/0001-product-and-evidence.md), [ADR-0009](../adr/0009-backend-semantics.md) | `TASK-TRI-007`, `TASK-WEB-011` | `ACC-010` |
| `REQ-EVD-008` | Assumptions, budgets and coverage travel with every number | `SRC-004`, `SRC-012`, `SRC-054` | [ADR-0001](../adr/0001-product-and-evidence.md), [ADR-0009](../adr/0009-backend-semantics.md) | `TASK-FEA-006`, `TASK-LOC-007`, `TASK-PRS-002`, `TASK-WEB-008` | `ACC-003`, `ACC-006`, `ACC-010` |
| `REQ-EVD-009` | Budget exhaustion is `unknown`, not failure | `SRC-022`, `SRC-026` | [ADR-0001](../adr/0001-product-and-evidence.md), [ADR-0009](../adr/0009-backend-semantics.md) | `TASK-FND-006`, `TASK-TRI-008` | `ACC-003` |
| `REQ-EVD-010` | Timeout is unknown progress | `SRC-026` | [ADR-0001](../adr/0001-product-and-evidence.md), [ADR-0009](../adr/0009-backend-semantics.md) | `TASK-CUDA-006`, `TASK-OMP-005` | `ACC-009` |
| `REQ-EVD-011` | `unsupported` and `unknown` are distinct | `SRC-029` | [ADR-0001](../adr/0001-product-and-evidence.md), [ADR-0009](../adr/0009-backend-semantics.md) | `TASK-FND-006`, `TASK-TRI-012` | `ACC-002`, `ACC-009` |
| `REQ-EVD-012` | Backend semantics stay attached to records | `SRC-019`, `SRC-024` | [ADR-0001](../adr/0001-product-and-evidence.md), [ADR-0009](../adr/0009-backend-semantics.md) | `TASK-CUDA-007`, `TASK-FND-006` | `ACC-009` |
| `REQ-EVD-013` | Provenance names the producing tool and method | `SRC-023`, `SRC-037` | [ADR-0001](../adr/0001-product-and-evidence.md), [ADR-0009](../adr/0009-backend-semantics.md) | `TASK-FEA-001`, `TASK-FEA-004`, `TASK-FND-006`, `TASK-PRS-002` | `ACC-006`, `ACC-009` |
| `REQ-EVD-014` | The correction hint is a qualified explanation | `SRC-002`, `SRC-020` | [ADR-0008](../adr/0008-triton-analysis.md) | `TASK-REL-005`, `TASK-TRI-014`, `TASK-WEB-013` | `ACC-001` |
| `REQ-EVD-015` | A succeeded job carries no correctness claim | `SRC-012` | [ADR-0001](../adr/0001-product-and-evidence.md), [ADR-0009](../adr/0009-backend-semantics.md) | `TASK-FND-006`, `TASK-WEB-008` | `ACC-004`, `ACC-007` |
| **EXP** | _Exploration_ | | | | |
| `REQ-EXP-001` | Extract access expressions and masks from the supported subset | `SRC-005` | [ADR-0008](../adr/0008-triton-analysis.md) | `TASK-TRI-005`, `TASK-TRI-006` | `ACC-001` |
| `REQ-EXP-002` | Bounds query finds enabled accesses outside their allocation | `SRC-005`, `SRC-007` | [ADR-0008](../adr/0008-triton-analysis.md) | `TASK-TRI-008` | `ACC-001` |
| `REQ-EXP-003` | Output-coverage query finds unwritten declared output | `SRC-002`, `SRC-007` | [ADR-0008](../adr/0008-triton-analysis.md) | `TASK-TRI-008` | `ACC-001` |
| `REQ-EXP-004` | Conflict query is non-atomic write/write only, initially | `SRC-005`, `SRC-024` | [ADR-0009](../adr/0009-backend-semantics.md) | `TASK-CUDA-005`, `TASK-OMP-004`, `TASK-TRI-008` | `ACC-002` |
| `REQ-EXP-005` | A witness is concrete, source-linked and minimizable | `SRC-020`, `SRC-028` | [ADR-0008](../adr/0008-triton-analysis.md) | `TASK-TRI-015` | `ACC-001`, `ACC-002` |
| `REQ-EXP-006` | Replay is a separate, labelled mechanism | `SRC-022` | [ADR-0008](../adr/0008-triton-analysis.md) | `TASK-LOC-006`, `TASK-TRI-016` | `ACC-001`, `ACC-006` |
| `REQ-EXP-007` | Domain partitioning is counterexample-guided | `SRC-020`, `SRC-028` | [ADR-0008](../adr/0008-triton-analysis.md) | `TASK-TRI-010` | `ACC-003` |
| `REQ-EXP-008` | Sampling strategies are recorded, seeded and comparable | `SRC-020`, `SRC-043` | [ADR-0008](../adr/0008-triton-analysis.md) | `TASK-FEA-005`, `TASK-TRI-010` | `ACC-003` |
| `REQ-EXP-009` | Seeds make a sample reproducible | `SRC-043` | [ADR-0008](../adr/0008-triton-analysis.md) | `TASK-TRI-010` | `ACC-003` |
| `REQ-EXP-010` | Unsupported semantics stop extraction explicitly | `SRC-029` | [ADR-0008](../adr/0008-triton-analysis.md), [ADR-0009](../adr/0009-backend-semantics.md) | `TASK-TRI-012`, `TASK-TRX-001`, `TASK-TRX-005` | `ACC-002`, `ACC-009` |
| `REQ-EXP-011` | Source, IR and PTX views are qualified by mapping quality | `SRC-031` | [ADR-0008](../adr/0008-triton-analysis.md) | `TASK-CUDA-003`, `TASK-TRI-013` | `ACC-009` |
| `REQ-EXP-012` | The explorer reports the query and model revision it used | `SRC-037`, `SRC-043` | [ADR-0008](../adr/0008-triton-analysis.md) | `TASK-FND-006`, `TASK-TRI-008` | `ACC-003`, `ACC-009` |
| `REQ-EXP-013` | A missing capability is actionable | `SRC-029`, `SRC-038` | [ADR-0008](../adr/0008-triton-analysis.md) | `TASK-HST-011`, `TASK-LOC-005`, `TASK-WEB-010` | `ACC-002`, `ACC-009` |
| **VAL** | _Validation_ | | | | |
| `REQ-VAL-001` | Required-property policy is explicit and single | `SRC-004`, `SRC-016` | [ADR-0008](../adr/0008-triton-analysis.md), [ADR-0010](../adr/0010-performance-and-eligibility.md) | `TASK-FND-006`, `TASK-LOC-003` | `ACC-006`, `ACC-007` |
| `REQ-VAL-002` | Policy states accepted methods and sampled acceptance | `SRC-004` | [ADR-0008](../adr/0008-triton-analysis.md), [ADR-0010](../adr/0010-performance-and-eligibility.md) | `TASK-LOC-003` | `ACC-006`, `ACC-007` |
| `REQ-VAL-003` | Unknown or unsupported required checks block eligibility | `SRC-004`, `SRC-035` | [ADR-0008](../adr/0008-triton-analysis.md), [ADR-0010](../adr/0010-performance-and-eligibility.md) | `TASK-LOC-003`, `TASK-PRS-003` | `ACC-006`, `ACC-007` |
| `REQ-VAL-004` | Static and dynamic evidence are reported separately | `SRC-021`, `SRC-022` | [ADR-0008](../adr/0008-triton-analysis.md), [ADR-0010](../adr/0010-performance-and-eligibility.md) | `TASK-FND-006`, `TASK-WEB-012` | `ACC-009` |
| `REQ-VAL-005` | Numerical comparison declares reference and tolerances | `SRC-006`, `SRC-042` | [ADR-0008](../adr/0008-triton-analysis.md), [ADR-0010](../adr/0010-performance-and-eligibility.md) | `TASK-LOC-006`, `TASK-OMP-002`, `TASK-TRI-011` | `ACC-006` |
| `REQ-VAL-006` | Output buffers are fresh or poisoned before numerical comparison | `SRC-007` | [ADR-0008](../adr/0008-triton-analysis.md), [ADR-0010](../adr/0010-performance-and-eligibility.md) | `TASK-CUDA-004`, `TASK-OMP-003`, `TASK-TRI-011` | `ACC-001`, `ACC-006` |
| `REQ-VAL-007` | Replay minimises and preserves assumptions | `SRC-028`, `SRC-043` | [ADR-0008](../adr/0008-triton-analysis.md), [ADR-0010](../adr/0010-performance-and-eligibility.md) | `TASK-LOC-006`, `TASK-TRI-015` | `ACC-001`, `ACC-002` |
| `REQ-VAL-008` | Synchronization, atomics and initialization are backend capabilities | `SRC-017`, `SRC-019`, `SRC-024` | [ADR-0008](../adr/0008-triton-analysis.md), [ADR-0010](../adr/0010-performance-and-eligibility.md) | `TASK-CUDA-005`, `TASK-HST-011`, `TASK-OMP-004` | `ACC-009` |
| `REQ-VAL-009` | Regression comparison is between named snapshots | `SRC-033`, `SRC-047` | [ADR-0008](../adr/0008-triton-analysis.md), [ADR-0010](../adr/0010-performance-and-eligibility.md) | `TASK-LOC-008`, `TASK-WEB-014` | `ACC-004`, `ACC-010` |
| `REQ-VAL-010` | Property naming is a closed vocabulary plus explicit extensions | `SRC-024` | [ADR-0008](../adr/0008-triton-analysis.md), [ADR-0010](../adr/0010-performance-and-eligibility.md) | `TASK-FND-004` | `ACC-005` |
| `REQ-VAL-011` | A validation record is bound to one snapshot and profile | `SRC-012`, `SRC-031` | [ADR-0008](../adr/0008-triton-analysis.md), [ADR-0010](../adr/0010-performance-and-eligibility.md) | `TASK-FND-006`, `TASK-HST-006` | `ACC-004`, `ACC-006` |
| `REQ-VAL-012` | Schedule-dependent outcomes are reported against a declared order | `SRC-025` | [ADR-0009](../adr/0009-backend-semantics.md), [ADR-0010](../adr/0010-performance-and-eligibility.md) | `TASK-LOC-003`, `TASK-OMP-005`, `TASK-TRI-009` | `ACC-002`, `ACC-009` |
| **PERF** | _Performance_ | | | | |
| `REQ-PERF-001` | Pomset measures and imports; it is not a profiler or an autotuner | `SRC-048` | [ADR-0010](../adr/0010-performance-and-eligibility.md) | `TASK-PRS-003`, `TASK-PRS-005` | `ACC-006` |
| `REQ-PERF-002` | Only eligible configurations are benchmarked | `SRC-035` | [ADR-0010](../adr/0010-performance-and-eligibility.md) | `TASK-LOC-006`, `TASK-PRS-003` | `ACC-006`, `ACC-007` |
| `REQ-PERF-003` | Imported measurements remain inspectable | `SRC-027` | [ADR-0010](../adr/0010-performance-and-eligibility.md) | `TASK-PRS-002` | `ACC-006` |
| `REQ-PERF-004` | Measurement records its qualifiers | `SRC-052`, `SRC-055` | [ADR-0010](../adr/0010-performance-and-eligibility.md) | `TASK-FEA-002`, `TASK-PRS-001`, `TASK-PRS-003` | `ACC-006` |
| `REQ-PERF-005` | Compilation time is separated from execution time | `SRC-052` | [ADR-0010](../adr/0010-performance-and-eligibility.md) | `TASK-PRS-003` | `ACC-006` |
| `REQ-PERF-006` | Instrumentation effects are declared, never hidden | `SRC-027` | [ADR-0010](../adr/0010-performance-and-eligibility.md) | `TASK-CUDA-008`, `TASK-PRS-005` | `ACC-006`, `ACC-009` |
| `REQ-PERF-007` | Hardware and software metrics are only reported where a tool supplies them | `SRC-048`, `SRC-055` | [ADR-0010](../adr/0010-performance-and-eligibility.md) | `TASK-CUDA-008`, `TASK-PRS-005` | `ACC-006`, `ACC-010` |
| `REQ-PERF-008` | No causal diagnosis from latency alone | `SRC-010`, `SRC-055` | [ADR-0010](../adr/0010-performance-and-eligibility.md) | `TASK-PRS-005`, `TASK-WEB-015` | `ACC-010` |
| `REQ-PERF-009` | Comparisons keep hardware cohorts separate | `SRC-010` | [ADR-0010](../adr/0010-performance-and-eligibility.md) | `TASK-PRS-004` | `ACC-006`, `ACC-010` |
| `REQ-PERF-010` | A recommendation requires complete, measured, compatible evidence | `SRC-004`, `SRC-035` | [ADR-0010](../adr/0010-performance-and-eligibility.md) | `TASK-LOC-003`, `TASK-PRS-004` | `ACC-006`, `ACC-007` |
| `REQ-PERF-011` | Estimated values are labelled as estimates everywhere | `SRC-004`, `SRC-054` | [ADR-0010](../adr/0010-performance-and-eligibility.md) | `TASK-LOC-007`, `TASK-WEB-015` | `ACC-006`, `ACC-010` |
| `REQ-PERF-012` | External measurement formats are validated on import | `SRC-027` | [ADR-0010](../adr/0010-performance-and-eligibility.md) | `TASK-FEA-002`, `TASK-PRS-002`, `TASK-SEC-004` | `ACC-005`, `ACC-006` |
| `REQ-PERF-013` | Trace export requires representable qualified data | `SRC-027`, `SRC-051` | [ADR-0010](../adr/0010-performance-and-eligibility.md) | `TASK-PRS-006` | `ACC-010` |
| **UX** | _Workbench_ | | | | |
| `REQ-UX-001` | Project and editor surface | `SRC-012`, `SRC-036` | [ADR-0003](../adr/0003-workbench-composition.md) | `TASK-WEB-002`, `TASK-WEB-004` | `ACC-010` |
| `REQ-UX-002` | Source, actor, memory and event views are linked | `SRC-036`, `SRC-053` | [ADR-0003](../adr/0003-workbench-composition.md) | `TASK-WEB-007`, `TASK-WEB-011` | `ACC-002`, `ACC-010` |
| `REQ-UX-003` | Up to four comparison lanes over one scenario | `SRC-036` | [ADR-0003](../adr/0003-workbench-composition.md) | `TASK-WEB-006` | `ACC-010` |
| `REQ-UX-004` | Explore, Validate and Optimize are the three experiences | `SRC-001`, `SRC-013` | [ADR-0003](../adr/0003-workbench-composition.md) | `TASK-WEB-001`, `TASK-WEB-008` | `ACC-010` |
| `REQ-UX-005` | Semantic status roles decorate independent states | `SRC-054` | [ADR-0003](../adr/0003-workbench-composition.md) | `TASK-WEB-003` | `ACC-004`, `ACC-010` |
| `REQ-UX-006` | Status is never carried by colour alone | `SRC-054` | [ADR-0003](../adr/0003-workbench-composition.md) | `TASK-WEB-003` | `ACC-010` |
| `REQ-UX-007` | Real job states are shown | `SRC-012`, `SRC-031` | [ADR-0003](../adr/0003-workbench-composition.md) | `TASK-HST-008`, `TASK-WEB-005` | `ACC-004`, `ACC-010` |
| `REQ-UX-008` | Cancellation and partial evidence remain visible | `SRC-012` | [ADR-0003](../adr/0003-workbench-composition.md) | `TASK-ENG-005`, `TASK-WEB-005` | `ACC-004` |
| `REQ-UX-009` | Historical evidence stays attached to its snapshot | `SRC-012` | [ADR-0003](../adr/0003-workbench-composition.md) | `TASK-WEB-004`, `TASK-WEB-005` | `ACC-004` |
| `REQ-UX-010` | Unavailable profiles are shown, not filtered out | `SRC-029`, `SRC-038` | [ADR-0003](../adr/0003-workbench-composition.md) | `TASK-HST-011`, `TASK-WEB-010` | `ACC-004`, `ACC-009` |
| `REQ-UX-011` | Disabled capabilities explain themselves | `SRC-029` | [ADR-0003](../adr/0003-workbench-composition.md) | `TASK-LOC-009`, `TASK-WEB-010` | `ACC-009` |
| `REQ-UX-012` | Domain and coverage are visible next to each result | `SRC-003`, `SRC-004` | [ADR-0003](../adr/0003-workbench-composition.md) | `TASK-WEB-008` | `ACC-003`, `ACC-007` |
| `REQ-UX-013` | Charts label measurement versus estimate and show region coverage | `SRC-054`, `SRC-055` | [ADR-0003](../adr/0003-workbench-composition.md) | `TASK-WEB-008`, `TASK-WEB-015` | `ACC-006`, `ACC-010` |
| `REQ-UX-014` | Causal views show only established order | `SRC-051` | [ADR-0003](../adr/0003-workbench-composition.md) | `TASK-PRS-006`, `TASK-WEB-011` | `ACC-002`, `ACC-010` |
| `REQ-UX-015` | Publication is a previewed, explicit act | `SRC-012`, `SRC-037` | [ADR-0003](../adr/0003-workbench-composition.md) | `TASK-HST-010`, `TASK-WEB-016` | `ACC-008` |
| `REQ-UX-016` | Empty, offline and error states are explicit | `SRC-022`, `SRC-029` | [ADR-0003](../adr/0003-workbench-composition.md) | `TASK-WEB-005`, `TASK-WEB-017` | `ACC-009` |
| `REQ-UX-017` | Responsive and keyboard-operable | `SRC-036` | [ADR-0003](../adr/0003-workbench-composition.md) | `TASK-WEB-018` | `ACC-010` |
| **CLI** | _Local and CI_ | | | | |
| `REQ-CLI-001` | Offline analysis without upload | `SRC-033` | [ADR-0006](../adr/0006-jobs-and-persistence.md), [ADR-0011](../adr/0011-private-local-and-publication.md) | `TASK-LOC-001`, `TASK-LOC-002` | `ACC-005` |
| `REQ-CLI-002` | A manifest describes the experiment | `SRC-033` | [ADR-0006](../adr/0006-jobs-and-persistence.md), [ADR-0011](../adr/0011-private-local-and-publication.md) | `TASK-LOC-004` | `ACC-005` |
| `REQ-CLI-003` | Commands cover the full local workflow | `SRC-033`, `SRC-047` | [ADR-0006](../adr/0006-jobs-and-persistence.md), [ADR-0011](../adr/0011-private-local-and-publication.md) | `TASK-LOC-005`, `TASK-LOC-006`, `TASK-REL-001` | `ACC-005` |
| `REQ-CLI-004` | Exit status distinguishes policy, failure, and error | `SRC-034` | [ADR-0006](../adr/0006-jobs-and-persistence.md), [ADR-0011](../adr/0011-private-local-and-publication.md) | `TASK-LOC-007` | `ACC-005` |
| `REQ-CLI-005` | Reports preserve the exact outcome behind a coarse status | `SRC-034` | [ADR-0006](../adr/0006-jobs-and-persistence.md), [ADR-0011](../adr/0011-private-local-and-publication.md) | `TASK-LOC-007` | `ACC-005` |
| `REQ-CLI-006` | Benchmarking requires eligibility and consent | `SRC-035` | [ADR-0006](../adr/0006-jobs-and-persistence.md), [ADR-0011](../adr/0011-private-local-and-publication.md) | `TASK-LOC-006` | `ACC-006` |
| `REQ-CLI-007` | Import never executes | `SRC-027`, `SRC-033` | [ADR-0006](../adr/0006-jobs-and-persistence.md), [ADR-0011](../adr/0011-private-local-and-publication.md) | `TASK-LOC-008`, `TASK-SEC-004` | `ACC-005` |
| `REQ-CLI-008` | `serve` is read-only and exposes no execution route | `SRC-030`, `SRC-033` | [ADR-0006](../adr/0006-jobs-and-persistence.md), [ADR-0011](../adr/0011-private-local-and-publication.md) | `TASK-LOC-009` | `ACC-008` |
| `REQ-CLI-009` | Local GPU execution is explicitly opted in | `SRC-030`, `SRC-034` | [ADR-0006](../adr/0006-jobs-and-persistence.md), [ADR-0011](../adr/0011-private-local-and-publication.md) | `TASK-CUDA-001`, `TASK-LOC-006` | `ACC-005`, `ACC-009` |
| `REQ-CLI-010` | No telemetry and no implicit upload | `SRC-033`, `SRC-034` | [ADR-0006](../adr/0006-jobs-and-persistence.md), [ADR-0011](../adr/0011-private-local-and-publication.md) | `TASK-HST-010`, `TASK-LOC-001` | `ACC-005`, `ACC-008` |
| `REQ-CLI-011` | Local execution consent is explicit and scoped | `SRC-030` | [ADR-0007](../adr/0007-sandbox-and-local-runners.md), [ADR-0011](../adr/0011-private-local-and-publication.md) | `TASK-LOC-006`, `TASK-SEC-003` | `ACC-005`, `ACC-009` |
| `REQ-CLI-012` | CI recipes are reproducible and documented | `SRC-043`, `SRC-047` | [ADR-0006](../adr/0006-jobs-and-persistence.md), [ADR-0011](../adr/0011-private-local-and-publication.md) | `TASK-FND-001`, `TASK-LOC-010` | `ACC-005` |
| `REQ-CLI-013` | The local viewer shares the workbench components | `SRC-053` | [ADR-0006](../adr/0006-jobs-and-persistence.md), [ADR-0011](../adr/0011-private-local-and-publication.md) | `TASK-LOC-009`, `TASK-WEB-001` | `ACC-005`, `ACC-010` |
| `REQ-CLI-014` | Write and job controls are unavailable offline, with an explanation | `SRC-029`, `SRC-033` | [ADR-0006](../adr/0006-jobs-and-persistence.md), [ADR-0011](../adr/0011-private-local-and-publication.md) | `TASK-LOC-009`, `TASK-WEB-010` | `ACC-009` |
| **SHR** | _Sharing and publication_ | | | | |
| `REQ-SHR-001` | Private by default | `SRC-012` | [ADR-0005](../adr/0005-snapshots-and-artifacts.md), [ADR-0011](../adr/0011-private-local-and-publication.md) | `TASK-HST-010` | `ACC-008` |
| `REQ-SHR-002` | Publication selects an immutable snapshot and named artifacts | `SRC-037` | [ADR-0005](../adr/0005-snapshots-and-artifacts.md), [ADR-0011](../adr/0011-private-local-and-publication.md) | `TASK-HST-010`, `TASK-WEB-016` | `ACC-008` |
| `REQ-SHR-003` | Disclosure preview precedes publication | `SRC-037` | [ADR-0005](../adr/0005-snapshots-and-artifacts.md), [ADR-0011](../adr/0011-private-local-and-publication.md) | `TASK-HST-010`, `TASK-WEB-016` | `ACC-008` |
| `REQ-SHR-004` | Portable bundles are replayable and self-describing | `SRC-037` | [ADR-0005](../adr/0005-snapshots-and-artifacts.md), [ADR-0011](../adr/0011-private-local-and-publication.md) | `TASK-PRS-006` | `ACC-010` |
| `REQ-SHR-005` | Bundle import never executes and never publishes | `SRC-027` | [ADR-0004](../adr/0004-contract-authority.md), [ADR-0011](../adr/0011-private-local-and-publication.md) | `TASK-HST-012`, `TASK-SEC-004` | `ACC-005`, `ACC-008` |
| `REQ-SHR-006` | Imported evidence cannot impersonate server validation | `SRC-021`, `SRC-037` | [ADR-0005](../adr/0005-snapshots-and-artifacts.md), [ADR-0011](../adr/0011-private-local-and-publication.md) | `TASK-HST-012`, `TASK-PRS-002` | `ACC-005`, `ACC-006` |
| `REQ-SHR-007` | Access-controlled retrieval of publications | `SRC-037` | [ADR-0005](../adr/0005-snapshots-and-artifacts.md), [ADR-0011](../adr/0011-private-local-and-publication.md) | `TASK-HST-010`, `TASK-HST-013` | `ACC-008` |
| `REQ-SHR-008` | Revocation denies future retrieval, not past downloads | `SRC-012`, `SRC-037` | [ADR-0005](../adr/0005-snapshots-and-artifacts.md), [ADR-0011](../adr/0011-private-local-and-publication.md) | `TASK-HST-010`, `TASK-HST-013` | `ACC-008` |
| `REQ-SHR-009` | Replay links preserve metadata | `SRC-012`, `SRC-037` | [ADR-0005](../adr/0005-snapshots-and-artifacts.md), [ADR-0011](../adr/0011-private-local-and-publication.md) | `TASK-HST-008`, `TASK-WEB-016` | `ACC-008`, `ACC-010` |
| `REQ-SHR-010` | Publication does not imply correctness | `SRC-004`, `SRC-012` | [ADR-0005](../adr/0005-snapshots-and-artifacts.md), [ADR-0011](../adr/0011-private-local-and-publication.md) | `TASK-PRS-006`, `TASK-WEB-016` | `ACC-008` |
| **PLT** | _Platform_ | | | | |
| `REQ-PLT-001` | A versioned profile catalogue | `SRC-031` | [ADR-0006](../adr/0006-jobs-and-persistence.md), [ADR-0012](../adr/0012-research-gates-and-compatibility.md) | `TASK-FND-002`, `TASK-FND-008`, `TASK-HST-011` | `ACC-004`, `ACC-006` |
| `REQ-PLT-002` | Support level and availability are independent | `SRC-038` | [ADR-0006](../adr/0006-jobs-and-persistence.md), [ADR-0012](../adr/0012-research-gates-and-compatibility.md) | `TASK-FND-002`, `TASK-FND-008`, `TASK-HST-011` | `ACC-004`, `ACC-009` |
| `REQ-PLT-003` | Incompatibility is stated explicitly | `SRC-029` | [ADR-0006](../adr/0006-jobs-and-persistence.md), [ADR-0012](../adr/0012-research-gates-and-compatibility.md) | `TASK-HST-011`, `TASK-LOC-005`, `TASK-REL-003` | `ACC-009` |
| `REQ-PLT-004` | Unknown profile resolves to an explicit error | `SRC-029` | [ADR-0012](../adr/0012-research-gates-and-compatibility.md) | `TASK-HST-011`, `TASK-LOC-005` | `ACC-004` |
| `REQ-PLT-005` | Durable jobs, events and artifacts | `SRC-031` | [ADR-0006](../adr/0006-jobs-and-persistence.md), [ADR-0012](../adr/0012-research-gates-and-compatibility.md) | `TASK-HST-005`, `TASK-HST-006` | `ACC-004`, `ACC-007` |
| `REQ-PLT-006` | Event stream reconnects without fabricated stages | `SRC-012`, `SRC-031` | [ADR-0006](../adr/0006-jobs-and-persistence.md), [ADR-0012](../adr/0012-research-gates-and-compatibility.md) | `TASK-HST-008` | `ACC-007` |
| `REQ-PLT-007` | Cancellation and resource budgets | `SRC-031`, `SRC-038` | [ADR-0006](../adr/0006-jobs-and-persistence.md), [ADR-0012](../adr/0012-research-gates-and-compatibility.md) | `TASK-ENG-005`, `TASK-HST-007`, `TASK-REL-002` | `ACC-007` |
| `REQ-PLT-008` | Authenticated ownership | `SRC-037`, `SRC-038` | [ADR-0006](../adr/0006-jobs-and-persistence.md), [ADR-0012](../adr/0012-research-gates-and-compatibility.md) | `TASK-HST-002`, `TASK-HST-010`, `TASK-REL-002` | `ACC-008` |
| `REQ-PLT-009` | A free CPU tier with declared quotas | `SRC-034`, `SRC-038` | [ADR-0006](../adr/0006-jobs-and-persistence.md), [ADR-0012](../adr/0012-research-gates-and-compatibility.md) | `TASK-HST-014`, `TASK-REL-001` | `ACC-005`, `ACC-007` |
| `REQ-PLT-010` | Capacity targets are measured, not promised | `SRC-038` | [ADR-0006](../adr/0006-jobs-and-persistence.md), [ADR-0012](../adr/0012-research-gates-and-compatibility.md) | `TASK-FEA-006`, `TASK-HST-014`, `TASK-REL-003` | `ACC-007` |
| `REQ-PLT-011` | Reproducibility of a stored result | `SRC-031`, `SRC-043` | [ADR-0006](../adr/0006-jobs-and-persistence.md), [ADR-0012](../adr/0012-research-gates-and-compatibility.md) | `TASK-FND-006`, `TASK-HST-006` | `ACC-004`, `ACC-006` |
| `REQ-PLT-012` | Artifact isolation | `SRC-030`, `SRC-037` | [ADR-0006](../adr/0006-jobs-and-persistence.md), [ADR-0012](../adr/0012-research-gates-and-compatibility.md) | `TASK-HST-009`, `TASK-HST-013` | `ACC-007`, `ACC-008` |
| `REQ-PLT-013` | Deployment without a proprietary queue service | `SRC-034` | [ADR-0006](../adr/0006-jobs-and-persistence.md), [ADR-0012](../adr/0012-research-gates-and-compatibility.md) | `TASK-HST-015`, `TASK-REL-002` | `ACC-007` |
| `REQ-PLT-014` | No hosted GPU execution | `SRC-030`, `SRC-034` | [ADR-0007](../adr/0007-sandbox-and-local-runners.md) | `TASK-CUDA-001`, `TASK-HST-001` | `ACC-008`, `ACC-009` |
| `REQ-PLT-015` | Retention and deletion are explicit | `SRC-012`, `SRC-037` | [ADR-0006](../adr/0006-jobs-and-persistence.md), [ADR-0012](../adr/0012-research-gates-and-compatibility.md) | `TASK-HST-013` | `ACC-007`, `ACC-008` |
| **SEC** | _Security_ | | | | |
| `REQ-SEC-001` | Hosted execution runs untrusted code in a fail-closed sandbox | `SRC-030` | [ADR-0007](../adr/0007-sandbox-and-local-runners.md) | `TASK-HST-012`, `TASK-HST-016` | `ACC-007` |
| `REQ-SEC-002` | Sandbox preflight is a gate on profile availability | `SRC-030` | [ADR-0007](../adr/0007-sandbox-and-local-runners.md) | `TASK-HST-016`, `TASK-HST-017`, `TASK-REL-002` | `ACC-007` |
| `REQ-SEC-003` | Local execution requires explicit consent | `SRC-030` | [ADR-0007](../adr/0007-sandbox-and-local-runners.md) | `TASK-LOC-006`, `TASK-TRI-017` | `ACC-005`, `ACC-009` |
| `REQ-SEC-004` | Imports are untrusted input | `SRC-027` | [ADR-0007](../adr/0007-sandbox-and-local-runners.md) | `TASK-HST-012`, `TASK-SEC-004` | `ACC-005` |
| `REQ-SEC-005` | Resource, network and filesystem limits are enforced by the supervisor | `SRC-030`, `SRC-038` | [ADR-0007](../adr/0007-sandbox-and-local-runners.md) | `TASK-ENG-004`, `TASK-ENG-006` | `ACC-007` |
| `REQ-SEC-006` | No secrets in artifacts or logs | `SRC-037` | [ADR-0007](../adr/0007-sandbox-and-local-runners.md) | `TASK-ENG-007`, `TASK-HST-016` | `ACC-007`, `ACC-008` |
| `REQ-SEC-007` | Artifact access is authorized per request | `SRC-037` | [ADR-0007](../adr/0007-sandbox-and-local-runners.md) | `TASK-HST-013` | `ACC-008` |
| `REQ-SEC-008` | No automatic remote or hosted GPU execution | `SRC-030`, `SRC-034` | [ADR-0007](../adr/0007-sandbox-and-local-runners.md) | `TASK-CUDA-001`, `TASK-HST-001` | `ACC-008`, `ACC-009` |
| `REQ-SEC-009` | Publication is a threat boundary | `SRC-037` | [ADR-0007](../adr/0007-sandbox-and-local-runners.md) | `TASK-HST-010`, `TASK-WEB-016` | `ACC-008` |
| `REQ-SEC-010` | Worker least privilege | `SRC-030`, `SRC-037` | [ADR-0007](../adr/0007-sandbox-and-local-runners.md) | `TASK-HST-005`, `TASK-HST-013` | `ACC-007` |
| `REQ-SEC-011` | Scenario-supplied paths are never executable authority | `SRC-027`, `SRC-030` | [ADR-0007](../adr/0007-sandbox-and-local-runners.md) | `TASK-ENG-002`, `TASK-ENG-003` | `ACC-007` |
| `REQ-SEC-012` | Reused third-party code carries its notices | `SRC-014` | [ADR-0002](../adr/0002-monorepo-and-language-boundary.md), [ADR-0004](../adr/0004-contract-authority.md) | `TASK-FND-009`, `TASK-REL-004` | `ACC-009` |
| `REQ-SEC-013` | Malicious output cannot corrupt the record | `SRC-030` | [ADR-0007](../adr/0007-sandbox-and-local-runners.md) | `TASK-ENG-004`, `TASK-ENG-005` | `ACC-007` |
| **BCK** | _Backend expansion_ | | | | |
| `REQ-BCK-001` | Triton is the first delivery phase | `SRC-005` | [ADR-0009](../adr/0009-backend-semantics.md), [ADR-0012](../adr/0012-research-gates-and-compatibility.md) | `TASK-FEA-003`, `TASK-TRI-001`, `TASK-TRI-002`, `TASK-TRI-003`, `TASK-TRI-004`, `TASK-TRI-005`, `TASK-TRI-006`, `TASK-TRI-007`, `TASK-TRI-008`, `TASK-TRI-009`, `TASK-TRI-010`, `TASK-TRI-011`, `TASK-TRI-012`, `TASK-TRI-013`, `TASK-TRI-014`, `TASK-TRI-015`, `TASK-TRI-016`, `TASK-TRI-017` | `ACC-001`, `ACC-002`, `ACC-003` |
| `REQ-BCK-002` | CUDA C++ is a required later phase | `SRC-006` | [ADR-0009](../adr/0009-backend-semantics.md), [ADR-0012](../adr/0012-research-gates-and-compatibility.md) | `TASK-CUDA-001`, `TASK-CUDA-002`, `TASK-CUDA-003`, `TASK-CUDA-004`, `TASK-CUDA-005`, `TASK-CUDA-006`, `TASK-CUDA-007`, `TASK-CUDA-008`, `TASK-CUDA-009` | `ACC-009` |
| `REQ-BCK-003` | OpenMP is a required later phase | `SRC-006`, `SRC-017`, `SRC-031` | [ADR-0009](../adr/0009-backend-semantics.md), [ADR-0012](../adr/0012-research-gates-and-compatibility.md) | `TASK-OMP-001`, `TASK-OMP-002`, `TASK-OMP-003`, `TASK-OMP-004`, `TASK-OMP-005`, `TASK-OMP-006` | `ACC-009` |
| `REQ-BCK-004` | Per-tool capability matrix, pinned and probed | `SRC-031`, `SRC-035` | [ADR-0009](../adr/0009-backend-semantics.md), [ADR-0012](../adr/0012-research-gates-and-compatibility.md) | `TASK-CUDA-001`, `TASK-FND-008`, `TASK-OMP-001` | `ACC-009` |
| `REQ-BCK-005` | Real diagnostics from real tools | `SRC-021`, `SRC-029` | [ADR-0009](../adr/0009-backend-semantics.md), [ADR-0012](../adr/0012-research-gates-and-compatibility.md) | `TASK-CUDA-005`, `TASK-OMP-004`, `TASK-PRS-002` | `ACC-009` |
| `REQ-BCK-006` | Compiler and profiler artifacts are first-class records | `SRC-031`, `SRC-048` | [ADR-0009](../adr/0009-backend-semantics.md), [ADR-0012](../adr/0012-research-gates-and-compatibility.md) | `TASK-CUDA-003`, `TASK-CUDA-008`, `TASK-TRI-013` | `ACC-009`, `ACC-010` |
| `REQ-BCK-007` | Backend-specific ordering, atomic and synchronization models | `SRC-019`, `SRC-024` | [ADR-0009](../adr/0009-backend-semantics.md), [ADR-0012](../adr/0012-research-gates-and-compatibility.md) | `TASK-CUDA-007`, `TASK-FND-006`, `TASK-OMP-005` | `ACC-009` |
| `REQ-BCK-008` | Feature-by-feature expansion with independent conformance | `SRC-029` | [ADR-0009](../adr/0009-backend-semantics.md), [ADR-0012](../adr/0012-research-gates-and-compatibility.md) | `TASK-TRX-001`, `TASK-TRX-002`, `TASK-TRX-003`, `TASK-TRX-004`, `TASK-TRX-005` | `ACC-009` |
| `REQ-BCK-009` | The missing-barrier demonstration belongs to the native phases | `SRC-005`, `SRC-032` | [ADR-0009](../adr/0009-backend-semantics.md) | `TASK-CUDA-006`, `TASK-OMP-005` | `ACC-009`, `ACC-010` |
| `REQ-BCK-010` | Interpreter replay is not GPU behaviour | `SRC-022`, `SRC-049` | [ADR-0009](../adr/0009-backend-semantics.md), [ADR-0012](../adr/0012-research-gates-and-compatibility.md) | `TASK-TRI-016` | `ACC-001`, `ACC-006` |
| `REQ-BCK-011` | Unsupported is never emulated | `SRC-029` | [ADR-0009](../adr/0009-backend-semantics.md), [ADR-0012](../adr/0012-research-gates-and-compatibility.md) | `TASK-FND-008`, `TASK-WEB-010` | `ACC-002`, `ACC-009` |
| `REQ-BCK-012` | Cross-backend comparison is of evidence, not of semantics | `SRC-019`, `SRC-024` | [ADR-0009](../adr/0009-backend-semantics.md), [ADR-0012](../adr/0012-research-gates-and-compatibility.md) | `TASK-FND-006`, `TASK-WEB-006` | `ACC-010` |
| **ENG** | _Engine and lifecycle_ | | | | |
| `REQ-ENG-001` | Exactly one initial hello, versioned | `SRC-029` | [ADR-0002](../adr/0002-monorepo-and-language-boundary.md), [ADR-0006](../adr/0006-jobs-and-persistence.md) | `TASK-ENG-001`, `TASK-ENG-004` | `ACC-007` |
| `REQ-ENG-002` | JSON Lines on stdin and stdout, diagnostics on stderr | `SRC-029` | [ADR-0002](../adr/0002-monorepo-and-language-boundary.md), [ADR-0006](../adr/0006-jobs-and-persistence.md) | `TASK-ENG-001` | `ACC-007` |
| `REQ-ENG-003` | Launch by fixed argv over a read-only request file | `SRC-030` | [ADR-0002](../adr/0002-monorepo-and-language-boundary.md), [ADR-0006](../adr/0006-jobs-and-persistence.md) | `TASK-ENG-002`, `TASK-ENG-003` | `ACC-007` |
| `REQ-ENG-004` | Envelope validation and per-direction sequence | `SRC-030` | [ADR-0002](../adr/0002-monorepo-and-language-boundary.md), [ADR-0006](../adr/0006-jobs-and-persistence.md) | `TASK-ENG-004` | `ACC-007` |
| `REQ-ENG-005` | Directional cancellation with bounded termination | `SRC-030` | [ADR-0002](../adr/0002-monorepo-and-language-boundary.md), [ADR-0006](../adr/0006-jobs-and-persistence.md) | `TASK-ENG-005`, `TASK-ENG-006`, `TASK-HST-007` | `ACC-007` |
| `REQ-ENG-006` | Job state machine with immutable terminal states | `SRC-031` | [ADR-0002](../adr/0002-monorepo-and-language-boundary.md), [ADR-0006](../adr/0006-jobs-and-persistence.md) | `TASK-ENG-005`, `TASK-HST-005` | `ACC-004`, `ACC-007` |
| `REQ-ENG-007` | Completion cannot outrun a recorded cancellation | `SRC-012`, `SRC-031` | [ADR-0006](../adr/0006-jobs-and-persistence.md) | `TASK-ENG-005`, `TASK-HST-007` | `ACC-004`, `ACC-007` |
| `REQ-ENG-008` | Partial evidence survives cancellation | `SRC-012`, `SRC-021` | [ADR-0002](../adr/0002-monorepo-and-language-boundary.md), [ADR-0006](../adr/0006-jobs-and-persistence.md) | `TASK-ENG-005`, `TASK-HST-006` | `ACC-004` |
| `REQ-ENG-009` | One job, one attempt | `SRC-031` | [ADR-0006](../adr/0006-jobs-and-persistence.md) | `TASK-ENG-005`, `TASK-HST-007` | `ACC-004` |
| `REQ-ENG-010` | Immutable result records under a job | `SRC-012`, `SRC-031` | [ADR-0002](../adr/0002-monorepo-and-language-boundary.md), [ADR-0006](../adr/0006-jobs-and-persistence.md) | `TASK-ENG-005`, `TASK-FND-006` | `ACC-004` |
| `REQ-ENG-011` | Leases fence stale workers | `SRC-031` | [ADR-0006](../adr/0006-jobs-and-persistence.md) | `TASK-HST-005`, `TASK-HST-007` | `ACC-007` |
| `REQ-ENG-012` | Cancellation finalises deterministically | `SRC-031` | [ADR-0006](../adr/0006-jobs-and-persistence.md) | `TASK-ENG-005`, `TASK-HST-007` | `ACC-007` |
| `REQ-ENG-013` | One error vocabulary | `SRC-029` | [ADR-0002](../adr/0002-monorepo-and-language-boundary.md), [ADR-0006](../adr/0006-jobs-and-persistence.md) | `TASK-ENG-004`, `TASK-FND-002`, `TASK-FND-006` | `ACC-005`, `ACC-007` |
| `REQ-ENG-014` | Synchronous error mapping, asynchronous error carriage | `SRC-029` | [ADR-0002](../adr/0002-monorepo-and-language-boundary.md), [ADR-0006](../adr/0006-jobs-and-persistence.md) | `TASK-ENG-004`, `TASK-HST-003` | `ACC-007`, `ACC-008` |
| `REQ-ENG-015` | Budget breaches fail; budget exhaustion is unknown | `SRC-022`, `SRC-030` | [ADR-0002](../adr/0002-monorepo-and-language-boundary.md), [ADR-0006](../adr/0006-jobs-and-persistence.md) | `TASK-ENG-004`, `TASK-ENG-006` | `ACC-003`, `ACC-007` |
| `REQ-ENG-016` | Progress and accepted evidence are append-only | `SRC-031` | [ADR-0002](../adr/0002-monorepo-and-language-boundary.md), [ADR-0006](../adr/0006-jobs-and-persistence.md) | `TASK-ENG-004`, `TASK-HST-006` | `ACC-007` |
| `REQ-ENG-017` | The engine owns no accounts and no publication | `SRC-030` | [ADR-0002](../adr/0002-monorepo-and-language-boundary.md), [ADR-0006](../adr/0006-jobs-and-persistence.md) | `TASK-ENG-002`, `TASK-HST-012` | `ACC-007` |

## Source coverage

Which requirements carry each source row. Every row dispositioned `retained` in
[`../reference/source-disposition.md`](../reference/source-disposition.md) appears here at least
once. Rows marked `evaluation-only` are carried by the named feasibility and evaluation tasks in
[`../evaluation/methodology.md`](../evaluation/methodology.md) and are not product promises; rows
marked `superseded` are recorded with their rationale and generate no work.

| Source | Disposition | Requirements |
|---|---|---|
| `SRC-001` | retained | `REQ-UX-004` |
| `SRC-002` | retained | `REQ-EVD-014`, `REQ-EXP-003` |
| `SRC-003` | retained | `REQ-DOM-001`, `REQ-DOM-002`, `REQ-DOM-003`, `REQ-DOM-004`, `REQ-DOM-010`, `REQ-PRJ-004`, `REQ-UX-012` |
| `SRC-004` | retained | `REQ-DOM-007`, `REQ-DOM-008`, `REQ-DOM-009`, `REQ-EVD-001`, `REQ-EVD-008`, `REQ-PERF-010`, `REQ-PERF-011`, `REQ-SHR-010`, `REQ-UX-012`, `REQ-VAL-001`, `REQ-VAL-002`, `REQ-VAL-003` |
| `SRC-005` | retained | `REQ-BCK-001`, `REQ-BCK-009`, `REQ-DOM-003`, `REQ-DOM-005`, `REQ-DOM-006`, `REQ-EXP-001`, `REQ-EXP-002`, `REQ-EXP-004`, `REQ-PRJ-002`, `REQ-PRJ-003`, `REQ-PRJ-005`, `REQ-PRJ-012` |
| `SRC-006` | retained | `REQ-BCK-002`, `REQ-BCK-003`, `REQ-VAL-005` |
| `SRC-007` | retained | `REQ-DOM-005`, `REQ-EXP-002`, `REQ-EXP-003`, `REQ-VAL-006` |
| `SRC-008` | evaluation-only | — |
| `SRC-009` | evaluation-only | — |
| `SRC-010` | retained | `REQ-DOM-011`, `REQ-PERF-008`, `REQ-PERF-009` |
| `SRC-011` | retained | `REQ-PRJ-001` |
| `SRC-012` | retained | `REQ-ENG-007`, `REQ-ENG-008`, `REQ-ENG-010`, `REQ-EVD-008`, `REQ-EVD-015`, `REQ-PLT-006`, `REQ-PLT-015`, `REQ-PRJ-007`, `REQ-PRJ-008`, `REQ-PRJ-010`, `REQ-PRJ-011`, `REQ-SHR-001`, `REQ-SHR-008`, `REQ-SHR-009`, `REQ-SHR-010`, `REQ-UX-001`, `REQ-UX-007`, `REQ-UX-008`, `REQ-UX-009`, `REQ-UX-015`, `REQ-VAL-011` |
| `SRC-013` | superseded | `REQ-UX-004` |
| `SRC-014` | retained | `REQ-SEC-012` |
| `SRC-015` | superseded | — |
| `SRC-016` | retained | `REQ-DOM-001`, `REQ-PRJ-004`, `REQ-VAL-001` |
| `SRC-017` | superseded | `REQ-BCK-003`, `REQ-VAL-008` |
| `SRC-018` | superseded | — |
| `SRC-019` | retained | `REQ-BCK-007`, `REQ-BCK-012`, `REQ-EVD-007`, `REQ-EVD-012`, `REQ-VAL-008` |
| `SRC-020` | retained | `REQ-EVD-014`, `REQ-EXP-005`, `REQ-EXP-007`, `REQ-EXP-008`, `REQ-PRJ-009` |
| `SRC-021` | retained | `REQ-BCK-005`, `REQ-DOM-008`, `REQ-ENG-008`, `REQ-EVD-001`, `REQ-EVD-003`, `REQ-EVD-004`, `REQ-PRJ-006`, `REQ-SHR-006`, `REQ-VAL-004` |
| `SRC-022` | retained | `REQ-BCK-010`, `REQ-ENG-015`, `REQ-EVD-002`, `REQ-EVD-003`, `REQ-EVD-009`, `REQ-EXP-006`, `REQ-UX-016`, `REQ-VAL-004` |
| `SRC-023` | retained | `REQ-DOM-006`, `REQ-EVD-005`, `REQ-EVD-006`, `REQ-EVD-013` |
| `SRC-024` | retained | `REQ-BCK-007`, `REQ-BCK-012`, `REQ-EVD-012`, `REQ-EXP-004`, `REQ-VAL-008`, `REQ-VAL-010` |
| `SRC-025` | retained | `REQ-VAL-012` |
| `SRC-026` | retained | `REQ-EVD-009`, `REQ-EVD-010` |
| `SRC-027` | retained | `REQ-CLI-007`, `REQ-PERF-003`, `REQ-PERF-006`, `REQ-PERF-012`, `REQ-PERF-013`, `REQ-SEC-004`, `REQ-SEC-011`, `REQ-SHR-005` |
| `SRC-028` | retained | `REQ-EXP-005`, `REQ-EXP-007`, `REQ-VAL-007` |
| `SRC-029` | retained | `REQ-BCK-005`, `REQ-BCK-008`, `REQ-BCK-011`, `REQ-CLI-014`, `REQ-DOM-004`, `REQ-DOM-010`, `REQ-ENG-001`, `REQ-ENG-002`, `REQ-ENG-013`, `REQ-ENG-014`, `REQ-EVD-011`, `REQ-EXP-010`, `REQ-EXP-013`, `REQ-PLT-003`, `REQ-PLT-004`, `REQ-PRJ-012`, `REQ-UX-010`, `REQ-UX-011`, `REQ-UX-016` |
| `SRC-030` | retained | `REQ-CLI-008`, `REQ-CLI-009`, `REQ-CLI-011`, `REQ-ENG-003`, `REQ-ENG-004`, `REQ-ENG-005`, `REQ-ENG-015`, `REQ-ENG-017`, `REQ-PLT-012`, `REQ-PLT-014`, `REQ-SEC-001`, `REQ-SEC-002`, `REQ-SEC-003`, `REQ-SEC-005`, `REQ-SEC-008`, `REQ-SEC-010`, `REQ-SEC-011`, `REQ-SEC-013` |
| `SRC-031` | retained | `REQ-BCK-003`, `REQ-BCK-004`, `REQ-BCK-006`, `REQ-DOM-012`, `REQ-ENG-006`, `REQ-ENG-007`, `REQ-ENG-009`, `REQ-ENG-010`, `REQ-ENG-011`, `REQ-ENG-012`, `REQ-ENG-016`, `REQ-EXP-011`, `REQ-PLT-001`, `REQ-PLT-005`, `REQ-PLT-006`, `REQ-PLT-007`, `REQ-PLT-011`, `REQ-PRJ-003`, `REQ-PRJ-005`, `REQ-PRJ-013`, `REQ-UX-007`, `REQ-VAL-011` |
| `SRC-032` | retained | `REQ-BCK-009` |
| `SRC-033` | retained | `REQ-CLI-001`, `REQ-CLI-002`, `REQ-CLI-003`, `REQ-CLI-007`, `REQ-CLI-008`, `REQ-CLI-010`, `REQ-CLI-014`, `REQ-VAL-009` |
| `SRC-034` | retained | `REQ-CLI-004`, `REQ-CLI-005`, `REQ-CLI-009`, `REQ-CLI-010`, `REQ-PLT-009`, `REQ-PLT-013`, `REQ-PLT-014`, `REQ-SEC-008` |
| `SRC-035` | retained | `REQ-BCK-004`, `REQ-CLI-006`, `REQ-PERF-002`, `REQ-PERF-010`, `REQ-VAL-003` |
| `SRC-036` | retained | `REQ-UX-001`, `REQ-UX-002`, `REQ-UX-003`, `REQ-UX-017` |
| `SRC-037` | retained | `REQ-DOM-012`, `REQ-EVD-013`, `REQ-EXP-012`, `REQ-PLT-008`, `REQ-PLT-012`, `REQ-PLT-015`, `REQ-PRJ-010`, `REQ-PRJ-013`, `REQ-SEC-006`, `REQ-SEC-007`, `REQ-SEC-009`, `REQ-SEC-010`, `REQ-SHR-002`, `REQ-SHR-003`, `REQ-SHR-004`, `REQ-SHR-006`, `REQ-SHR-007`, `REQ-SHR-008`, `REQ-SHR-009`, `REQ-UX-015` |
| `SRC-038` | retained | `REQ-EXP-013`, `REQ-PLT-002`, `REQ-PLT-007`, `REQ-PLT-008`, `REQ-PLT-009`, `REQ-PLT-010`, `REQ-SEC-005`, `REQ-UX-010` |
| `SRC-039` | evaluation-only | — |
| `SRC-040` | evaluation-only | — |
| `SRC-041` | evaluation-only | — |
| `SRC-042` | retained | `REQ-DOM-009`, `REQ-VAL-005` |
| `SRC-043` | retained | `REQ-CLI-012`, `REQ-DOM-013`, `REQ-EXP-008`, `REQ-EXP-009`, `REQ-EXP-012`, `REQ-PLT-011`, `REQ-VAL-007` |
| `SRC-044` | evaluation-only | — |
| `SRC-045` | evaluation-only | — |
| `SRC-046` | evaluation-only | — |
| `SRC-047` | retained | `REQ-CLI-003`, `REQ-CLI-012`, `REQ-PRJ-009`, `REQ-VAL-009` |
| `SRC-048` | retained | `REQ-BCK-006`, `REQ-PERF-001`, `REQ-PERF-007` |
| `SRC-049` | retained | `REQ-BCK-010` |
| `SRC-050` | evaluation-only | — |
| `SRC-051` | retained | `REQ-EVD-007`, `REQ-PERF-013`, `REQ-UX-014` |
| `SRC-052` | retained | `REQ-PERF-004`, `REQ-PERF-005`, `REQ-PRJ-006` |
| `SRC-053` | retained | `REQ-CLI-013`, `REQ-UX-002` |
| `SRC-054` | retained | `REQ-DOM-007`, `REQ-EVD-008`, `REQ-PERF-011`, `REQ-UX-005`, `REQ-UX-006`, `REQ-UX-013` |
| `SRC-055` | retained | `REQ-PERF-004`, `REQ-PERF-007`, `REQ-PERF-008`, `REQ-UX-013` |

## Acceptance coverage

Which requirements each acceptance scenario observes.

| Acceptance | Requirements |
|---|---|
| `ACC-001` | `REQ-BCK-001`, `REQ-BCK-010`, `REQ-DOM-001`, `REQ-DOM-005`, `REQ-EVD-006`, `REQ-EVD-014`, `REQ-EXP-001`, `REQ-EXP-002`, `REQ-EXP-003`, `REQ-EXP-005`, `REQ-EXP-006`, `REQ-PRJ-002`, `REQ-PRJ-003`, `REQ-PRJ-005`, `REQ-VAL-006`, `REQ-VAL-007` |
| `ACC-002` | `REQ-BCK-001`, `REQ-BCK-011`, `REQ-DOM-006`, `REQ-DOM-010`, `REQ-EVD-001`, `REQ-EVD-004`, `REQ-EVD-005`, `REQ-EVD-011`, `REQ-EXP-004`, `REQ-EXP-005`, `REQ-EXP-010`, `REQ-EXP-013`, `REQ-UX-002`, `REQ-UX-014`, `REQ-VAL-007`, `REQ-VAL-012` |
| `ACC-003` | `REQ-BCK-001`, `REQ-DOM-001`, `REQ-DOM-002`, `REQ-DOM-003`, `REQ-DOM-004`, `REQ-DOM-007`, `REQ-DOM-008`, `REQ-DOM-009`, `REQ-DOM-013`, `REQ-ENG-015`, `REQ-EVD-003`, `REQ-EVD-004`, `REQ-EVD-006`, `REQ-EVD-008`, `REQ-EVD-009`, `REQ-EXP-007`, `REQ-EXP-008`, `REQ-EXP-009`, `REQ-EXP-012`, `REQ-PRJ-004`, `REQ-PRJ-005`, `REQ-UX-012` |
| `ACC-004` | `REQ-DOM-012`, `REQ-ENG-006`, `REQ-ENG-007`, `REQ-ENG-008`, `REQ-ENG-009`, `REQ-ENG-010`, `REQ-EVD-015`, `REQ-PLT-001`, `REQ-PLT-002`, `REQ-PLT-004`, `REQ-PLT-005`, `REQ-PLT-011`, `REQ-PRJ-001`, `REQ-PRJ-007`, `REQ-PRJ-008`, `REQ-PRJ-009`, `REQ-PRJ-010`, `REQ-PRJ-013`, `REQ-UX-005`, `REQ-UX-007`, `REQ-UX-008`, `REQ-UX-009`, `REQ-UX-010`, `REQ-VAL-009`, `REQ-VAL-011` |
| `ACC-005` | `REQ-CLI-001`, `REQ-CLI-002`, `REQ-CLI-003`, `REQ-CLI-004`, `REQ-CLI-005`, `REQ-CLI-007`, `REQ-CLI-009`, `REQ-CLI-010`, `REQ-CLI-011`, `REQ-CLI-012`, `REQ-CLI-013`, `REQ-DOM-003`, `REQ-ENG-013`, `REQ-PERF-012`, `REQ-PLT-009`, `REQ-PRJ-012`, `REQ-SEC-003`, `REQ-SEC-004`, `REQ-SHR-005`, `REQ-SHR-006`, `REQ-VAL-010` |
| `ACC-006` | `REQ-BCK-010`, `REQ-CLI-006`, `REQ-DOM-009`, `REQ-DOM-011`, `REQ-DOM-012`, `REQ-EVD-001`, `REQ-EVD-004`, `REQ-EVD-008`, `REQ-EVD-013`, `REQ-EXP-006`, `REQ-PERF-001`, `REQ-PERF-002`, `REQ-PERF-003`, `REQ-PERF-004`, `REQ-PERF-005`, `REQ-PERF-006`, `REQ-PERF-007`, `REQ-PERF-009`, `REQ-PERF-010`, `REQ-PERF-011`, `REQ-PERF-012`, `REQ-PLT-001`, `REQ-PLT-011`, `REQ-PRJ-003`, `REQ-PRJ-006`, `REQ-PRJ-013`, `REQ-SHR-006`, `REQ-UX-013`, `REQ-VAL-001`, `REQ-VAL-002`, `REQ-VAL-003`, `REQ-VAL-005`, `REQ-VAL-006`, `REQ-VAL-011` |
| `ACC-007` | `REQ-DOM-007`, `REQ-ENG-001`, `REQ-ENG-002`, `REQ-ENG-003`, `REQ-ENG-004`, `REQ-ENG-005`, `REQ-ENG-006`, `REQ-ENG-007`, `REQ-ENG-011`, `REQ-ENG-012`, `REQ-ENG-013`, `REQ-ENG-014`, `REQ-ENG-015`, `REQ-ENG-016`, `REQ-ENG-017`, `REQ-EVD-015`, `REQ-PERF-002`, `REQ-PERF-010`, `REQ-PLT-005`, `REQ-PLT-006`, `REQ-PLT-007`, `REQ-PLT-009`, `REQ-PLT-010`, `REQ-PLT-012`, `REQ-PLT-013`, `REQ-PLT-015`, `REQ-PRJ-004`, `REQ-SEC-001`, `REQ-SEC-002`, `REQ-SEC-005`, `REQ-SEC-006`, `REQ-SEC-010`, `REQ-SEC-011`, `REQ-SEC-013`, `REQ-UX-012`, `REQ-VAL-001`, `REQ-VAL-002`, `REQ-VAL-003` |
| `ACC-008` | `REQ-CLI-008`, `REQ-CLI-010`, `REQ-ENG-014`, `REQ-PLT-008`, `REQ-PLT-012`, `REQ-PLT-014`, `REQ-PLT-015`, `REQ-PRJ-010`, `REQ-SEC-006`, `REQ-SEC-007`, `REQ-SEC-008`, `REQ-SEC-009`, `REQ-SHR-001`, `REQ-SHR-002`, `REQ-SHR-003`, `REQ-SHR-005`, `REQ-SHR-007`, `REQ-SHR-008`, `REQ-SHR-009`, `REQ-SHR-010`, `REQ-UX-015` |
| `ACC-009` | `REQ-BCK-002`, `REQ-BCK-003`, `REQ-BCK-004`, `REQ-BCK-005`, `REQ-BCK-006`, `REQ-BCK-007`, `REQ-BCK-008`, `REQ-BCK-009`, `REQ-BCK-011`, `REQ-CLI-009`, `REQ-CLI-011`, `REQ-CLI-014`, `REQ-DOM-010`, `REQ-EVD-002`, `REQ-EVD-010`, `REQ-EVD-011`, `REQ-EVD-012`, `REQ-EVD-013`, `REQ-EXP-010`, `REQ-EXP-011`, `REQ-EXP-012`, `REQ-EXP-013`, `REQ-PERF-006`, `REQ-PLT-002`, `REQ-PLT-003`, `REQ-PLT-014`, `REQ-PRJ-011`, `REQ-SEC-003`, `REQ-SEC-008`, `REQ-SEC-012`, `REQ-UX-010`, `REQ-UX-011`, `REQ-UX-016`, `REQ-VAL-004`, `REQ-VAL-008`, `REQ-VAL-012` |
| `ACC-010` | `REQ-BCK-006`, `REQ-BCK-009`, `REQ-BCK-012`, `REQ-CLI-013`, `REQ-DOM-011`, `REQ-EVD-007`, `REQ-EVD-008`, `REQ-PERF-007`, `REQ-PERF-008`, `REQ-PERF-009`, `REQ-PERF-011`, `REQ-PERF-013`, `REQ-PRJ-009`, `REQ-SHR-004`, `REQ-SHR-009`, `REQ-UX-001`, `REQ-UX-002`, `REQ-UX-003`, `REQ-UX-004`, `REQ-UX-005`, `REQ-UX-006`, `REQ-UX-007`, `REQ-UX-013`, `REQ-UX-014`, `REQ-UX-017`, `REQ-VAL-009` |

