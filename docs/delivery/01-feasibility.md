# Feasibility gate — `FEA`

The feasibility epic runs **before any application infrastructure exists**. It
decides the research gate in [`README.md`](README.md) with measurements rather
than assertions: real or faithfully reconstructed known-defect cases together
with correct controls, an independent comparison against existing tools at
documented versions, and at least one documented benefit. Nothing here is
complete. An evaluation of the existing analyzer now records a
[baseline no-go](../evaluation/implementation-audit.md); the complete corpus,
independent comparisons and strategy measurements remain owed.

| Field | Value |
|---|---|
| Epic prefix | `FEA` |
| Prerequisites as a whole | None — this epic is the entry point of the dependency graph. |
| Milestone | **M0 Feasibility**, closed by the research gate in [`README.md`](README.md). |
| Downstream | Every other epic. `TASK-FEA-006` is the go/no-go record that opens `FND`, and through it `ENG`, `TRI`, `LOC`, `HST`, `WEB`, `PRS`, `CUDA`, `OMP` and `REL`. |

The harness used here is deliberately small and disposable: plain Python driven
by `uv`, no workspace, no UI, no API and no database. It is the seed of the
planned `engines/triton/` package and is absorbed by `TASK-FND-001` once the
workspace exists. Reading for the sources of the cases:
[`../reference/source-disposition.md`](../reference/source-disposition.md) and
[`../adr/0012-research-gates-and-compatibility.md`](../adr/0012-research-gates-and-compatibility.md).

### TASK-FEA-001  Obtain, license and minimize real defect cases and correct controls

**Purpose.** Assemble the corpus the gate is judged on: the known-defect kernels,
their correct controls, and the origin and licence record that makes each case
usable and auditable.
**Owns.** `fixtures/kernels/feasibility/`, `fixtures/kernels/feasibility/cases.json`, `engines/triton/feasibility/corpus_check.py`
**Requirement links.** `REQ-BCK-001`, `REQ-EVD-002`
**Prerequisites.** None (entry point)
**Implementation.** Collect the two cases named in the source ledger: the Triton `transform` kernel that does not write every declared output element when the grid uses floor division and the remainder is masked by autotune buffer reuse, and the fused RMSNorm/RoPE kernel with overlapping writes. For each, record the upstream report, the exact revision quoted and the licence under which a reproducer may be redistributed. When a reproducer cannot be obtained or legally redistributed, write a minimal fixture that demonstrates the same mechanism, record it as `reconstructed`, and name the upstream case it reconstructs; it is never labelled the upstream reproducer. Write one correct control per defect case: the same kernel launched with ceiling division and full masking, and the same fusion with disjoint index ranges. Each fixture gets one `cases.json` record with `caseId`, `class` (`defect` or `control`), `backend`, `entrypoint`, `origin`, `licence`, `expectedOutcome` and the property it exercises. This task executes nothing; the corpus is data. The controls exist so that the third gate condition — a correct control is not misclassified — has something to fail against.
**Acceptance.** `cases.json` lists at least two defect cases and at least one correct control for each, every record naming origin, licence and a declared expected outcome; `corpus_check.py` reports zero records with a missing licence, origin or expected outcome, and exits 0.
**Verification.** Environment: any CPU host with Python 3.11+ and `uv`; network access only to fetch the upstream reports. Command: `uv run --directory engines/triton python feasibility/corpus_check.py --corpus fixtures/kernels/feasibility --json`. Observation: one JSON record per case carrying `caseId`, `class`, `origin`, `licence` and `expectedOutcome`, and exit status 0.
**Artifacts.** The fixture kernels, `cases.json`, and the corpus report written to `fixtures/kernels/feasibility/reports/corpus-check.json`.

### TASK-FEA-002  Pin an executable CPU environment and record its exact versions

**Purpose.** Establish one CPU environment whose every component version is
known, so that each later feasibility measurement is attributable to a specific
interpreter, Triton, PyTorch, NumPy and Z3 rather than to whatever was installed
on the day.
**Owns.** `engines/triton/pyproject.toml`, `engines/triton/uv.lock`, `engines/triton/feasibility/probe.py`, `profiles/triton/`
**Requirement links.** `REQ-PLT-001`, `REQ-PLT-002`
**Prerequisites.** `TASK-FEA-001`
**Implementation.** Declare the harness environment in `pyproject.toml` with exact pins for Python, Triton, PyTorch, NumPy and Z3, and resolve them into `uv.lock`. Write `probe.py`, which imports each component, prints its version and the platform triple, reports whether a CUDA device is visible, and emits a machine-readable probe record. Write that record into a planned profile revision `profiles/triton/<profileId>.json` holding `engineVersion`, `toolVersions`, `platform`, a possibly empty `imageDigest` for a local probe, and one capability entry per analysis feature with an independently assigned support level and availability. A component that cannot be imported is recorded as unavailable with its import error and is never omitted. No capability is marked validated by this task.
**Acceptance.** `uv.lock` resolves reproducibly with `--frozen`; the probe prints exact versions and the platform; the profile revision names every component, separates support level from availability, and records an absent CUDA device as `unavailable` rather than failing or omitting the row.
**Verification.** Environment: a clean CPU host with `uv` installed. Commands: `uv sync --project engines/triton --frozen`, then `uv run --project engines/triton python feasibility/probe.py --out profiles/triton/local-cpu.json`. Observation: exit status 0, non-empty `engineVersion`, `toolVersions` and `platform` in the written JSON, and a `cuda` entry whose availability is `unavailable` on a machine without a device.
**Artifacts.** The locked environment, the probe record and the first Triton profile revision.

