# Foundation — `FND`

The foundation epic turns the decided contracts into a buildable skeleton: the
workspace, the generated bindings, the immutable types, the identity rules and
the profile manifests that every later epic consumes. It contains no analysis
and no user-facing behaviour. Canonical bindings, validation and aggregate verification now exist. These
remain delivery targets with acceptance obligations; see the
[current audit](../evaluation/implementation-audit.md).

| Field | Value |
|---|---|
| Epic prefix | `FND` |
| Prerequisites as a whole | `TASK-FEA-006` — the feasibility gate must return a go. A no-go stops this epic. |
| Milestone | **M1 Foundation**, shared with `ENG` and `SEC`; closes when the contracts validate, the generated bindings build and CI runs CPU-only. |
| Downstream | `ENG`, `TRI`, `LOC`, `HST` and, through them, `WEB`, `PRS`, `CUDA`, `OMP`, `REL`. |

Ownership of shared packages is recorded in
[`../architecture/monorepo.md`](../architecture/monorepo.md): this epic owns the
canonical schema bindings and error registry, the `packages/storage` lifecycle
interface, and the versioned profile manifests under
`profiles/{backend}/{profileId}.json`.

### TASK-FND-001  Establish the workspace, package boundaries and split CI

**Purpose.** Create the planned monorepo skeleton and the continuous integration
that can prove it, with CPU-only jobs always runnable and GPU jobs strictly
optional.
**Owns.** `pnpm-workspace.yaml`, `package.json`, `apps/web/`, `apps/api/`, `apps/cli/`, `apps/worker/`, `packages/contracts/`, `packages/domain/`, `packages/ui/`, `packages/storage/`, `packages/engine-client/`, `.github/workflows/ci.yml`
**Requirement links.** `REQ-PRJ-001`, `REQ-PLT-013`
**Prerequisites.** `TASK-FEA-006`
**Implementation.** Instantiate the planned tree from [`../architecture/monorepo.md`](../architecture/monorepo.md) with `pnpm` workspaces for TypeScript and Python engines kept behind `uv`, so that no Python or native build is ever forced through a JavaScript bundler. Each package starts empty but declares its dependencies along the directions in that document: `packages/domain` imports no React, HTTP, persistence, GPU or solver code, and `packages/contracts` sits under everything. CI runs one CPU-only job per package: type-check, lint, build and unit tests; a separate job generates and type-checks the contract bindings; a third job runs the Python engine environment under `uv sync --frozen`. GPU jobs are declared `optional`, are skipped without a self-hosted runner, and never gate a merge. `TASK-FEA-001`'s disposable harness is absorbed into `engines/triton/` here and its standalone entry points are removed, so no second harness survives. No file is copied from the mock branch: the workbench shell is a later epic.
**Acceptance.** A fresh clone installs and builds on a CPU-only machine with no network access to a GPU host; `pnpm -r build` and `pnpm -r test` succeed; the optional GPU workflow reports skipped rather than failed on a machine without a device; the dependency graph check reports no import from `packages/domain` into React, HTTP, persistence, GPU or solver packages.
**Verification.** Environment: a clean CPU worker with Node.js, `pnpm` and `uv` installed and no GPU. Command: `pnpm install --frozen-lockfile && pnpm -r build && pnpm -r test && pnpm run check:boundaries`. Observation: exit status 0 from each step, and the boundary check listing zero forbidden imports.
**Artifacts.** The workspace, the lockfiles, and CI configuration with CPU-only and optional GPU jobs.

### TASK-FND-002  Generate the canonical schema bindings and the single error registry

