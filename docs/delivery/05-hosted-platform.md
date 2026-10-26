# Hosted platform — `HST`

The hosted deployment runs the same engine boundary the local path uses:
PostgreSQL for ownership, jobs and durable events, an S3-compatible object store
for artifacts, an API in front, and CPU-only workers behind it. No path here
executes a user kernel on a hosted GPU or forwards work to a user's machine.

**Whole-epic prerequisites.** `TASK-FND-008`, `TASK-ENG-001`, `TASK-ENG-005`.
Each block lists its own prerequisites.

**Milestone.** M3 Hosted product: a real job is accepted, executed and finalised
on the deployment, its evidence is durable and reconnectable, and every route is
authorised per request.

**Ordering before public job acceptance.** Authentication (`TASK-HST-002`),
sandbox preflight (`TASK-HST-016`, `TASK-HST-017`) and artifact authorisation
(`TASK-HST-009`, `TASK-HST-013`) MUST precede exposure of the job surface
(`TASK-HST-005`, `TASK-HST-007`, `TASK-HST-008`). A deployment missing any of
them serves the catalogue read-only; it never accepts a job it cannot isolate,
attribute and protect.

Rules are owned by [`../architecture/lifecycle.md`](../architecture/lifecycle.md)
and [`../architecture/security-and-deployment.md`](../architecture/security-and-deployment.md);
routes and error mapping by [`packages/contracts/schema/openapi.yaml`](../../packages/contracts/schema/openapi.yaml).
Every path below is a planned future target.

### TASK-HST-001  Fix the hosted execution scope to CPU analysis only

**Purpose.** Make the CPU-only hosted scope one enforced policy, so no acceptance path can start GPU work or reach a user's machine.

**Owns.** `apps/api/src/scope/hostedScope.ts`, `apps/worker/src/scope/hostedScope.ts`, `infra/deployment/scope.yaml`

**Requirement links.** `REQ-PLT-014`, `REQ-SEC-008`

**Prerequisites.** `TASK-FND-008`

**Implementation.** Define one `hostedScope` record of admissible operations (Triton parse, symbolic query, sandboxed compile, sandboxed interpreter replay), each tagged with its device class. API admission and the worker spawn path both read it and refuse any operation needing a GPU device: the profile reports availability `unavailable` with a reason and job creation returns `INPUT_INVALID` naming the missing capability, creating no job row. The deployment has no GPU runtime class, no device passthrough and no route by which a hosted session supplies a device address, pairing code or callback target. The record is the only allow-list; the worker keeps none.

**Acceptance.** For a manifest declaring a GPU requirement, `GET /v1/profiles` shows availability `unavailable` with a reason, `POST /v1/jobs` returns 400 naming the capability, no job row is created and no process starts. The route inventory of `../contracts/openapi.yaml` and the worker route table contain no device-pairing or forwarding operation.

**Verification.** Environment: local compose deployment under `infra/deployment/` plus a GPU-declaring profile manifest. Command: `pnpm --filter @pomset/api test -- integration/hosted-scope` and the deployed route inventory check. Observe: catalogue entry, 400 body, zero new job rows.

**Artifacts.** The `hostedScope` record, admission checks in API and worker, and the recorded route inventory.

### TASK-HST-002  Add OIDC sign-in with server-side sessions and CSRF protection

**Purpose.** Establish the authenticated identity every later authorisation decision depends on, with no caller-supplied value acting as identity.

**Owns.** `apps/api/src/auth/`, `apps/api/src/session/`, `packages/storage/src/hosted/identity.ts`, `infra/deployment/oidc.yaml`

**Requirement links.** `REQ-PLT-008`

**Prerequisites.** `TASK-ENG-001`

**Implementation.** `GET /auth/login` issues an OIDC authorization-code request with PKCE (`S256`) and signed `state` and `nonce`; `GET /auth/callback` exchanges the code; `POST /auth/logout` ends the session; `GET /v1/session` reads it. Sessions are server-side rows behind an `HttpOnly`, `Secure`, `SameSite=Lax` cookie, and mutations require a double-submit CSRF token bound to the session. Issuer, client and redirect URI come from deployment configuration, so no provider is chosen in code. `(issuer, subject)` maps to a server-owned opaque `ownerId` on first sign-in and is never re-derived from a body, header or query value.

