# OpenMP and advanced Triton — `OMP` and `TRX`

Two epics share this file because both close at milestone **M6 Native backends**
([`README.md`](README.md)); they are separate sections with separate prefixes and
separate prerequisite chains, and neither may be scheduled from the other's tasks.
These are delivery targets, not completed acceptance claims. The local native
probe compiles, links and runs its owned OpenMP control; the user-kernel adapter
and instrumentation are unfinished. Advanced Triton families remain unsupported.
See [current evidence](../evaluation/implementation-audit.md).

**Whole-epic prerequisites.** The `FND` foundation epic
([`02-foundation.md`](02-foundation.md)) for the capability and profile manifest
format, the `TRI` epic ([`03-triton-engine.md`](03-triton-engine.md)) for the
extraction and query surface the advanced families extend, and the `PRS` epic
([`07-performance-and-sharing.md`](07-performance-and-sharing.md)) for the
measurement and profiler import contracts.

**Common rule for both sections.** Where a device or tool is missing, the affected
check is a **documented blocker** — never an executed check, never a fabricated
result. Behaviour is specified in
[`../architecture/native-backends.md`](../architecture/native-backends.md); the
decision is [`../adr/0009-backend-semantics.md`](../adr/0009-backend-semantics.md).

## Section: OpenMP — `OMP`

Local CPU concurrency analysis with real tooling. A timeout reported by any tool or
runner here is unknown progress, never a deadlock or a liveness finding
([`REQ-EVD-010`](../srs/evidence.md)).

### TASK-OMP-001  Probe the OpenMP toolchain and pin one capability entry per combination

**Purpose.** Replace "OpenMP is supported" with the small set of compiler, runtime and instrumentation combinations this backend has actually probed.
**Owns.** `engines/openmp/src/pomset_openmp/profiles/probe.py`, `engines/openmp/src/pomset_openmp/profiles/manifest.py`, `profiles/openmp/*.json`
**Requirement links.** `REQ-BCK-003`, `REQ-BCK-004`
**Prerequisites.** `TASK-FND-008`, `TASK-REL-001`
**Implementation.** Probe and record the C and C++ compiler identity and version, the `-fopenmp` support level actually observed, the OpenMP specification level reachable through `_OPENMP`, the libgomp or libomp runtime version linked at run time, the ThreadSanitizer availability for that exact compiler, and the Archer version when present. Write one immutable manifest per probed combination under `profiles/openmp/` in the `TASK-FND-008` format, with a support level per feature family — compilation, local execution, numerical reference, race instrumentation, thread and barrier diagnostics — and with availability kept separate from the support claim. A combination not present in the catalogue is unavailable, and an unknown profile id resolves to `PROFILE_NOT_FOUND` with no fallback. A missing compiler, sanitizer or Archer installation is reported as a blocker naming the component, never as a passing check.
**Acceptance.** `pomset profiles --backend openmp` lists exactly the probed combinations with their exact compiler, runtime and instrumentation versions and their per-family support levels; a combination missing ThreadSanitizer shows race instrumentation as `untested` or `unavailable` with the reason rather than inheriting support from a sibling combination; a request for an absent profile id fails with `PROFILE_NOT_FOUND`; removing Archer from the host changes the probe outcome rather than the claim.
**Verification.** Linux CPU host with the pinned toolchain: `pytest engines/openmp/tests/test_profiles.py -q`, then one manual probe with Archer installed and one without, comparing the recorded manifests with the probe output.
**Artifacts.** The capability and profile manifests under `profiles/openmp/`, the probe implementation, and the probe log used as the support record.

### TASK-OMP-002  Run OpenMP kernels locally against the declared reference