**Purpose.** Make the contract documents the one authority from which TypeScript
and Python types are generated, so that no hand-written duplicate type and no
second error vocabulary can appear later.
**Owns.** `packages/contracts/src/generated/`, `packages/contracts/python/pomset_contracts/`, `packages/contracts/scripts/generate.ts`, `packages/contracts/src/errors.ts`
**Requirement links.** `REQ-ENG-013`, `REQ-PLT-001`
**Prerequisites.** `TASK-FND-001`
**Implementation.** Take `packages/contracts/schema/*.schema.yaml` and `openapi.yaml` as the input authority and generate TypeScript and Python bindings from them, resolving every local `$ref` and rejecting an unresolvable one. Emit the shared `ErrorRecord {code, message, details}` type and one `ErrorCode` enum containing exactly `PROFILE_NOT_FOUND`, `ENGINE_FAILED`, `WORKER_LOST`, `PROTOCOL_INVALID`, `INPUT_INVALID`, `BUNDLE_INVALID`, `UNAUTHORIZED`, `FORBIDDEN`; the HTTP status mapping in [`../contracts/README.md`](../contracts/README.md) and the engine error payload both reference this one enum. A generation step that produces a diff fails CI, so a schema edit and its bindings cannot drift. The canonical schemas live in `packages/contracts/schema` and nowhere else, so two authorities never coexist.
**Acceptance.** Both generated bindings compile; every schema file validates as JSON Schema 2020-12 with all local references resolvable; the generated `ErrorCode` contains exactly the eight codes and no others; a deliberately edited schema with stale bindings fails CI; the valid and invalid fixtures under `docs/contracts/examples/` validate and are rejected respectively through the generated bindings.
**Verification.** Environment: a CPU worker with the workspace installed. Commands: `pnpm --filter @pomset/contracts run generate --check`, `pnpm --filter @pomset/contracts run build`, and `uv run --directory packages/contracts python -m pomset_contracts.check --examples docs/contracts/examples`. Observation: exit status 0 from each, with the check reporting zero unresolved references and the example run reporting each valid fixture accepted and each invalid fixture rejected by its documented code.
**Artifacts.** Generated bindings for both languages, the generation script with its drift check, and the error registry.

### TASK-FND-003  Define the immutable domain types for projects, scenarios and eligibility

**Purpose.** Encode the project, scenario, allocation, alias-group and eligibility
policy shapes once as immutable pure data, so that the API, the CLI and the worker
cannot disagree about what a scenario is.
**Owns.** `packages/domain/src/project.ts`, `packages/domain/src/scenario.ts`, `packages/domain/src/domain.ts`, `packages/domain/src/eligibility.ts`
**Requirement links.** `REQ-PRJ-003`, `REQ-DOM-002`
**Prerequisites.** `TASK-FND-002`
**Implementation.** Model `Project`, `SnapshotManifest`, `Scenario`, `Allocation`, `AliasGroup`, `WorkloadDomain` and `EligibilityPolicy` as immutable value types with no setters and no hidden mutable state; a change produces a new value. `Scenario` carries exactly one entrypoint, the declared allocations with name, role, dtype, shape and strides, the launch expression, the required properties and any declared reference computation. `WorkloadDomain` is a conjunction of declared variables whose kinds cover shape, dtype, layout and strides, launch configuration and hardware. `EligibilityPolicy` is one object holding the required-property acceptance and measurement-eligibility rules at a stated revision. Allocations outside an alias group are non-aliasing by construction; the model never infers aliasing. The package stays free of React, HTTP, persistence, GPU and solver imports, so local and hosted operation share it verbatim.
**Acceptance.** The types compile with readonly semantics such that an attempted mutation is a compile error; constructing a scenario with two entrypoints, an unknown property id, or a launch parameter that resolves to no declared domain variable is rejected at construction; a domain variable of an unsupported kind is rejected; the boundary check reports zero forbidden imports from this package.
**Verification.** Environment: a CPU worker with the workspace installed. Commands: `pnpm --filter @pomset/domain run build` and `pnpm --filter @pomset/domain test`. Observation: exit status 0, and a test report listing one passing case per rejection above and a compile-failure fixture for the mutation case.
**Artifacts.** The domain package with its type-level invariants and rejection tests.