**Acceptance.** Unauthenticated `POST /v1/projects` returns 401 `UNAUTHORIZED`; a callback with mismatched `state` or a reused code is rejected; a mutation without the CSRF token returns 403 `FORBIDDEN` while the same request with it succeeds; changing an `ownerId` body field does not change the identity used for authorisation.

**Verification.** Environment: local API with a stub OIDC issuer plus hosted PostgreSQL. Command: `pnpm --filter @pomset/api test -- integration/auth`. Observe: cookie attributes, 401/403 responses, owner row created on first sign-in.

**Artifacts.** Login, callback, logout and session handlers, the owner mapping, session/CSRF middleware, deployment identity configuration.

### TASK-HST-003  Expose project, snapshot and scenario routes with synchronous error mapping

**Purpose.** Give the hosted API the same project unit the CLI and workbench use, with one error vocabulary and the fixed status mapping.

**Owns.** `apps/api/src/routes/projects.ts`, `apps/api/src/routes/snapshots.ts`, `apps/api/src/routes/scenarios.ts`, `apps/api/src/errors/httpMapping.ts`

**Requirement links.** `REQ-PRJ-001`, `REQ-ENG-014`

**Prerequisites.** `TASK-HST-002`

**Implementation.** Implement `POST /v1/projects`, `GET /v1/projects`, `GET /v1/projects/{projectId}`, `POST /v1/projects/{projectId}/snapshots`, `GET /v1/projects/{projectId}/snapshots`, `GET /v1/snapshots/{snapshotId}`, `POST /v1/snapshots/{snapshotId}/scenarios`, `GET /v1/scenarios/{scenarioId}`. Every handler validates its body against the portable schemas before touching storage, filters collection reads by owner with opaque cursor pagination in creation-order-then-id order, and serialises failures through one mapping function: 404 missing profile, 400 invalid input or protocol, 422 invalid bundle, 401 unauthenticated, 403 unauthorised, 500 engine or worker failure. Scenario creation validates against the backend capability manifest and rejects rather than repairs.

**Acceptance.** A project created by one owner is absent from another owner's listing and returns 403 when read by id. A scenario naming an undeclared launch parameter is rejected 400 with an `ErrorRecord` naming the field and no partial row. Every failure body uses the same `ErrorRecord` shape as the CLI report.

**Verification.** Environment: hosted API on hosted PostgreSQL with two signed-in owners. Command: `pnpm --filter @pomset/api test -- integration/project-routes`. Observe: status codes, `ErrorRecord` bodies, absence of cross-owner rows.

**Artifacts.** Project, snapshot and scenario handlers, the shared HTTP error mapping, route-level schema validation tests.

### TASK-HST-004  Create immutable snapshots on the hosted store, and edit as a new snapshot

**Purpose.** Make the snapshot the hosted unit of analysis identity, so a result always names the bytes it was produced from.

**Owns.** `packages/storage/src/hosted/snapshots.ts`, `apps/api/src/routes/snapshots.ts`, `packages/storage/src/hosted/hashing.ts`

**Requirement links.** `REQ-PRJ-007`, `REQ-PRJ-008`

**Prerequisites.** `TASK-HST-003`

**Implementation.** Creation uploads an explicit file set, hashes each file's original bytes with SHA-256, then hashes the manifest over its RFC 8785 JCS serialization with the hash field omitted, and stores the manifest immutably. Paths are normalized POSIX relative paths; absolute paths, symlinks, duplicate paths and escaping components are rejected. An edit always creates a child snapshot with `parentSnapshotId` set; no handler mutates a stored manifest, retargets a job or rewrites a result's `snapshotId`. Identical bytes under identical paths yield the same content identity and reuse storage without exposing that reuse across owners.

