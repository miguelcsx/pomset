# Acceptance scenarios

Canonical executable acceptance lives here and only here. A requirement narrates
what must be observable; the `ACC-###` scenario is the check that observes it.
These specify the required runnable checks, not claims about the current partial
implementation. The [acceptance disposition](implementation-audit.md) records
what is missing, partial or externally blocked; none is closed.

Each scenario states its exact input, the expected observable evidence, the
requirements it covers, and the tasks that implement it.

## ACC-001  Output coverage over a floor-divided grid

**Input.** The `transform` fixture with `BLOCK=256`, an explicitly selected
`@triton.jit` entrypoint, `grid = (N // BLOCK,)`, masked load and store with
`mask = offsets < N`, and a declared output allocation with role `output` and
`poisoned: true`. Domain: `N` ranging over the declared values, `BLOCK` in
{128, 256, 512}, dtypes {fp16, bf16}.

**Expected observable evidence.**

1. `N = 1024` has no modelled output hole.
2. `N = 1025` yields unwritten output index 1024, with the exact snapshot id,
   launch configuration and mask provenance on the witness.
3. A correction hint for the recognized positive-`N`/positive-`BLOCK`
   floor-grid pattern is shown, qualified, requiring a user rerun.
4. Replacing the grid with `ceilDivide(N, BLOCK)` in a **new scenario or snapshot**
   removes the modelled hole and leaves the old report unchanged.
5. Repeating the numerical comparison with an initially poisoned output and with
   the autotune-buffer-reuse flag set does not turn a missing write into a pass.
6. CPU interpreter replay is recorded as a numerical replay, explicitly not GPU
   scheduling or GPU-speed evidence.

**Covers.** [`REQ-EXP-002`](../srs/exploration.md), `REQ-EXP-003`, `REQ-EXP-005`,
`REQ-EXP-006`, `REQ-DOM-005`, `REQ-EVD-014`, `REQ-VAL-006`, `REQ-BCK-010`,
`REQ-PRJ-002`, `REQ-PRJ-005`, `REQ-PRJ-003`, `REQ-DOM-001`, `REQ-UX-002`.

**Implemented by.** `TASK-TRI-008`, `TASK-TRI-014`, `TASK-TRI-011`, `TASK-TRI-016`,
`TASK-WEB-007`, `TASK-WEB-013`.

## ACC-002  Overlapping writes, and their corrected control

**Input.** A minimized fixture in which two distinct program instances write the
same address without ordering, and a corrected control in which the writers are
disjoint under the declared domain.

**Expected observable evidence.**

1. The defective fixture yields two distinct writers, the shared address, both
   masks and both source locations in one finding.
2. The corrected control yields no modelled conflict under the same domain.
3. A variant using atomics, and a variant with data-dependent indexing, each return
   `unsupported` with the construct named — never "safe", never a silent
   approximation.

**Covers.** [`REQ-EXP-004`](../srs/exploration.md), `REQ-EXP-010`, `REQ-EXP-005`,
`REQ-DOM-006`, `REQ-DOM-010`, `REQ-EVD-004`, `REQ-EVD-005`, `REQ-EVD-011`,
`REQ-EVD-006`, `REQ-UX-014`, `REQ-UX-002`, `REQ-BCK-011`.

**Implemented by.** `TASK-TRI-008`, `TASK-TRI-012`, `TASK-TRI-015`, `TASK-TRI-007`,
`TASK-WEB-011`, `TASK-WEB-010`.

## ACC-003  Domain exploration and strategy comparison

**Input.** A domain with multiple shapes, strides and block choices under finite
constraints; the five sampling strategies at recorded revisions and seeds.

**Expected observable evidence.**

1. The explorer produces a witness, or qualified established and unknown regions,
   and records the seeds and budgets.
2. Solver timeout produces `unknown` with the exhausted limit named.
3. A sampled check never becomes a full-domain proof; sampled regions stay
   labelled sampled.
4. A count or percentage appears only for the enumerated denominator.
5. Each strategy's cost, precision and coverage are recorded comparably.
6. The result names the query and model revision and the solver version.