### TASK-FND-004  Validate scenarios and domains against schema, launch expression and capability

**Purpose.** Reject an invalid scenario rather than repairing it, and validate the
launch expression, the property vocabulary and the reserved extension prefix in
one place.
**Owns.** `packages/domain/src/validate.ts`, `packages/domain/src/expr.ts`, `packages/domain/src/properties.ts`
**Requirement links.** `REQ-PRJ-005`, `REQ-PRJ-012`, `REQ-DOM-003`, `REQ-VAL-010`
**Prerequisites.** `TASK-FND-002`
**Implementation.** Validate a scenario against the portable schema and the declared backend capabilities. Evaluate the launch configuration as a restricted integer-expression tree over declared domain variables with exactly the operators literal, parameter, add, subtract, multiply, floor-divide, ceil-divide and modulo; reject an unresolvable parameter name, a divisor not provably positive under the constraints, or a resulting grid dimension not provably nonnegative. Accept no host callback and never parse a display hint such as `triton.cdiv` back into semantics. Validate the domain as a machine-checkable conjunction over the declared variables and reject a domain that is empty or whose constraints cannot be checked. Resolve required properties against the shared vocabulary; a project-local property is accepted only under the reserved `x-` prefix and must carry a declared meaning. Every rejection produces an `ErrorRecord` with `INPUT_INVALID` and the offending path; nothing is dropped, defaulted or rewritten.
**Acceptance.** A scenario with a missing entrypoint, an unknown property id, a launch parameter that no domain variable declares, a non-positive divisor or a negative grid dimension is rejected with `INPUT_INVALID` and the offending JSON pointer; a project-local property without the `x-` prefix is rejected; an empty domain is rejected; each case is returned in one machine-readable rejection list rather than a prose error.
**Verification.** Environment: a CPU worker with the workspace installed. Command: `pnpm --filter @pomset/domain test -- validate`. Observation: exit status 0, with one passing case per rejection above asserting the code and the JSON pointer, and one passing case confirming a valid scenario round-trips unchanged.
**Artifacts.** The validation module, the expression evaluator, the property vocabulary, and the rejection test suite.

### TASK-FND-005  Implement snapshot identity and manifest hashing

**Purpose.** Give snapshots one identity rule that both storage implementations
obey, so two deployments compute the same hash for the same bytes.
**Owns.** `packages/domain/src/identity.ts`, `packages/domain/src/manifest.ts`
**Requirement links.** `REQ-PRJ-007`
**Prerequisites.** `TASK-FND-002`
**Implementation.** Hash each file's original bytes individually with SHA-256. Compute the `SnapshotManifest` hash over the UTF-8 serialization defined by [RFC 8785 JCS](https://www.rfc-editor.org/rfc/rfc8785.html) with the hash field omitted from the input, using normalized POSIX relative paths and no symlinks. Reject a non-I-JSON value, a path that is absolute or escaping, a duplicate path and a symlink entry; encode an integer outside the interoperable JSON safe-integer range as a decimal string under an explicit schema rather than losing precision. A manifest records the parent snapshot id when the snapshot was derived by editing, and an edit never mutates an existing manifest. The same inputs produce the same manifest hash in the TypeScript and Python implementations.
**Acceptance.** Hashing the same file set twice yields identical per-file and manifest hashes; reordering files in the manifest input does not change the manifest hash because keys are canonicalized; a manifest containing an absolute path, an escaping path, a symlink or a duplicate path is rejected with `INPUT_INVALID`; the TypeScript and Python implementations agree on a shared fixture.
**Verification.** Environment: a CPU worker with the workspace installed. Command: `pnpm run test:identity -- --cross-language`. Observation: exit status 0, with the cross-language comparison printing one identical manifest hash per fixture and one rejection per invalid case.
**Artifacts.** The identity and manifest modules in both languages plus their shared fixtures.

### TASK-FND-006  Publish the shared result, evidence, coverage and error record types

