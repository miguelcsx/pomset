# Local CLI and CI — `LOC`

Epic `LOC`, milestone **M2 Local product**
([`README.md`](README.md)). Local capture, analysis, bundles, comparison and the read-only viewer exist.
Benchmarking and numerical execution remain unfinished; see the
[current audit](../evaluation/implementation-audit.md).

**Whole-epic prerequisites.** The `FND` foundation epic
([`02-foundation.md`](02-foundation.md)), the `TRI` engine epic
([`03-triton-engine.md`](03-triton-engine.md)) for genuine engine output, and the
`ENG` protocol tasks for the supervisor boundary. The CLI consumes real engine
results; it never renders seeded or synthetic data. Behaviour lives in
[`../architecture/local-ci.md`](../architecture/local-ci.md); storage duality is
in [`../architecture/monorepo.md`](../architecture/monorepo.md); decisions are
[`../adr/0006-jobs-and-persistence.md`](../adr/0006-jobs-and-persistence.md) and
[`../adr/0011-private-local-and-publication.md`](../adr/0011-private-local-and-publication.md).

### TASK-LOC-001  Create the offline workspace and CLI skeleton

**Purpose.** Stand up the TypeScript CLI package with no network, no account and no telemetry in any code path.
**Owns.** `apps/cli/package.json`, `apps/cli/src/main.ts`, `apps/cli/src/commands/registry.ts`, `apps/cli/src/telemetry.ts`
**Requirement links.** `REQ-CLI-001`, `REQ-CLI-010`
**Prerequisites.** `TASK-FND-002`
**Implementation.** Register the `apps/cli` workspace under the root `pnpm` workspace, add the `pomset` bin entry, and define the seven commands `analyze`, `validate`, `benchmark`, `compare`, `import`, `export` and `serve` in one registry with argument parsing and a shared context object. Provide a single outbound-transport module that is constructed only by commands that make an explicit, user-named remote request; no command constructs it implicitly, and no crash reporter, version check or usage counter is wired. Resolve every path against the invocation directory, and refuse to start if a command needs a network or account it was not given. The skeleton reports unimplemented commands as explicit errors rather than doing nothing.
**Acceptance.** On a machine with networking disabled, `pomset --help` lists all seven commands, each command reports its own not-yet-implemented state explicitly, and a runtime guard confirms no socket is opened and no remote host is contacted during any command.
**Verification.** CPU-only with networking disabled: `pytest apps/cli/tests/test_skeleton.py -q` plus one manual `pomset --help` invocation; socket activity observed with the platform network monitor during the run.
**Artifacts.** A buildable CLI package with a command registry and a transport module that no default path instantiates.

### TASK-LOC-002  Store snapshots and results in SQLite and a content-addressed store

**Purpose.** Provide the local metadata and artifact persistence that makes offline snapshots and results durable and immutable.
**Owns.** `apps/cli/src/storage/sqlite.ts`, `apps/cli/src/storage/cas.ts`, `packages/storage/src/local/*`
**Requirement links.** `REQ-CLI-001`, `REQ-PRJ-001`, `REQ-PRJ-007`, `REQ-PRJ-008`
**Prerequisites.** `TASK-LOC-001`
**Implementation.** Implement the `packages/storage` consumer-visible lifecycle over a local SQLite database plus a filesystem content-addressed store: projects holding multiple source and configuration files, snapshots hashed per file over original bytes with the manifest hash computed over its RFC 8785 JCS serialization with the hash field omitted, and results and artifacts referenced by content hash. A snapshot is written once and never mutated; an edit writes a child snapshot with `parentSnapshotId` set and leaves the parent and every result attached to it untouched. Normalise POSIX relative paths, reject symlinks, escaping paths and duplicate paths. No PostgreSQL, no object store and no network connection is required.
**Acceptance.** Two consecutive analyses of an edited file produce two snapshots whose manifests hash independently, with the younger naming the older as parent; the older snapshot's bytes and results are byte-identical after the edit; a snapshot containing a symlink or an escaping path is rejected before any bytes are stored.
**Verification.** CPU-only: `pytest apps/cli/tests/test_storage.py -q`, asserting hash stability across repeated runs, parent linkage, and rejection of the symlink and traversal fixtures.
**Artifacts.** A local storage implementation satisfying the shared lifecycle interface, plus the initial database schema.

### TASK-LOC-003  Implement the single eligibility policy