### TASK-FEA-003  Define tiny modelled extraction and query cases and prove the two flagship witnesses

**Purpose.** Decide on the smallest possible kernels whether the modelled
extraction can actually produce the two flagship witnesses, before any product
code is written.
**Owns.** `engines/triton/feasibility/extract.py`, `engines/triton/feasibility/queries.py`, `fixtures/kernels/feasibility/witnesses/`
**Requirement links.** `REQ-EXP-002`, `REQ-EXP-003`, `REQ-EXP-004`
**Prerequisites.** `TASK-FEA-001`
**Implementation.** Hand-write extraction for the supported subset — one annotated entrypoint, the program identifier, a constant-bounded arange, integer address arithmetic, boolean masks, load and store — over the transformed fixture at a block size of 256 with a floor-divided grid and a masked in-range predicate. Encode the launch grid, shape, block size and allocation extents as solver variables under the declared constraints, preserving the fixture's integer width and overflow behaviour. Implement three separate queries: a **bounds** query for an enabled access outside its allocation, an **output-coverage** query for a declared output index with no enabled write, and a **conflict** query for two distinct unordered non-atomic writers to one address. Run each query against its defect and control pair and record `sat`, `unsat` or `unknown` with the model revision and the solver version. The required results are: coverage `sat` at the input size 1025 with the unwritten index 1024 fixed by the witness and the launch, mask and allocation provenance recorded; coverage `unsat` at size 1024; coverage `unsat` for the ceiling-division control; conflict `sat` on the overlapping-write fixture with two writers, both addresses, both masks and both source locations; conflict `unsat` on the disjoint control; and an explicit `unsupported` result naming the missing construct when a variant uses atomics or data-dependent indexing, never a guessed encoding.
**Acceptance.** The harness prints one verdict per query and case and dumps each `sat` witness as JSON carrying the domain assignments, launch grid, mask and source range. `ACC-001` describes the missing-output witness and `ACC-002` the conflict witness; this task is the first evidence that either is reachable at all.
**Verification.** Environment: the pinned CPU environment from `TASK-FEA-002`. Command: `uv run --project engines/triton python feasibility/queries.py --cases fixtures/kernels/feasibility/witnesses --json`. Observation: exit status 0 and a report containing coverage `sat` with index 1024 for the 1025-size defect, coverage `unsat` for the 1024-size control, conflict `sat` with two writers for the overlap defect, conflict `unsat` for its control, and `unsupported` with a named missing construct for the atomics variant.
**Artifacts.** The extraction and query harness, the witness JSON records, and the verdict table `fixtures/kernels/feasibility/reports/witnesses.json`.

### TASK-FEA-004  Compare independent existing tools at documented versions against the cases and controls

**Purpose.** Try to defeat the result: run independent existing tools at
documented versions against the same cases and controls, so that the gate is
decided by a comparison rather than by a demonstration of our own harness.
**Owns.** `engines/triton/feasibility/compare/`, `fixtures/kernels/feasibility/compare.json`
**Requirement links.** `REQ-PERF-012`, `REQ-EVD-013`
**Prerequisites.** `TASK-FEA-003`
**Implementation.** For each tool listed as a feasibility comparison in [`../reference/analysis-tool-landscape.md`](../reference/analysis-tool-landscape.md) — the Triton interpreter, TileLens, TritonSan and, where a device exists, Compute Sanitizer racecheck — record the exact version, the platform, the invocation and the outcome for every defect case and every control. Validate each imported tool output against the portable measurement schema, keep a well-formed but incomplete import as ineligible with reason codes, and reject a structurally invalid or hash-conflicting one. Attribute every recorded outcome to the tool, its version and its method, and mark a run whose observation mechanism serialised or perturbed execution. Two experiments are declared **blocked** until they run and do not count as comparisons meanwhile: Compute Sanitizer on the native control fixture, which requires a CUDA device with the pinned driver and toolkit; and any tool whose install fails on the pinned platform. The unblock condition for the first is a runner that passes the device preflight and prints its version; for the second, a pinned release that installs into the harness environment. A blocked experiment is recorded as blocked, never as a passed or failed check.
**Acceptance.** A comparison table with one row per tool, version and case, each naming its outcome and evidence class; blocked rows present with an explicit blocked status and the experiment named; every unblocked row naming a real tool version and a reproducible invocation; and an explicit statement of whether any comparison tool misclassified a correct control, since the gate cannot pass while one does.
**Verification.** Environment: the pinned CPU environment; a CUDA device on a local runner only for the blocked rows. Command: `uv run --project engines/triton python -m feasibility.compare.run --cases fixtures/kernels/feasibility --out fixtures/kernels/feasibility/compare.json`. Observation: exit status 0, one row per tool, version and case, `status: blocked` rows carrying the named experiment, and the schema-validation report showing each accepted import as eligible or ineligible with reason codes.
**Artifacts.** `compare.json`, the raw per-tool outputs kept as artifacts with their versions, and the import-validation report.

