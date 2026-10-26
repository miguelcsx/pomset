# Release and evaluation — `REL`

Epic `REL`, milestone **M7 Release** ([`README.md`](README.md)). Every task here is
**planned**: no acceptance run described below has been performed, and this file
records obligations, not results.

**Whole-epic prerequisites.** Every preceding epic, for the phases this epic
exercises: the `FND` foundation and `ENG` protocol boundary
([`02-foundation.md`](02-foundation.md), [`11-engine-and-security.md`](11-engine-and-security.md)),
the `TRI` engine and `LOC` local product
([`03-triton-engine.md`](03-triton-engine.md), [`04-local-ci.md`](04-local-ci.md)),
the `HST` hosted platform ([`05-hosted-platform.md`](05-hosted-platform.md)), the
`PRS` measurement and sharing path ([`07-performance-and-sharing.md`](07-performance-and-sharing.md)),
and the native `CUDA` and `OMP` epics ([`08-cuda.md`](08-cuda.md),
[`09-openmp-and-advanced-triton.md`](09-openmp-and-advanced-triton.md)).

**What this epic may and may not claim.** It runs the acceptance scenarios in
[`../evaluation/acceptance.md`](../evaluation/acceptance.md) and publishes what was
observed, in which environment, with which exact tool versions. A scenario that
completes proves that the job reached a terminal state and that the expected
evidence was observed **in that environment**; it does not prove a kernel's
correctness in general. Where a device or a tool is missing, the affected check is a
**documented blocker** recorded as a blocker — never an executed check, never a
fabricated result. Method is specified in
[`../evaluation/methodology.md`](../evaluation/methodology.md); decisions are
[`../adr/0010-performance-and-eligibility.md`](../adr/0010-performance-and-eligibility.md),
[`../adr/0011-private-local-and-publication.md`](../adr/0011-private-local-and-publication.md)
and [`../adr/0012-research-gates-and-compatibility.md`](../adr/0012-research-gates-and-compatibility.md).

### TASK-REL-001  Run the end-to-end CPU and local acceptance over the acceptance scenarios

**Purpose.** Establish, on the hardware that actually exists, that the local product performs the whole workflow end to end and records the environment each result came from.
**Owns.** `docs/evaluation/runs/cpu-local/*`, `evaluation/acceptance/run_cpu_local.py`
**Requirement links.** `REQ-PLT-010`, `REQ-BCK-001`
**Prerequisites.** `TASK-LOC-010`, `TASK-TRI-017`
**Implementation.** Drive `ACC-001` through `ACC-006` and the local portions of `ACC-004`, `ACC-005` and `ACC-006` from one harness that runs each scenario's declared input, collects the expected observable evidence, and writes a run record per scenario naming the exact engine, extraction, query and solver revisions, the profile revision, the profile catalogue state, the operating system and the kernel build, and the CPU-only or local-GPU classification of the machine. The harness records for each scenario which scenarios ran, which evidence was observed and which expected evidence was absent, and it never repairs a scenario by loosening its declared input. A scenario whose tool or device is unavailable is recorded as a blocker naming the missing component, with the failing observation recorded as absent rather than assumed. The harness asserts the CLI exit statuses and the report's per-property outcomes independently of the exit status, so a coarse status never stands in for the recorded outcomes.
**Acceptance.** On a clean local CPU installation the harness produces one run record per executed scenario, each naming the environment and the exact revisions used; the environment naming matches what the machine actually reports; a scenario whose tool is missing appears as a blocker with the missing component named and no observed evidence claimed; the recorded per-property outcomes agree with the machine-readable report and the exit status mapping is confirmed for at least one satisfied, one actually-failed and one unsupported-required-property case.
**Verification.** Local CPU machine, networking disabled, execution consent present for the paths that need it: `pytest evaluation/acceptance/test_run_cpu_local.py -q` plus one manual inspection of the produced run records against the machine's reported environment.
**Artifacts.** One run record per executed scenario with its environment, revision and outcome record, plus the list of blockers for the scenarios this hardware cannot exercise.

### TASK-REL-002  Run the hosted acceptance: containment, quotas, races and authorization

