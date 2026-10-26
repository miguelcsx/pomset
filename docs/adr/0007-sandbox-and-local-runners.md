# ADR-0007  Sandbox and local runners

## Context

A hosted service that runs arbitrary user Python and native compiler toolchains
is running hostile code by design. Ordinary process isolation is not enough for
that, and it is even less adequate for GPU work, where untrusted programs
interact with drivers and accelerator resources. The reference implementation
reads its sandbox type from configuration and **defaults to none**, which is a
permissive default rather than an isolation guarantee.

At the same time, a GPU is a machine someone owns. Running user kernels on a
hosted GPU pool would mean accepting untrusted code next to hardware resources
on infrastructure the project operates, which the selected scope rules out.

## Decision

- **Hosted CPU-only execution runs in Linux OCI isolation** with gVisor/runsc: no
  network, non-root identity, read-only runtime, bounded scratch, bounded
  memory, bounded wall clock, bounded output and artifact sizes.
- **Fail closed.** When the sandbox is unavailable or a tool cannot run inside
  it, the profile capability is marked unavailable. There is no unsandboxed
  fallback, not even behind a flag.
- **Sandbox compatibility is a preflight gate.** A hosted profile that needs
  execution is offered only after its interpreter, libraries and compilation
  path have been demonstrated to work inside the deployed image with bounded
  writable scratch and cache. The image digest is recorded in the profile
  revision.
- **GPU jobs run only on user-operated local runners** under explicit per-run
  consent. There is no hosted GPU pool, no web-to-local job submission, and no
  runner pairing infrastructure.
- **The supervisor enforces limits and owns termination.** The engine is
  cooperative about cancellation; the kill is not optional.
- **Workers hold least privilege**: job-lifecycle database and object-store
  permissions only, no identity-provider or billing credentials, no access to
  another owner's artifacts or an unleased project's content.

## Consequences

- Public CPU analysis can be offered free within declared quotas without exposing
  the operator to arbitrary code execution on shared infrastructure.
- Some tools may not run under gVisor. Those profiles stay unavailable hosted,
  and local mode is offered as the honest alternative rather than a weakened
  sandbox.
- GPU features are only demonstrable by a user who has the hardware, which is
  acceptable: a missing device is a documented blocker, not a fabricated result.
- The isolation boundary is testable, because it is a specific image and a
  specific runtime, with a recorded digest.

## Validation obligations

- Demonstrate that a malicious import, an infinite loop, an attempted network
  access, an escaping artifact path, an oversized output and a cross-user
  artifact read are each denied or contained within the configured budgets.
- Demonstrate that a failed sandbox preflight makes a capability unavailable
  rather than available-unsandboxed.

## Links

Requirements: [`REQ-SEC-001`](../srs/security.md) …
`REQ-SEC-012`, [`REQ-PLT-014`](../srs/platform.md), `REQ-CLI-009`,
`REQ-CLI-011`.
Specifications: [`../architecture/security-and-deployment.md`](../architecture/security-and-deployment.md).
Reference: [`../reference/compiler-explorer.md`](../reference/compiler-explorer.md).

## Local symbolic workstation amendment

[ADR-0013](0013-local-symbolic-workstation.md) permits a separately launched,
capability-gated loopback AST/Z3 application. It treats source as data and executes
no user code. The hosted execution sandbox and native runner consent rules above
remain in force; `pomset serve` remains read-only.