**Purpose.** Implement the one `EligibilityPolicy` that decides whether required properties are satisfied and whether a measurement is eligible.
**Owns.** `packages/domain/src/eligibility/policy.ts`, `packages/domain/src/eligibility/evaluate.ts`
**Requirement links.** `REQ-PRJ-004`, `REQ-DOM-001`, `REQ-DOM-009`, `REQ-VAL-001`, `REQ-VAL-002`, `REQ-VAL-003`, `REQ-PERF-010`
**Prerequisites.** `TASK-LOC-002`
**Implementation.** Evaluate the scenario's declared required properties against exactly one policy at a stated revision and record that revision with the result. For each property the policy states accepted methods, whether a sampled pass may satisfy it, and whether an `unknown` result may satisfy it; the default accepts neither for correctness properties, so unknown or unsupported required checks block automatic eligibility. A user change to the policy is recorded with its revision and leaves the evidence class unchanged — policy changes re-label, they never upgrade. A performance recommendation additionally requires exact compatible snapshot, scenario, profile, domain and policy identities, complete provenance, a measured rather than estimated metric and a compatible hardware cohort. This package imports no React, HTTP, persistence, GPU or solver code and is consumed by the CLI now and by the API later.
**Acceptance.** A configuration with an `unknown` output-coverage result is ineligible under the default policy and reports `ineligible` with reason codes; the same configuration becomes eligible only after an explicit recorded policy change that still reports the unchanged evidence class; a recommendation request missing measurement provenance is refused with the missing field named.
**Verification.** CPU-only: `pytest packages/domain/tests/test_eligibility.py -q`, including the identity-mismatch, unknown-required-check, sampled-only and incomplete-provenance cases.
**Artifacts.** The canonical eligibility policy implementation and its reason-code vocabulary, reused by local and hosted consumers.

### TASK-LOC-004  Validate the `pomset.json` manifest against the `Scenario` schema

**Purpose.** Load and validate the checked-in manifest that describes the experiment, in the canonical `Scenario` schema.
**Owns.** `apps/cli/src/manifest/load.ts`, `apps/cli/src/manifest/validate.ts`
**Requirement links.** `REQ-CLI-002`, `REQ-PRJ-012`
**Prerequisites.** `TASK-LOC-002`
**Implementation.** Read `pomset.json` and validate each scenario against the canonical schema bindings generated in `packages/contracts`: entrypoint file path and symbol, allocations with roles, dtypes, shapes and strides, launch expression, domain variables and constraints, required properties, and profiles. Reject an invalid scenario with an explicit `INPUT_INVALID` naming the offending field — never drop, default or rewrite the parts that do not parse. Reject unknown property identifiers, unresolvable launch parameter names, allocations referenced by the launch expression but not declared, and an unsatisfiable or empty domain. Validate on every load, not only on the first import.
**Acceptance.** A manifest naming an undeclared allocation in its launch expression is rejected with that name quoted; a manifest with an unknown property identifier is rejected; a valid manifest loads with all scenarios, domains and required properties intact and no silently added defaults.
**Verification.** CPU-only: `pytest apps/cli/tests/test_manifest.py -q` over the valid `docs/contracts/examples/scenario.json` and the invalid fixtures `scenario-zero-divisor.json` and their traversal counterparts.
**Artifacts.** A manifest loader with field-level rejection messages, used by every command.

### TASK-LOC-005  Implement `analyze` and `validate` with explicit profile resolution

**Purpose.** Run the engine locally and report property outcomes, resolving profiles explicitly instead of falling back.
**Owns.** `apps/cli/src/commands/analyze.ts`, `apps/cli/src/commands/validate.ts`, `apps/cli/src/profiles/resolve.ts`
**Requirement links.** `REQ-CLI-003`, `REQ-PLT-003`, `REQ-PLT-004`, `REQ-EXP-013`
**Prerequisites.** `TASK-LOC-003`, `TASK-LOC-004`
**Implementation.** `analyze` resolves the scenario's profile revision from the local capability manifests, launches the `TRI` engine through the `packages/engine-client` supervisor over the read-only request file, and persists genuine results; `validate` evaluates those results against the policy from `TASK-LOC-003`. An unknown profile id fails with `PROFILE_NOT_FOUND`; an incompatible profile or unsupported requested property states the incompatibility, names the missing component and offers the alternative that does exist — including running locally — and never substitutes a nearby analysis. Show unavailable profiles with their reason rather than filtering them out of the listing.
**Acceptance.** On a supported fixture, `analyze` then `validate` produces persisted results with no network access; an unknown profile id exits with status 2 and a `PROFILE_NOT_FOUND` record; a property the profile marks unsupported reports the missing capability and its reason rather than a nearby property's result.
**Verification.** CPU-only, networking disabled: `pytest apps/cli/tests/test_analyze_validate.py -q`, asserting the persisted records, the `PROFILE_NOT_FOUND` code and the unavailable-capability explanation.
**Artifacts.** Two working commands over real engine output, plus the profile resolution table the report carries.