**Covers.** [`REQ-EXP-007`](../srs/exploration.md), `REQ-EXP-008`, `REQ-EXP-009`,
`REQ-EXP-012`, `REQ-DOM-003`, `REQ-DOM-004`, `REQ-DOM-007`, `REQ-DOM-008`,
`REQ-DOM-009`, `REQ-DOM-013`, `REQ-EVD-003`, `REQ-EVD-009`.

**Implemented by.** `TASK-TRI-009`, `TASK-TRI-010`, `TASK-TRI-008`, `TASK-FEA-005`,
`TASK-WEB-008`.

## ACC-004  Snapshots, cancellation and profile changes

**Input.** A project with one snapshot; run a job; edit the source; cancel a second
job mid-run; change a lane's profile to an id that does not exist.

**Expected observable evidence.**

1. The first result keeps its original snapshot id and full provenance after the
   edit.
2. The cancelled job's partial evidence remains visible with its completeness
   qualifier.
3. The unknown profile id returns `PROFILE_NOT_FOUND`; no nearby or first profile is
   substituted.
4. Support level and availability remain separately reported.
5. No run and no compile created a publication.
6. Job state is shown separately from the property outcomes it contains.

**Covers.** [`REQ-PRJ-007`](../srs/projects.md), `REQ-PRJ-008`, `REQ-PRJ-010`,
`REQ-PRJ-013`, `REQ-ENG-006`, `REQ-ENG-007`, `REQ-ENG-008`, `REQ-ENG-009`,
`REQ-ENG-010`, `REQ-PLT-002`, `REQ-PLT-004`, `REQ-PLT-005`, `REQ-PLT-011`,
`REQ-UX-005`, `REQ-UX-007`, `REQ-UX-008`, `REQ-UX-009`, `REQ-UX-010`.

**Implemented by.** `TASK-LOC-002`, `TASK-HST-004`, `TASK-HST-007`, `TASK-HST-011`,
`TASK-WEB-004`, `TASK-WEB-005`.

## ACC-005  Offline analysis, CI statuses and hostile imports

**Input.** A clean local CPU installation with networking disabled; a supported
fixture; a malformed bundle; a bundle containing a path-traversal entry; a
scenario whose required property is unsupported.

**Expected observable evidence.**

1. `analyze`, `validate`, `export` and `serve` work with no hosted credentials, no
   database server and no GPU.
2. Exit codes distinguish an actual property failure (1) from unsupported, unknown,
   invalid input and engine failure (2), and the report preserves the exact
   outcome behind each status.
3. Both the malformed bundle and the traversal bundle are rejected without
   execution and without disclosure.
4. A path that would execute user code refuses to run without `--trust-local-code`.
5. `serve` exposes no route that starts, compiles or executes anything, and opening
   a report or a loopback URL never triggers execution.
6. No telemetry and no upload occurs.

**Covers.** [`REQ-CLI-001`](../srs/local-ci.md), `REQ-CLI-002`, `REQ-CLI-003`,
`REQ-CLI-004`, `REQ-CLI-005`, `REQ-CLI-007`, `REQ-CLI-008`, `REQ-CLI-011`,
`REQ-CLI-010`, `REQ-SEC-004`, `REQ-SEC-003`, `REQ-SHR-005`, `REQ-PLT-003`,
`REQ-PLT-009`, `REQ-VAL-010`, `REQ-DOM-003`, `REQ-PRJ-012`.

**Implemented by.** `TASK-LOC-001`, `TASK-LOC-005`, `TASK-LOC-007`, `TASK-LOC-008`,
`TASK-LOC-009`, `TASK-SEC-004`, `TASK-SEC-003`, `TASK-HST-012`.

## ACC-006  Measurements, eligibility and benchmarking

**Input.** A real measurement with complete hardware, warm-up, sample and method
provenance; an incomplete profiler export; an attempt to benchmark a configuration
whose required validation is unknown.

**Expected observable evidence.**

1. Complete records are accepted; incomplete or mismatched records are rejected or
   marked ineligible with reason codes.
2. An unknown required validation blocks benchmarking and recommendation until the
   policy explicitly changes, and the policy change does not upgrade the evidence
   class.
3. Eligible configurations can be compared without any claim that CPU interpreter
   timing is GPU timing.
4. Each measurement shows whether values are measured or estimated, and compile time
   is separated from execution time.
5. Cohorts are separate; unlike devices are not pooled into one ranking.