**Purpose.** Establish the correctness baseline the race and ordering work is interpreted against, using the same declared reference contract the other backends use.
**Owns.** `engines/openmp/src/pomset_openmp/run/compile.py`, `engines/openmp/src/pomset_openmp/run/launch.py`, `engines/openmp/src/pomset_openmp/run/reference.py`
**Requirement links.** `REQ-BCK-003`, `REQ-VAL-005`
**Prerequisites.** `TASK-OMP-001`
**Implementation.** Compile the fixture's translation unit with the pinned compiler and the probed flags through the supervisor's fixed argv boundary ([`../srs/engine-protocol.md`](../srs/engine-protocol.md)), record the compiler artifact, the exact flag vector including the thread count and scheduling settings, and the resolved OpenMP specification level. Execute the program as the engine's declared executable path under `--trust-local-code`, with the request's wall-clock, memory, message and output budgets enforced by the supervisor. Run the scenario's declared reference computation ([`../srs/projects.md`](../srs/projects.md)) and compare with the declared dtype, absolute and relative tolerances and NaN and Inf policy, reporting mismatching indices and both values. Record the thread count, the scheduling kind and chunk, and the environment identity with the result, and record the comparison as a numerical result rather than a race or correctness verdict. A race or ordering condition is never inferred from a numerical mismatch.
**Acceptance.** The race fixture's correct control agrees with the declared reference within tolerance at the recorded thread count and schedule; a defect that produces a wrong value reports the mismatching indices and both values rather than a bare failure; the compiler flags, the OpenMP specification level and the environment identity travel with the result; the same command without `--trust-local-code` is refused with a named reason while pure parsing still succeeds.
**Verification.** Linux CPU host with the pinned compiler, execution consent present: `pytest engines/openmp/tests/test_run.py -q` over the control and defective fixtures, asserting agreement, the reported mismatch indices and the recorded flags and environment identity.
**Artifacts.** A local runner and numerical reference record for OpenMP kernels, carrying flags, thread count, schedule and environment identity.

### TASK-OMP-003  Enforce fresh and poisoned output buffers in the OpenMP comparison

**Purpose.** Stop a reused or uninitialised output buffer from making an unwritten or wrongly written element look correct in the OpenMP numerical comparison.
**Owns.** `engines/openmp/src/pomset_openmp/run/buffers.py`, `fixtures/kernels/openmp/buffer-discipline/*`
**Requirement links.** `REQ-VAL-006`
**Prerequisites.** `TASK-OMP-002`
**Implementation.** Allocate every declared output allocation immediately before each timed or checked execution, zero or fill it with the scenario's declared poison pattern according to the declared role, and, in the poisoned case, run a comparison that reports any element still holding the poison value as an unwritten output at that index. Keep the fresh and poisoned runs as two records rather than one so their outcomes can disagree, and record which discipline was used, the poison pattern, the buffer digest before the run and the digest of what was written. Refuse to compare against a buffer allocated by the harness and reused across runs, and refuse a dtype or element pattern the runner cannot fill exactly.
**Acceptance.** A fixture that writes only part of its declared output reports the untouched indices as unwritten under poisoning while a fresh-buffer run leaves them at whatever the allocator supplied; running the same fixture twice with distinct poison patterns reports the same unwritten index set; a request to reuse a harness-allocated buffer is refused with the reason rather than silently allocating a replacement.
**Verification.** Linux CPU host with the pinned compiler: `pytest engines/openmp/tests/test_buffers.py -q`, asserting the unwritten index set across two poison patterns, the recorded digests and the refusal case.
**Artifacts.** The buffer-discipline implementation and its records, shared in shape with the CUDA and Triton comparison paths.

### TASK-OMP-004  Integrate ThreadSanitizer with Archer and normalise its race evidence