**Acceptance.** Two identical uploads produce one manifest hash and one stored copy; editing a file creates a child snapshot naming the first as parent while the first manifest and its results are byte-for-byte unchanged; a manifest with `../` or a symlink is rejected 400 and stores nothing.

**Verification.** Environment: hosted API and object store with the hashing fixtures under `docs/contracts/examples/`. Command: `pnpm --filter @pomset/storage test -- snapshots`. Observe: manifest hashes, parent linkage, unchanged first manifest.

**Artifacts.** Snapshot creation and hashing code, the child-snapshot rule, and fixtures covering the escaping and duplicate-path rejections.

### TASK-HST-005  Coordinate jobs with leased rows, heartbeats and fencing tokens

**Purpose.** Make worker death and duplication ordinary events rather than corruption, using leased PostgreSQL rows as the only coordinator.

**Owns.** `apps/worker/src/lease/`, `packages/storage/src/hosted/jobs.ts`, `packages/storage/src/hosted/schema.sql`

**Requirement links.** `REQ-PLT-005`, `REQ-ENG-006`, `REQ-ENG-011`, `REQ-SEC-010`

**Prerequisites.** `TASK-HST-003`

**Implementation.** Add job, attempt, lease and event tables. A worker claims a `queued` row by writing an `attemptId`, a lease expiry and a fencing token, then heartbeats every five seconds; the lease expires after thirty seconds. Every write presents the current token and a stale token is rejected, so a paused worker cannot commit after its lease elapsed. Lease expiry finalises the job `failed` with `WORKER_LOST`. Implemented transitions are exactly `queued`→`running`|`cancelled`|`failed`, `running`→`succeeded`|`failed`|`cancel-requested`, `cancel-requested`→`cancelled`, and terminal states accept none. The worker's database role can read and write job, attempt and event rows for leased work only, holds no identity-provider, billing or publication permission, and cannot read another owner's unleased content.

**Acceptance.** A worker killed mid-job leaves the row `running` until expiry, after which the job is `failed` with `WORKER_LOST` and is not silently re-leased; a resumed worker presenting the pre-expiry token has its write rejected and cannot move the finalised job. The worker role fails an attempted read of another owner's unleased project.

**Verification.** Environment: hosted PostgreSQL plus a worker from the compose deployment with a controllable process stop. Command: `pnpm --filter @pomset/worker test -- integration/lease-fencing`. Observe: heartbeat rows, expiry timestamp, terminal state and error code, rejected stale write.

**Artifacts.** Job/attempt/lease/event schema, the fencing-token check, lease-expiry finalisation, and the worker role's least-privilege grants.

### TASK-HST-006  Commit results and artifacts atomically and retain partial evidence

**Purpose.** Make a finished job and its evidence appear together or not at all, and keep what an interrupted attempt did find.

**Owns.** `apps/worker/src/commit/`, `packages/storage/src/hosted/results.ts`, `packages/storage/src/hosted/events.ts`

**Requirement links.** `REQ-PLT-005`, `REQ-PLT-011`, `REQ-ENG-008`, `REQ-ENG-016`, `REQ-PRJ-013`, `REQ-VAL-011`

**Prerequisites.** `TASK-HST-005`

**Implementation.** Append accepted progress and evidence events in per-job sequence order, never updating or retracting an accepted event. Completion commits result references, artifact references and the terminal state in one transaction; a crash between them leaves the previous state, which the lease resolves. Each immutable result record carries `jobId`, `attemptId`, the snapshot, scenario, domain, policy and profile revisions, the query model revision, the solver version and its artifact references, with findings attached to the result rather than the job. Evidence accepted before a cancellation was recorded is retained with its actual completeness and a partial qualifier and is never promoted to a complete success. Jobs committing no result record a terminal state with zero results.

**Acceptance.** A failure injected between the result insert and the state update leaves the job non-terminal and re-finalisable with no partial result visible. A cancelled job that emitted two findings and one artifact shows them with a partial qualifier beside `state: cancelled`. Re-reading a result yields the same revision triple it committed with, and a validation record is unusable for a different snapshot or profile revision.

