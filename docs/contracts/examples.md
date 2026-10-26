# Contracts: examples

Every contract above has a runnable example under
[`examples/`](examples/). The valid ones validate against their schema; the
invalid ones are rejected, either by the schema shape or by the rule the evaluator
enforces. The machine-readable index is [`examples/manifest.json`](examples/manifest.json).

The validator in the delivery plan replays this manifest: it checks that each valid
fixture validates against the named `$defs` entry and that each invalid fixture is
rejected. The rule-level fixtures are additionally checked by the implementation
tasks named in [`../delivery/README.md`](../delivery/README.md).

## Valid fixtures

| File | Schema definition | What it shows |
|---|---|---|
| [`project.json`](examples/project.json) | `domain.schema.yaml#project` | A versioned project with a server-owned owner id. |
| [`snapshot-manifest.json`](examples/snapshot-manifest.json) | `domain.schema.yaml#snapshotManifest` | Per-file hashes plus the JCS manifest hash. |
| [`workload-domain.json`](examples/workload-domain.json) | `domain.schema.yaml#workloadDomain` | Enumerated domain with shape, block-size and dtype variables and positive-divisor constraints. |
| [`scenario.json`](examples/scenario.json) | `domain.schema.yaml#scenario` | The floor-divided grid form, a poisoned output, declared tolerances and three required properties. |
| [`profile-revision.json`](examples/profile-revision.json) | `domain.schema.yaml#profileRevision` | Pinned Python, Triton and Z3 versions with an image digest. |
| [`capability.json`](examples/capability.json) | `domain.schema.yaml#capability` | A validated, immediately available capability. |
| [`eligibility-policy.json`](examples/eligibility-policy.json) | `domain.schema.yaml#eligibilityPolicy` | Required properties that accept neither sampled passes nor unknowns. |
| [`analysis-result.json`](examples/analysis-result.json) | `evidence.schema.yaml#analysisResult` | A violated coverage result with its witness, assumptions, coverage regions and the qualified correction hint, plus an established bounds result and an unsupported conflict result. |
| [`artifact-manifest.json`](examples/artifact-manifest.json) | `evidence.schema.yaml#artifactManifest` | A content-addressed report artifact with a retention class. |
| [`measurement-measured.json`](examples/measurement-measured.json) | `measurement.schema.yaml#measurement` | A measured, eligible latency record with distribution, warm-up, compile/execution separation and a fresh output buffer. |
| [`measurement-imported.json`](examples/measurement-imported.json) | `measurement.schema.yaml#measurement` | A profiler export: serialising instrumentation, no warm-up, one sample, imported origin, ineligible with reasons. |
| [`owner-identity.json`](examples/owner-identity.json) | `publication.schema.yaml#ownerIdentity` | Issuer, subject hash and opaque owner id. |
| [`disclosure-preview.json`](examples/disclosure-preview.json) | `publication.schema.yaml#disclosurePreview` | Enumerated disclosure categories with counts and bytes. |
| [`publication.json`](examples/publication.json) | `publication.schema.yaml#publication` | One snapshot and one explicitly selected artifact, unlisted. |
| [`experiment-bundle.json`](examples/experiment-bundle.json) | `bundle.schema.yaml#experimentBundle` | Portable bundle with required tools, required hardware, `executable: false` and `published: false`. |
| [`job-succeeded.json`](examples/job-succeeded.json) | `engine.schema.yaml#job` | A succeeded job whose result contains a violation: state carries no correctness assertion. |
| [`job-cancelled.json`](examples/job-cancelled.json) | `engine.schema.yaml#job` | A recorded cancellation with no results. |
| [`job-failed.json`](examples/job-failed.json) | `engine.schema.yaml#job` | A lease expiry finalised as failed with `WORKER_LOST`. |
| [`job-events.json`](examples/job-events.json) | `engine.schema.yaml#jobEvent` | A durable, append-only event sequence ending in `result.committed` then `job.succeeded`. |
| [`engine-request.json`](examples/engine-request.json) | `engine.schema.yaml#engineRequest` | The read-only request with mapped inputs, scratch, artifact directory and the budget defaults. |
| [`engine-hello.json`](examples/engine-hello.json) | `engine.schema.yaml#engineEnvelope` | Exactly one initial hello with capability declarations and limits. |
| [`engine-error.json`](examples/engine-error.json) | `engine.schema.yaml#engineEnvelope` | An asynchronous engine failure carried in the payload, not in an HTTP status. |
| [`engine-cancel.json`](examples/engine-cancel.json) | `engine.schema.yaml#cancelEnvelope` | The single supervisor-to-engine message direction, with its own sequence. |