**Purpose.** Obtain genuine OpenMP-aware race reports and classify them honestly, including the effect of instrumentation on what was explored.
**Owns.** `engines/openmp/src/pomset_openmp/tsan/invoke.py`, `engines/openmp/src/pomset_openmp/tsan/archer.py`, `engines/openmp/src/pomset_openmp/tsan/normalize.py`
**Requirement links.** `REQ-BCK-005`, `REQ-EVD-002`, `REQ-EXP-004`, `REQ-VAL-008`
**Prerequisites.** `TASK-OMP-002`
**Implementation.** Build the fixture with the pinned compiler's ThreadSanitizer instrumentation and with Archer when the capability entry records it as compatible, and parse the real report format into normalised findings: a reported race produces an `observed` finding with the two memory accesses, their thread identities, the OpenMP region or task where each occurred and the source ranges from the compiled artifact, and a suppression or an unclassified report produces a `potential` finding rather than being dropped. Classify race, initialization and synchronization diagnostics as separate backend capability families with their own support levels. Record the instrumentation caveats with every finding: the sanitizer version, whether Archer was active, the observed thread count and schedule, that instrumentation changes timing and therefore changes which interleavings were explored, and that the report covers only the executions that ran. A run with no report is observed coverage of that run, never a proof of race freedom.
**Acceptance.** The race fixture produces an `observed` finding naming both accesses, their OpenMP regions and their source ranges, with the sanitizer and Archer versions recorded; the correct control produces no finding and is stored as observed coverage with the instrumentation caveats attached; a combination where Archer is unavailable still runs plain ThreadSanitizer and records its OpenMP-reporting limitation rather than reporting `unsupported` for the whole family; a missing sanitizer yields a blocker named component.
**Verification.** Linux CPU host with the pinned compiler, ThreadSanitizer and, where compatible, Archer: `pytest engines/openmp/tests/test_tsan.py -q` over the race fixture, its control and the no-Archer path, asserting the finding classes, the source ranges and the recorded caveats.
**Artifacts.** The sanitizer invocation and normalisation path, its findings with instrumentation caveats, and the race and synchronization capability entries it validates.

### TASK-OMP-005  Produce thread, task, barrier, deadlock and atomic-ordering evidence with stated limits

**Purpose.** Cover the OpenMP failure modes the sanitizer does not decide by itself, and demonstrate the missing barrier here rather than borrowing the Triton symbolic path.
**Owns.** `engines/openmp/src/pomset_openmp/diagnostics/threads.py`, `engines/openmp/src/pomset_openmp/diagnostics/barriers.py`, `engines/openmp/src/pomset_openmp/diagnostics/atomics.py`, `fixtures/kernels/openmp/missing-barrier/*`
**Requirement links.** `REQ-BCK-007`, `REQ-BCK-009`, `REQ-EVD-010`
**Prerequisites.** `TASK-OMP-004`
**Implementation.** Build the missing-barrier fixture — a parallel region where one thread consumes a value another thread has not yet published, with the barrier omitted — together with its correct control that inserts the barrier, and record for the defective case the ordering evidence linking the two accesses and the source ranges of the missing publication edge. Extend the same machinery to thread and task creation, task dependencies, barrier and flush placement, and atomic operations with their memory ordering and scope, each as its own capability family with a support level and a stated limitation. Declare the OpenMP ordering, atomicity, barrier and task-dependency semantics the backend models and attach that declaration to every finding; do not transfer CUDA or Triton semantics to an OpenMP finding. A run that does not finish inside its budget is reported as unknown progress, and a program waiting on a barrier that another thread never reaches is reported as a suspected ordering defect with the observation that a clock cannot separate blocking forever from waiting a long time. An atomic ordering the backend cannot model stays `unsupported` with its reason.
**Acceptance.** The missing-barrier fixture produces ordering evidence citing the omitted publication edge and its source ranges, and the correct control produces none; a variant that hangs is reported as unknown progress rather than as a deadlock; an unsupported atomic ordering is reported with the missing capability named; every finding carries the declared OpenMP semantics identifier at a revision and no cross-backend semantic transfer.
**Verification.** Linux CPU host with the pinned toolchain, execution consent present: `pytest engines/openmp/tests/test_diagnostics.py -q` over the missing-barrier fixture, its control, the hanging variant and an unsupported atomic-ordering fixture, asserting the evidence classes, the unknown-progress report and the semantics identifier.
**Artifacts.** The missing-barrier fixture and control, the thread, task, barrier and atomic diagnostics with their limitations, and the declared OpenMP semantics document.

### TASK-OMP-006  Conform the OpenMP scenario, CLI and workbench paths to the shared contracts