**Verification.** Environment: hosted PostgreSQL with an injected failure hook. Command: `pnpm --filter @pomset/worker test -- integration/atomic-commit`. Observe: row visibility before and after the injection, the partial qualifier, stored revision fields.

**Artifacts.** The commit transaction, the appended event log, the partial-evidence rule, and provenance-complete result records.

### TASK-HST-007  Orchestrate worker execution, budgets and the cancel-versus-finish race

**Purpose.** Give a hosted job a bounded process it can always stop, with one deterministic outcome when cancellation and completion race.

**Owns.** `apps/worker/src/execute/`, `apps/worker/src/cancel/`, `apps/worker/src/budgets.ts`

**Requirement links.** `REQ-PLT-007`, `REQ-ENG-007`, `REQ-ENG-009`, `REQ-ENG-011`, `REQ-ENG-012`

**Prerequisites.** `TASK-HST-005`, `TASK-ENG-005`

**Implementation.** Spawn the engine with the deployment-selected argv vector and a supervisor-written read-only request file, and enforce the request budgets (solver time, engine wall time, memory, per-message, output and artifact bytes) on the process and its children. Poll cancellation and lease status at most once per second; on a recorded cancellation send cooperative `cancel`, allow two seconds, then kill the whole process tree. Cancellation is recorded durably and idempotently as a transaction on the leased job row. Completion wins only if it commits before the cancellation request is recorded; afterwards engine death or grace expiry finalises `cancelled`, and lease expiry without a recorded cancellation finalises `failed`. A user rerun creates a new job with a new attempt; nothing resumes a terminal result and no automatic retry exists. A budget breach fails with `ENGINE_FAILED` and the breached limit named, while solver exhaustion yields an `unknown` property result rather than a failure.

**Acceptance.** A completion injected one millisecond after a recorded cancellation yields `cancelled`, not `succeeded`. A kernel exceeding its wall budget is finalised `failed` with `ENGINE_FAILED` and the limit named, while a solver exhausting its own budget produces a `result` whose property outcome is `unknown` under a job that ends `succeeded`. Cancelling twice converges on one state and one event.

**Verification.** Environment: hosted worker with a stub engine that can delay its terminal message. Command: `pnpm --filter @pomset/worker test -- integration/cancel-race`. Observe: terminal state, error code, single convergence.

**Artifacts.** The execution supervisor, budget enforcement, cancellation recording, both terminal-outcome rules, and the race regression fixtures.

### TASK-HST-008  Stream durable job events with `Last-Event-ID` reconnect

**Purpose.** Let a client recover a job's true history after a dropped connection, without inventing progress stages it never received.

**Owns.** `apps/api/src/routes/jobEvents.ts`, `apps/api/src/sse/`, `packages/storage/src/hosted/eventCursor.ts`

**Requirement links.** `REQ-PLT-006`, `REQ-SHR-009`, `REQ-UX-007`

**Prerequisites.** `TASK-HST-006`

**Implementation.** Serve `GET /v1/jobs/{jobId}/events` as SSE over the durable event log, emitting each event with its durable id in the `id` field. A reconnect carrying `Last-Event-ID` is authorised exactly like the initial request and replays every durable event after that id in sequence order. An id outside the retained window returns an explicit expired-cursor signal instructing the client to fetch current job state, never a replay from the beginning and never a synthesised stage. The stream carries the real terminal state so a client renders queued, running, cancel-requested, succeeded, failed and cancelled without a timer. A replay link carried in an event resolves to that job's snapshot, scenario, profile and tool metadata rather than the project's current state.

**Acceptance.** Disconnecting after event 3 and reconnecting with `Last-Event-ID` for event 3 delivers events 4 onward once, in order, with no duplicate and no gap; reconnecting with an expired id returns the expired-cursor signal; a cancelled job's stream ends with the cancelled terminal event after its partial-evidence events.

**Verification.** Environment: hosted API and PostgreSQL with an SSE client that drops the connection mid-stream. Command: `pnpm --filter @pomset/api test -- integration/event-reconnect`. Observe: delivered event ids, expired-cursor signal, terminal event.