### TASK-LOC-006  Implement `benchmark` behind eligibility and explicit consent

**Purpose.** Measure only eligible configurations, on an explicitly opted-in device, with consent, the declared reference and witness replay.
**Owns.** `apps/cli/src/commands/benchmark.ts`, `apps/cli/src/consent.ts`, `apps/cli/src/bench/run.ts`
**Requirement links.** `REQ-CLI-003`, `REQ-CLI-006`, `REQ-CLI-009`, `REQ-CLI-011`, `REQ-PRJ-006`, `REQ-DOM-011`, `REQ-EXP-006`, `REQ-VAL-005`, `REQ-VAL-007`, `REQ-PERF-002`, `REQ-SEC-003`
**Prerequisites.** `TASK-LOC-005`
**Implementation.** Refuse `benchmark` unless an eligible validation record exists for the same snapshot, scenario, domain and policy, and unless `--trust-local-code` was passed; the refusal names which condition failed. Run GPU work only when the user opts in for that run, never by configuration default, project file or imported bundle. Compile and execute through the supervisor with the request's budgets, run the declared reference with its tolerances, NaN/Inf policy and fresh or poisoned buffers, and record replay of a witness with its method and outcome. Keep hardware cohorts separate, and record warm-ups, samples, variance, clock and synchronisation method, instrumentation effects and compilation time separately from execution time.
**Acceptance.** Without an eligible validation record the command exits with status 2 and names the missing record; without `--trust-local-code` it refuses and names the flag; with both, it records a measurement carrying hardware, tool, warm-up, sample, method and variance fields; requesting a GPU run without the per-run opt-in is refused; comparing two unlike devices keeps the cohorts separate rather than producing one ranking.
**Verification.** CPU-only by default plus one explicitly opted-in local GPU run on a machine that has the device: `pytest apps/cli/tests/test_benchmark.py -q`, then one manual run per device class; where no GPU exists the GPU case is recorded as a documented blocker.
**Artifacts.** A benchmark command, an audit of consent invocations, and measurement records carrying their qualifiers.

### TASK-LOC-007  Emit the machine-readable report and the three exit statuses

**Purpose.** Produce a report for every run and map the requested policy to exit status 0, 1 or 2 while preserving the exact outcomes.
**Owns.** `apps/cli/src/report/json.ts`, `apps/cli/src/report/exit.ts`
**Requirement links.** `REQ-CLI-004`, `REQ-CLI-005`, `REQ-DOM-008`, `REQ-DOM-013`, `REQ-EVD-008`, `REQ-PERF-011`
**Prerequisites.** `TASK-LOC-005`
**Implementation.** For every invocation emit one machine-readable JSON report on stdout or to a named file, carrying per-property outcomes with method and evidence class, error records with their codes, the policy revision, profile revision, coverage, assumptions and budget, and the sampling strategy, revision, seed and budget that produced any sampled point. Exit 0 when the requested policy is satisfied, 1 when an actual property or regression check failed, and 2 when the input is invalid, a required analysis is unsupported, a required result is unknown, or the engine failed. Status 2 aggregates distinct causes, so the report must keep them separate and must be identical in substance whether the status is 2 or 1. Counts and percentages appear only with an enumerated denominator; estimated values are labelled `estimated` in the report.
**Acceptance.** A failing fixture exits 1 with a violated property in the report; an unsupported-required-property fixture exits 2 with an `unsupported` outcome and a named construct, distinguishable from the 1 case by the report alone; a sampled run's report reproduces its point list from the recorded seed, revision and budget; an unenumerated domain reports constraints and no percentage.
**Verification.** CPU-only: `pytest apps/cli/tests/test_report.py -q`, asserting exit statuses per fixture and validating each report against `packages/contracts/schema/evidence.schema.yaml`.
**Artifacts.** A report writer and exit-status mapper, plus the schema-validated report fixtures CI compares against.

### TASK-LOC-008  Implement `compare`, `import` and `export` without execution

