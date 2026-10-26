# CUDA backend — `CUDA`

Epic `CUDA`, milestone **M6 Native backends** ([`README.md`](README.md)). Every
task here is a delivery target, not a completed acceptance claim. The owned
native probe has a compilation-only path; this machine lacks `nvcc`, so no CUDA
compilation or execution has been observed. User-kernel adapters are unfinished.
See [current evidence](../evaluation/implementation-audit.md).

**Whole-epic prerequisites.** The `FND` foundation epic
([`02-foundation.md`](02-foundation.md)) for the capability and profile manifest
format, the `PRS` epic ([`07-performance-and-sharing.md`](07-performance-and-sharing.md))
for the measurement record and profiler import contract, and the `ENG` protocol
work ([`11-engine-and-security.md`](11-engine-and-security.md)) for the
supervisor's process boundary, budgets and cancellation.

**Scope of the promise.** No universal symbolic CUDA verification is offered. This
epic wires real, pinned vendor tooling to real artefacts and normalises what those
tools genuinely report; it does not model arbitrary CUDA semantics, and it does not
claim race freedom from a clean instrumented run. Every feature family that is not
explicitly probed and conformance-tested stays `unsupported` with a named reason.

**Where GPU work happens.** GPU execution runs only on user-operated machines,
under explicit per-run consent, never on hosted infrastructure and never started
from a web session
([`REQ-CLI-009`](../srs/local-ci.md), [`REQ-PLT-014`](../srs/platform.md),
[`REQ-SEC-008`](../srs/security.md)). Where no device or tool is present, the
affected check is a **documented blocker** — never an executed check, never a
fabricated result. Behaviour is specified in
[`../architecture/native-backends.md`](../architecture/native-backends.md) and
[`../architecture/security-and-deployment.md`](../architecture/security-and-deployment.md);
the decision is [`../adr/0009-backend-semantics.md`](../adr/0009-backend-semantics.md).

### TASK-CUDA-001  Pin the supported Linux compiler, device and tool profiles

**Purpose.** Turn "CUDA is supported" into a small, enumerated set of probed combinations with immutable capability entries, and make local GPU execution an explicit per-run choice.
**Owns.** `engines/cuda/src/pomset_cuda/profiles/probe.py`, `engines/cuda/src/pomset_cuda/profiles/manifest.py`, `profiles/cuda/*.json`
**Requirement links.** `REQ-BCK-002`, `REQ-BCK-004`, `REQ-CLI-009`, `REQ-PLT-014`, `REQ-SEC-008`
**Prerequisites.** `TASK-FND-008`, `TASK-REL-001`
**Implementation.** Implement a probe that records, for one Linux host, the `nvcc` version, the target compute capability, the driver version, the device name and compute capability as reported by the CUDA runtime, and the versions of Compute Sanitizer and both Nsight tools. Write one immutable manifest per probed combination under the planned `profiles/cuda/` directory using the `TASK-FND-008` capability format: each feature carries a support level (`validated`, `limited`, `untested`) and availability is derived from deployment and queue state, never rewritten into the support claim. A combination absent from the catalogue is unavailable; a requested profile id that is not present resolves to `PROFILE_NOT_FOUND` with no fallback to a nearby profile. The probe reports a missing compiler, driver or device as a blocker naming the missing component, never as a passing check. Nothing in this task runs a user kernel: the probe compiles only its own version-printing probes. Execution paths declare the local-GPU consent requirement and refuse when it is absent, and no code path submits GPU work to a hosted service or accepts work pushed from a web session.
**Acceptance.** On a host with the toolkit installed, `pomset profiles --backend cuda` lists exactly the combinations the probe observed, each with its exact tool and device versions; on a host without a device the command reports a blocker naming the missing component and produces no capability entry claiming support; a request for a profile id absent from the catalogue fails with `PROFILE_NOT_FOUND`; a GPU run without the explicit consent is refused before any device is opened.
**Verification.** Linux host with the pinned toolkit: `pytest engines/cuda/tests/test_profiles.py -q`, then one manual probe run on a machine with a device and one on a machine without, comparing the recorded manifests with the probe output.
**Artifacts.** The capability and profile manifests under `profiles/cuda/`, the probe implementation, and the probe log used as the support record for this combination.