**Artifacts.** The SSE handler, the durable event cursor and its retention window, and the reconnect acceptance fixture.

### TASK-HST-009  Store artifacts content-addressed with owner-scoped opaque access

**Purpose.** Separate content identity from access so deduplication and a published hash cannot widen who may read bytes.

**Owns.** `packages/storage/src/hosted/artifacts.ts`, `apps/api/src/routes/artifacts.ts`, `packages/storage/src/hosted/artifactKeys.ts`

**Requirement links.** `REQ-DOM-012`, `REQ-PLT-012`

**Prerequisites.** `TASK-HST-004`

**Implementation.** Store each artifact under its SHA-256 content hash in the object store, and hand consumers an opaque, owner-scoped reference that is the only external name for it. `GET /v1/artifacts/{artifactId}` resolves the reference against the requester's ownership or a publication including it, then streams; the content hash, internal path and object-store key are never credentials. Deduplication stores identical bytes once but each owner gets an independent reference, and no response reveals another owner's possession. Measurement and analysis cache keys include device, tool, environment, model and revision identity, so an entry is served only for the exact same question.

**Acceptance.** Two owners uploading identical bytes receive distinct references; owner A's reference returns 403 for owner B while A's own read succeeds; fetching by content hash alone is not a route; an artifact produced under profile revision P is not returned for a request whose cache key names revision Q.

**Verification.** Environment: hosted API and object store with two signed-in owners. Command: `pnpm --filter @pomset/storage test -- artifacts` plus the cross-owner retrieval check. Observe: distinct references, 403, cache-key mismatch refusal.

**Artifacts.** Content-addressed storage, opaque artifact references, the authorised retrieval handler, and artifact cache-key composition.

### TASK-HST-010  Publish explicitly, preview disclosure, and revoke honestly

**Purpose.** Make publication a deliberate disclosure of one analysed state, and make revoking access visibly distinct from deleting bytes.

**Owns.** `apps/api/src/routes/publications.ts`, `packages/storage/src/hosted/publications.ts`, `apps/api/src/disclosure/preview.ts`

**Requirement links.** `REQ-PRJ-010`, `REQ-PLT-008`, `REQ-SHR-001`, `REQ-SHR-002`, `REQ-SHR-003`, `REQ-SHR-007`, `REQ-SHR-008`, `REQ-SEC-009`, `REQ-UX-015`, `REQ-CLI-010`

**Prerequisites.** `TASK-HST-008`, `TASK-HST-009`

**Implementation.** Everything is owner-private on creation and there is no implicit publication: creating a snapshot, running a job or compiling publishes nothing. `POST /v1/publications` requires an explicit snapshot and an explicit artifact set, and first computes a disclosure preview enumerating categories and counts of what would become visible — source text, file paths, logs, compiler artifacts, witness details, hardware metadata, profile revisions, measurements, findings — which the caller must accept as current; a preview computed before a snapshot change is refused. Publication never implies correctness and preserves coverage, assumptions, budget, evidence class and eligibility. `GET /v1/publications/{publicationId}` returns only the published view, `GET /v1/projects/{projectId}/publications` lists the owner's own, and `DELETE /v1/publications/{publicationId}` denies subsequent server retrieval while API and exported reports state that already obtained copies are not recalled. Reads are authorised per request; a content hash is not a credential. No telemetry or upload accompanies any operation.

**Acceptance.** Publishing without an accepted current preview creates nothing; accepting a preview then editing the snapshot invalidates it and the publish is refused. Unauthenticated retrieval of a private or publication-limited artifact returns 401 or 403. After `DELETE` the publication read returns 403 while the row records `revokedAt`, and no claim is made that downloaded bytes disappeared.

**Verification.** Environment: hosted API with two signed-in owners and one anonymous client. Command: `pnpm --filter @pomset/api test -- integration/publication`. Observe: preview refusal, 401/403, `revokedAt`, exported wording.

**Artifacts.** Publication and disclosure-preview records, publish and revoke handlers, public read authorisation, and the deletion-versus-revocation copy.

### TASK-HST-011  Serve the profile catalogue with support separate from availability

