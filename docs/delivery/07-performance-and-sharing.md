# Performance and sharing — `PRS`

Measurement is a separate evidence class from correctness. This epic records
measurements with their qualifiers, imports what external tools produced, admits
only eligible configurations to benchmarking, keeps hardware cohorts separate, and
exports and publishes with every qualifier intact. Pomset implements neither a
profiler nor an autotuner.

**Whole-epic prerequisites.** `TASK-LOC-002` (local snapshot and result storage),
`TASK-LOC-003` (the shared `EligibilityPolicy`) and `TASK-HST-009` (authorised
artifact storage). Each block lists its own prerequisites.

**Milestone.** M5 Performance and sharing: an eligible measurement is produced,
imported and compared within its cohort, a publication is previewed, published and
revoked, and access checks hold.

The measurement record, its eligibility and the comparison rules are specified in
[`../architecture/exploration-and-validation.md`](../architecture/exploration-and-validation.md);
the contract is owned by [`packages/contracts/schema/measurement.schema.yaml`](../../packages/contracts/schema/measurement.schema.yaml)
and [`../contracts/README.md`](../contracts/README.md); the decision is
[`../adr/0010-performance-and-eligibility.md`](../adr/0010-performance-and-eligibility.md).
Every path below is a planned future target.

### TASK-PRS-001  Define the measurement record and its required qualifiers

**Purpose.** Make a number meaningless unless it arrives with the conditions it was taken under.

**Owns.** `packages/domain/src/measurement/record.ts`, `packages/domain/src/measurement/validate.ts`

**Requirement links.** `REQ-PERF-004`

**Prerequisites.** `TASK-LOC-002`

**Implementation.** Implement the `Measurement` record with the hardware identity (device name, architecture, driver or runtime version, cohort id), the tool identity and version, the warm-up count, the sample count, the statistic used, the clock method, the synchronisation method, the per-sample values, the variance or distribution summary, the instrumentation note, and the evidence class `measured` or `estimated`. Define a validator that classifies a record as complete or incomplete per field group rather than rejecting it, so a well-formed but under-specified record can be retained and marked. A metric the producing tool cannot supply is absent with a capability explanation, never a numeric zero, and `estimated` values carry the model revision that produced them.

**Acceptance.** A record missing the clock method validates as incomplete with that field group named rather than as invalid, and a record missing the hardware identity likewise. A record carrying a `0` for a metric no tool supplied is rejected as structurally invalid, while an absent metric with a capability explanation validates. A record with ten samples and no variance summary reports as incomplete, not as a measurement with zero variance.

**Verification.** Environment: Node toolchain with the workspace installed. Command: `pnpm --filter @pomset/domain test -- measurement-record`. Observe: completeness classification and field-group names for each fixture.

**Artifacts.** The measurement record type, its completeness validator, and the metric-absence rule used by import and by the charts.

### TASK-PRS-002  Import measurements and profiler exports with provenance validation

**Purpose.** Let a user's own tool output be inspected, while a structurally broken or hash-conflicting record is refused and a merely incomplete one is kept honestly marked.

**Owns.** `packages/domain/src/measurement/import.ts`, `apps/cli/src/import/`, `packages/domain/src/measurement/profilerImport.ts`

**Requirement links.** `REQ-PERF-003`, `REQ-PERF-012`, `REQ-EVD-008`, `REQ-EVD-013`, `REQ-SHR-006`, `REQ-BCK-005`

**Prerequisites.** `TASK-PRS-001`

**Implementation.** Validate an imported measurement or profiler export against the portable schema, its required provenance fields and its content hashes, and reject a structurally invalid, hash-conflicting, oversized or malformed record. A well-formed but incomplete record is stored with `origin: imported`, its missing provenance named, and eligibility marked `ineligible` with reason codes, so it stays inspectable but is never admissible for a recommendation. Profiler exports are mapped to metric entries only where the exporting tool actually supplied them, each entry naming the tool and version, and every normalised entry keeps the source artifact reference so the mapping is auditable. Import never executes anything, never publishes, and never re-labels imported evidence as server-produced validation.

