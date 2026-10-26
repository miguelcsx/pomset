# Triton engine — `TRI`

Epic `TRI`, milestone **M2 Local product**
([`README.md`](README.md)). The supported local symbolic subset is partially implemented and regression
tested. The complete task acceptance remains owed; see the
[current audit](../evaluation/implementation-audit.md).

**Whole-epic prerequisites.** The M0 feasibility go decision
([`01-feasibility.md`](01-feasibility.md)) and the `FND` foundation epic
(`TASK-FND-001`–`TASK-FND-009`), with `TASK-ENG-006` covering the cancellation
boundary. Each task names its own prerequisites below. Behaviour lives in
[`../architecture/triton-engine.md`](../architecture/triton-engine.md); the
decision is [`../adr/0008-triton-analysis.md`](../adr/0008-triton-analysis.md).

**Supported subset.** The supported Triton subset is **exactly** what
[`../architecture/triton-engine.md`](../architecture/triton-engine.md)
enumerates and nothing else: one explicit `@triton.jit` entrypoint, named
pointer and integer/constexpr parameters, `tl.program_id`, a constant-bounded
`tl.arange`, integer address arithmetic, comparisons and boolean masks,
`tl.load`/`tl.store` with address and mask, and static `tl.constexpr` control
flow. Any construct outside that list — data-dependent addresses, dynamic
loops, indirect loads, reductions, dot products, atomics — MUST return
`unsupported` with the construct named and its source range attached. The
symbolic path parses; it never imports or executes the user module.

### TASK-TRI-001  Parse the module and validate the single explicit entrypoint

**Purpose.** Parse the kernel module as source text and accept exactly one explicitly selected `@triton.jit` entrypoint, rejecting every other selection.
**Owns.** `engines/triton/src/pomset_triton/parse/entrypoint.py`, `engines/triton/src/pomset_triton/parse/module_index.py`
**Requirement links.** `REQ-PRJ-002`, `REQ-BCK-001`
**Prerequisites.** `TASK-FND-006`
**Implementation.** Read the snapshot file named by `Scenario.entrypoint.path` from the supervisor-provided read-only request mount and index it with `ast` only — never `import`, `exec`, `runpy` or `importlib`. Match `Scenario.entrypoint.symbol` against exactly one `FunctionDef` carrying the `triton.jit` decorator, and check the declared `constexpr` parameters against that signature. A missing path, a missing or duplicated symbol, a differently decorated function, or an unparsable module yields `INPUT_INVALID` with the location; a construct the parser cannot represent yields `unsupported`. Never fall back to the first decorated function.
**Acceptance.** A fixture with two decorated functions and an entrypoint naming the second analyses the second. Naming a plain function, naming neither, or naming an absent symbol produces an explicit error naming the mismatch, a non-zero CLI status, and no analysis result.
**Verification.** CPU-only, no GPU, no execution consent: `pytest engines/triton/tests/test_entrypoint.py -q` over `fixtures/kernels/triton/entrypoint_*`, then one `pomset analyze` run to observe the error record and exit status.
**Artifacts.** An immutable parsed module index with symbol table, decorator list and source ranges, consumed by `TASK-TRI-002` and `TASK-TRI-013`.

### TASK-TRI-002  Bind the domain variables to the extraction model