### TASK-CUDA-002  Compile to PTX and cubin without executing the result

**Purpose.** Produce the compilation artefacts the backend reasons about, while keeping compilation strictly separate from execution, as the product's snapshot and publication invariants require.
**Owns.** `engines/cuda/src/pomset_cuda/compile/invoke.py`, `engines/cuda/src/pomset_cuda/compile/artifacts.py`
**Requirement links.** `REQ-PRJ-011`
**Prerequisites.** `TASK-CUDA-001`
**Implementation.** Invoke the pinned `nvcc` from the capability entry through the supervisor's fixed argv boundary ([`../srs/engine-protocol.md`](../srs/engine-protocol.md)), with the translation unit mounted read-only and scratch and artifact directories confined inside the sandbox. Emit PTX (`-ptx`) and cubin (`-cubin`) as separate artifacts recorded in an `ArtifactManifest`, together with the compiler log, the exact `nvcc` invocation arguments and the producing profile revision. Compilation never launches the produced module: no runtime handle is created, no launch call exists in this operation's code path, and the operation's engine result carries artifacts only, never a property result. A compile failure is recorded as `ENGINE_FAILED` with the compiler's diagnostic text bounded and redacted, and it fails only the compilation operation, leaving the terminal attempt consistent.
**Acceptance.** Compiling the bounds-violation fixture produces a PTX artifact and a cubin artifact retrievable from their manifest, the compiler log and the exact argument vector are recorded, and the run summary contains no property result and no device activity; a deliberately malformed translation unit fails with `ENGINE_FAILED` carrying the compiler diagnostic and still leaves no device activity; compiling publishes nothing and makes no artifact retrievable to anyone but the invoking owner.
**Verification.** Linux host with the pinned `nvcc`, no device required: `pytest engines/cuda/tests/test_compile.py -q`, asserting both artifact types, the recorded argument vector, the absence of a launch call in the produced operation trace, and the failure case; device activity observed as absent via `nvidia-smi` sampling during the run.
**Artifacts.** A compilation operation producing PTX, cubin and log artifacts, plus the artifact manifest format shared with `TASK-TRI-013`.

### TASK-CUDA-003  Map PTX and source at declared mapping confidence

**Purpose.** Make a PTX instruction or memory access attributable to a source range, or say honestly that it is not.
**Owns.** `engines/cuda/src/pomset_cuda/artifacts/lineinfo.py`, `engines/cuda/src/pomset_cuda/artifacts/ptx_parse.py`
**Requirement links.** `REQ-BCK-006`, `REQ-EXP-011`
**Prerequisites.** `TASK-CUDA-002`
**Implementation.** Parse the DWARF line information from the cubin produced by `TASK-CUDA-002` when `-lineinfo` is present, and parse the PTX text for instruction and memory-operand structure. For every PTX element the user can select, record a mapping with confidence `exact` (line information resolves it to one source range), `approximate` (the toolchain supplied a coarser or inlined association) or `unavailable` (no line information, as with an optimised-away or toolchain-generated instruction). An approximate or unavailable mapping is never rendered or serialised as exact, and a downstream finding that cites a PTX element inherits the mapping's confidence in its source range. Store the parsed structures as artifacts attached to the finding that cites them, with the cubin's digest, the `nvcc` version and the profile revision.
**Acceptance.** For a fixture compiled with `-lineinfo`, selecting a reported PTX memory instruction shows the source range it maps to with confidence `exact` and the cubin digest it came from; for the same fixture compiled without `-lineinfo`, the same selection reports `unavailable` with an explanation and shows no guessed source range; an inlined helper reports `approximate` rather than a fabricated exact line.
**Verification.** Linux host with the pinned `nvcc`, no device required: `pytest engines/cuda/tests/test_sourcemap.py -q` over the same source compiled with and without `-lineinfo`, asserting the three confidence values and the absence of a source range where confidence is `unavailable`; one manual inspection of the rendered view.
**Artifacts.** PTX and source-map structures carrying per-element mapping confidence, and the cubin digest binding each mapping to the binary it describes.

### TASK-CUDA-004  Run the numerical comparison against the declared reference