**Acceptance.** A Nsight export with complete hardware, warm-up and sample provenance imports with `origin: imported`, all metrics mapped and the mapping citing the artifact. The same export with its hash altered is rejected as hash-conflicting and stored nowhere. An export missing warm-up counts imports as ineligible with a reason naming the missing field and remains visible in the report listing.

**Verification.** Environment: CLI with the measurement and profiler fixtures under `docs/contracts/examples/`. Command: `pnpm --filter @pomset/cli test -- import-measurement`. Observe: stored records, `ineligible` reason codes, rejected hash conflict.

**Artifacts.** The import validator, the profiler-to-metric mapping, and the `origin: imported` labelling path.

### TASK-PRS-003  Benchmark locally with an eligible validation and explicit consent

**Purpose.** Time only configurations whose required properties were satisfied, and record compile time apart from execution time under the user's explicit consent.

**Owns.** `apps/cli/src/benchmark/`, `packages/engine-client/src/benchmark.ts`, `packages/domain/src/measurement/benchRun.ts`

**Requirement links.** `REQ-PERF-001`, `REQ-PERF-002`, `REQ-PERF-004`, `REQ-PERF-005`, `REQ-VAL-003`

**Prerequisites.** `TASK-LOC-006`, `TASK-PRS-001`

**Implementation.** Implement the launch-and-time harness for a locally executed configuration: it requires an eligible validation record for the same snapshot, scenario, domain and policy revision, requires the `--trust-local-code` flag, and refuses with the failed condition named otherwise, recording that the policy was unchanged. It warms up a declared number of times, takes a declared number of samples, computes the declared statistic with its variance, and records the clock and synchronisation method in the measurement. Compilation duration and just-in-time cache state are recorded separately and never folded into execution latency. Output buffers are fresh or poisoned before any reference comparison in the same run, and no profile is timed whose required checks are `unknown` or `unsupported` under the active policy.

**Acceptance.** `pomset benchmark` without an eligible validation record is refused naming that condition, and the same command without `--trust-local-code` is refused naming consent. An eligible run produces samples whose mean and variance are recorded alongside a separately recorded compile duration. A run whose reference comparison fails is recorded as a failed required check and produces no benchmark record admitted to a comparison.

**Verification.** Environment: a machine with the Triton CPU profile installed, plus fixtures with and without an eligible validation record. Command: `pomset validate` then `pomset benchmark --trust-local-code` on the eligible fixture. Observe: refusal messages, sample statistics, separate compile duration.

**Artifacts.** The benchmark harness, the eligibility and consent preconditions, and the measurement records it produces.

### TASK-PRS-004  Compare within a hardware cohort and gate recommendations

**Purpose.** Rank only what may be ranked, and reserve the product's strongest claim for evidence that is complete, measured and exactly compatible.

**Owns.** `packages/domain/src/measurement/comparison.ts`, `packages/domain/src/measurement/recommendation.ts`, `packages/domain/src/measurement/cohort.ts`

**Requirement links.** `REQ-PERF-009`, `REQ-PERF-010`, `REQ-DOM-011`

**Prerequisites.** `TASK-PRS-003`

**Implementation.** Compare configurations within a declared hardware cohort and produce a recommendation only when the measurement's snapshot, scenario, profile, domain and policy identities exactly match the request, its declared required checks are satisfied, its provenance is complete, its metric is `measured` rather than `estimated`, and its cohort is compatible under the policy's strictness. Failures of any condition produce an ineligible label naming each unmet condition, not a weaker ranking. A cross-cohort view is produced as a labelled comparison of cohorts and never as one ordered list, and unlike devices are never pooled to rank a universally fastest configuration. An explicit user policy may admit imported local evidence, which is recorded as a policy change while its origin and evidence class remain visible and its evidence class is not upgraded.

**Acceptance.** Two measurements from the same cohort with complete provenance compare into an ordered list with a recommendation. A third measurement from a different device appears in a separate labelled cohort view and in no combined ranking. A measurement whose policy revision differs from the request, or whose metric is `estimated`, is labelled ineligible with reason codes and produces no recommendation. Admitting an imported measurement through a policy change leaves its `origin: imported` and evidence class visible.

**Verification.** Environment: the CLI workspace with measurement fixtures for two cohorts and one estimate. Command: `pnpm --filter @pomset/domain test -- comparison`. Observe: cohort separation, reason codes, unchanged provenance.

