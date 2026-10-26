# Sharing and publication — `SHR`

Private by default, published deliberately, revoked honestly. Sources:
`SRC-012`, `SRC-037`, `SRC-047`.

### REQ-SHR-001  Private by default

**Statement.** Every project, snapshot, job, result, measurement and artifact SHALL
be private to its owner on creation, and SHALL NOT become retrievable by anyone
else until an explicit publication exists.

**Rationale.** `SRC-012`. Running a job and publishing its output are different
acts.

**Acceptance.** `ACC-008`.

**Scope.** Enforced server-side; the UI cannot be the enforcement point.

**Implemented by.** `TASK-HST-010`.

**ADRs.** [ADR-0011](../adr/0011-private-local-and-publication.md), [ADR-0005](../adr/0005-snapshots-and-artifacts.md)  Specification: [`../architecture/lifecycle.md`](../architecture/lifecycle.md).

**Contracts.** `Publication`.

### REQ-SHR-002  Publication selects an immutable snapshot and named artifacts

**Statement.** A publication SHALL name exactly one snapshot and the explicit set
of artifacts it exposes. Nothing is included by implication, and nothing attached
to the project later joins an existing publication.

**Rationale.** `SRC-037`. A publication is a statement about one analysed state.

**Acceptance.** `ACC-008`.

**Scope.** A later edit creates a new snapshot that is unpublished.

**Implemented by.** `TASK-HST-010`, `TASK-WEB-016`.

**ADRs.** [ADR-0011](../adr/0011-private-local-and-publication.md), [ADR-0005](../adr/0005-snapshots-and-artifacts.md)  Specification: [`../architecture/lifecycle.md`](../architecture/lifecycle.md).

**Contracts.** `Publication.artifactIds`.

### REQ-SHR-003  Disclosure preview precedes publication

**Statement.** Before a publication is created, Pomset SHALL compute and show a
disclosure preview enumerating the categories and counts of information that would
become visible — at least source text, file paths, logs, compiler artifacts,
witness details, hardware metadata, profile revisions, measurements and findings —
and SHALL refuse to publish without an accepted, current preview.

**Rationale.** `SRC-037`. A developer must see what they are about to reveal,
including things they forgot were in the report.

**Acceptance.** `ACC-008`.

**Scope.** A stale preview after a snapshot change is refused.

**Implemented by.** `TASK-HST-010`, `TASK-WEB-016`.

**ADRs.** [ADR-0011](../adr/0011-private-local-and-publication.md), [ADR-0005](../adr/0005-snapshots-and-artifacts.md)  Specification: [`../architecture/lifecycle.md`](../architecture/lifecycle.md).

**Contracts.** `DisclosurePreview`.

### REQ-SHR-004  Portable bundles are replayable and self-describing

**Statement.** A Pomset bundle SHALL carry the portable records needed to read the
experiment offline, the profile revisions used, the required tools and hardware,
and the provenance of its origin, so that a replay can be attempted elsewhere and
any difference in tools or hardware identified.

**Rationale.** `SRC-037`. A shareable experiment that cannot be rerun is a
screenshot.

**Acceptance.** `ACC-010`.

**Scope.** Replay requiring a missing tool produces an explicit blocked result.

**Implemented by.** `TASK-PRS-006`.

**ADRs.** [ADR-0011](../adr/0011-private-local-and-publication.md), [ADR-0005](../adr/0005-snapshots-and-artifacts.md)  Specification: [`../architecture/lifecycle.md`](../architecture/lifecycle.md).

**Contracts.** `ExperimentBundle`.

### REQ-SHR-005  Bundle import never executes and never publishes

**Statement.** Importing a bundle SHALL validate it, reject escaping paths,
symlinks, conflicting identities, invalid hashes and unsupported schema versions,
and SHALL NOT execute any code it contains, publish anything, or grant access to
anything.

**Rationale.** `SRC-027`. An imported bundle is untrusted input from an
untrusted source.

**Acceptance.** `ACC-005`, `ACC-008`.

**Scope.** Imported records retain `origin: imported` permanently.

**Implemented by.** `TASK-HST-012`, `TASK-SEC-004`.

**ADRs.** [ADR-0004](../adr/0004-contract-authority.md), [ADR-0011](../adr/0011-private-local-and-publication.md)  Specification: [`../architecture/lifecycle.md`](../architecture/lifecycle.md).

