# Implementation audit and feasibility status

The implementation remains partial. The feasibility gate is **no-go**: no
independent comparative benefit has been measured. No canonical acceptance
scenario or backend capability is closed by the changes described here.
The user's subsequent instructions authorize editor and local foundation work;
that work does not satisfy or remove the release gate in ADR-0012.

The latest [editor and kernel review](editor-and-kernel-review.md) records tab
interactions, feature boundaries, model revision 3 regressions and fresh CPU probes.

## Reproducible evidence

```sh
nix develop -c pnpm run ci
nix develop -c python3 scripts/audit-spec.py
nix develop -c uv run --directory engines/triton python -m feasibility.gate
nix develop -c uv run python -m engines.native.probe --output docs/evaluation/reports/native-probe.json
```

The aggregate command includes dependency boundaries, generated bindings,
TypeScript, lint, Python lint and formatting, builds, TypeScript and Python tests,
canonical semantic fixtures, documentation, profiles, licences and cross-language
identity checks. Passing these checks is regression evidence, not specification
compliance. The [inventory](reports/inventory.md) maps requirements and delivery
targets; path existence is never acceptance evidence.

The [gate record](../../fixtures/kernels/feasibility/reports/gate-record.json)
now has seven internal coverage cases with zero mismatches. The earlier four
mismatches were repaired. The oracle is internal and limited to finite coverage
patterns. Bounds/conflict regressions are separate tests, not an independently
confirmed upstream defect corpus. Timings are actual CPU observations, not GPU
measurements. Independent tool comparisons and strategy measurements remain owed.

## Observed implementation and remaining work

| Area | Implemented locally | Still missing or limited |
|---|---|---|
| Contracts | Canonical schemas, generated TS/Python, semantic fixture rejection, source/evidence links and content hashes | Full cross-validator semantic parity and every hostile-input acceptance case |
| Triton model | Structured AST access extraction; typed modular integers; constraints and stepped ranges; bounds, output coverage and non-atomic conflict queries; source-linked witnesses and minimization | General aliasing, strides, multidimensional allocations, advanced families, sampling/partitioning, independent replay and numerical comparison |
| Supervision | Fixed argv, validated envelopes, raw byte limits, memory-tree sampling, actual artifact accounting, cooperative cancel then group kill, redacted diagnostics | Hosted filesystem/network containment, enforced quotas rather than sampling, teardown and full descendant/crash acceptance |
| Local persistence | SQLite transactions and CAS; immutable snapshots including configuration; append-only chunks; cancellation precedence; abandoned-owner recovery | Shared hosted adapter, artifact finalization/retention and exhaustive crash/race evaluation |
| CLI | Real analysis, static validation, compare, directory-bundle import/export, capability-gated loopback reader | Benchmark and numerical/replay runners; complete policy integration; early-invalid-input portable reports |
| Workbench | Full-height split Monaco editor; real canonical scenario editing/import and probed profile; local symbolic submission/cancellation; IndexedDB drafts and persisted job history; visual access graph, witness inputs and domain classification grid; captured source links, light/dark and local disclosure-preview download | Four simultaneous analysis lanes, hosted events, complete accessibility/performance evaluation, measured comparisons and publication/revocation |
| Native | Owned OpenMP fixture syntax, compile/link and CPU-reference run pass; actual compiler and environment recorded | User-kernel adapters, sanitizer normalization, conformance corpus and exact runtime/instrumentation probes |
| Hosted | Contract/package shells; separate loopback symbolic Express service under ADR-0013 | Hosted Express/OpenAPI routes, OIDC ownership, PostgreSQL/object storage, fenced leases, durable events, Linux gVisor and authorized publication |

## Environment availability is separate from implementation

| Check | Needs a GPU? | Current evidence / blocker |
|---|---|---|
| Triton symbolic queries | No | Local Z3 tests run; supported subset only |
| Triton interpreter replay | No | Pinned Triton wheel unavailable on Darwin arm64; runner also unfinished |
| CUDA PTX/cubin compilation and source mapping | No | `nvcc` absent; adapter also unfinished |
| CUDA static-tool integrations | No for analysis itself | Integration and independent conformance unfinished; exact tool environments required |
| CUDA numerical execution, sanitizer and Nsight measurements | Yes | No compatible device/vendor stack; integrations unfinished |
| OpenMP compilation and CPU execution | No | Local owned fixture passes with Nix Clang/libomp; no user-kernel support claim |
| OpenMP ThreadSanitizer/Archer | No | Integration unfinished; specified Linux combination not available here |
| Hosted containment and deployment load | No | Linux gVisor/deployment unavailable; hosted implementation unfinished |

The [native probe](reports/native-probe.json) retains actual argv, versions,
stdout/stderr, exit codes, hashes and elapsed observations. Installing a toolkit
must not automatically promote support; exact conformance fixtures must pass.

## Acceptance disposition

| Scenario | Current disposition |
|---|---|
| ACC-001 | Partial symbolic coverage and source-link evidence; hints, poisoning and replay unfinished |
| ACC-002 | Local conflict/control regressions; confirmed licensed corpus and full linked acceptance unfinished |
| ACC-003 | Width/constraint/query regressions; strategy comparisons and partitioning unfinished |
| ACC-004 | Local immutable capture/cancellation/recovery and session history; hosted acceptance unfinished |
| ACC-005 | Local analysis/import/export/compare/viewer regressions; complete offline installation and consented numerical workflow unfinished |
| ACC-006 | Contract/import qualifiers partial; benchmark, numerical and recommendation workflow unfinished |
| ACC-007 | Local protocol and lifecycle regressions; hosted implementation missing and Linux containment externally blocked |
| ACC-008 | Local file disclosure preview; hosted ownership/publication/revocation missing |
| ACC-009 | Owned CPU toolchain probe; native user-kernel adapters missing; CUDA device checks externally blocked |
| ACC-010 | Browser editor/evidence inspection partial; synchronization and measured performance demonstrations unfinished |

## Specification issues requiring resolution

- TASK-FEA-001 requests RMSNorm/RoPE as a confirmed defect while the source
  disposition excludes it as unconfirmed. It must not be counted as confirmed.
- Triton #9230 concerns disjoint autotune candidates and reused output buffers;
  the floor-grid reconstruction does not reproduce that exact behavior.
- TASK-FEA-005 should compare deterministic point sequences separately from
  observed timings; whole timing reports cannot honestly be byte-identical.
- TASK-TRI-004's mixed-width refusal and current same-signedness promotion need
  reconciliation against exact Triton semantics and independent conformance.
- A project is an ownership/storage unit. The editor-first interaction decision
  does not remove scenario declarations, immutable snapshots or publication rules.