**Purpose.** Make the OpenMP backend usable through the same manifest, report and workbench surfaces as Triton and CUDA, so a user does not meet a second product for CPU concurrency.
**Owns.** `engines/openmp/src/pomset_openmp/conformance/*`, `fixtures/kernels/openmp/corpus/*`, `apps/cli/tests/backends/test_openmp.py`
**Requirement links.** `REQ-BCK-003`
**Prerequisites.** `TASK-OMP-005`, `TASK-WEB-010`
**Implementation.** Take one scenario whose entrypoint, allocations, launch configuration, required properties and profile are declared once and run it through the OpenMP path: validate the manifest against the same `Scenario` schema and capability check the other backends use, reject an unsupported required property with `INPUT_INVALID` or the appropriate unsupported outcome rather than skipping it, and emit the same machine-readable report shape with per-property outcomes, evidence classes, error records and the profile revision, including the CLI exit statuses 0, 1 and 2 ([`../srs/local-ci.md`](../srs/local-ci.md)). Exercise the same scenario through the workbench read path so the OpenMP findings render with their semantics, coverage and availability reasons beside the other backends' findings, with unavailable combinations shown rather than filtered out. Assemble the licensed OpenMP corpus with declared outcomes, including the race, missing-barrier, initialization and control fixtures, and record each miss explicitly. No separate report format, no separate viewer and no second scenario schema is introduced.
**Acceptance.** One manifest runs unchanged through `analyze`, produces the shared report shape with the OpenMP semantics and coverage recorded, and yields exit status 0, 1 and 2 on the satisfied, actually-failed and unsupported-required-property cases respectively; the same scenario's findings render in the shared workbench with unavailable profiles shown and explained; the corpus records its declared outcomes and flags any fixture whose outcome was not observed.
**Verification.** Linux CPU host with the pinned toolchain, execution consent present: `pytest engines/openmp/tests/test_conformance.py -q` plus one manual run of the scenario through the CLI and one load of its report in the workbench read path, asserting the shared report shape, the three exit statuses and the rendered availability reasons.
**Artifacts.** The OpenMP conformance tests, the licensed corpus with declared outcomes, and the backend entries in the shared capability catalogue.

## Section: advanced Triton feature families — `TRX`

Each family below is `unsupported` today with a named reason, and each becomes
available only after its own supported-model definition, extraction work, query
work and independent conformance fixtures have landed
([`REQ-BCK-008`](../srs/backend-expansion.md)). None of these tasks may weaken the
explicit-unsupported behaviour delivered by `TASK-TRI-012`; they extend it family by
family, and a family whose fixtures do not pass stays unsupported.

### TASK-TRX-001  Model dynamic control flow and data-dependent addressing

**Purpose.** Give the first advanced family a real semantics instead of a guess, so that loops and addresses that depend on loaded values can be analysed without pretending to know those values.
**Owns.** `engines/triton/src/pomset_triton/model/dynamic_control.py`, `engines/triton/src/pomset_triton/extract/dynamic_address.py`, `fixtures/kernels/triton/dynamic-control/*`
**Requirement links.** `REQ-BCK-008`
**Prerequisites.** `TASK-TRI-012`
**Implementation.** Define the supported model for value-dependent control flow and addresses: which loop shapes are admitted with a symbolic trip count, how a loaded value that only influences an address is represented as an uninterpreted term, and where a numerical claim is therefore forbidden. Extend the extractor to emit address expressions and masks containing those uninterpreted terms, and extend the bounds and coverage queries to answer over them where the query does not depend on the values; a query that does depend on a loaded value returns `unknown` with the reason rather than an answer under a guessed value. Keep integer width, signedness and overflow semantics from `TASK-TRI-004`; a loop or address whose width handling the model cannot represent remains unsupported. Add fixtures with a bounded trip count, an unbounded but constrained trip count and a genuinely data-dependent address, each with a declared outcome, and record extraction failures as explicit `unsupported` with the construct named.
**Acceptance.** The bounded-trip-count fixture yields a modelled result with the trip count as a symbolic variable; the data-dependent-address fixture yields a bounds or coverage answer that holds without assuming the loaded value, or `unknown` naming the value it would have had to assume; a construct the model declines is reported `unsupported` with the construct named, and no fixture produces a numerical correctness claim from an uninterpreted term.
**Verification.** CPU-only, no GPU: `pytest engines/triton/tests/test_dynamic_control.py -q`, asserting the modelled results, the uninterpreted-term handling and the `unknown` and `unsupported` outcomes; the fixtures and their declared outcomes checked into the corpus.
**Artifacts.** The dynamic-control supported-model definition, the extended extraction path, and the fixture set with declared outcomes.