**Purpose.** Establish numerical agreement or disagreement with the scenario's declared reference on real GPU hardware, under declared tolerances and without letting a reused buffer hide an unwritten output.
**Owns.** `engines/cuda/src/pomset_cuda/numerics/runner.py`, `engines/cuda/src/pomset_cuda/numerics/compare.py`, `fixtures/kernels/cuda/reference/*`
**Requirement links.** `REQ-VAL-006`
**Prerequisites.** `TASK-CUDA-002`
**Implementation.** For a scenario that declares numerical agreement ([`../srs/projects.md`](../srs/projects.md)), run the compiled kernel under the local-GPU consent flag, allocating every output buffer immediately before the launch and filling it with the scenario's declared poison pattern so that an unwritten element cannot be mistaken for a correct value. Run the declared reference computation and compare element by element with the scenario's declared dtype, absolute and relative tolerances, and NaN and Inf policy, reporting mismatching indices, both values and the tolerance that was violated. Record the comparison as a numerical result, not as a race or correctness verdict, and record the buffer discipline (fresh or poisoned, which pattern), the device and profile revision, and the reference implementation's artifact digest. A dtype or buffer arrangement the runner cannot honour is rejected explicitly rather than approximated.
**Acceptance.** The output-coverage fixture run with a poisoned output buffer reports the missing write as a numeric mismatch at the unwritten index, not as an incidental equality; the correct control reports agreement within the declared tolerance; re-running with a fresh buffer rather than a reused one yields the same indices; a NaN policy of "forbid" turns a NaN result into a reported failure with the offending index rather than a pass.
**Verification.** Linux host with a GPU device, local execution consent present: `pytest engines/cuda/tests/test_numerics.py -q` plus the fixtures with and without poisoning, asserting the reported index sets and the recorded buffer discipline; the same comparison recorded as `blocked` when no device is present.
**Artifacts.** A numerical runner and comparison record carrying buffer discipline, tolerances, dtype, reference digest and device identity.

### TASK-CUDA-005  Normalise Compute Sanitizer diagnostics with their coverage limits

**Purpose.** Turn genuine Compute Sanitizer output into findings of the right evidence class, while keeping its documented coverage limits in front of the user.
**Owns.** `engines/cuda/src/pomset_cuda/sanitizer/invoke.py`, `engines/cuda/src/pomset_cuda/sanitizer/normalize.py`
**Requirement links.** `REQ-BCK-005`, `REQ-EVD-002`, `REQ-EXP-004`, `REQ-VAL-008`
**Prerequisites.** `TASK-CUDA-004`
**Implementation.** Invoke the pinned `compute-sanitizer` with the `memcheck`, `initcheck` and `racecheck` tool sets and parse its real report format into normalised findings: a check that fired produces an `observed` finding with the reported address, access kind, block and thread identity, and the source range from `TASK-CUDA-003`; a check that reports a candidate without a fired error produces a `potential` finding. Classify each diagnostic family as a separate backend capability — memory error, initialization and synchronization — with the support level from the capability entry, and attach each finding the sanitizer version, the invocation arguments and the tool set used. Surface the documented limitation that `racecheck` covers on-chip shared memory rather than general global-memory races as a coverage limit on the finding and on the capability entry; do not build a global-memory conflict claim on it. A run reporting no error is recorded as observed coverage of that run with its coverage limits and never as a proof of race freedom or memory safety.
**Acceptance.** The synchronization-defect fixture produces an `observed` finding naming the address, the block and thread and the source range, with the sanitizer version and tool set recorded; the correct control produces no finding and is stored as observed coverage with its limits attached; a requested check whose tool set is not pinned in the capability entry reports `unsupported` with the missing component named rather than returning an empty success.
**Verification.** Linux host with a GPU device and the pinned Compute Sanitizer, local execution consent present: `pytest engines/cuda/tests/test_sanitizer.py -q`, asserting fired-diagnostic findings, the potential class, the recorded coverage limits and the unsupported path; recorded as `blocked` with the missing component named when the tool is absent.
**Artifacts.** A normaliser mapping each sanitizer report family to a finding class, plus the capability entries for memory error, initialization and synchronization diagnostics.