**Purpose.** Compare named snapshots, and move portable bundles in and out of the workspace, validating rather than running their contents.
**Owns.** `apps/cli/src/commands/compare.ts`, `apps/cli/src/commands/import.ts`, `apps/cli/src/commands/export.ts`
**Requirement links.** `REQ-CLI-007`, `REQ-PRJ-009`, `REQ-VAL-009`
**Prerequisites.** `TASK-LOC-007`
**Implementation.** `export` writes an `ExperimentBundle` containing the portable records, profile revisions, required tools and the artifacts needed to read the experiment offline. `import` validates that bundle against the portable schemas, rejects escaping paths, absolute paths, symlinks, conflicting identities, invalid hashes and unsupported schema versions with `BUNDLE_INVALID`, and executes nothing — no kernel, no reference and no code found inside the archive. `compare` diffs two named snapshots' files and reports, per required property and per region, whether the validation outcome improved, regressed or stayed the same, without re-labelling the older result; a comparison across different domains is refused rather than approximated. Imported evidence keeps `origin: imported` and its original provenance.
**Acceptance.** A malformed bundle and a traversal-path bundle are both rejected with `BUNDLE_INVALID` and neither writes outside the workspace; `compare` between a baseline and an edited snapshot reports the per-property movement while the baseline report remains unchanged; two snapshots with different domains are refused.
**Verification.** CPU-only, networking disabled: `pytest apps/cli/tests/test_bundle_compare.py -q` over the valid `docs/contracts/examples/experiment-bundle.json` plus `bundle-path-traversal.json`, `bundle-symlink-entry.json` and a hash-conflicting variant.
**Artifacts.** Three commands, a bundle validator, and regression comparison output suitable for a CI log.

### TASK-LOC-009  Serve read-only reports on loopback with a local read capability

**Purpose.** Provide `pomset serve` as a loopback-only, read-only report viewer that shares the workbench components and exposes no execution route.
**Owns.** `apps/cli/src/commands/serve.ts`, `apps/cli/src/serve/transport.ts`, `apps/cli/src/serve/capability.ts`
**Requirement links.** `REQ-CLI-008`, `REQ-CLI-013`, `REQ-CLI-014`, `REQ-PRJ-010`, `REQ-UX-011`
**Prerequisites.** `TASK-LOC-002`
**Implementation.** Serve the built `apps/web` report route and the shared `packages/ui` inspector components over the same read-only transport contract the hosted workbench uses, from one transport implementation rather than a second renderer. Bind to loopback only, validate the `Host` and `Origin` headers, disable cross-origin access and require a random per-process local read capability for the private report APIs; opening a URL without that capability, or merely opening an imported report, authorises nothing and starts nothing. Expose no route that starts a job, compiles or executes anything, so there is no web-to-local job submission and no runner pairing. Write and job controls render unavailable with an explicit explanation naming the local CLI command that performs the operation instead.
**Acceptance.** The viewer renders a persisted real-result report with source, actor and memory inspection and keyboard navigation; a request without the read capability, from a non-loopback address or with a foreign `Host` header is refused; no route accepts a job or execution request; the disabled run control states which command to use.
**Verification.** CPU-only, networking disabled: `pytest apps/cli/tests/test_serve.py -q`, then one manual load of the served report in a browser to inspect rendering, keyboard operability and the disabled-control explanation.
**Artifacts.** A read-only loopback viewer sharing the workbench components, plus the transport interface `WEB` extends.

### TASK-LOC-010  Document reproducible CI recipes

**Purpose.** Publish CI recipes that pin their profile revisions, hold a named baseline snapshot and need no hosted credentials.
**Owns.** `docs/ci-recipes.md`, `apps/cli/tests/ci/recipes/`
**Requirement links.** `REQ-CLI-012`
**Prerequisites.** `TASK-LOC-007`
**Implementation.** Write recipes that pin the exact profile revisions and tool versions in use, name the baseline snapshot for regression comparison, list the exact command line for each step and state the exit status each step is expected to produce. Cover a first-run analysis, a validation against the baseline, a `compare` against the named baseline, and a bundle import check. The recipes hold no hosted credential, install no hosted dependency, require no account and transmit nothing; a recipe that cannot run without network access is not admitted. Record the observed limitations of the pinned environment next to the recipes rather than promising more.
**Acceptance.** Running the recipes on a clean machine with networking disabled reproduces the documented statuses: 0 for the satisfied baseline, 1 for a deliberately regressed property and 2 for an unsupported required property; no recipe contacts a remote host or requires a login.
**Verification.** CPU-only, networking disabled: `pytest apps/cli/tests/test_ci_recipes.py -q`, executing each documented recipe and asserting its exit status, then one manual run on a clean machine.
**Artifacts.** A documented CI recipe set with its pinned revisions, its named baseline snapshot and its expected statuses.