**Purpose.** Turn the scenario's declared workload domain and allocations into the typed symbolic variables the extractor reasons over.
**Owns.** `engines/triton/src/pomset_triton/model/domain_vars.py`, `engines/triton/src/pomset_triton/model/launch_binding.py`
**Requirement links.** `REQ-DOM-001`, `REQ-DOM-002`, `REQ-PRJ-003`
**Prerequisites.** `TASK-TRI-001`
**Implementation.** Map each `WorkloadDomain` variable — shape, dtype, layout/strides, launch configuration, block size, warps, stages, hardware cohort — onto a symbolic variable of a declared kind, value set or range. Map every `Allocation` (name, role, dtype, shape, strides) onto a symbolic buffer with a declared extent. Reject a domain that declares no variable for a dimension the kernel actually reads, and record which declared variables each extracted access depends on. The domain object is taken verbatim from the scenario; it is never inferred from the kernel or from a previous run.
**Acceptance.** For the fixture domain, the extractor prints the bound variable list with kinds and ranges, and each `tl.load`/`tl.store` site reports the declared variables its address depends on. A kernel reading an undeclared dimension is rejected with the dimension named.
**Verification.** CPU-only: `pytest engines/triton/tests/test_domain_binding.py -q`, asserting the binding table against the fixture's `WorkloadDomain` and confirming rejection of an undeclared dimension.
**Artifacts.** A domain-binding table and a symbolic allocation table, both serialisable and referenced by every later property result.

### TASK-TRI-003  Evaluate the launch AST under the shared width semantics

**Purpose.** Evaluate the scenario's restricted integer-expression launch tree against the domain, rejecting divisors and grid extents that the constraints do not prove safe.
**Owns.** `engines/triton/src/pomset_triton/model/int_expr.py`, `engines/triton/src/pomset_triton/model/launch_eval.py`
**Requirement links.** `REQ-DOM-003`, `REQ-PRJ-005`
**Prerequisites.** `TASK-TRI-002`
**Implementation.** Implement the `literal`, `parameter`, `add`, `subtract`, `multiply`, `floorDivide`, `modulo` and `ceilDivide` operators over the shared typed expression model used by scenario validation. Parameter names resolve only to declared domain variables; an unresolved name is `INPUT_INVALID`. Prove each divisor positive under the domain constraints and each resulting grid extent nonnegative; a failure is an explicit rejection, never a clamp. `displayHints` are text and are never parsed back into semantics. The same evaluation function is used by the extractor and the scenario evaluator, so the two cannot drift.
**Acceptance.** `floorDivide(N, BLOCK)` evaluates identically in the extractor and the scenario validator for every enumerated domain point. A launch whose divisor can be zero, or whose grid can be negative, is rejected with the offending subexpression quoted.
**Verification.** CPU-only: `pytest engines/triton/tests/test_launch_eval.py -q`, including the differential check against the validator's evaluator and the negative divisor and negative-extent cases.
**Artifacts.** A launch evaluation record (per domain point: grid, block, warps, stages) with the constraint proof that made it admissible.

### TASK-TRI-004  Model integer width, signedness and overflow

**Purpose.** Give every modelled integer its declared Triton width and signedness, including overflow, and reject widths the engine cannot represent.
**Owns.** `engines/triton/src/pomset_triton/model/width.py`
**Requirement links.** `REQ-DOM-004`
**Prerequisites.** `TASK-TRI-003`
**Implementation.** Implement bit-vector encodings for the widths the scenario may declare, with matching signedness and wrap-around behaviour, and thread the width through address arithmetic, comparisons and masks. A width the engine does not model is rejected as `unsupported` with the width named in the reason; the value is never widened to an unbounded mathematical integer, because widening would erase the overflow behaviour the analysis exists to find. A comparison between values of different declared widths is a model error, not an implicit promotion.
**Acceptance.** A fixture whose address arithmetic overflows a narrow integer produces the overflowed value under the model and an explicit `unsupported` under an unmodeled width; both outcomes name the width. No fixture yields a silently widened value.
**Verification.** CPU-only: `pytest engines/triton/tests/test_width.py -q` over boundary, overflow and unmodeled-width fixtures, checking exact bit patterns rather than symbolic equivalence alone.
**Artifacts.** A width table attached to the model revision, recording which widths are modelled and which are rejected.

### TASK-TRI-005  Extract load/store addresses and masks with source ranges