**Covers.** [`REQ-PERF-001`](../srs/performance.md), `REQ-PERF-002`, `REQ-PERF-003`,
`REQ-PERF-004`, `REQ-PERF-005`, `REQ-PERF-009`, `REQ-PERF-010`, `REQ-PERF-011`,
`REQ-PERF-012`, `REQ-VAL-001`, `REQ-VAL-002`, `REQ-VAL-003`, `REQ-VAL-005`,
`REQ-VAL-006`, `REQ-DOM-011`, `REQ-DOM-012`, `REQ-EVD-008`, `REQ-EVD-013`,
`REQ-SHR-006`, `REQ-PLT-001`, `REQ-PRJ-006`, `REQ-UX-013`.

**Implemented by.** `TASK-LOC-006`, `TASK-LOC-007`, `TASK-PRS-002`, `TASK-PRS-003`,
`TASK-PRS-004`, `TASK-WEB-015`.

## ACC-007  Hosted containment, budgets and crash races

**Input.** A hosted deployment with the sandbox image; a malicious Python import; an
infinite loop; an attempted network access; an artifact path escaping the scratch
root; an oversized output; a cross-user artifact read; a worker killed mid-job; a
cancellation racing completion.

**Expected observable evidence.**

1. Each hostile input is denied or contained within the configured budgets, with an
   explicit error or an explicit unknown.
2. The worker crash and the cancellation race each leave a consistent terminal
   attempt with a durable, reconnectable event stream.
3. A sandbox preflight failure makes the profile unavailable; it never enables
   unsandboxed execution.
4. An engine that exceeds a size or sequence rule fails the job as
   `PROTOCOL_INVALID` without corrupting previously accepted evidence.
5. An already successful `GET` or an open stream keeps its status when the job later
   fails asynchronously; the failure appears in `Job.failure` and the error event.
6. Secrets do not appear in logs, artifacts or error records.

**Covers.** [`REQ-SEC-001`](../srs/security.md), `REQ-SEC-002`, `REQ-SEC-005`,
`REQ-SEC-006`, `REQ-SEC-010`, `REQ-SEC-011`, `REQ-SEC-013`, `REQ-ENG-001`,
`REQ-ENG-002`, `REQ-ENG-003`, `REQ-ENG-004`, `REQ-ENG-005`, `REQ-ENG-011`,
`REQ-ENG-012`, `REQ-ENG-014`, `REQ-ENG-015`, `REQ-ENG-016`, `REQ-ENG-017`,
`REQ-PLT-005`, `REQ-PLT-006`, `REQ-PLT-007`, `REQ-PLT-010`, `REQ-PLT-012`,
`REQ-PLT-013`, `REQ-PLT-015`, `REQ-DOM-007`, `REQ-EVD-015`, `REQ-PRJ-004`.

**Implemented by.** `TASK-HST-005` … `TASK-HST-017`, `TASK-ENG-001` … `TASK-ENG-007`,
`TASK-REL-002`.

## ACC-008  Publication, revocation and access control

**Input.** A private project with source, a result and an artifact; a publication
attempt without an accepted disclosure preview; a second owner attempting to read
the artifact; a revocation.

**Expected observable evidence.**

1. Publication requires an explicit snapshot and artifact selection after an accepted,
   current disclosure preview.
2. Private source and results cannot be retrieved anonymously or by another owner.
3. Possessing the content hash grants nothing.
4. Revocation denies subsequent server retrieval and makes no claim that
   already-downloaded copies vanished.
5. The published report preserves coverage, assumptions, budget and evidence class,
   and publishing is not presented as an endorsement of correctness.
6. No web-to-local job submission and no runner pairing exists.

**Covers.** [`REQ-SHR-001`](../srs/sharing.md), `REQ-SHR-002`, `REQ-SHR-003`,
`REQ-SHR-007`, `REQ-SHR-008`, `REQ-SHR-009`, `REQ-SHR-010`, `REQ-SEC-007`,
`REQ-SEC-008`, `REQ-SEC-009`, `REQ-PLT-008`, `REQ-PLT-014`, `REQ-PLT-012`,
`REQ-PLT-015`, `REQ-PRJ-010`, `REQ-CLI-008`, `REQ-CLI-010`, `REQ-UX-015`.

**Implemented by.** `TASK-HST-010`, `TASK-HST-013`, `TASK-WEB-016`, `TASK-LOC-009`.