**Purpose.** Attempt to break the hosted deployment at the boundaries the product claims, and record honestly where it held and where the attempt was inconclusive.
**Owns.** `docs/evaluation/runs/hosted/*`, `evaluation/acceptance/run_hosted.py`
**Requirement links.** `REQ-SEC-001`, `REQ-SEC-002`, `REQ-SEC-005`, `REQ-SEC-007`, `REQ-ENG-011`, `REQ-ENG-012`, `REQ-PLT-007`
**Prerequisites.** `TASK-HST-017`, `TASK-ENG-006`
**Implementation.** Execute the hosted portions of `ACC-007` and `ACC-008` against a deployment built from the sandbox image: a malicious Python import, an infinite loop, an attempted network access, an artifact path escaping the scratch directory, an oversized output, and a second owner attempting to read a first owner's artifact. For each attempt record the observed containment — the job's terminal state, the specific error record with its code, the resource actually bounded and the value reached, and whether any data reached the requester. Then exercise the lifecycle races: cancel a running job while it is about to commit, kill a worker mid-job and let the lease expire, and reconnect to a job's event stream with a `Last-Event-ID` after a dropped connection, recording whether the terminal attempt stayed consistent and whether the replayed events matched the durable stream. Also record the sandbox preflight outcome and confirm that a profile whose preflight failed was shown unavailable with local mode offered as the alternative rather than run outside the sandbox.
**Acceptance.** Every adversarial attempt is recorded with its terminal state, error code and the resource that contained it, and no attempt yields data outside its owner's authorization; the cancel-versus-finish race finalises exactly one terminal state with the recorded cancellation respected; the lease expiry after a worker kill finalises the job with `WORKER_LOST`; the event reconnect replays the durable events after the supplied identifier without fabricating a stage; the failed-preflight profile is unavailable with its reason and unsandboxed fallback is absent.
**Verification.** Hosted deployment from the built sandbox image, PostgreSQL and object store present: `pytest evaluation/acceptance/test_run_hosted.py -q` plus one manual worker kill and one manual event-stream reconnect, with the resulting job records and event streams inspected against the recorded expectations.
**Artifacts.** The hosted acceptance run records, including the adversarial attempt log, the race outcomes and the preflight outcome record.

### TASK-REL-003  Publish the reproducible tool and profile support record and the measured capacity

**Purpose.** Replace support claims and capacity promises with a published record of what was probed and what was measured, reproducible from the recorded revisions.
**Owns.** `docs/evaluation/support-record.md`, `docs/evaluation/capacity/*`, `evaluation/support_record/build.py`
**Requirement links.** `REQ-PLT-010`, `REQ-BCK-004`
**Prerequisites.** `TASK-REL-001`, `TASK-REL-002`
**Implementation.** Assemble, from the capability and profile manifests and from the acceptance runs, one record that names each backend, each probed tool and version, each platform, each image digest and each feature family's support level, and that separates a validated combination from a limited, untested or unavailable one. Report the measured capacity of the deployed hosted service — job throughput, queue latency and artifact growth observed over the recorded run window — with the workload, the hardware and the measurement method that produced each figure, and state no service level it has not measured. Include the reproduction instructions: the exact profile revisions, lockfile and image digests used, and the command that regenerates the figures from the stored records. Where a backend has no probed combination, the record says so rather than omitting the row; where a capacity figure was not obtained, the record says so rather than estimating it.
**Acceptance.** The record names every backend's probed combinations with exact versions and per-family support levels, and a reader can identify which combinations were validated and which were not without leaving the document; the capacity figures each carry their workload, hardware and method, and any target without a measurement is stated as unmeasured rather than promised; regenerating the figures from the stored records and the pinned profile revisions reproduces them.
**Verification.** Local CPU machine for record assembly, hosted deployment for capacity figures: `pytest evaluation/support_record/test_build.py -q`, asserting that every capability manifest in the catalogue appears in the record and that each capacity figure resolves to a stored run record; one manual reading of the generated record.
**Artifacts.** The published support record and capacity figures, with the pinned revisions and the regeneration command.

### TASK-REL-004  Audit third-party licences and notices before any release