**Purpose.** Extract, per program instance and per lane, the symbolic address and predicate mask of every `tl.load` and `tl.store`, attributable to a source range.
**Owns.** `engines/triton/src/pomset_triton/extract/access.py`, `engines/triton/src/pomset_triton/extract/mask.py`
**Requirement links.** `REQ-EXP-001`, `REQ-EVD-006`
**Prerequisites.** `TASK-TRI-004`
**Implementation.** Walk the supported statement forms under the entrypoint and build, for each access site: the symbolic address expression over pointer arguments, `tl.program_id`, a constant-bounded `tl.arange` and declared shapes and strides; the boolean mask expression; and the source range of the call. Addresses and masks stay symbolic — a concrete address is attached only when a witness assigns every domain variable the expression depends on, and never invented for display. Value expressions that only the masks depend on may remain uninterpreted; the record says so.
**Acceptance.** For the fixture, each access site reports its address expression, mask expression and source range, with no concrete address present until a satisfying assignment exists; after a witness is found the same site reports the assigned address.
**Verification.** CPU-only: `pytest engines/triton/tests/test_extraction.py -q`, asserting expression structure, source ranges and the absence of invented concrete addresses.
**Artifacts.** An extracted access table keyed by source range, consumed by `TASK-TRI-006`, `TASK-TRI-007`, `TASK-TRI-008` and `TASK-TRI-012`.

### TASK-TRI-006  Build the allocation and declared-alias model

**Purpose.** Construct the buffer and alias-group model that address comparisons are made against.
**Owns.** `engines/triton/src/pomset_triton/model/allocations.py`, `engines/triton/src/pomset_triton/model/alias.py`
**Requirement links.** `REQ-DOM-006`, `REQ-EXP-001`
**Prerequisites.** `TASK-TRI-005`
**Implementation.** Instantiate each declared allocation with its role, dtype, shape, strides and derived element count; treat two allocations as non-overlapping unless a declared alias group contains both. Bind each extracted pointer argument to its allocation; an access through a pointer bound to no allocation is `INPUT_INVALID`. Sizes are symbolic and constrained by the domain; no dimension is assumed positive, non-zero or divisible unless the constraints establish it. A declared-alias case the engine cannot model is declined explicitly rather than approximated.
**Acceptance.** The overlapping-write fixture resolves both writes to one allocation with a shared alias group, while the corrected control resolves them to distinct allocations and therefore to no conflict. An access through an unbound pointer is rejected, not assigned a default buffer.
**Verification.** CPU-only: `pytest engines/triton/tests/test_alloc_alias.py -q`, including the alias-group positive and negative cases and the unbound-pointer rejection.
**Artifacts.** A symbolic allocation and alias-group table referenced by every address comparison and by the bounds query.

### TASK-TRI-007  Build actors, memory-access events and the causal partial order

**Purpose.** Emit the actors, events and established order edges that any finding depends on.
**Owns.** `engines/triton/src/pomset_triton/extract/actors.py`, `engines/triton/src/pomset_triton/extract/order.py`
**Requirement links.** `REQ-EVD-005`, `REQ-EVD-006`, `REQ-EVD-007`
**Prerequisites.** `TASK-TRI-006`
**Implementation.** Create one actor per program instance or lane coordinate, one `MemoryAccessEvent` per extracted access at that actor, and source ranges for both. Build a partial order containing only the edges the supported model establishes — program order within an instance, and nothing else where the model establishes nothing — and label every edge with its relation kind. Never synthesise a total order or a timeline to make a view legible. Serialise actors, events and edges as immutable records so a finding can reference several of each.
**Acceptance.** The overlapping-write fixture yields two distinct actors, two write events, at least two source ranges and no fabricated ordering edge between them; a single-instance fixture yields program-order edges and no cross-instance edges.
**Verification.** CPU-only: `pytest engines/triton/tests/test_actors_order.py -q`, asserting actor and event counts, edge kinds, and the absence of unestablished edges.
**Artifacts.** An actor table, an event table and a partial-order record, referenced by findings and by the workbench's causal view.

### TASK-TRI-008  Answer the bounds, coverage and conflict queries over Z3