## ACC-009  CUDA and OpenMP native evidence

**Input.** CUDA and OpenMP fixtures with known defective and correct controls, on a
machine with the tools available; the same fixtures on a machine without them.

**Expected observable evidence.**

1. Where the tools exist, real, source-linked observations are produced with the
   exact tool, model and hardware versions recorded.
2. Bounds, race and synchronization examples produce evidence; the correct controls
   do not, and their clean runs are recorded as observed coverage rather than as
   race-freedom proofs.
3. Where a tool or device is absent, the check is a documented blocker.
4. Profiler data is recorded as measured; inferred resource bottlenecks remain
   estimates with their stated basis.
5. A timeout is reported as unknown progress, never as deadlock or liveness failure.
6. The missing-barrier demonstration is produced here, not claimed by the Triton
   symbolic path.
7. Reused third-party code carries its per-file notices and the `NOTICE` entry.

**Covers.** [`REQ-BCK-002`](../srs/backend-expansion.md), `REQ-BCK-003`, `REQ-BCK-004`,
`REQ-BCK-005`, `REQ-BCK-006`, `REQ-BCK-007`, `REQ-BCK-008`, `REQ-BCK-009`,
`REQ-BCK-011`, `REQ-EVD-002`, `REQ-EVD-010`, `REQ-EVD-011`, `REQ-EVD-012`,
`REQ-EVD-013`, `REQ-EXP-011`, `REQ-EXP-012`, `REQ-EXP-013`, `REQ-VAL-004`,
`REQ-VAL-008`, `REQ-PERF-006`, `REQ-SEC-012`, `REQ-PRJ-011`, `REQ-CLI-009`,
`REQ-CLI-011`, `REQ-CLI-014`, `REQ-PLT-002`, `REQ-PLT-003`, `REQ-PLT-014`,
`REQ-UX-010`, `REQ-UX-011`, `REQ-UX-016`, `REQ-DOM-010`.

**Implemented by.** `TASK-CUDA-001` … `TASK-CUDA-009`, `TASK-OMP-001` … `TASK-OMP-006`,
`TASK-TRX-001` … `TASK-TRX-005`, `TASK-REL-001`, `TASK-REL-003`, `TASK-REL-004`.

## ACC-010  The three demonstrations, and accessible inspection

**Input.** The conflicting-write fixture, the missing-synchronization fixture, and
the correct-but-slow kernel; the workbench on a wide and a narrow viewport, in dark
and light themes, driven by keyboard only.

**Expected observable evidence.**

1. The conflicting write is explained with its two writers, address, masks and source
   locations.
2. The missing synchronization is explained with its ordering evidence.
3. The correct-but-slow kernel is compared using real measurements where a device
   exists, with the measurement/estimate distinction and the region coverage visible.
4. Keyboard navigation reaches finding → actors → source → memory and events for each
   demonstration.
5. Responsive reflow and dark/light both keep assumptions, domain and coverage visible,
   and no status is carried by colour alone.
6. Any timeline shown contains only established ordering edges, with unresolved
   relationships marked as unresolved.
7. Causal claims cite a measured metric, a compilation artifact or a declared resource
   model, and say which.

**Covers.** [`REQ-UX-001`](../srs/workbench.md) … `REQ-UX-018` where applicable,
plus [`REQ-PRJ-009`](../srs/projects.md), `REQ-EVD-007`, `REQ-EVD-008`,
`REQ-PERF-007`, `REQ-PERF-008`, `REQ-PERF-009`, `REQ-PERF-011`, `REQ-PERF-013`,
`REQ-SHR-004`, `REQ-SHR-009`, `REQ-CLI-013`, `REQ-BCK-006`, `REQ-BCK-009`,
`REQ-BCK-012`, `REQ-VAL-009`, `REQ-DOM-011`.

**Implemented by.** `TASK-WEB-001` … `TASK-WEB-018`, `TASK-PRS-006`, `TASK-REL-005`.

## Rule: what a passing scenario proves

A scenario that completes proves that the job reached a terminal state and that the
expected evidence was observed **in that environment**. It does not prove the
kernel's correctness in general, and it does not prove that another environment
would behave the same way. Where a scenario cannot run for want of a tool or a
device, the result is a documented blocker and not a pass.