**Contracts.** `ExperimentBundle`, `BUNDLE_INVALID`.

### REQ-SHR-006  Imported evidence cannot impersonate server validation

**Statement.** Imported evidence SHALL be labelled `origin: imported` and SHALL
remain distinguishable from server-produced validation under every presentation,
export and policy evaluation.

**Rationale.** `SRC-021`, `SRC-037`. Provenance completeness is not authenticity.

**Acceptance.** `ACC-005`, `ACC-006`.

**Scope.** An explicit user policy may admit imported local evidence while keeping
its origin and evidence class visible.

**Implemented by.** `TASK-PRS-002`, `TASK-HST-012`.

**ADRs.** [ADR-0011](../adr/0011-private-local-and-publication.md), [ADR-0005](../adr/0005-snapshots-and-artifacts.md)  Specification: [`../architecture/lifecycle.md`](../architecture/lifecycle.md).

**Contracts.** `AnalysisResult.origin`.

### REQ-SHR-007  Access-controlled retrieval of publications

**Statement.** Retrieval of a published result or artifact SHALL be authorized per
request against the publication's visibility and the caller's identity, and an
opaque content hash SHALL NOT function as an access credential.

**Rationale.** `SRC-037`. Two owners may legitimately hold identical bytes, and
neither may learn that from a shared hash.

**Acceptance.** `ACC-008`.

**Scope.** Internal deduplication must not reveal another owner's possession of
identical bytes.

**Implemented by.** `TASK-HST-010`, `TASK-HST-013`.

**ADRs.** [ADR-0011](../adr/0011-private-local-and-publication.md), [ADR-0005](../adr/0005-snapshots-and-artifacts.md)  Specification: [`../architecture/lifecycle.md`](../architecture/lifecycle.md).

**Contracts.** `Publication.visibility`, `FORBIDDEN`.

### REQ-SHR-008  Revocation denies future retrieval, not past downloads

**Statement.** Revoking a publication SHALL deny subsequent server-side retrieval
of its artifacts, and Pomset SHALL NOT claim or imply that copies already obtained
or rendered by a third party have disappeared.

**Rationale.** `SRC-037`, `SRC-012`. An honest statement about what revocation does
is part of the contract.

**Acceptance.** `ACC-008`.

**Scope.** Retention and deletion of stored bytes are separate from access
revocation; see [`../architecture/lifecycle.md`](../architecture/lifecycle.md).

**Implemented by.** `TASK-HST-010`, `TASK-HST-013`.

**ADRs.** [ADR-0011](../adr/0011-private-local-and-publication.md), [ADR-0005](../adr/0005-snapshots-and-artifacts.md)  Specification: [`../architecture/lifecycle.md`](../architecture/lifecycle.md).

**Contracts.** `Publication.revokedAt`.

### REQ-SHR-009  Replay links preserve metadata

**Statement.** A link to a replayed experiment SHALL preserve the snapshot,
scenario, profile revision and tool metadata it was created with, and SHALL NOT
resolve to the project's current state.

**Rationale.** `SRC-037`, `SRC-012`.

**Acceptance.** `ACC-008`, `ACC-010`.

**Scope.** A link to an unpublished experiment resolves only for its owner.

**Implemented by.** `TASK-HST-008`, `TASK-WEB-016`.

**ADRs.** [ADR-0011](../adr/0011-private-local-and-publication.md), [ADR-0005](../adr/0005-snapshots-and-artifacts.md)  Specification: [`../architecture/lifecycle.md`](../architecture/lifecycle.md).

**Contracts.** `Publication`, `AnalysisResult`.

### REQ-SHR-010  Publication does not imply correctness

**Statement.** A published report SHALL preserve every qualifier of the evidence it
contains — coverage, assumptions, budget, evidence class and eligibility — and
publishing SHALL NOT be presented as an endorsement of the kernel's correctness.

**Rationale.** `SRC-004`, `SRC-012`.

**Acceptance.** `ACC-008`.

**Scope.** Applies to public views, exported bundles and shared links.

**Implemented by.** `TASK-WEB-016`, `TASK-PRS-006`.

**ADRs.** [ADR-0011](../adr/0011-private-local-and-publication.md), [ADR-0005](../adr/0005-snapshots-and-artifacts.md)  Specification: [`../architecture/lifecycle.md`](../architecture/lifecycle.md).

**Contracts.** `Assumptions`, `Coverage`, `Budget`.