### TASK-CUDA-006  Produce race and missing-barrier evidence with correct controls

**Purpose.** Demonstrate, with the real tooling, that one thread consumes data another has not published, and be honest about how much of that demonstration generalises.
**Owns.** `engines/cuda/src/pomset_cuda/conformance/race/*`, `fixtures/kernels/cuda/missing-barrier/*`
**Requirement links.** `REQ-BCK-009`, `REQ-EVD-010`
**Prerequisites.** `TASK-CUDA-005`
**Implementation.** Build the missing-barrier fixture — a block that writes a shared tile, omits the barrier, and then reads, so that one thread can observe values another has not published — together with its correct control that inserts the barrier. Run both through `TASK-CUDA-005` and record, for the defective case, the synchronization finding with its actors, events and source ranges, and for the control, observed coverage of the executions that ran, never race freedom. Where the sanitizer does not report the defect on a given run, record the miss explicitly with the number of attempted runs rather than retrying until a report appears, and never present a clean control as proof of correctness. An execution that does not finish inside its budget is reported as unknown progress, never as a deadlock or a liveness failure; a clock cannot distinguish blocking forever from waiting a long time. When no device or sanitizer is available the whole task reports a documented blocker naming the missing component.
**Acceptance.** The missing-barrier fixture yields a synchronization finding on the demonstration machine, with the barrier omission visible in the cited source range and the control's non-barrier lines absent from it; the correct control's run is stored as observed coverage of the runs performed, with that count stated; a deliberately hung variant is reported as unknown progress rather than as a deadlock; on a machine without a device the task contributes an explicit blocker record and no finding.
**Verification.** Linux host with a GPU device and the pinned tools, local execution consent present: `pytest engines/cuda/tests/test_missing_barrier.py -q` plus one manual end-to-end demonstration run; the no-device path exercised on a CPU-only host to confirm the blocker record.
**Artifacts.** The missing-barrier fixture and its correct control, and the demonstration record with its run counts and coverage limits.

### TASK-CUDA-007  Declare the modelled CUDA stream, block, warp, atomic and fence semantics

**Purpose.** Make it explicit which CUDA ordering and atomicity model each CUDA finding holds under, so that no result is displayed as though it held under another backend's model.
**Owns.** `engines/cuda/src/pomset_cuda/semantics/model.py`, `profiles/cuda/semantics/*.json`
**Requirement links.** `REQ-BCK-007`, `REQ-EVD-012`
**Prerequisites.** `TASK-CUDA-005`
**Implementation.** Define the backend's declared semantics as data in the capability entry: what is modelled about intra-block thread ordering, warp-level execution, `__syncthreads()` and other block barriers, the memory fence intrinsics and their scope, the atomic operations and their scope qualifiers, and stream-level ordering between kernel invocations. Attach the semantics identifier to every finding this backend produces, so that the finding records that it holds under the CUDA model at its revision and not under the Triton or OpenMP model. Where the backend is only able to observe rather than model a construct — for instance a race reported by an instrumented run — the finding records the observation method and does not borrow a modelling claim. A cross-backend view presents the same kernel's CUDA findings beside the other backends' findings as separate evidence with their own qualifiers, and never merges them into one verdict.
**Acceptance.** Every finding from `TASK-CUDA-005` and `TASK-CUDA-006` carries the CUDA semantics identifier at a revision, and the identifier resolves to a capability entry stating scope, barrier, fence and atomic behaviour; requesting a comparison against an OpenMP finding shows both findings' semantics side by side with no merged verdict; a construct deliberately left unmodelled produces `unsupported` naming it rather than a semantics claim.
**Verification.** Linux host with a GPU device and the pinned tools, local execution consent present: `pytest engines/cuda/tests/test_semantics.py -q`, asserting the semantics identifier on each finding class and the refusal to merge, plus one manual cross-backend comparison view.
**Artifacts.** The declared CUDA semantics document under `profiles/cuda/`, and the identifier binding every CUDA finding to it.

### TASK-CUDA-008  Import Nsight Compute and Nsight Systems measurements with declared instrumentation effects

