# ADR-0011  Private local and publication

## Context

Kernels are often proprietary. A CI check that uploads source is unusable in a
company, and a report that carries a hardware serial or an internal path can leak
more than the source it summarises. At the same time, the product's value partly
comes from sharing a reproducible failure with a colleague, a maintainer or a
researcher.

Running a job and sharing its output are therefore different acts, and a local
viewer must not become a remote execution surface.

## Decision

- **Offline operation is first-class.** The CLI analyses source, stores results
  and renders reports with no network and no account. There is no telemetry and
  no implicit upload.
- **Private by default.** Every project, snapshot, job, result and artifact is
  owner-private on creation.
- **Publication is explicit**: one immutable snapshot plus an explicitly selected
  set of artifacts.
- **A disclosure preview is mandatory** and enumerates what would become
  visible — source text, file paths, logs, compiler artifacts, witness details,
  hardware metadata, profile revisions, measurements and findings — by category
  and count. A stale preview after a snapshot change is refused.
- **Access is authorized per request.** Content hashes are internal identifiers,
  never credentials.
- **Revocation is honest**: it denies subsequent server retrieval and does not
  claim that already-downloaded copies disappeared.
- **The local viewer is read-only.** It binds to loopback, validates Host and
  Origin, disables cross-origin access, requires a random local read capability
  for private report APIs, and exposes no route that starts, compiles or executes
  anything. Opening a report, a bundle or a URL never authorises execution.

## Consequences

- A team can adopt the CI check without a procurement conversation about source
  leaving the network.
- A shared link is trustworthy because it names an immutable snapshot and
  because its preview was seen before it was published.
- The product cannot promise that an unpublished leak is impossible, but it can
  state exactly what it does and does not guarantee, which is the useful
  guarantee.
- No web-to-local execution path exists to be secured later, because none is
  built.

## Validation obligations

- Verify that a private project, result or artifact cannot be retrieved
  anonymously or by another owner, and that a published one can.
- Verify that publication without an accepted, current disclosure preview is
  refused.
- Verify that opening a report or bundle, and reaching a loopback URL without its
  read capability, never triggers execution.
- Verify that no command outside the local consent flag executes user code.

## Links

Requirements: [`REQ-SHR-001`](../srs/sharing.md) …
`REQ-SHR-010`, [`REQ-CLI-007`](../srs/local-ci.md) …
`REQ-CLI-011`, [`REQ-SEC-003`](../srs/security.md), `REQ-SEC-009`.
Specification: [`../architecture/local-ci.md`](../architecture/local-ci.md),
[`../architecture/security-and-deployment.md`](../architecture/security-and-deployment.md).

## Local workstation amendment

[ADR-0013](0013-local-symbolic-workstation.md) adds an explicitly launched symbolic
workstation alongside the read-only CLI viewer. It accepts source-as-data analysis
requests, never kernel execution requests. Its disclosure preview downloads a
portable report; hosted publication and revocation remain separate operations.