**Purpose.** Answer "is this analysed?" and "is this busy?" as two independent questions, and refuse to invent an answer for an unknown profile.

**Owns.** `apps/api/src/routes/profiles.ts`, `apps/api/src/catalogue/`, `packages/storage/src/hosted/catalogue.ts`

**Requirement links.** `REQ-PLT-001`, `REQ-PLT-002`, `REQ-PLT-003`, `REQ-PLT-004`, `REQ-VAL-008`, `REQ-UX-010`, `REQ-EXP-013`

**Prerequisites.** `TASK-FND-008`

**Implementation.** `GET /v1/profiles` reads the immutable profile revision manifests from foundation and joins them with live deployment state. A manifest records the pinned engine, tool versions, platform and image digest, per-feature support level (`validated`, `limited`, `untested`) and the capability list; live state supplies availability (`immediate`, `queued`, `unavailable`) and never rewrites a support claim, so a validated capability may be `queued` and an available one `untested`. An unknown profile id fails with `PROFILE_NOT_FOUND` and never resolves to a nearby, default or first profile. A requested capability the profile does not declare is reported with the missing component named and, where one exists, the alternative capability or the local path that does support it.

**Acceptance.** A validated-but-busy capability appears `validated`/`queued`; an untested one appears `untested`/`immediate`; job creation with an invented profile id returns 404 `PROFILE_NOT_FOUND`; a synchronization-ordering capability declared `untested` under Triton shows its reason and is not offered as validated.

**Verification.** Environment: hosted API with one validated and one untested manifest and a saturated worker pool. Command: `pnpm --filter @pomset/api test -- integration/catalogue`. Observe: support/availability pairs, 404, reason text.

**Artifacts.** The catalogue endpoint, the support/availability join, the `PROFILE_NOT_FOUND` path, and the capability manifest reader.

### TASK-HST-012  Import bundles into an owned project and reduce engine process privilege

**Purpose.** Let a user bring an experiment in and let the engine run untrusted code without either act gaining authority it should not have.

**Owns.** `apps/api/src/routes/bundles.ts`, `packages/storage/src/hosted/bundleImport.ts`, `infra/sandbox/engine-user/`

**Requirement links.** `REQ-SEC-001`, `REQ-SEC-004`, `REQ-SHR-005`, `REQ-SHR-006`, `REQ-ENG-017`

**Prerequisites.** `TASK-HST-002`, `TASK-HST-005`

**Implementation.** `POST /v1/bundles/import` requires authentication and a `projectId` the caller owns; imported snapshot and result references enter that owner's namespace retaining `origin: imported`, and the import neither publishes nor executes. Validation rejects escaping or absolute paths, symlinks, duplicate and conflicting identities, invalid content hashes, unsupported schema versions, oversized payloads and malformed nesting, with no auto-execution on success, and no contract carries a Python pickle or executable object. Engine processes run as a dedicated non-root identity with no network namespace and a read-only runtime; engines hold no accounts, no publication rights and no network access, and their only inputs are the read-only request file and their allocated scratch.

**Acceptance.** A bundle containing `../secret` or a symlink is rejected 422 `BUNDLE_INVALID` writing nothing; a well-formed bundle imports with provenance intact and appears in no public listing; an engine process for a hosted job has no network route, runs as the engine identity, and cannot read the API's session or database credentials.

**Verification.** Environment: hosted deployment with the malicious-bundle fixtures under `docs/contracts/examples/`. Command: `pnpm --filter @pomset/api test -- integration/bundle-import` plus a namespace inspection inside the running engine container. Observe: 422, provenance, absent credentials.

**Artifacts.** The import endpoint and validator, `origin: imported` labelling, and the engine identity, scratch and network configuration.

### TASK-HST-013  Authorise artifact access per request and define retention classes

**Purpose.** Make every artifact read an authorised decision and make deletion of bytes visibly distinct from revocation of access.

**Owns.** `apps/api/src/artifacts/authorize.ts`, `packages/storage/src/hosted/retention.ts`, `infra/deployment/retention.yaml`