**Purpose.** Bring real hardware metrics into the measurement record without letting an instrumented, perturbed run masquerade as an ordinary one.
**Owns.** `engines/cuda/src/pomset_cuda/nsight/import_compute.py`, `engines/cuda/src/pomset_cuda/nsight/import_systems.py`
**Requirement links.** `REQ-BCK-006`, `REQ-PERF-006`, `REQ-PERF-007`
**Prerequisites.** `TASK-PRS-002`, `TASK-CUDA-004`
**Implementation.** Import a pinned Nsight Compute kernel profile and a pinned Nsight Systems timeline through the `TASK-PRS-002` validation path, mapping the tool's reported metrics into the measurement record with their exact metric names, units and the tool version that produced them, and retaining the raw export as a measured artifact. Record the instrumentation effect explicitly: whether the profiling run serialised or replayed kernel execution, what replay mode was used, what pass count the counters required, and what the tool itself states about perturbation. Report a memory, coalescing, bank-conflict, divergence, load-balance, register, spill or occupancy value only where the tool actually supplied it; where a metric is absent because the tool or device does not expose it, the metric is absent with the capability reason attached, never a numeric zero. A causal explanation of a performance change cites a measured metric, a compilation artifact or a declared resource model, and says which; latency alone is never the explanation.
**Acceptance.** An imported Compute report yields measurements labelled `measured` carrying the exact metric names, units, tool version and hardware identity, with the replay mode and serialisation status recorded; a metric the device does not expose is absent with the capability reason rather than zero; an import whose provenance is incomplete is retained as ineligible with reason codes rather than promoted; a comparison chart labels each series measured or estimated and never derives a cause from the latency column alone.
**Verification.** Linux host with a GPU device and the pinned Nsight tools, local execution consent present: `pytest engines/cuda/tests/test_nsight_import.py -q` over captured exports plus the incomplete export fixture, asserting metric provenance, the instrumentation-effect fields and the ineligible marking; the raw exports kept as the task's verification assets.
**Artifacts.** Two import adapters, the mapped measurement records with instrumentation effects, and the retained raw profiler exports.

### TASK-CUDA-009  Certify the CUDA corpus and publish the capability entry it validates

**Purpose.** Make the backend's support claim rest on a corpus that can fail, including fixtures on which the tooling is expected to miss.
**Owns.** `fixtures/kernels/cuda/corpus/*`, `fixtures/kernels/cuda/expected/*`, `engines/cuda/tests/conformance/*`
**Requirement links.** `REQ-BCK-002`
**Prerequisites.** `TASK-CUDA-006`, `TASK-CUDA-007`
**Implementation.** Assemble the corpus of licensed tiny kernels with declared outcomes: a bounds violation and its correct control, an overlapping-write conflict and its non-overlapping control, the missing-barrier case and its correct control, the initialization defect and its correct control, and the correct-but-slow kernel used by the performance demonstrations. Each fixture declares what the tools can and cannot observe for it, so that a clean run on a defective fixture is recorded as a miss rather than as a pass. Run the corpus through the compiled, normalised and measured paths from the preceding tasks, and promote the specific tool/version/platform combination to `validated` in the capability matrix only for the feature families whose fixtures passed in that exact combination; every other family stays `limited`, `untested` or `unsupported` with its reason. Record the corpus revision, the exact profile revision and the run outcomes, and register the CUDA entries in the shared capability catalogue so the profile catalogue and the workbench can show reason-carrying unavailability.
**Acceptance.** A full corpus run in one pinned combination records, per fixture, the declared outcome and the observed outcome; the combination's matrix entry names exactly the feature families that passed and marks every miss explicitly; the correct-but-slow fixture carries a measured comparison with the measurement/estimate distinction visible; re-running the corpus after a tool version change creates a new capability entry rather than inheriting the old claim; the corpus and its expected outcomes are reusable by `TASK-REL-001` and `TASK-REL-005`.
**Verification.** Linux host with a GPU device and the pinned toolchain, local execution consent present: `pytest engines/cuda/tests/conformance -q` executing the whole corpus and diffing observed against declared outcomes, plus one manual inspection of the resulting capability entry; on a host without a device the run reports the blocker and promotes nothing.
**Artifacts.** The licensed CUDA corpus with declared outcomes, the conformance runner, and the CUDA capability entries it validated.