## Invalid fixtures

Each of these must be rejected. The schema rejects some directly; the rest are
rejected by the named rule, which the implementation owns.

### Rejected by schema

| File | Why |
|---|---|
| [`invalid/job-unknown-state.json`](examples/invalid/job-unknown-state.json) | A job state outside the closed state set. |
| [`invalid/measurement-with-correctness-class.json`](examples/invalid/measurement-with-correctness-class.json) | A measurement carrying a correctness evidence class instead of `measured` or `estimated`. |
| [`invalid/engine-envelope-missing-sequence.json`](examples/invalid/engine-envelope-missing-sequence.json) | An envelope without its sequence number. |
| [`invalid/capability-unavailable-without-reason.json`](examples/invalid/capability-unavailable-without-reason.json) | An untested, unavailable capability with no reason. |

### Rejected by a named rule

| File | Rule | Owner |
|---|---|---|
| [`invalid/scenario-zero-divisor.json`](examples/invalid/scenario-zero-divisor.json) | A launch expression with a zero divisor; the launch evaluator rejects it. | `TASK-FND-004`, `TASK-TRI-003` |
| [`invalid/result-established-by-instrumentation.json`](examples/invalid/result-established-by-instrumentation.json) | `established` paired with an instrumented observation; the closed outcome table forbids it. | `TASK-FND-006` |
| [`invalid/finding-without-source-range.json`](examples/invalid/finding-without-source-range.json) | A finding with no source range is not renderable. | `TASK-FND-006`, `TASK-TRI-007` |
| [`invalid/coverage-percentage-unenumerated.json`](examples/invalid/coverage-percentage-unenumerated.json) | A count or percentage over a domain that is not enumerated. | `TASK-TRI-009` |
| [`invalid/bundle-path-traversal.json`](examples/invalid/bundle-path-traversal.json) | A bundle entry path escaping the bundle root. | `TASK-SEC-004` |
| [`invalid/bundle-symlink-entry.json`](examples/invalid/bundle-symlink-entry.json) | A bundle entry declaring a symlink. | `TASK-SEC-004` |
| [`invalid/witness-undeclared-and-unassigned.json`](examples/invalid/witness-undeclared-and-unassigned.json) | A witness that does not fix every domain variable the property depends on. | `TASK-TRI-015` |
| [`invalid/measurement-zero-for-absent-metric.json`](examples/invalid/measurement-zero-for-absent-metric.json) | A metric the tool cannot supply reported as a numeric zero instead of being absent with a capability explanation. | `TASK-PRS-005` |

## How to run the checks

From the repository root, with the validator environment described in the delivery
plan:

```bash
python3 -m venv /tmp/pomset-docs-validation
/tmp/pomset-docs-validation/bin/python -m pip install jsonschema openapi-spec-validator PyYAML
/tmp/pomset-docs-validation/bin/python /tmp/pomset-docs-check.py docs
```

The validator reports broken links, duplicate or unresolved identifiers,
requirement blocks missing a task or an acceptance scenario, task-graph cycles,
retained source rows with no requirement, schema or fixture failures, and OpenAPI
problems. A mechanically passing run does **not** establish that the application
exists; it establishes that this documentation set is internally consistent.
