# ADR-0005  Snapshots and artifacts

## Context

A result belongs to the snapshot that was analysed, even after the source
changes. Two owners may hold byte-identical content and must not learn that
about each other. An artifact may be superseded, withdrawn from public access,
or deleted, and those are different operations. A content hash is a good
identity and a terrible credential.

## Decision

- **Identity is content.** Original file bytes are hashed with SHA-256. The
  manifest is hashed separately, over its UTF-8 serialization under RFC 8785
  (JSON Canonicalization Scheme), with normalized POSIX relative paths and no
  symlinks; the manifest hash field itself is omitted from the input.
- **Snapshots are immutable.** Editing creates a new snapshot with a parent
  reference. A job, result or artifact names the snapshot it belongs to and is
  never retargeted.
- **Artifacts are immutable manifests**: kind, content hash, byte size, media
  type, producing revision, retention class.
- **Ownership is separate from content identity.** Artifacts are addressed by an
  opaque, owner-scoped `artifactId`; the content hash is internal. Authorization
  is per request against ownership or an including publication. Internal
  deduplication must not reveal that another owner holds identical bytes.
- **Retention is per artifact class**, and deleting stored bytes is distinct from
  revoking access to a publication.

## Consequences

- Analysis and measurement cache keys are exact identity comparisons: snapshot,
  scenario, domain, policy and profile revision, plus device, tool and
  environment for measurements. No reuse across differing identity.
- Revocation can be stated honestly: subsequent server retrieval is denied;
  copies already downloaded are not claimed to have vanished.
- The same snapshot may legitimately produce different results under a newer
  query model or solver version, and the difference is reported rather than
  hidden.

## Validation obligations

- Verify that a manifest hash is stable across serialization orders and
  whitespace, and that a single-byte change to any file changes the snapshot
  identity.
- Verify that two owners holding identical bytes cannot retrieve each other's
  artifact, and that guessing a hash grants nothing.

## Links

Requirements: [`REQ-PRJ-007`](../srs/projects.md), `REQ-PRJ-008`,
[`REQ-SHR-002`](../srs/sharing.md), `REQ-SHR-007`, `REQ-SHR-008`,
[`REQ-PLT-012`](../srs/platform.md), `REQ-PLT-015`, `REQ-SEC-007`.
Specification: [`../architecture/lifecycle.md`](../architecture/lifecycle.md).
Schema: [`packages/contracts/schema/domain.schema.yaml`](../../packages/contracts/schema/domain.schema.yaml).