### TASK-FEA-005  Compare exhaustive, random, boundary and counterexample-guided strategies

**Purpose.** Choose the exploration strategy by measurement: compare the four
selection strategies on the same cases by cost, precision, coverage and witness
size, so the later product is not built on intuition.
**Owns.** `engines/triton/feasibility/strategies/`, `fixtures/kernels/feasibility/reports/strategies.json`
**Requirement links.** `REQ-EXP-008`, `REQ-EXP-009`
**Prerequisites.** `TASK-FEA-003`
**Implementation.** Implement exhaustive, random, boundary and counterexample-guided selection over the declared domains of the case corpus. Every run records its `strategyId`, `strategyRevision`, `seed` and `budget`, and derives its points from those alone rather than from wall-clock time, thread scheduling or hash iteration order. Measure per strategy and case: the analysis cost, the decision reached, the domain coverage and the witness size, where a missed defect is a defect case the strategy did not decide as violated within the budget. Use the exhaustive result over the finite cases as the precision reference. Re-running one (case, strategy, revision, seed, budget) tuple must reproduce the identical point sequence.
**Acceptance.** A table per strategy with cost, precision, coverage and witness size, plus an explicit statement of which strategies missed which defect cases and with which budget; the recorded point sequence for one tuple is byte-identical across two runs; no reported run depends on the clock, a schedule or an iteration order.
**Verification.** Environment: the pinned CPU environment. Commands, run twice with different output paths: `uv run --project engines/triton python -m feasibility.strategies.run --cases fixtures/kernels/feasibility --strategies all --seed 20261011 --budget-ms 30000 --out /tmp/strategies-a.json` and the same with `--out /tmp/strategies-b.json`, followed by `cmp /tmp/strategies-a.json /tmp/strategies-b.json`. Observation: identical files, and a strategy table carrying per-case outcomes, cost, coverage and witness size.
**Artifacts.** The strategy harness, the reproducibility diff, and `strategies.json` with the measurements.

### TASK-FEA-006  Publish the go/no-go record with measured limitations and case counts

**Purpose.** Decide and publish the gate: the go/no-go record that either opens
the foundation epic or stops every dependent implementation task while
preserving this specification.
**Owns.** `fixtures/kernels/feasibility/reports/gate-record.json`, `fixtures/kernels/feasibility/reports/limitations.json`
**Requirement links.** `REQ-PLT-010`, `REQ-EVD-008`
**Prerequisites.** `TASK-FEA-004`, `TASK-FEA-005`
**Implementation.** Assemble the gate record from the corpus check, the witness verdicts, the independent comparison and the strategy comparison. State the case count, the correct-control count, the exact tool versions and platforms, the measured cost, precision, coverage and witness numbers, and every limitation that was observed. State the decision against the three gate conditions in [`README.md`](README.md): source-linked reproducible outcomes on real or faithfully reconstructed cases together with correct controls; at least one documented benefit over the comparison baseline, whether an additional supported defect class, a smaller witness, a lower comparable analysis or search cost, or a better explanation of the changing domain; and no misclassified correct control in the chosen scope. **This task is the gate for every other epic**: `FND`, and through it `ENG`, `TRI`, `LOC`, `HST`, `WEB`, `PRS`, `CUDA`, `OMP` and `REL`, depend on this outcome. A **no-go stops the dependent implementation tasks** and preserves the completed specification and backlog; it does not delete this file, narrow the requirements or substitute a different product. A conditional go states exactly which condition is unmet and which epics it blocks. Negative results are published alongside positive ones, and no number is projected without being labelled as such.
**Acceptance.** `gate-record.json` names the decision, the case and control counts, the exact comparison tool versions, either one measured benefit or an explicit statement that none was demonstrated, every blocked experiment with its blocker, and every measured limitation; the human-readable summary appears in [`../evaluation/methodology.md`](../evaluation/methodology.md). Every number is traceable to a row of `witnesses.json`, `compare.json` or `strategies.json`.
**Verification.** Environment: the pinned CPU environment plus the recorded device blockers. Command: `uv run --project engines/triton python -m feasibility.gate --corpus fixtures/kernels/feasibility --out fixtures/kernels/feasibility/reports/gate-record.json`. Observation: exit status 0 with a decision present, and a traceability cross-check that resolves every number in the record to a source row. A decision of `no-go` is a successful outcome of this task, not a failure of the command.
**Artifacts.** The gate record, the limitations record, and the list of epics the decision blocks.