**Requirement links.** `REQ-PLT-012`, `REQ-PLT-015`, `REQ-SEC-007`, `REQ-SEC-010`, `REQ-SHR-007`, `REQ-SHR-008`

**Prerequisites.** `TASK-HST-009`

**Implementation.** Centralise artifact authorisation in one per-request check evaluated against the requester's ownership or a publication including the artifact, refusing possession of a hash, an internal path or an unguessable URL as authorisation. Assign every artifact a retention class — `job`, `project`, `publication` or `permanent` — recorded in its manifest, and implement retention sweeps per class. Keep deleting stored bytes and revoking access as separate operations with separate records and operator documentation: deletion removes content from this deployment and says nothing about third-party copies; revocation denies subsequent server retrieval and says nothing about downloads already made. The worker role cannot read another owner's artifacts and deduplication stays invisible to both owners.

**Acceptance.** A retrieval with a correct content hash but no ownership or publication returns 403; a `job`-class artifact is removed by the job sweep while a `permanent` artifact survives and the sweep record names what it deleted; revoking a publication then reading its artifact returns 403 while the bytes persist under `publication` retention until that class expires.

**Verification.** Environment: hosted PostgreSQL and object store with a compressed retention schedule. Command: `pnpm --filter @pomset/storage test -- retention` plus the authorisation check. Observe: 403, sweep record, surviving artifact.

**Artifacts.** The per-request authorisation check, the retention class field and sweeps, and the deletion-versus-revocation operator documentation.

### TASK-HST-014  Define the free CPU tier quotas and record measured capacity

**Purpose.** Bound the public tier's cost with declared quotas and publish only capacity this deployment has been measured at.

**Owns.** `apps/api/src/quota/`, `packages/storage/src/hosted/quota.ts`, `infra/deployment/quota.yaml`

**Requirement links.** `REQ-PLT-009`, `REQ-PLT-010`

**Prerequisites.** `TASK-HST-007`

**Implementation.** Declare the free CPU tier's limits — concurrent jobs per owner, total job wall time per period, artifact storage per owner — in configuration, and enforce them at job admission with an explicit `FORBIDDEN` carrying the exhausted quota name and its reset time. Paid and unlimited tiers are out of scope. Measure capacity as observed series for job throughput, queue latency and artifact growth, written to a capacity record with the deployment revision, image digest and measurement window. No availability percentage, latency target or adoption projection is published unless measured on the deployment it describes; the public capacity page is generated from the record and states its window.

**Acceptance.** A fourth concurrent job from an owner at a three-job quota is refused with the quota named and no job row created while the existing three continue. The published capacity page's figures match the record for the stated window and render a short window honestly rather than extrapolating.

**Verification.** Environment: hosted deployment under a load generator submitting jobs from several owners for a fixed window. Command: `pnpm --filter @pomset/api test -- integration/quota` plus the capacity-record regeneration step. Observe: `FORBIDDEN` body, unchanged job count, matching page figures.

**Artifacts.** Quota configuration and enforcement, the quota-exhaustion error path, and the measured capacity record with its generator.

### TASK-HST-015  Deploy the API and workers without a proprietary queue service

**Purpose.** Make the hosted deployment reproducible from PostgreSQL, an S3-compatible object store, the API and workers alone, keeping the public tier portable and affordable.

**Owns.** `infra/deployment/compose.yaml`, `infra/deployment/`, `apps/api/src/server.ts`, `apps/worker/src/main.ts`

**Requirement links.** `REQ-PLT-013`

**Prerequisites.** `TASK-HST-014`

**Implementation.** Define the deployment so the only external services are PostgreSQL and an S3-compatible object store; job coordination stays on leased rows in PostgreSQL and no managed queue, broker or vendor scheduler is required. Provide API and worker as separate processes from the same images, with health and readiness endpoints, migrations on deploy and graceful worker shutdown that releases its lease. Images are pinned by digest and the deployment records the exact image, migration and configuration revision it started with. This task adds no second storage implementation and no second job coordinator.