**Purpose.** Make the allowed outcome, method and evidence combinations a closed
table in code, so an impossible combination such as an established property
derived from an instrumented run cannot be constructed at all.
**Owns.** `packages/domain/src/evidence.ts`, `packages/domain/src/coverage.ts`, `packages/domain/src/result.ts`
**Requirement links.** `REQ-EVD-001`, `REQ-EVD-004`, `REQ-EVD-015`
**Prerequisites.** `TASK-FND-002`
**Implementation.** Model `Finding`, `Witness`, `Actor`, `MemoryAccessEvent`, `SourceRange`, `Assumptions`, `Coverage`, `Budget`, `SampledCheck`, `PropertyResult`, `AnalysisResult`, `ArtifactManifest` and `ErrorRecord` as immutable types. A `PropertyResult` carries one outcome from `established`, `violated`, `unknown`, `unsupported`, one method and one evidence class drawn from the six classes `observed`, `counterexample`, `potential`, `verified-under-assumptions`, `measured`, `estimated`, and only these tuples are constructible: established with static or symbolic and verified-under-assumptions, requiring a non-empty assumption set naming the model, its revision and the domain; violated with symbolic or static and counterexample, or with instrumented and observed; unknown and unsupported with any method and potential or estimated; measurement-only records with benchmark and measured or estimated. Any other combination is rejected as `INPUT_INVALID`. An `AnalysisResult` carries the snapshot, scenario, domain, policy revision and profile revision it belongs to, plus an `origin` of `local`, `hosted` or `imported` and the original execution location. `Job.state` is not part of a result and never implies a correctness verdict. A finite sampled check is a `SampledCheck` with explicit points and passed, failed or error observations, and never a domain-wide established result; a count or percentage is constructible only for a finite, explicitly enumerated denominator with duplicate points removed.
**Acceptance.** Each permitted row of the tuple table is constructible; every unlisted combination, including established by instrumented observation and violated with verified-under-assumptions, is rejected as `INPUT_INVALID`; a result without snapshot, scenario, domain, policy or profile provenance is rejected; a `Coverage` percentage with a nonexistent or non-enumerated denominator is rejected; a succeeded job's records never carry a correctness verdict derived from the job state alone.
**Verification.** Environment: a CPU worker with the workspace installed. Command: `pnpm --filter @pomset/domain test -- evidence`. Observation: exit status 0, with a test report listing one passing case per admitted tuple, one per rejected tuple, and the provenance- and coverage-invariant cases.
**Artifacts.** The evidence, coverage and result modules, the exported tuple table and its generated tests.

### TASK-FND-007  Build cache keys from exact identity, never from resemblance

**Purpose.** Define the cache key so that a hit means the same question asked of
the same inputs under the same tooling, and a measurement is never reused across
a different device.
**Owns.** `packages/domain/src/cache-key.ts`
**Requirement links.** `REQ-DOM-012`
**Prerequisites.** `TASK-FND-002`
**Implementation.** Compose an analysis cache key from the exact snapshot, scenario, domain, policy revision, model revision and profile revision identity. Compose a measurement cache key from the analysis key plus the device, tool, tool revision, environment identity and hardware cohort. Compare identities exactly; a newer model revision or solver version is a different key and may legitimately produce a different established-unknown split. Cache only immutable inputs and versions, so an edited source, a changed policy, a different query model or a different device can never reuse the earlier evidence. The key is a pure function with no clock, path or process input.
**Acceptance.** Changing any single component of the analysis key yields a different key; changing device, tool revision or environment yields a different measurement key while the analysis key is unchanged; a snapshot identity computed after an edit never equals the pre-edit identity; the function is deterministic across processes and repeated calls.
**Verification.** Environment: a CPU worker with the workspace installed. Command: `pnpm --filter @pomset/domain test -- cache-key`. Observation: exit status 0, with one passing case per differing component and a determinism case comparing two separately launched processes.
**Artifacts.** The cache-key module and its invariance tests.