**Artifacts.** The cohort model, the comparison function, and the recommendation gate with its reason codes.

### TASK-PRS-005  Enforce metric and explanation discipline

**Purpose.** Report only metrics an external tool supplied, declare instrumentation effects, and refuse to explain a change from latency alone.

**Owns.** `packages/domain/src/measurement/metrics.ts`, `packages/domain/src/measurement/explanation.ts`, `apps/cli/src/report/explain.ts`

**Requirement links.** `REQ-PERF-001`, `REQ-PERF-006`, `REQ-PERF-007`, `REQ-PERF-008`

**Prerequisites.** `TASK-PRS-003`, `TASK-HST-009`

**Implementation.** Maintain one metric catalogue keyed by tool capability: memory throughput, coalescing, bank conflicts, divergence, load balance, registers, spills and occupancy are emitted only for a capability a profile's tool actually provides, each entry naming the tool and version and referencing the artifact it was read from. No metric is inferred from runtime latency. Every measurement records whether the observation mechanism serialised or perturbed execution, so an instrumented or serialised run is never presented as unmodified parallel behaviour. An explanation of a performance change is stored only with a citation to a measured metric, a compilation artifact or a declared resource model, and names which of the three it rests on; an explanation lacking a citation is not stored.

**Acceptance.** Requesting an occupancy figure for a profile whose tool does not supply it returns an absent metric with a capability explanation and no number and no zero. A counter-collection run whose serialising dispatches are declared renders with that declaration. An explanation attempt citing only that one configuration was faster is rejected for want of a citation, while one citing a measured spill count is stored with that citation.

**Verification.** Environment: the CLI workspace with a measurement fixture carrying an instrumented run and a tool-capability fixture missing occupancy. Command: `pnpm --filter @pomset/domain test -- metric-discipline`. Observe: absent-versus-zero behaviour, the instrumentation declaration, the rejected uncited explanation.

**Artifacts.** The capability-keyed metric catalogue, the instrumentation declaration field usage, and the citation-enforcing explanation record.

### TASK-PRS-006  Export and replay portable bundles and a qualified timeline

**Purpose.** Let an experiment travel and be re-attempted elsewhere, and export a timeline only from ordering the analysis actually established.

**Owns.** `packages/contracts/src/bundle/`, `apps/cli/src/export/`, `packages/domain/src/timeline/perfetto.ts`

**Requirement links.** `REQ-PERF-013`, `REQ-SHR-004`, `REQ-SHR-010`, `REQ-UX-014`

**Prerequisites.** `TASK-PRS-002`, `TASK-LOC-008`, `TASK-HST-010`

**Implementation.** Assemble an `ExperimentBundle` carrying the portable records needed to read the experiment offline, the profile revisions used, the required tools and hardware, and the provenance of its origin, with each payload hashed and the manifest hashed over its JCS serialization. Export writes the bundle to the local filesystem and, where the owner chooses, uploads it through the authorised artifact route; it never publishes on its own. A replay attempt elsewhere resolves the bundle's records against the local environment and records a difference in tool or hardware identity, and where a required tool is missing records an explicit blocked replay naming it rather than a silent substitution. Timeline export writes only event data whose order the analysis established, marking unresolved relationships as unresolved and fabricating no total order to tidy the trace; a publication containing an exported bundle keeps every qualifier, including coverage, assumptions, budget, evidence class and eligibility.

**Acceptance.** Exported then re-imported on a clean machine, the bundle validates and lists its profile revisions and hardware; replaying it with the pinned tool present reproduces the recorded outcome and, with the tool absent, records a blocked replay naming the missing tool. A timeline export of a fixture with two independent writers contains no ordering edge between them and marks the pair unresolved. The bundle exported from a publication contains the same qualifiers as the published report.

**Verification.** Environment: the CLI workspace on a machine with the pinned tool, then without it, plus the partial-order fixtures. Command: `pomset export`, `pomset import`, `pomset compare` against the exported bundle. Observe: bundle validation, blocked-replay record, absent ordering edges in the exported trace.

**Artifacts.** The bundle assembler, the export and replay path with its difference and blocked-replay records, and the qualified timeline exporter.