**Purpose.** Make the reused-code obligations auditable before release, so that a selective reuse is never published without its notices.
**Owns.** `NOTICE`, `docs/reference/licence-audit.md`, `evaluation/licence/audit.py`
**Requirement links.** `REQ-SEC-012`
**Prerequisites.** `TASK-FND-009`
**Implementation.** Walk every dependency and every selectively reused piece of third-party code — libraries from the lockfiles, native and Python tool adapters, selectively adopted patterns and any copied fixture or snippet — and check that its per-file copyright and licence notice is retained in the source, that it appears in the project `NOTICE` file with its origin and licence, and that its licence is compatible with this repository's licence split. Cross-check the fixture and licence provenance metadata recorded by `TASK-FND-009` against the fixture corpus, so a fixture without recorded provenance is a finding rather than an omission. Report each finding with the file, the missing or mismatched notice and the licence text involved. The audit neither relicenses anything nor edits upstream notice text, and it fails the release on an unresolved finding rather than recording it as a known issue.
**Acceptance.** The audit enumerates every reused dependency and reusable artefact with its licence, its notice location and its `NOTICE` entry, and reports zero unresolved findings before release; a fixture whose provenance metadata is missing is reported as a finding; a deliberately un-noticed reuse introduced for the purpose of the check is reported rather than passed.
**Verification.** Local CPU machine, no device required: `pytest evaluation/licence/test_audit.py -q` over the lockfiles, the fixture corpus and the `NOTICE` file, plus one manual review of the generated audit against the repository's licence split.
**Artifacts.** The updated `NOTICE` file, the licence audit report, and the audit implementation used at each later release.

### TASK-REL-005  Demonstrate the three flagship cases end to end

**Purpose.** Show, with the real engines and real measurements, that the product answers the three questions it exists for, including where an answer comes from a native tool rather than from symbolic analysis.
**Owns.** `docs/evaluation/demonstrations/*`, `fixtures/kernels/demonstrations/*`, `evaluation/demonstrations/run.py`
**Requirement links.** `REQ-BCK-009`, `REQ-EVD-014`, `REQ-PERF-008`, `REQ-UX-014`
**Prerequisites.** `TASK-CUDA-009`, `TASK-OMP-005`, `TASK-WEB-013`
**Implementation.** Run the three cases through the workbench and the CLI. For the conflicting write, produce the two writers with their address, masks and source ranges from the backend that legitimately reports it, and for the floor-grid output-coverage case produce the qualified correction hint with the rerun action and confirm that accepting the hint creates a new snapshot and leaves the old report unchanged. For the missing synchronization, produce the ordering evidence from the native backend that owns the demonstration, and state that the Triton symbolic path declines it as `unsupported` with a reason rather than reporting it. For the correct-but-slow kernel, compare configurations using real measurements where a device exists, within one hardware cohort, with the measurement-versus-estimate distinction, the region coverage and the causal citation visible on every claim, and with no causal explanation drawn from latency alone. Each demonstration records the engine, tool, model and hardware identity that produced its evidence, or records a blocker when the required device or tool is absent. Confirm by inspection that keyboard-only navigation reaches finding, actor, source, memory and event views and that no demonstration presents a timeline edge it did not establish.
**Acceptance.** Each of the three cases produces a source-linked explanation naming the engine and evidence class behind it; the floor-grid hint appears as a qualified suggestion whose acceptance creates a new snapshot and leaves the previous report byte-identical; the missing-synchronization evidence comes from the native backend while the Triton path reports `unsupported` with a reason; the slow-kernel comparison shows the measurement/estimate distinction, region coverage and a causal citation on every claim; a keyboard-only pass reaches finding, actor, source, memory and events for all three; a case whose device is unavailable is recorded as a blocker rather than demonstrated with synthesised evidence.
**Verification.** Local CPU machine for the symbolic and CPU-native cases, plus a GPU machine under local execution consent for the CUDA evidence: `pytest evaluation/demonstrations/test_run.py -q` plus one manual keyboard-only pass through all three demonstrations in the workbench and one inspection of the produced reports.
**Artifacts.** The three demonstration fixtures, their run records with engine and hardware identity, and the demonstration guide used in the release review.