### TASK-FND-008  Publish versioned capability and profile manifests

**Purpose.** Give every backend one immutable manifest format that separates what
has been validated from what is currently available, so a support claim is never
rewritten by deployment state.
**Owns.** `profiles/triton/`, `profiles/cuda/`, `profiles/openmp/`, `packages/domain/src/profile.ts`, `packages/contracts/scripts/check-profiles.ts`
**Requirement links.** `REQ-BCK-004`, `REQ-PLT-001`, `REQ-PLT-002`
**Prerequisites.** `TASK-FND-006`
**Implementation.** Define a `ProfileRevision` carrying the pinned engine identity and version, the exact tool versions and platform, an image digest where hosted, and one `Capability` entry per analysis feature. Every capability carries an independently assigned support level from `validated`, `limited`, `untested` and an availability from `immediate`, `queued`, `unavailable`. Support level is a property of the measured revision; availability is derived from deployment and queue state at read time and never rewrites a support claim. A capability absent from a manifest is reported as unsupported with the missing capability named, never as unsupported-by-omission or replaced by a nearby one. The profile check validates every manifest against the schema, rejects a profile that names no tool versions, and rejects a capability whose support level claims `validated` without a recorded conformance reference.
**Acceptance.** `profiles/{backend}/{profileId}.json` validates against the schema; every capability declares both a support level and an availability; a manifest claiming `validated` without a conformance reference fails the check; a deployed profile whose availability changes leaves its support level and revision hash unchanged.
**Verification.** Environment: a CPU worker with the workspace installed. Command: `pnpm --filter @pomset/contracts run check:profiles -- profiles`. Observation: exit status 0 with one report row per manifest listing its capability count, and exit status 1 with the offending path for a manifest missing tool versions or a conformance reference.
**Artifacts.** The profile schema binding, the checker, and the initial manifests for the three backends — the Triton one populated from `TASK-FEA-002`, the CUDA and OpenMP ones carrying `untested` capabilities only.

### TASK-FND-009  Record fixture and licence provenance for every reused artefact

**Purpose.** Make reuse legally traceable: one metadata format for kernel
fixtures and one notice file that names each selectively reused third-party
component with its origin and revision.
**Owns.** `fixtures/kernels/README.md`, `fixtures/kernels/*/fixture.json`, `NOTICE`, `packages/contracts/scripts/check-licences.ts`
**Requirement links.** `REQ-SEC-012`
**Prerequisites.** `TASK-FND-001`
**Implementation.** Give every kernel fixture a `fixture.json` recording its origin, licence, the revision it came from and the declared expected outcome, so a fixture without a licence or an origin cannot be committed. Create `NOTICE` listing each selectively reused third-party component with its origin, revision and licence, retaining the original per-file copyright and licence notices required by its terms — the Compiler Explorer reference is BSD-2-Clause, whose conditions require the notice to survive a source redistribution and to be reproduced in the materials accompanying a binary distribution. Pomset's own code remains Apache-2.0. The checker walks the fixtures tree and the third-party source directories and fails on a fixture without provenance or a reused file whose licence text is missing; the check runs in CI. This task copies no third-party code; it builds the mechanism that a future reuse task must satisfy.
**Acceptance.** Every fixture directory contains a `fixture.json` with origin, licence and expected outcome; `NOTICE` names each reused component with origin, revision and licence; the checker fails when a fixture or a copied file lacks provenance; copying a file with a stripped notice fails CI.
**Verification.** Environment: a CPU worker with the workspace installed. Command: `pnpm --filter @pomset/contracts run check:licences -- fixtures NOTICE`. Observation: exit status 0 with a per-fixture report, and exit status 1 naming the offending path when a fixture's provenance or a copied file's notice is removed.
**Artifacts.** The fixture metadata format, the populated `NOTICE`, and the licence check wired into CI.