**Purpose.** Run the three initial symbolic queries over one shared extraction under the declared solver budget.
**Owns.** `engines/triton/src/pomset_triton/query/bounds.py`, `engines/triton/src/pomset_triton/query/coverage.py`, `engines/triton/src/pomset_triton/query/conflict.py`, `engines/triton/src/pomset_triton/query/solver.py`
**Requirement links.** `REQ-DOM-005`, `REQ-EVD-009`, `REQ-EXP-002`, `REQ-EXP-003`, `REQ-EXP-004`, `REQ-EXP-012`
**Prerequisites.** `TASK-TRI-007`
**Implementation.** Encode bounds (some enabled access outside its allocation's extent), output coverage (some declared output index with no enabled write) and non-atomic write/write conflict (two distinct unordered non-atomic writers to one address) as separate satisfiability queries over the shared model, constrained by allocations, alias groups and domain constraints — never by an assumed divisibility or positivity. Apply the request's `solverTimeMs` and `memoryBytes`; record the query revision, model revision and solver version with every answer. `unsat` is reported as established over the declared model and domain only, with its assumptions attached; `sat` returns assignments plus the participating actors, addresses and source ranges; exhaustion, timeout or incomplete extraction returns `unknown` or `unsupported` with the limit named, never a crashed job and never a proof. Read/write conflict, atomics and cross-scope ordering are not encoded here.
**Acceptance.** For the flagships: `N=1024` with `BLOCK=256` and a floor-divided grid yields no modelled output hole, and `N=1025` yields unwritten output index 1024 with its snapshot, launch and mask provenance. A tightened `solverTimeMs` turns the same query into `unknown` naming the exhausted limit.
**Verification.** CPU-only with the pinned Z3 build: `pytest engines/triton/tests/test_queries.py -q` over `fixtures/kernels/triton/output_coverage_*` and `write_conflict_*`, including the budget-exhaustion case.
**Artifacts.** Three query implementations plus a solver-answer record carrying assumptions, budget, query revision and solver version.

### TASK-TRI-009  Assemble property results, regions and enumerated-denominator counts

**Purpose.** Turn query answers into `PropertyResult` and `Coverage` records that obey the closed outcome/method/evidence tuples and the denominator rule.
**Owns.** `engines/triton/src/pomset_triton/result/property.py`, `engines/triton/src/pomset_triton/result/coverage.py`
**Requirement links.** `REQ-DOM-007`, `REQ-DOM-008`, `REQ-EVD-001`, `REQ-EVD-003`
**Prerequisites.** `TASK-TRI-008`
**Implementation.** Emit one `PropertyResult` per property per region with outcome, method and evidence class drawn only from the closed matrix — `established` exclusively with `static`/`symbolic` and `verified-under-assumptions`, and only with a non-empty assumption set naming model revision and domain. Emit regions as constraint sets with independent per-property classifications. Emit a count or percentage only for a finite, explicitly enumerated denominator with duplicate points removed; otherwise emit constraints and sampled points and no proportion at all. Never collapse regions into one verdict.
**Acceptance.** An `established` result carries model revision, domain and assumption list; a sampled region stays `sampled`; a request that would produce a percentage over an unenumerated domain produces constraints instead, and the invalid-fixture shape `coverage-percentage-unenumerated.json` is rejected.
**Verification.** CPU-only: `pytest engines/triton/tests/test_property_result.py -q` plus schema validation of the emitted records against `packages/contracts/schema/evidence.schema.yaml`.
**Artifacts.** `PropertyResult` and `Coverage` records in the canonical evidence schema, consumed by the CLI report and the workbench.

### TASK-TRI-010  Implement the five sampling strategies

**Purpose.** Provide exhaustive, random, boundary, partition-guided and counterexample-guided sampling, each reproducible from its recorded identity.
**Owns.** `engines/triton/src/pomset_triton/explore/strategies.py`, `engines/triton/src/pomset_triton/explore/partition.py`
**Requirement links.** `REQ-DOM-009`, `REQ-DOM-013`, `REQ-EXP-007`, `REQ-EXP-008`, `REQ-EXP-009`
**Prerequisites.** `TASK-TRI-008`
**Implementation.** Implement the five strategies behind one interface emitting `SampledCheck {strategyId, strategyRevision, seed, points, observations, budget}` with passed/failed/error observations. Exhaustive is available only over an enumerated finite domain. Random and boundary draws come from a seeded generator; partition-guided draws add the partition derivation; counterexample-guided draws record the witness and add the constraints implied by that witness as the next region boundary, then re-query the complement while budget remains. Nothing depends on wall-clock time, process identity or iteration order. A sampled region is never relabelled `established`.
**Acceptance.** Re-running any strategy with the recorded seed, revision and budget reproduces the identical point list on a different machine; the counterexample-guided run records the witness that redirected it; the partition boundaries quote their originating witness.
**Verification.** CPU-only: `pytest engines/triton/tests/test_strategies.py -q`, including a cross-process determinism check and a comparison run over exhaustive, random and boundary strategies on one fixture.
**Artifacts.** Strategy implementations, a `SampledCheck` record per run, and the partition derivation graph.

### TASK-TRI-011  Run the numerical reference with declared tolerances and poisoned outputs

**Purpose.** Compare a kernel run against the declared reference under explicitly recorded tolerances, using fresh or poisoned output buffers.
**Owns.** `engines/triton/src/pomset_triton/numerics/reference.py`, `engines/triton/src/pomset_triton/numerics/compare.py`
**Requirement links.** `REQ-PRJ-006`, `REQ-VAL-005`, `REQ-VAL-006`
**Prerequisites.** `TASK-TRI-002`
**Implementation.** Resolve the scenario's `ReferenceComputation` (kind, path, symbol) from the read-only mount; an undeclared reference blocks the check. Allocate output buffers fresh or fill them with a recorded poison pattern before the kernel runs, and record whether a reused autotune buffer was in play. Compare under the declared dtype, absolute and relative tolerances, and the declared NaN/Inf policy, reporting the first differing element with observed and expected values. A comparison against residue from a previous run is refused as evidence that an output was written. Executing the reference requires local execution consent; without it the check is `blocked`, not silently skipped.
**Acceptance.** Against a poisoned buffer, an unwritten output index is reported as a differing element rather than hidden by stale values; an identical re-run with a reused autotune buffer and no poison is refused as evidence; a missing reference declaration blocks the check with a named reason.
**Verification.** CPU-only with the pinned interpreter and NumPy: `pytest engines/triton/tests/test_numerics.py -q` over the fresh-buffer, poisoned-buffer and missing-reference cases.
**Artifacts.** A numerical comparison record carrying tolerances, dtype, NaN/Inf policy, fresh-buffer and autotune-reuse flags, and the first differing element.

### TASK-TRI-012  Detect and report every unsupported construct

**Purpose.** Stop extraction explicitly at each construct outside the supported subset and name it.
**Owns.** `engines/triton/src/pomset_triton/extract/unsupported.py`
**Requirement links.** `REQ-DOM-010`, `REQ-EVD-011`, `REQ-EXP-010`
**Prerequisites.** `TASK-TRI-005`
**Implementation.** Classify every statement and expression the extractor meets into supported or unsupported, with a dedicated detector per family: data-dependent addresses, dynamic loop bounds, indirect loads, reductions, dot products and atomics. An unsupported construct yields a region classified `unsupported` naming the construct and its source range, distinct from `unknown` with its budget reason; neither becomes an error code and neither is grouped with `established` regions. No approximate fallback is encoded, and no unsupported family is silently parsed as if it were supported.
**Acceptance.** One fixture per family returns `unsupported` with the family name and source range; an otherwise identical supported control returns a normal result; the atomics fixture never returns `established` or a conflict verdict.
**Verification.** CPU-only: `pytest engines/triton/tests/test_unsupported.py -q` over `fixtures/kernels/triton/unsupported_*`, checking the reported construct name and that no property result carries a conclusive outcome.
**Artifacts.** A construct-classification record with a per-family reason, plus the fixture list each later `TRX` expansion task must replace.

### TASK-TRI-013  Handle artifacts and source maps at declared confidence

**Purpose.** Record compilation artifacts and source mappings with an explicit exact, approximate or unavailable confidence, and keep compilation unexecuted.
**Owns.** `engines/triton/src/pomset_triton/artifacts/sourcemap.py`, `engines/triton/src/pomset_triton/artifacts/manifest.py`
**Requirement links.** `REQ-BCK-006`, `REQ-EXP-011`, `REQ-PRJ-011`
**Prerequisites.** `TASK-TRI-001`
**Implementation.** Emit `ArtifactManifest` records for every produced artifact — extracted access table, generated constraints, solver transcripts, intermediate representations — with kind, content hash, byte count, media type and producing revision. Record each source-to-IR correspondence with `confidence` of `exact`, `approximate` or `unavailable`, and never present an approximate mapping as exact. A compilation operation inside this path yields artifacts only: it does not execute the compiled program and its output is never counted as behaviour evidence.
**Acceptance.** A fixture with an ambiguous mapping reports `approximate`; a fixture with no mapping reports `unavailable`; artefacts resolve by content hash and are retrievable by their owner only; a compile step produces artifacts and leaves the compiled program unexecuted.
**Verification.** CPU-only: `pytest engines/triton/tests/test_artifacts.py -q`, validating manifests against `packages/contracts/schema/evidence.schema.yaml` and asserting the confidence values per fixture.
**Artifacts.** An artifact manifest set and a confidence-tagged source map, consumed by the workbench's view toggle and by bundle export.

### TASK-TRI-014  Emit the qualified correction hint for the floor-grid pattern

**Purpose.** Recognise the positive-`N`/positive-`BLOCK` floor-divided grid pattern behind an output-coverage witness and offer a qualified correction hint.
**Owns.** `engines/triton/src/pomset_triton/result/correction_hint.py`
**Requirement links.** `REQ-EVD-014`
**Prerequisites.** `TASK-TRI-009`
**Implementation.** On an output-coverage witness, test the launch expression for exactly the recognised shape: a positive `N`, a positive `BLOCK`, and a `floorDivide(N, BLOCK)` grid. When it matches, attach a correction hint quoting the recognised pattern, its location and the suggested `ceilDivide(N, BLOCK)` displayed as `triton.cdiv(N, BLOCK)`. The hint never edits the kernel, never rewrites the snapshot, is explicitly labelled as an unverified suggestion, and requires the user to rerun validation. Any other witness receives no hint; generic repair synthesis is out of scope.
**Acceptance.** The `N=1025` fixture attaches the hint and leaves the snapshot byte-identical; the corrected control attaches no hint; a witness from a different cause attaches no hint; the hint text states that a rerun is required and that no repair is proved.
**Verification.** CPU-only: `pytest engines/triton/tests/test_correction_hint.py -q`, asserting hint presence, trigger pattern and that no file in the fixture snapshot changed after the run.
**Artifacts.** A `correctionHint` record attached to the qualifying property result, consumed by the workbench hint panel.

### TASK-TRI-015  Minimize witnesses and record replay

**Purpose.** Attempt witness minimization without dropping any assumption the result depends on, and record the replay outcome.
**Owns.** `engines/triton/src/pomset_triton/witness/minimize.py`, `engines/triton/src/pomset_triton/witness/replay_record.py`
**Requirement links.** `REQ-EXP-005`, `REQ-VAL-007`
**Prerequisites.** `TASK-TRI-008`
**Implementation.** Starting from a satisfying assignment, attempt to drop domain assignments the property does not depend on, re-checking each candidate so that no assumption required by the result is removed; record what was dropped and what was kept. Record the minimization outcome even when the witness cannot be reduced. When a replay path exists, record its method and outcome as `reproduced`, `not-reproduced` or `blocked`, with the reason and the missing tool or device named; a failed or blocked replay is retained, never omitted. A witness that still reproduces after minimization is reported as minimized; one that does not is reported unminimized with its original assignment set intact.
**Acceptance.** The overlapping-write witness minimizes to a strictly smaller assignment set that still satisfies the query; a deliberately unminimizable fixture reports an unminimized witness; a blocked replay names the absent path and leaves the witness intact.
**Verification.** CPU-only: `pytest engines/triton/tests/test_minimize.py -q`, asserting that every minimized witness re-satisfies the query under the same model revision and that no dropped assumption was load-bearing.
**Artifacts.** `Witness.minimization` and `Witness.replay` records under the canonical witness type.

### TASK-TRI-016  Replay through the CPU interpreter, labelled as numerical and modelling

**Purpose.** Replay a witness's numerical behaviour through the Triton CPU interpreter and surface its documented limitations instead of working around them.
**Owns.** `engines/triton/src/pomset_triton/replay/interpreter.py`
**Requirement links.** `REQ-BCK-010`, `REQ-EXP-006`
**Prerequisites.** `TASK-TRI-011`
**Implementation.** Execute the fixture through the pinned interpreter on the witness's assigned domain point, and record the outcome as a numerical and modelling mechanism. Probe and surface the interpreter's documented limitations — sequential program-instance execution, unmodelled GPU scheduling, and the documented dtype and indirect-load restrictions — as capability notes attached to the replay record. Never present interpreter replay as evidence of GPU race scheduling, race freedom or GPU speed; a limitation that makes the replay inapplicable yields `unsupported` for that replay, not a cast around the limitation. Replay that executes anything requires local execution consent.
**Acceptance.** The `N=1025` witness replays numerically and the record states that the result is modelling, not GPU behaviour; a fixture using a documented-unsupported dtype reports the limitation rather than silently casting; without consent the replay is `blocked`.
**Verification.** CPU-only, no GPU: `pytest engines/triton/tests/test_interpreter_replay.py -q`, asserting the replay classification, the surfaced limitation and the consent gate.
**Artifacts.** A replay record carrying method, outcome, the assigned domain point and the interpreter limitation notes.

### TASK-TRI-017  Compile and replay inside the sandbox, under local execution consent

**Purpose.** Provide the genuine compilation and replay path as a separate operation from symbolic parsing, gated by sandboxing and explicit consent.
**Owns.** `engines/triton/src/pomset_triton/replay/compile.py`, `engines/triton/src/pomset_triton/replay/sandbox.py`
**Requirement links.** `REQ-BCK-001`, `REQ-SEC-003`
**Prerequisites.** `TASK-ENG-006`
**Implementation.** Implement the executable path as its own engine operation, launched by the supervisor's fixed argv over a read-only request file, requiring `--trust-local-code` for the invocation; pure static or symbolic parsing needs no consent and stays in the parse-only path. Confine compilation and replay to the sandbox described in [`../architecture/security-and-deployment.md`](../architecture/security-and-deployment.md) with the request's memory, wall-clock, message, output and artifact limits enforced by the supervisor; a sandbox that cannot be established makes the operation unavailable rather than unsandboxed. Compilation produces artifacts and leaves the compiled program unexecuted; the compiled artifact from `TASK-TRI-013` is the input to replay. Cancellation follows the directional protocol owned by `TASK-ENG-006`.
**Acceptance.** Without `--trust-local-code` the executable operation is refused with a named reason while `analyze` still succeeds; with consent, a fixture compiles inside the sandbox and replays, and a fixture that attempts a network access or exceeds its output limit fails with `ENGINE_FAILED` and a specific reason, leaving the terminal attempt consistent.
**Verification.** Linux CPU sandbox profile: `pytest engines/triton/tests/test_sandbox_path.py -q` plus one supervisor-driven run asserting the consent refusal, the success case and the limit-breach failure.
**Artifacts.** A sandboxed compile/replay operation, its consent gate, and the sandbox configuration used for the probe record.