**Acceptance.** The deployment starts from one compose invocation with PostgreSQL and a local S3-compatible store, accepts, executes and results a job with no other service present. Killing and restarting the worker leaves the job's terminal state consistent after lease expiry. A deployment configured without the S3-compatible store fails readiness rather than falling back to local disk for artifacts.

**Verification.** Environment: a clean host with a container runtime and no cloud credentials. Command: `docker compose -f infra/deployment/compose.yaml up` then a scripted job submission and worker restart. Observe: result returned, consistent terminal state, readiness failure without the object store.

**Artifacts.** Compose and image definitions, migration and readiness wiring, and the recorded deployment revision.

### TASK-HST-016  Build the gVisor sandbox image and its preflight probe

**Purpose.** Establish by experiment, not assumption, that the hosted interpreter, numerical libraries and solver actually run inside the isolation the deployment claims.

**Owns.** `infra/sandbox/image/`, `infra/sandbox/preflight/`, `packages/engine-client/src/preflight.ts`

**Requirement links.** `REQ-SEC-001`, `REQ-SEC-002`, `REQ-SEC-006`

**Prerequisites.** `TASK-HST-001`

**Implementation.** Build a Linux OCI image running under gVisor (`runsc`) with no network, a non-root identity, a read-only runtime and bounded writable scratch and cache sized from the request budget. Add a preflight probe that, inside that image, starts the pinned Python interpreter, imports the pinned numerical libraries, runs a fixed solver query to a known answer, and exercises the compilation path, each in fresh scratch with a bounded cache, and writes a probe record with the image digest, each tool version, the observed outcome and elapsed time. Redact recognized secret patterns from captured probe output so no credential reaches logs or artifacts. Where the probe cannot demonstrate a step, the affected capability is unavailable; isolation is never weakened to make it pass and the step is never run unsandboxed.

**Acceptance.** A probe run records the image digest, interpreter, numerical-library and solver versions and a passing outcome per step. An outbound connection attempted inside the network-disabled sandbox fails. Removing a required library makes the probe fail and the capability unavailable with no fallback execution attempted.

**Verification.** Environment: a Linux host with gVisor installed and the built image. Command: the preflight runner against the image digest followed by the sandbox escape fixtures. Observe: the probe record and the absence of any unsandboxed process.

**Artifacts.** The sandbox image definition, the preflight probe and its record, the scratch and cache layout, and the output redaction rules.

### TASK-HST-017  Gate hosted Triton replay on the preflight record

**Purpose.** Make one hosted capability — Triton interpreter and numerical replay — available only where the probe demonstrated it, and keep that fact in the profile revision.

**Owns.** `apps/api/src/catalogue/preflightGate.ts`, `profiles/hosted/triton/replay.gate.json`, `packages/engine-client/src/preflight.ts`

**Requirement links.** `REQ-SEC-002`

**Prerequisites.** `TASK-HST-016`

**Implementation.** Record each hosted Triton profile revision as naming the image digest and preflight probe record its replay capability was admitted on, and resolve replay availability from the latest probe for that exact digest: a passing probe yields `immediate` or `queued`, a failing or absent one yields `unavailable` with the failing step named. Pure symbolic parsing and query capabilities resolve independently, so an unavailable replay never disables static analysis. A newer image digest makes the recorded probe stale and returns the capability to `unavailable` until a probe for the new digest passes; no operator flag or configuration override sets it available without a probe. Hosted replay stays labelled a modelling and numerical mechanism, not evidence of GPU scheduling or GPU speed.

**Acceptance.** With a passing probe for the deployed digest a Triton replay job is accepted and completes; with a probe record for an older digest replay reports `unavailable` while the symbolic query capability stays `immediate`; deleting the probe record makes replay unavailable on the next catalogue read with no deployment change.

**Verification.** Environment: the hosted deployment with two probe records for different image digests. Command: `pnpm --filter @pomset/api test -- integration/preflight-gate`. Observe: availability per digest, unaffected query capability, stale record effect.

**Artifacts.** The replay preflight gate, the profile revision field naming its probe record, and the catalogue read path resolving availability from it.