### TASK-TRX-002  Model indirect loads and gather/scatter accesses

**Purpose.** Admit indirect memory access under a stated model, so a gather or scatter is analysed for the properties it can be analysed for and refused for the rest.
**Owns.** `engines/triton/src/pomset_triton/model/indirect.py`, `engines/triton/src/pomset_triton/extract/indirect_access.py`, `fixtures/kernels/triton/indirect/*`
**Requirement links.** `REQ-BCK-008`
**Prerequisites.** `TASK-TRI-012`
**Implementation.** Define the supported model for a load or store whose address comes from another memory location: represent the index as an uninterpreted term with its declared dtype and width, record that the accessed location is therefore symbolic rather than enumerable, and state which queries remain answerable. Extend the conflict and coverage extraction so that two indirect accesses to the same uninterpreted index are compared as the same term only when extraction proves them equal, and otherwise produce `unknown` rather than an assumed disjointness or an assumed conflict. Add fixtures for a gather with a provably in-range index, a scatter with an unconstrained index under declared constraints, and an indirect access the model declines, each with a declared outcome. Document the Triton interpreter's indirect-load limitation beside this capability and never work around it by substituting a different execution path.
**Acceptance.** The bounded-gather fixture yields a bounded index set with the constraints it relies on recorded; the unconstrained-scatter fixture yields `unknown` naming the unproven index relation rather than a conflict found or a conflict ruled out; the declined fixture reports `unsupported` with the construct named; no fixture claims GPU behaviour from interpreter replay.
**Verification.** CPU-only, no GPU: `pytest engines/triton/tests/test_indirect.py -q`, asserting the bounded-index result, the `unknown` on the unproven relation and the `unsupported` case; the interpreter limitation note asserted present in the record.
**Artifacts.** The indirect-access supported-model definition, the extended extraction path, and the fixture set with declared outcomes.

### TASK-TRX-003  Model reductions and dot products

**Purpose.** Cover the reduction and dot families with their real numerical semantics, so that a reduction is analysed as a reduction and not as an ordinary elementwise write.
**Owns.** `engines/triton/src/pomset_triton/model/reduction.py`, `engines/triton/src/pomset_triton/extract/reduction_access.py`, `fixtures/kernels/triton/reduction/*`
**Requirement links.** `REQ-BCK-008`
**Prerequisites.** `TASK-TRI-012`
**Implementation.** Define the supported model for `tl.sum`, `tl.max` and the dot-product operations: the accumulation dtype and its width and overflow behaviour, whether the reduction order is fixed or free in the model, the effect of that freedom on numerical agreement, and the memory accesses the operation performs through its input and output operands. Extract the reduction's input access set and its single output write, model the output write as one event attributable to the reduction rather than to each lane, and answer the bounds and coverage queries over the extracted accesses. Where the reduction order is free, a numerical comparison made through the reference path records that the tolerances must accommodate it or that the comparison is not available for that fixture. Add fixtures for a fixed-shape sum, a reduction whose accumulation overflows at the declared width and a dot product, each with a declared outcome. No reduction semantics is guessed from the elementwise path.
**Acceptance.** The sum fixture yields a coverage result treating the reduction output as one write with the reduction's input access set recorded; the overflow fixture reports the width behaviour from the declared accumulation dtype or declines the fixture; the dot-product fixture yields extraction and bounds results and, where the order is free, a comparison record stating that order freedom is accommodated in the tolerance rather than hidden in it.
**Verification.** CPU-only, no GPU: `pytest engines/triton/tests/test_reduction.py -q`, asserting the single-write coverage result, the accumulation-width handling and the order-freedom record; fixtures and declared outcomes checked in.
**Artifacts.** The reduction supported-model definition, the extraction path and the fixture set with declared outcomes.

### TASK-TRX-004  Model atomics and cross-scope ordering, or keep them explicitly unsupported

**Purpose.** Decide, with evidence, whether the Triton atomic and cross-scope families can be modelled honestly, and leave them unsupported when they cannot.
**Owns.** `engines/triton/src/pomset_triton/model/atomics.py`, `engines/triton/src/pomset_triton/extract/atomic_access.py`, `fixtures/kernels/triton/atomics/*`
**Requirement links.** `REQ-BCK-008`
**Prerequisites.** `TASK-TRI-012`
**Implementation.** Write the supported-model definition for the Triton atomic operations and the ordering they provide, stating the scope at which the model reasons, what ordering guarantee it may and may not assume, and which conflict queries become meaningful once writes are no longer all non-atomic. Extend extraction to distinguish an atomic access from a non-atomic one and to attach the modelled ordering to the event, so that the initial write/write conflict query keeps its non-atomic restriction and does not silently start reporting atomic accesses as conflicts. Add fixtures for an atomic accumulation, an atomic exchange followed by an ordinary read, and a cross-scope case the model declines, each with a declared outcome. If the definition cannot be made honest with the available semantics, record that finding and keep the family `unsupported` with the reason, rather than shipping a partial model under a support claim.
**Acceptance.** Either the atomic-accumulation fixture yields a result under the declared ordering model with the scope named and the cross-scope fixture reports `unsupported` naming the unmodelled ordering, or the family is recorded as remaining `unsupported` with the reason and the attempt documented; in both cases the non-atomic write/write conflict query's behaviour on the pre-existing fixtures is unchanged, and no finding borrows CUDA or OpenMP atomic semantics.
**Verification.** CPU-only, no GPU: `pytest engines/triton/tests/test_atomics.py -q`, asserting the modelled result and its scope, the declined fixture and the unchanged behaviour of the existing conflict fixtures.
**Artifacts.** The atomic and cross-scope supported-model definition, the extended extraction path, and either the conformance fixtures or the documented unsupported decision.

### TASK-TRX-005  Certify each advanced family and publish its capability entry

**Purpose.** Make support a per-family fact backed by fixtures that can fail, so no family is advertised on the strength of its implementation alone.
**Owns.** `fixtures/kernels/triton/advanced/corpus/*`, `fixtures/kernels/triton/advanced/expected/*`, `engines/triton/tests/conformance/advanced/*`, `profiles/triton/advanced/*.json`
**Requirement links.** `REQ-BCK-008`
**Prerequisites.** `TASK-TRX-001`, `TASK-TRX-002`, `TASK-TRX-003`, `TASK-TRX-004`
**Implementation.** Assemble the advanced corpus from the fixtures declared by `TASK-TRX-001` through `TASK-TRX-004`, each with its declared outcome, and run it through the extraction and query paths at a recorded revision. For each family, promote the capability entry to a supported level only for the constructs and query classes the fixtures actually exercise and that passed in that exact combination, and leave every other construct `unsupported` with the construct named. Record the corpus revision, the extraction and query model revisions and the solver version with the outcome, and make the extraction path refuse to start on a construct belonging to an unpromoted family. Where a fixture's declared outcome is not observed, record the miss explicitly; the miss is a result about the corpus, not a licence to relax the declared outcome. Publish the per-family entries so that the CLI, the workbench and the profile catalogue show the reason-carrying unavailability for every family that remains unsupported.
**Acceptance.** A full advanced-corpus run records, per fixture, the declared outcome and the observed outcome and names any miss; the capability entries list exactly the constructs and query classes whose fixtures passed, with model and solver revisions recorded; an input using a construct from an unpromoted family reports `unsupported` with that construct named rather than an approximate answer; a family whose fixtures did not pass stays unsupported with its reason visible in the workbench and the CLI.
**Verification.** CPU-only, no GPU: `pytest engines/triton/tests/conformance/advanced -q` executing the whole corpus and diffing observed against declared outcomes, plus one manual inspection of the published capability entries and of the unsupported reason shown for a remaining family.
**Artifacts.** The advanced corpus with declared outcomes, the conformance runner, and the per-family capability entries it validated.
